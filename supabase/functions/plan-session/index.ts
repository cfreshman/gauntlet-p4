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
    const { task, timeBlockMinutes, goals, sessions } = await req.json()

    // Validate request
    if (!task || !timeBlockMinutes || !sessions) {
      throw new Error('Missing required data')
    }

    // Create prompt for GPT
    const prompt = `
You are an AI assistant helping to plan a Pomodoro session. Analyze the historical session data and suggest an optimal pattern.

Do not bullshit the user. Do not spew fucking bullshit. The pattern needs to actually make sense for the user and what would be effective in the situation.
The pattern doesn't need to perfectly fit the time block, but, considering that the pattern repeats when complete, the end of the time block should coincide with the end of a break.
The patterns are specified as an even number of numbers separated by dashes like 50-10 or 25-5-20-10 or the classic 25-5-25-5-25-5-25-15, where even indices are focus rounds (work) and odd indices are break rounds.
The pattern should be written in its shortest form, e.g. 50-10-50-10 as 50-10. AGAIN, DO NOT REPEAT A PATTERN WITHIN THE PATTERN. the final pattern should be irreducible.
Rounds must be at least 1 minute long.

Task: ${task}
Available Time: ${timeBlockMinutes} minutes
Goals: ${goals || 'No specific goals provided'}

Recent Sessions:
${sessions.slice(0, 50).map(session => `
Session Pattern: ${session.pattern}
Goals: ${session.goals}
Rounds:
${session.rounds.map(round => `- ${round.duration}min: ${round.notes || 'No notes'}`).join('\n')}`
).join('\n\n')}

Based on this data, suggest a Pomodoro cycle pattern that:
1. Fits within the ${timeBlockMinutes} minute time block
2. Accounts for patterns in historical session data
3. Considers the goals and notes from previous sessions
4. Is appropriate for the current session goals

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