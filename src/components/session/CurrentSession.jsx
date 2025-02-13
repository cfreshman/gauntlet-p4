import { useTimerStore } from '../../store/timerStore'

export function CurrentSession() {
  const { currentSession } = useTimerStore()

  if (!currentSession) return null

  return (
    <div className="current-session">
      <h3>Current Session</h3>
      <div className="session-pattern">
        Pattern: {currentSession.pattern}
      </div>
      {currentSession.goals && (
        <div className="session-goals-display">
          {currentSession.goals}
        </div>
      )}
    </div>
  )
} 