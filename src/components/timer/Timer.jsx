import { useEffect, useRef, useState } from 'react'
import { useTimerStore } from '../../store/timerStore'
import { useAudioStore } from '../../store/audioStore'
import { useTaskStore } from '../../store/taskStore'
import { useNotificationStore } from '../../store/notificationStore'
import { supabase } from '../../supabase-client'

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
  const lastTickRef = useRef(Date.now())
  
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

  // Handle visibility changes and reconnection
  useEffect(() => {
    if (isPip) return // Don't handle recovery in PiP windows

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, checking timer state')
        try {
          // Always reload timer state when becoming visible
          await useTimerStore.getState().loadTimerState()
          
          // Only catch up on missed time if timer was running
          const now = Date.now()
          const missedMs = now - lastTickRef.current
          const missedSeconds = Math.floor(missedMs / 1000)
          
          if (missedSeconds > 0 && is_running) {
            console.log('Catching up missed time while hidden:', missedSeconds, 'seconds')
            await useTimerStore.getState().setElapsedTime(t => {
              const newTime = Math.min(t + missedSeconds, duration)
              // If we've passed the duration while hidden, handle completion
              if (newTime >= duration) {
                useTimerStore.getState().setIsRunning(false)
                const roundType = isBreak ? (isLongBreak ? 'Long Break' : 'Short Break') : 'Focus'
                notify(
                  `${roundType} Round Complete`,
                  isBreak ? 'Time to focus!' : 'Time for a break!'
                )
                if (!isBreak && newTime >= 60 && (newTime >= 600 || newTime >= duration * 0.5)) {
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
              }
              return newTime
            })
          }
        } catch (error) {
          console.error('Error recovering timer state:', error)
        }
      }
    }

    // Update last tick time whenever elapsed_time changes
    lastTickRef.current = Date.now()

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [duration, elapsed_time, is_running, isBreak, isLongBreak, isPip, notify])

  useEffect(() => {
    let interval
    if (!isPip && is_running && elapsed_time < duration) {
      interval = setInterval(async () => {
        try {
          await useTimerStore.getState().setElapsedTime(t => {
            if (t >= duration) {
              console.log('Timer completed:', { elapsed_time: t, duration })
              clearInterval(interval)
              useTimerStore.getState().setIsRunning(false)
              
              // Send notification when round completes
              const roundType = isBreak ? (isLongBreak ? 'Long Break' : 'Short Break') : 'Focus'
              notify(
                `${roundType} Round Complete`,
                isBreak ? 'Time to focus!' : 'Time for a break!'
              )
              
              // If completing a focus round, show notes dialog
              if (!isBreak && t >= 60 && (t >= 600 || t >= duration * 0.5)) {
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
              return t
            }
            return t + 1
          })
        } catch (error) {
          console.error('Error updating timer:', error)
          // Try to reload timer state on error
          await useTimerStore.getState().loadTimerState()
        }
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [is_running, duration, isPip, isBreak, isLongBreak, notify])

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

  return (
    <>
      <div id="timer" className={`t-${timerClass}`}>
        <svg id="ring" viewBox="0 0 120 120">
          <circle id="secondary" cx="60" cy="60" r="54" />
          <circle 
            ref={progressRef}
            id="progress" 
            cx="60" 
            cy="60" 
            r="54"
            transform="rotate(-90 60 60)"
          />
        </svg>

        <div className="timer-content">
          <div id="status" className="status-text">
            {isBreak ? (isLongBreak ? 'LONG BREAK' : 'SHORT BREAK') : 'FOCUS'}
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