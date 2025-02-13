import { create } from 'zustand'
import { supabase, saveCompletedSession } from '../../supabase-client'

const initialRoundInfo = {
  t: 0,
  focusNum: 1,
  current: "focus",
  running: false,
  pattern: null,
  patternPosition: 0,
  currentRoundIndex: 0,
  sessionStartTime: null  // Add this to track when the focus period started
}

export const useTimerStore = create((set, get) => ({
  roundInfo: { ...initialRoundInfo },
  currentSession: null,

  loadTimerState: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: timerState } = await supabase
      .from('timer_states')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (timerState) {
      const session = timerState.session_pattern ? {
        pattern: timerState.session_pattern,
        goals: timerState.session_goals,
        rounds: timerState.session_pattern.split('-').map(Number),
        currentRoundIndex: timerState.pattern_position || 0
      } : null

      set({
        currentSession: session,
        roundInfo: {
          ...initialRoundInfo,
          t: timerState.time || 0,
          running: false, // Always start paused on load
          pattern: timerState.session_pattern,
          current: timerState.current,
          focusNum: timerState.focus_num,
          currentRoundIndex: timerState.pattern_position || 0
        }
      })
    }
  },

  syncTimerState: async () => {
    const { roundInfo, currentSession } = get()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('timer_states')
      .upsert({
        user_id: user.id,
        time: roundInfo.t,
        current: roundInfo.current,
        running: roundInfo.running,
        focus_num: roundInfo.focusNum,
        session_pattern: currentSession?.pattern,
        session_goals: currentSession?.goals,
        pattern_position: roundInfo.currentRoundIndex,
        updated_at: new Date().toISOString()
      })
  },

  setTime: (t) => {
    const newT = typeof t === 'function' ? t(get().roundInfo.t) : t
    set(state => ({
      roundInfo: { ...state.roundInfo, t: newT }
    }))
    get().syncTimerState()
  },

  setRunning: (running) => {
    set(state => ({
      roundInfo: { ...state.roundInfo, running }
    }))
    get().syncTimerState()
  },

  setCurrentRound: (current) => {
    set(state => ({
      roundInfo: { ...state.roundInfo, current }
    }))
    get().syncTimerState()
  },

  setFocusNum: (focusNum) => {
    set(state => ({
      roundInfo: { ...state.roundInfo, focusNum }
    }))
    get().syncTimerState()
  },

  setPattern: (pattern) => set(state => ({
    roundInfo: { ...state.roundInfo, pattern }
  })),

  setPatternPosition: (patternPosition) => set(state => ({
    roundInfo: { ...state.roundInfo, patternPosition }
  })),

  setCurrentSession: (session) => set({ currentSession: session }),

  resetRoundInfo: () => {
    const { currentSession } = get()
    if (currentSession) {
      set(state => ({
        roundInfo: {
          ...initialRoundInfo,
          pattern: currentSession.pattern,
          currentRoundIndex: currentSession.currentRoundIndex
        }
      }))
    } else {
      set({ roundInfo: { ...initialRoundInfo } })
    }
    get().syncTimerState()
  },

  updateRoundInfo: (updates) => set(state => ({
    roundInfo: { ...state.roundInfo, ...updates }
  })),

  startNewSession: async (pattern, goals) => {
    const { currentSession, roundInfo } = get()
    
    // Clean up existing session if any
    if (currentSession) {
      // If we're in a focus round and have completed either:
      // - more than 75% of the round, or
      // - at least 15 minutes of work
      const duration = currentSession.rounds[currentSession.currentRoundIndex] * 60
      if (currentSession.currentRoundIndex % 2 === 0 && 
          (roundInfo.t >= duration * 0.75 || roundInfo.t >= 900)) { // 900 seconds = 15 minutes
        get().nextRound()
      }
    }

    const rounds = pattern.split('-').map(Number)
    const session = {
      pattern,
      goals,
      rounds,
      currentRoundIndex: 0
    }
    
    set({
      currentSession: session,
      roundInfo: {
        ...initialRoundInfo,
        pattern,
        current: 'focus',
        currentRoundIndex: 0,
        t: 0,
        sessionStartTime: new Date().toISOString()  // Set start time for first focus period
      }
    })
    
    await get().syncTimerState()
    return session
  },

  nextRound: async () => {
    const { currentSession, roundInfo } = get()
    if (!currentSession) return

    // If completing a focus round, save the session
    if (roundInfo.current === 'focus') {
      const duration = currentSession.rounds[roundInfo.currentRoundIndex] * 60
      // Only save if they completed enough of the session
      if (roundInfo.t >= duration * 0.75 || roundInfo.t >= 900) { // 75% of duration or at least 15 minutes
        try {
          await saveCompletedSession({
            taskId: null, // TODO: Get from task selection
            startTime: roundInfo.sessionStartTime,
            timerDuration: duration,
            actualDuration: roundInfo.t,
            notes: null, // TODO: Get from notes dialog if needed
            sessionPattern: currentSession.pattern,
            sessionGoals: currentSession.goals,
            patternPosition: roundInfo.currentRoundIndex
          })
        } catch (error) {
          console.error('Error saving completed session:', error)
        }
      }
    }

    const nextIndex = (currentSession.currentRoundIndex + 1) % currentSession.rounds.length
    const updatedSession = {
      ...currentSession,
      currentRoundIndex: nextIndex
    }

    set({
      currentSession: updatedSession,
      roundInfo: {
        ...initialRoundInfo,
        pattern: currentSession.pattern,
        current: nextIndex % 2 === 0 ? 'focus' : 'break',
        currentRoundIndex: nextIndex,
        focusNum: nextIndex % 2 === 0 ? Math.floor(nextIndex / 2) + 1 : Math.floor(nextIndex / 2),
        sessionStartTime: nextIndex % 2 === 0 ? new Date().toISOString() : null // Set start time for new focus periods
      }
    })
    get().syncTimerState()
  },

  endCurrentSession: async () => {
    set({
      currentSession: null,
      roundInfo: { ...initialRoundInfo }
    })
    await get().syncTimerState()
  }
})) 