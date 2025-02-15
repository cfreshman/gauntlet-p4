import { create } from 'zustand'
import { supabase } from '../supabase-client'
import { useTaskStore } from './taskStore'

const initialTimerState = {
  elapsed_time: 0,
  is_running: false,
  current_session_id: null,
  current_task_id: null,
  pattern_position: 0
}

export const useTimerStore = create((set, get) => ({
  timerState: { ...initialTimerState },
  currentSession: null,

  loadTimerState: async (preserveRunning) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    console.log('Loading timer state from Supabase')

    const { data: timer } = await supabase
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

    console.log('Loaded timer state:', timer)

    if (timer) {
      // Sync task selection with taskStore
      if (timer.current_task_id) {
        console.log('Syncing task selection from timer:', timer.current_task_id)
        useTaskStore.getState().selectTask(timer.current_task_id)
      }

      set({
        timerState: {
          elapsed_time: timer.elapsed_time || 0,
          is_running: preserveRunning !== undefined ? preserveRunning : false, // Use preserved state if provided
          current_session_id: timer.current_session_id,
          current_task_id: timer.current_task_id,
          pattern_position: timer.pattern_position || 0
        },
        currentSession: timer.current_session
      })
      return timer
    } else {
      // Create initial timer record if it doesn't exist
      try {
        const { data: newTimer, error } = await supabase
          .from('timer')
          .upsert({
            user_id: user.id,
            elapsed_time: 0,
            is_running: false,
            pattern_position: 0
          })
          .select()
          .single()

        if (error) {
          console.error('Error creating timer record:', error)
          return null
        }
        
        set({ timerState: { ...initialTimerState } })
        return newTimer
      } catch (error) {
        console.error('Error creating timer record:', error)
        return null
      }
    }
  },

  syncTimerState: async () => {
    const { timerState } = get()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    console.log('Syncing timer state to Supabase:', timerState)

    let retries = 3
    while (retries > 0) {
      try {
        const { error } = await supabase
          .from('timer')
          .upsert({
            user_id: user.id,
            ...timerState,
            updated_at: new Date().toISOString()
          })
        
        if (error) throw error
        
        // Sync successful
        return
        
      } catch (error) {
        console.error(`Error syncing timer state (${retries} retries left):`, error)
        retries--
        if (retries === 0) {
          console.error('Syncing timer state failed')
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
  },

  setElapsedTime: (time) => {
    const newTime = typeof time === 'function' ? time(get().timerState.elapsed_time) : time
    set(state => ({
      timerState: { ...state.timerState, elapsed_time: newTime }
    }))
    get().syncTimerState()
  },

  setIsRunning: (isRunning) => {
    set(state => ({
      timerState: { ...state.timerState, is_running: isRunning }
    }))
    get().syncTimerState()
  },

  setCurrentTask: (taskId) => {
    console.log('Setting current task in timer store:', taskId)
    set(state => ({
      timerState: { ...state.timerState, current_task_id: taskId }
    }))
    get().syncTimerState()
  },

  startNewSession: async (pattern, goals) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Must be logged in to start session')

    const { data: session } = await supabase
      .from('sessions')
      .insert({
        pattern,
        goals,
        user_id: user.id
      })
      .select()
      .single()

    if (!session) throw new Error('Failed to create session')

    const nextState = {
      elapsed_time: 0,
      is_running: false,
      current_session_id: session.id,
      current_task_id: get().timerState.current_task_id,
      pattern_position: 0
    }

    // Update both Supabase and local state
    const { error: timerError } = await supabase
      .from('timer')
      .upsert({
        user_id: user.id,
        ...nextState,
        updated_at: new Date().toISOString()
      })

    if (timerError) throw timerError

    set({
      currentSession: session,
      timerState: nextState
    })

    return session
  },

  nextRound: async () => {
    const { timerState } = get()
    if (!timerState.current_session_id) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // First, fetch the current session to ensure we have latest data
    const { data: freshSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', timerState.current_session_id)
      .single()

    if (!freshSession) {
      console.error('Could not find current session')
      return
    }

    const rounds = freshSession.pattern.split('-').map(Number)
    const nextPosition = (timerState.pattern_position + 1) % rounds.length

    let createdRoundId = null

    // If completing a focus round, save it
    if (timerState.pattern_position % 2 === 0) {
      const duration = rounds[timerState.pattern_position] * 60
      // Only save if they completed enough of the session
      if (timerState.elapsed_time >= duration * 0.75 || timerState.elapsed_time >= 900) {
        try {
          const { data: round } = await supabase
            .from('rounds')
            .insert({
              user_id: user.id,
              session_id: freshSession.id,
              task_id: timerState.current_task_id,
              started_at: new Date(Date.now() - (timerState.elapsed_time * 1000)).toISOString(),
              duration: timerState.elapsed_time,
              pattern_position: timerState.pattern_position
            })
            .select()
            .single()

          if (round) {
            createdRoundId = round.id
          }
        } catch (error) {
          console.error('Error saving completed round:', error)
        }
      }
    }

    const nextState = {
      elapsed_time: 0,
      is_running: false,
      current_session_id: freshSession.id,
      current_task_id: timerState.current_task_id,
      pattern_position: nextPosition
    }

    // Update timer state in Supabase first
    const { error: timerError } = await supabase
      .from('timer')
      .upsert({
        user_id: user.id,
        ...nextState,
        updated_at: new Date().toISOString()
      })

    if (timerError) {
      console.error('Error updating timer state:', timerError)
      return createdRoundId
    }

    // Then update local state
    set({
      currentSession: freshSession,
      timerState: nextState
    })

    return createdRoundId
  },

  endCurrentSession: async () => {
    set({
      currentSession: null,
      timerState: { ...initialTimerState }
    })
    await get().syncTimerState()
  }
})) 