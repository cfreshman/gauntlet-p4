import { useEffect, useRef, useState } from 'react'
import { useTimerStore } from '../../store/timerStore'
import { useAudioStore } from '../../store/audioStore'
import { useTaskStore } from '../../store/taskStore'
import { useNotificationStore } from '../../store/notificationStore'
import { supabase } from '../../supabase-client'

// Create worker
const worker = new Worker('/timer.worker.js', { type: 'module' })

// Initialize worker with env vars and auth session
worker.postMessage({
  type: 'INIT',
  payload: {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY
  }
})

supabase.auth.getSession().then(({ data: { session }}) => {
  if (session) {
    supabase.auth.getUser().then(({ data: { user }}) => {
      if (user) {
        worker.postMessage({
          type: 'AUTH',
          payload: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user
          }
        })
      }
    })
  }
})

// Handle worker messages
worker.onmessage = (e) => {
  const { type, elapsed_time } = e.data
  if (type === 'TICK') {
    useTimerStore.getState().setElapsedTime(elapsed_time, false) // Don't sync back to Supabase
  }
}

export function Timer({ isPip }) {
  const { timerState, currentSession } = useTimerStore()
  const { elapsed_time, is_running, pattern_position } = timerState
  const { audioType, fadeIn, fadeOut } = useAudioStore()
  const { notify } = useNotificationStore()
  const { getSelectedTask } = useTaskStore()
  const progressRef = useRef(null)
  const [showNotesDialog, setShowNotesDialog] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  const [currentRoundId, setCurrentRoundId] = useState(null)
  const notesDialogRef = useRef(null)

  // Get current round duration from pattern
  const rounds = currentSession?.pattern.split('-').map(Number) || [25]
  const duration = (rounds[pattern_position] || 25) * 60
  const isBreak = pattern_position % 2 === 1
  const isLongBreak = isBreak && rounds[pattern_position] >= 15

  const timerClass = isBreak ? 
    (isLongBreak ? 'long' : 'short') : 
    'focus'

  // Effect to handle dialog visibility
  useEffect(() => {
    if (showNotesDialog) {
      notesDialogRef.current?.showModal()
    } else {
      notesDialogRef.current?.close()
    }
  }, [showNotesDialog])

  // Effect to handle timer state changes
  useEffect(() => {
    if (is_running) {
      if (elapsed_time >= duration) {
        // Stop worker with current state
        worker.postMessage({
          type: 'STOP',
          payload: {
            elapsed_time,
            current_session_id: currentSession?.id,
            current_task_id: timerState.current_task_id,
            pattern_position
          }
        })

        // Handle round completion
        const roundType = isBreak ? (isLongBreak ? 'Long Break' : 'Short Break') : 'Focus'
        notify(
          `${roundType} Round Complete`,
          isBreak ? 'Time to focus!' : 'Time for a break!'
        )
        
        if (!isBreak && elapsed_time >= 60 && (elapsed_time >= 600 || elapsed_time >= duration * 0.5)) {
          useTimerStore.getState().nextRound().then(roundId => {
            if (roundId) {
              setCurrentRoundId(roundId)
              setShowNotesDialog(true)
            } else {
              useTimerStore.getState().nextRound()
            }
          })
        } else {
          useTimerStore.getState().nextRound()
        }
      } else {
        // Start worker
        worker.postMessage({
          type: 'START',
          payload: {
            elapsed_time,
            current_session_id: currentSession?.id,
            current_task_id: timerState.current_task_id,
            pattern_position,
            duration
          }
        })
      }
    } else {
      // Stop worker with current state
      worker.postMessage({
        type: 'STOP',
        payload: {
          elapsed_time,
          current_session_id: currentSession?.id,
          current_task_id: timerState.current_task_id,
          pattern_position
        }
      })
    }

    // Cleanup worker on unmount
    return () => {
      worker.postMessage({ type: 'STOP' })
    }
  }, [is_running, elapsed_time, duration, currentSession?.id, pattern_position, timerState.current_task_id])

  // Effect to load initial state when visibility changes
  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const timer = await useTimerStore.getState().loadTimerState(true)
        if (timer?.is_running) {
          // Get current round duration from pattern
          const pattern = timer.current_session?.pattern || '25'
          const rounds = pattern.split('-').map(Number)
          const duration = (rounds[timer.pattern_position] || 25) * 60

          worker.postMessage({
            type: 'START',
            payload: {
              elapsed_time: timer.elapsed_time,
              current_session_id: timer.current_session_id,
              current_task_id: timer.current_task_id,
              pattern_position: timer.pattern_position,
              duration
            }
          })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Effect to sync task changes
  useEffect(() => {
    if (timerState.current_task_id !== undefined) {
      useTaskStore.getState().selectTask(timerState.current_task_id)
    }
  }, [timerState.current_task_id])

  // Effect to sync session changes
  useEffect(() => {
    if (currentSession) {
      worker.postMessage({
        type: 'STOP',
        payload: {
          elapsed_time,
          current_session_id: currentSession.id,
          current_task_id: timerState.current_task_id,
          pattern_position
        }
      })
      if (is_running) {
        worker.postMessage({
          type: 'START',
          payload: {
            elapsed_time,
            current_session_id: currentSession.id,
            current_task_id: timerState.current_task_id,
            pattern_position,
            duration
          }
        })
      }
    }
  }, [currentSession?.id])

  // Control noise based on timer state
  useEffect(() => {
    if (!isPip && audioType === 'noise') {
      if (is_running && !isBreak) {
        fadeIn()
      } else {
        fadeOut()
      }
    }
  }, [is_running, isBreak, audioType, isPip])

  useEffect(() => {
    if (progressRef.current) {
      const circumference = 2 * Math.PI * 54
      // Set the total length of the dash and gap to be the circumference
      progressRef.current.style.strokeDasharray = `${circumference}`
      // Offset starts at 0 (full ring) and increases to circumference (empty ring)
      progressRef.current.style.strokeDashoffset = `${(elapsed_time / duration) * circumference}`
    }
  }, [elapsed_time, duration])

  function formatTime(seconds) {
    const minutes = Math.floor((duration - seconds) / 60)
    const remainingSeconds = (duration - seconds) % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Handle notes submission
  const handleNotesSubmit = async (save) => {
    if (save && currentRoundId && sessionNotes) {
      try {
        await supabase
          .from('rounds')
          .update({ notes: sessionNotes })
          .eq('id', currentRoundId)
      } catch (error) {
        console.error('Error updating round notes:', error)
      }
    }
    setSessionNotes('')
    setShowNotesDialog(false)
    setCurrentRoundId(null)
  }

  return (
    <>
      <div id="timer" className={`t-${timerClass}`}>
        <svg id="ring" viewBox="0 0 136 136">
          <circle id="secondary" cx="68" cy="68" r="54" />
          <circle 
            ref={progressRef}
            id="progress" 
            cx="68" 
            cy="68" 
            r="54"
            transform="rotate(-90 68 68)"
          />
        </svg>

        <div className="timer-content">
          <div id="status" className="status-text">
            {isBreak ? 'BREAK' : 'FOCUS'}
          </div>

          <div id="time" className="time-display">
            {formatTime(elapsed_time)}
          </div>

          <button 
            id="pauseplay" 
            className={is_running ? 'playing' : 'paused'} 
            title={is_running ? 'Pause Timer' : 'Start Timer'}
            onClick={async () => {
              if (!currentSession) {
                // Create default Pomodoro session if none exists
                await useTimerStore.getState().startNewSession('25-5-25-5-25-5-25-15', 'Default Pomodoro Session')
              }
              useTimerStore.getState().setIsRunning(!is_running)
            }}
          >
            <span className="material-icons-round playing">pause_circle</span>
            <span className="material-icons-round paused">play_circle</span>
          </button>
        </div>
      </div>

      <dialog ref={notesDialogRef} id="notes-dialog">
        <form method="dialog" onSubmit={(e) => {
          e.preventDefault()
          handleNotesSubmit(true)
        }}>
          <h2>Focus Round Complete</h2>
          <p className="dialog-desc">Take a moment to reflect on what you accomplished during this focus round.</p>
          
          <textarea
            id="round-notes"
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="e.g., Finished first draft of proposal, researched key points..."
            rows="4"
          />
          
          <div className="dialog-buttons">
            <button type="button" className="secondary" onClick={() => handleNotesSubmit(false)}>
              Skip
            </button>
            <button type="submit" className="primary">
              Save Notes
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
} 