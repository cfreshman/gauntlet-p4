import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
})

// Auth functions
export async function signInWithEmail(email, password) {
  return await supabase.auth.signInWithPassword({
    email,
    password
  })
}

export async function signUpWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error signing up:', error)
    return { error }
  }
}

export async function signOut() {
  return await supabase.auth.signOut()
}

export async function getCurrentSession() {
  return await supabase.auth.getSession()
}

// Task functions
export async function saveTasks(tasks) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Must be logged in to save tasks')

  return await supabase
    .from('tasks')
    .insert(tasks.map(task => ({
      ...task,
      user_id: user.id
    })))
    .select()
}

export async function getTasks() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Must be logged in to get tasks')

  return await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
}

export async function getTaskByName(name) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .ilike('name', name)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error

  return data || null
}

export async function createTask(name) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Must be logged in to create tasks')
  
  return await supabase
    .from('tasks')
    .insert({
      name,
      user_id: user.id
    })
    .select()
    .single()
}

export async function deleteTask(id) {
  return await supabase
    .from('tasks')
    .delete()
    .match({ id })
}

// Session functions
export async function createSession(pattern, goals) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Must be logged in to create session')

  return await supabase
    .from('sessions')
    .insert({
      pattern,
      goals,
      user_id: user.id
    })
    .select()
    .single()
}

export async function getSessions(startDate, endDate) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  let query = supabase
    .from('sessions')
    .select(`
      *,
      rounds(
        *,
        task:tasks(name)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  return await query
}

export async function deleteSession(id) {
  return await supabase
    .from('sessions')
    .delete()
    .match({ id })
}

// Round functions
export async function getRounds(startDate, endDate) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  let query = supabase
    .from('rounds')
    .select(`
      *,
      task:tasks(name),
      session:sessions(pattern, goals)
    `)
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  if (startDate) {
    query = query.gte('started_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('started_at', endDate.toISOString())
  }

  return await query
}

export async function saveRound(roundData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Must be logged in to save round')

  return await supabase
    .from('rounds')
    .insert({
      user_id: user.id,
      ...roundData
    })
    .select()
    .single()
}

export async function deleteRound(id) {
  return await supabase
    .from('rounds')
    .delete()
    .match({ id })
}

// Timer state table functions
export async function updateTimerState(state) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data, error } = await supabase
    .from('timer')
    .upsert({
      user_id: user.id,
      elapsed_time: state.elapsed_time || 0,
      is_running: state.is_running || false,
      current_session_id: state.current_session_id,
      current_task_id: state.current_task_id,
      pattern_position: state.pattern_position || 0,
      updated_at: new Date().toISOString()
    })
    .select()
    .maybeSingle()
  
  if (error) {
    console.error('Error updating timer state:', error)
    return null
  }

  return { data, error }
}

export async function getTimer() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return await supabase
    .from('timer')
    .select(`
      *,
      current_session:sessions(
        pattern,
        goals
      )
    `)
    .eq('user_id', user.id)
    .maybeSingle()
}

export async function subscribeToTimer(callback) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return supabase
    .channel('timer_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'timer',
        filter: `user_id=eq.${user.id}`
      },
      callback
    )
    .subscribe()
} 