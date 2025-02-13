import { useEffect, useRef } from 'react'
import { useTimerStore } from '../../store/timerStore'
import { useAudioStore } from '../../store/audioStore'

export function Timer({ isPip }) {
  const { roundInfo, currentSession } = useTimerStore()
  const { t, running, currentRoundIndex } = roundInfo
  const { audioType, fadeIn, fadeOut } = useAudioStore()
  const progressRef = useRef(null)
  
  const duration = currentSession?.rounds[currentRoundIndex] * 60 || 1500
  const isBreak = currentRoundIndex % 2 === 1
  const isLongBreak = isBreak && currentSession?.rounds[currentRoundIndex] >= 15

  const timerClass = isBreak ? 
    (isLongBreak ? 'long' : 'short') : 
    'focus'

  useEffect(() => {
    let interval
    if (!isPip && running && t < duration) {
      interval = setInterval(() => {
        useTimerStore.getState().setTime(t => {
          if (t >= duration) {
            clearInterval(interval)
            useTimerStore.getState().setRunning(false)
            useTimerStore.getState().nextRound()
            return 0
          }
          return t + 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [running, duration, isPip])

  // Control noise based on timer state
  useEffect(() => {
    if (!isPip && audioType === 'noise') {
      if (running && !isBreak) {
        fadeIn()
      } else {
        fadeOut()
      }
    }
  }, [running, isBreak, audioType, isPip])

  useEffect(() => {
    if (progressRef.current) {
      const progress = (t / duration) * 100
      progressRef.current.style.strokeDashoffset = progress
    }
  }, [t, duration])

  function formatTime(seconds) {
    const minutes = Math.floor((duration - seconds) / 60)
    const remainingSeconds = (duration - seconds) % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div id="timer" className={`t-${timerClass}`}>
      <svg id="ring" viewBox="0 0 120 120">
        <circle id="secondary" cx="60" cy="60" r="54" />
        <circle 
          ref={progressRef}
          id="progress" 
          cx="60" 
          cy="60" 
          r="54"
          pathLength="100" 
        />
      </svg>

      <div className="timer-content">
        <div id="time" className="time-display">
          {formatTime(t)}
        </div>

        <div id="status" className="status-text">
          {isBreak ? (isLongBreak ? 'LONG BREAK' : 'SHORT BREAK') : 'FOCUS'}
        </div>

        <button 
          id="pauseplay" 
          className={running ? 'playing' : 'paused'} 
          title={running ? 'Pause Timer' : 'Start Timer'}
          onClick={() => useTimerStore.getState().setRunning(!running)}
        >
          <span className="material-icons-round playing">pause_circle</span>
          <span className="material-icons-round paused">play_circle</span>
        </button>
      </div>
    </div>
  )
} 