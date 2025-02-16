import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { OpenAI } from 'https://deno.land/x/openai@v4.24.1/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessions, currentTask, message, userId } = await req.json()

    // If message is 'header', generate header analysis
    if (message === 'header') {
      const headerPrompt = `You are an AI productivity assistant. BE CONCISE. Look at their Pomodoro history and help them work better.

Return response as JSON:
{
  "message": "your thoughts",
  "imagePrompt": "dall-e prompt"
}

The message should be a natural response that helps the user improve their productivity.
The imagePrompt should describe a visual that represents their work patterns or goals.

Current Task: ${currentTask?.name || 'No task selected'}

Recent Sessions:
${sessions.slice(0, 50).map(session => `
Pattern: ${session.pattern}
Goals: ${session.goals}
Rounds:
${session.rounds.map(round => `- ${Math.round(round.duration / 60)}min: ${round.notes || 'No notes'}`).join('\n')}`
).join('\n\n')}`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an AI productivity assistant analyzing Pomodoro session data.'
          },
          {
            role: 'user',
            content: headerPrompt
          }
        ],
        response_format: { type: 'json_object' }
      })

      const headerData = JSON.parse(completion.choices[0].message.content)

      // Generate image
      const image = await openai.images.generate({
        model: 'dall-e-3',
        prompt: headerData.imagePrompt,
        size: '1792x1024',
        quality: 'standard',
        style: 'natural'
      })

      return new Response(JSON.stringify({
        message: headerData.message,
        imageUrl: image.data[0].url,
        cachedAt: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Handle chat messages
    const chatPrompt = `You are an AI productivity assistant. BE CONCISE.

Return response as JSON array. You can include one or both types of messages:

1. Text response:
{
  "type": "text",
  "content": "your response"
}

2. Session suggestion
{
  "type": "session",
  "content": "explain why you're suggesting this pattern",
  "pattern": "work-break times in numbers, like 25-5 or 50-10",
  "goals": "what they should focus on in this session"
}

Example response with both types:
[
  {
    "type": "text",
    "content": "I notice you work best in 50 minute blocks when coding."
  },
  {
    "type": "session",
    "content": "Since you're working on a complex task, let's try a longer focus period",
    "pattern": "50-10",
    "goals": "Complete the database schema design"
  }
]

If they ask you to suggest a new session (or something similar) or that they'd like to get certain work done, you should respond with a session suggestion.
If they didn't provide a clear goal, first ask for a goal, THEN respond with a session suggestion.
YOUR GOAL IS TO RETURN A SESSION RESPONSE ONCE YOU HAVE ENOUGH DETAIL.
DO NOT MAKE STUFF UP. if the user provided a goal, do not elaborate on it.

Do not bullshit the user. Do not spew fucking bullshit. The pattern needs to actually make sense for the user and what would be effective in the situation.
The pattern doesn't need to perfectly fit the time block, but, considering that the pattern repeats when complete, the end of the time block should coincide with the end of a break.
The patterns are specified as an even number of numbers separated by dashes like 50-10 or 25-5-20-10 or the classic 25-5-25-5-25-5-25-15, where even indices are focus rounds (work) and odd indices are break rounds.
The pattern should be written in its shortest form, e.g. 50-10-50-10 as 50-10. AGAIN, DO NOT REPEAT A PATTERN WITHIN THE PATTERN. the final pattern should be irreducible.
Rounds must be at least 1 minute long.

AGAIN, DO NOT MAKE UP ANYTHING ABOUT THE GOAL. THE USER MUST TELL YOU THE GOAL FOR YOU TO INCLUDE IT. OTHERWISE, DO NOT PROVIDE A GOAL.

Besides that, respond intuitively considering all of the following info on the user:

User Message: ${message}

Current Task: ${currentTask?.name || 'No task selected'}

Recent Sessions:
${sessions.slice(0, 50).map(session => `
Pattern: ${session.pattern}
Goals: ${session.goals}
Rounds:
${session.rounds.map(round => `- ${Math.round(round.duration / 60)}min: ${round.notes || 'No notes'}`).join('\n')}`
).join('\n\n')}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an AI productivity assistant analyzing Pomodoro session data.'
        },
        {
          role: 'user',
          content: chatPrompt
        }
      ],
      response_format: { type: 'json_object' }
    })

    const response = JSON.parse(completion.choices[0].message.content)

    // Store chat in database
    await supabase
      .from('ai_chats')
      .insert([
        { user_id: userId, role: 'user', content: message },
        { user_id: userId, role: 'assistant', content: JSON.stringify(response) }
      ])

    return new Response(JSON.stringify({
      messages: Array.isArray(response) ? response : [response]
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} 