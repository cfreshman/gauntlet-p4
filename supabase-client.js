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
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin
    }
  })
}

export async function signOut() {
  return await supabase.auth.signOut()
}

// Session functions
export async function saveSession(sessionData) {
  return await supabase
    .from('pomodoro_sessions')
    .insert([sessionData])
}

export async function getSessions() {
  return await supabase
    .from('pomodoro_sessions')
    .select(`
      *,
      task:tasks(name)
    `)
    .order('created_at', { ascending: false })
}

// Get all sessions after a certain date
export async function getSessionsAfter(date) {
  return await supabase
    .from('pomodoro_sessions')
    .select(`
      *,
      task:tasks(name)
    `)
    .gte('created_at', new Date(date).toISOString())
    .order('created_at', { ascending: true })
}

// Bulk insert sessions
export async function bulkSaveSessions(sessions) {
  return await supabase
    .from('pomodoro_sessions')
    .insert(sessions)
}

// Task functions
export async function saveTasks(tasks) {
  return await supabase
    .from('tasks')
    .insert(tasks)
    .select()
}

export async function getTasks() {
  return await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true })
}

export async function getTaskByName(name) {
  return await supabase
    .from('tasks')
    .select('*')
    .eq('name', name)
    .single()
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

export async function updateTask(id, data) {
  return await supabase
    .from('tasks')
    .update(data)
    .match({ id })
}

export async function deleteTask(id) {
  return await supabase
    .from('tasks')
    .delete()
    .match({ id })
}

// Get current session
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}

// Timer state table functions
export async function updateTimerState(state) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  
  const { data, error } = await supabase
    .from('timer_states')
    .upsert({
      user_id: user.id,
      current: state.current,
      time: state.t,
      remaining_time: state.duration - state.t,
      started_at: state.running ? new Date().toISOString() : null,
      running: state.running,
      focus_num: state.focusNum,
      selected_task: state.selectedTask
    })
  
  if (error) {
    console.error('Error updating timer state:', {
      error,
      details: error.details,
      hint: error.hint,
      message: error.message
    })
  }
  return { data, error }
}

export async function getTimerState() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data } = await supabase
    .from('timer_states')
    .select('*')
    .eq('user_id', user.id)
    .single()
    
  return data
}

export async function subscribeToTimerState(callback) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return supabase
    .channel('timer_states')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'timer_states',
        filter: `user_id=eq.${user.id}`
      },
      callback
    )
    .subscribe()
} 