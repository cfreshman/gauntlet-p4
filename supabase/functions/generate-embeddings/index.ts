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
    const { type, id } = await req.json()

    if (!type || !id) {
      throw new Error('Missing required parameters')
    }

    if (type === 'round') {
      // Get round data
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .select(`
          id,
          notes,
          task:tasks (
            name
          )
        `)
        .eq('id', id)
        .single()

      if (roundError) throw roundError

      // Generate content for embedding
      const content = `Task: ${round.task?.name || 'No task'}
Notes: ${round.notes || 'No notes'}`

      // Generate embedding
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: content
      })

      // Store embedding
      const { error: storeError } = await supabase
        .from('round_embeddings')
        .upsert({
          id: round.id,
          content_embedding: embedding.data[0].embedding
        })

      if (storeError) throw storeError

    } else if (type === 'session') {
      // Get session data
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, goals, pattern')
        .eq('id', id)
        .single()

      if (sessionError) throw sessionError

      // Generate content for embedding
      const content = `Session Goals: ${session.goals || 'No goals'}
Pattern: ${session.pattern}`

      // Generate embedding
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: content
      })

      // Store embedding
      const { error: storeError } = await supabase
        .from('session_embeddings')
        .upsert({
          id: session.id,
          content_embedding: embedding.data[0].embedding
        })

      if (storeError) throw storeError
    }

    return new Response(JSON.stringify({ success: true }), {
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