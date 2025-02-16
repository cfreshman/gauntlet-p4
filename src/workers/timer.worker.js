/* eslint-disable no-restricted-globals */
import { createClient } from '@supabase/supabase-js'

let supabase = null
let interval = null
let syncInterval = null
let authSession = null

// Function to sync timer state to Supabase
async function syncToSupabase(data) {
  try {
    if (!supabase || !authSession?.user?.id) {
      console.error('No Supabase client or auth session in worker')
      return
    }

    console.log('Worker syncing to Supabase:', data)
    
    const { error } = await supabase
      .from('timer')
      .upsert({
        user_id: authSession.user.id,
        ...data,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Worker sync error:', error)
    } else {
      console.log('Worker sync successful')
    }
  } catch (error) {
    console.error('Worker sync error:', error)
  }
}

// Handle messages from the main thread
self.onmessage = async (e) => {
  const { type, payload } = e.data
  console.log('Worker received message:', type, payload)

  if (type === 'INIT') {
    supabase = createClient(payload.supabaseUrl, payload.supabaseKey)
    console.log('Worker initialized Supabase client')
  }

  if (type === 'AUTH') {
    try {
      if (!supabase) {
        console.error('Cannot set auth session without Supabase client')
        return
      }

      if (!payload.user) {
        console.error('No user provided in auth payload')
        return
      }

      // Set the session once when we receive it
      const { error: authError } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token
      })
      if (authError) {
        console.error('Error setting auth session:', authError)
        return
      }

      authSession = {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        user: payload.user
      }
      console.log('Worker auth session set with user:', payload.user.id)
    } catch (error) {
      console.error('Error setting worker auth session:', error)
    }
  }

  if (type === 'START') {
    if (!supabase || !authSession) {
      console.error('Cannot start timer without Supabase client and auth session')
      return
    }

    const { elapsed_time, current_session_id, current_task_id, pattern_position } = payload
    let currentTime = elapsed_time

    // Clear any existing intervals
    if (interval) clearInterval(interval)
    if (syncInterval) clearInterval(syncInterval)

    // Start tick interval
    interval = setInterval(() => {
      currentTime++
      self.postMessage({ type: 'TICK', elapsed_time: currentTime })
    }, 1000)

    // Start sync interval
    syncInterval = setInterval(() => {
      syncToSupabase({
        elapsed_time: currentTime,
        is_running: true,
        current_session_id,
        current_task_id,
        pattern_position
      })
    }, 1000) // Sync every second

    // Initial sync
    await syncToSupabase({
      elapsed_time: currentTime,
      is_running: true,
      current_session_id,
      current_task_id,
      pattern_position
    })
  }

  if (type === 'STOP') {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }

    // Sync one last time when stopping
    if (payload) {
      console.log('Worker performing final sync:', payload)
      await syncToSupabase({
        ...payload,
        is_running: false
      })
    }
  }
} 