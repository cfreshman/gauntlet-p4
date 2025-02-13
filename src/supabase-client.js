// Session functions
export async function saveSession(sessionData) {
  return await supabase
    .from('daily_sessions')
    .insert([sessionData])
}

export async function getSessions() {
  return await supabase
    .from('daily_sessions')
    .select(`
      *,
      task:tasks(name)
    `)
    .order('created_at', { ascending: false })
}

// Get all sessions after a certain date
export async function getSessionsAfter(date) {
  return await supabase
    .from('daily_sessions')
    .select(`
      *,
      task:tasks(name)
    `)
    .gte('created_at', new Date(date).toISOString())
    .order('created_at', { ascending: true })
} 