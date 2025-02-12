import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

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
  if (!user) return null
  
  const { data, error } = await supabase
    .from('timer_states')
    .upsert({
      user_id: user.id,
      current: state.current || 'focus',
      time: state.t || 0,
      remaining_time: state.duration ? (state.duration - state.t) : 0,
      started_at: state.running ? new Date().toISOString() : null,
      running: state.running || false,
      focus_num: state.focusNum || 1,
      selected_task: state.selectedTask || 'Default Task',
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

export async function getTimerState() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data, error } = await supabase
    .from('timer_states')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
    
  if (error) {
    console.error('Error getting timer state:', error)
    return null
  }

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

// Session recording functions
export async function startSession(taskId, timerDuration) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return await supabase
    .from('daily_sessions')
    .insert({
      user_id: user.id,
      task_id: taskId,
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      timer_duration: timerDuration,
      actual_duration: 0
    })
    .select()
    .single()
}

export async function endSession(sessionId, actualDuration, notes = null) {
  if (actualDuration < 60) { // Less than 1 minute
    return await supabase
      .from('daily_sessions')
      .delete()
      .match({ id: sessionId })
  }

  return await supabase
    .from('daily_sessions')
    .update({
      end_time: new Date().toISOString(),
      actual_duration: actualDuration,
      notes
    })
    .match({ id: sessionId })
}

export async function updateSelectedTask(taskName) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  
  // First get existing state
  const { data: existingState } = await getTimerState()
  
  // If no existing state, create a new one with defaults
  if (!existingState) {
    return await updateTimerState({
      current: 'focus',
      t: 0,
      duration: config.focus,
      running: false,
      focusNum: 1,
      selectedTask: taskName
    })
  }
  
  // Update existing state
  return await updateTimerState({
    current: existingState.current || 'focus',
    t: existingState.time || 0,
    duration: config[existingState.current || 'focus'],
    running: existingState.running || false,
    focusNum: existingState.focus_num || 1,
    selectedTask: taskName
  })
} 