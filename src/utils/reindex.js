import { supabase } from '../supabase-client'

async function reindexEmbeddings(options = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Must be logged in to reindex embeddings')

    console.log('Starting reindex...')
    
    // Get counts of what needs reindexing
    const { data: counts, error } = await supabase.rpc('reindex_embeddings', {
      user_id: user.id,
      start_date: options.startDate,
      end_date: options.endDate
    })

    if (error) throw error

    console.log(`Found ${counts.rounds_reindexed} rounds and ${counts.sessions_reindexed} sessions to reindex`)

    if (counts.rounds_reindexed === 0 && counts.sessions_reindexed === 0) {
      console.log('Nothing to reindex')
      return
    }

    // Get rounds that need embeddings
    const { data: roundEmbeddings } = await supabase
      .from('round_embeddings')
      .select('id')

    let roundsQuery = supabase
      .from('rounds')
      .select('id')
      .eq('user_id', user.id)

    // Only add the not-in filter if we have existing embeddings
    if (roundEmbeddings?.length > 0) {
      roundsQuery = roundsQuery.not('id', 'in', roundEmbeddings.map(r => r.id))
    }

    const { data: rounds, error: roundsError } = await roundsQuery
    if (roundsError) throw roundsError

    // Get sessions that need embeddings
    const { data: sessionEmbeddings } = await supabase
      .from('session_embeddings')
      .select('id')

    let sessionsQuery = supabase
      .from('sessions')
      .select('id')
      .eq('user_id', user.id)

    // Only add the not-in filter if we have existing embeddings
    if (sessionEmbeddings?.length > 0) {
      sessionsQuery = sessionsQuery.not('id', 'in', sessionEmbeddings.map(s => s.id))
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery
    if (sessionsError) throw sessionsError

    // Generate embeddings for each item
    let roundsProcessed = 0
    let sessionsProcessed = 0

    console.log('Generating embeddings...')

    for (const round of rounds || []) {
      try {
        await supabase.functions.invoke('generate-embeddings', {
          body: { type: 'round', id: round.id }
        })
        roundsProcessed++
        console.log(`Processed ${roundsProcessed}/${rounds.length} rounds`)
      } catch (e) {
        console.error(`Failed to generate embeddings for round ${round.id}:`, e)
      }
    }

    for (const session of sessions || []) {
      try {
        await supabase.functions.invoke('generate-embeddings', {
          body: { type: 'session', id: session.id }
        })
        sessionsProcessed++
        console.log(`Processed ${sessionsProcessed}/${sessions.length} sessions`)
      } catch (e) {
        console.error(`Failed to generate embeddings for session ${session.id}:`, e)
      }
    }

    console.log('Reindex complete!')
    console.log(`Successfully processed:`)
    console.log(`- ${roundsProcessed}/${rounds?.length || 0} rounds`)
    console.log(`- ${sessionsProcessed}/${sessions?.length || 0} sessions`)

  } catch (error) {
    console.error('Error during reindex:', error)
    throw error
  }
}

// Expose to window for console access
window.reindexEmbeddings = reindexEmbeddings

export { reindexEmbeddings } 