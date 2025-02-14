import { useTimerStore } from '../../store/timerStore'

export function CurrentSession() {
  const { currentSession, timerState } = useTimerStore()
  const { pattern_position } = timerState

  if (!currentSession) return null

  const rounds = currentSession.pattern.split('-')

  return (
    <div className="current-session">
      <h3>Session</h3>
      <div className="session-pattern">
        {rounds.map((duration, index) => (
          <span key={index} className="round-indicator">
            <span className={`round ${index === pattern_position ? 'current' : ''}`}>
              {duration}
            </span>
          </span>
        ))}
      </div>
      {currentSession.goals && (
        <div className="session-goals-display">
          {currentSession.goals}
        </div>
      )}
    </div>
  )
} 