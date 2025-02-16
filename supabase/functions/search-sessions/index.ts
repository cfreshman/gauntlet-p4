import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { OpenAI } from 'https://deno.land/x/openai@v4.24.1/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const { query, userId } = await req.json()

    if (!query || !userId) {
      throw new Error('Missing required parameters')
    }

    // Get query embedding
    const queryEmbedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query
    })

    // Search for matching sessions and rounds using stored embeddings
    const { data: matchingSessions, error: sessionError } = await supabase.rpc(
      'search_sessions',
      {
        query_embedding: queryEmbedding.data[0].embedding,
        similarity_threshold: 0.1,
        user_id: userId
      }
    )

    if (sessionError) throw sessionError

    const { data: matchingRounds, error: roundError } = await supabase.rpc(
      'search_rounds',
      {
        query_embedding: queryEmbedding.data[0].embedding,
        similarity_threshold: 0.1,
        user_id: userId
      }
    )

    if (roundError) throw roundError

    // Process results to create session view models
    const sessionMap = new Map()

    // First pass: Add matching sessions and initialize with direct match scores
    matchingSessions.forEach(result => {
      sessionMap.set(result.id, {
        id: result.id,
        goals: result.goals,
        pattern: result.pattern,
        created_at: result.created_at,
        match_type: 'session',
        session_score: Math.round(result.similarity * 100),
        highest_round_score: 0,
        overall_score: Math.round(result.similarity * 100),
        rounds: [],
        matching_rounds: []
      })
    })

    // Second pass: Process matching rounds and update session scores
    matchingRounds.forEach(result => {
      const sessionId = result.session_id
      const roundScore = Math.round(result.similarity * 100)
      const round = {
        id: result.id,
        duration: result.duration,
        notes: result.notes,
        started_at: result.started_at,
        pattern_position: result.pattern_position,
        task: { name: result.task_name },
        score: roundScore
      }

      let session = sessionMap.get(sessionId)
      if (!session) {
        // Initialize session if not already in map
        session = {
          id: sessionId,
          goals: result.session_goals,
          pattern: result.session_pattern,
          created_at: result.session_created_at,
          match_type: 'round',
          session_score: 0,
          highest_round_score: roundScore,
          overall_score: roundScore,
          rounds: [],
          matching_rounds: []
        }
        sessionMap.set(sessionId, session)
      } else {
        // Update highest round score if this round has a higher score
        if (roundScore > session.highest_round_score) {
          session.highest_round_score = roundScore
          session.overall_score = Math.max(session.session_score, roundScore)
        }
      }

      // Always add matching rounds to the matching_rounds array
      session.matching_rounds.push(round)
    })

    // For sessions that matched at session-level or have high-scoring rounds, fetch all their rounds
    const sessionsToFetch = Array.from(sessionMap.values())
      .filter(s => s.match_type === 'session' || s.highest_round_score > 80)
      .map(s => s.id)

    if (sessionsToFetch.length > 0) {
      const { data: fullRounds } = await supabase
        .from('rounds')
        .select(`
          id,
          duration,
          notes,
          started_at,
          pattern_position,
          session_id,
          task:tasks (
            id,
            name
          )
        `)
        .in('session_id', sessionsToFetch)
        .order('started_at')

      // Add all rounds to matching sessions
      fullRounds?.forEach(round => {
        const session = sessionMap.get(round.session_id)
        if (session?.match_type === 'session') {
          // For direct session matches, include all rounds but mark matching ones
          const matchingRound = session.matching_rounds.find(r => r.id === round.id)
          session.rounds.push({
            ...round,
            score: matchingRound?.score
          })
        }
      })
    }

    // Convert map to array and sort by overall score
    const processedResults = Array.from(sessionMap.values())
      .sort((a, b) => b.overall_score - a.overall_score)

    // Get AI analysis and filtering of the search results
    const analysis = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are analyzing search results from a Pomodoro timer app. The results are from a semantic search with a low similarity threshold. Your task is to:

1. Filter out irrelevant matches using STRICT criteria:
   - For sessions: Include ONLY if the goals/pattern are DIRECTLY related to the query (e.g. for query "bug fixes", goals must explicitly mention bugs/fixes/debugging)
   - For rounds: Include ONLY if the task name or notes DIRECTLY relate to the query (e.g. for "bug fixes", must mention bugs/fixes/debugging)
   - Do NOT include items that are only tangentially or potentially related
   - When in doubt, exclude rather than include
   - IMPORTANT: You MUST include in relevant_ids:
     * Session IDs when their goals directly match
     * Round IDs when their task name or notes directly match
     * Both can be included independently - a session can match without its rounds matching, and rounds can match without their session matching
2. Provide a BRIEF, 1-2 sentence summary of the key findings
3. Offer 2-3 specific, actionable insights that would be valuable to the user
4. Be direct and concise - no lengthy explanations

Provide your analysis as a JSON object with the structure:
{
  "summary": string, // 1-2 sentence overview of relevant results
  "insights": string[], // 2-3 actionable insights, each 1 sentence long
  "relevant_ids": string[] // Array of relevant session and round IDs - MUST include both matching session IDs and matching round IDs
}`
        },
        {
          role: 'user',
          content: `Analyze these search results, filtering out anything not DIRECTLY related to the query. Be strict - only include exact matches or very close semantic equivalents.

Search query: "${query}"

Raw results (needs filtering):
${processedResults.map(r => `
Session ID: ${r.id}
Session Date: ${new Date(r.created_at).toLocaleDateString()}
Goals: ${r.goals}
Pattern: ${r.pattern}
Match Type: ${r.match_type}
Score: ${r.score}%
Rounds:
${r.rounds.map(round => `  - ID: ${round.id}
    Task: ${round.task?.name}
    Notes: ${round.notes}
    Score: ${round.score}%`).join('\n')}
Matching Rounds:
${r.matching_rounds.map(round => `  - ID: ${round.id}
    Task: ${round.task?.name}
    Notes: ${round.notes}
    Score: ${round.score}%`).join('\n')}`).join('\n')}`
        }
      ],
      response_format: { type: 'json_object' }
    })

    const llmResponse = JSON.parse(analysis.choices[0].message.content)
    
    // Convert relevant IDs to a Set for O(1) lookups
    const relevantIds = new Set(llmResponse.relevant_ids)
    
    // Filter results based on LLM analysis
    const filteredResults = processedResults.map(session => {
      const isSessionRelevant = relevantIds.has(session.id)
      const relevantRounds = session.matching_rounds.filter(round => 
        relevantIds.has(round.id)
      )

      if (isSessionRelevant) {
        // If session is relevant, keep all rounds
        return {
          id: session.id,
          goals: session.goals,
          pattern: session.pattern,
          created_at: session.created_at,
          match_type: 'session',
          rounds: session.rounds.map(round => ({
            id: round.id,
            duration: round.duration,
            notes: round.notes,
            started_at: round.started_at,
            pattern_position: round.pattern_position,
            task: round.task
          }))
        }
      } else if (relevantRounds.length > 0) {
        // Session isn't relevant but has relevant rounds
        return {
          id: session.id,
          goals: session.goals,
          pattern: session.pattern,
          created_at: session.created_at,
          match_type: 'round',
          matching_rounds: relevantRounds.map(round => ({
            id: round.id,
            duration: round.duration,
            notes: round.notes,
            started_at: round.started_at,
            pattern_position: round.pattern_position,
            task: round.task
          }))
        }
      }
      return null
    }).filter(Boolean)

    return new Response(JSON.stringify({
      results: filteredResults,
      analysis: {
        summary: llmResponse.summary,
        insights: llmResponse.insights
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}) 