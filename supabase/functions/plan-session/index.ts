import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { OpenAI } from 'https://deno.land/x/openai@v4.24.1/mod.ts'

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { task, timeBlockMinutes, sessions } = await req.json()

    // Validate request
    if (!task || !timeBlockMinutes || !sessions) {
      throw new Error('Missing required data')
    }

    // Create prompt for GPT
    const prompt = `
You are an AI assistant helping to plan a Pomodoro session. Analyze the historical session data and suggest an optimal pattern.

Task: ${task}
Available Time: ${timeBlockMinutes} minutes

Recent Sessions:
${sessions.slice(0, 3).map(session => `
Session Pattern: ${session.pattern}
Goals: ${session.goals}
Rounds:
${session.rounds.map(round => `- ${round.duration}min: ${round.notes || 'No notes'}`).join('\n')}`
).join('\n\n')}

Based on this data, suggest a Pomodoro cycle pattern that:
1. Fits within the ${timeBlockMinutes} minute time block
2. Accounts for patterns in historical session data
3. Considers the goals and notes from previous sessions

Provide your response in JSON format with:
- pattern: string (e.g. "25-5-25-5-25-15")
- explanation: string explaining the rationale`

    // Call GPT-4 for session planning
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a Pomodoro session planning assistant. Analyze session history and suggest optimal patterns.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    })

    const plan = JSON.parse(completion.choices[0].message.content)

    return new Response(JSON.stringify(plan), {
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}