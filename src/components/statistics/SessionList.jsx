import { useState, useEffect } from 'react'
import { useTimerStore } from '../../store/timerStore'

export function SessionList({ sessions, onDelete, searchResults }) {
  const [expandedSessions, setExpandedSessions] = useState(new Set())
  const { timerState } = useTimerStore()

  // Debug log
  console.log('SessionList render:', {
    searchMode: !!searchResults,
    sessions: sessions.map(s => ({
      id: s.id,
      match_type: s.match_type,
      has_rounds: s.rounds?.length > 0,
      has_matching_rounds: s.matching_rounds?.length > 0
    }))
  })

  // Auto-expand sessions with matching rounds
  useEffect(() => {
    if (searchResults) {
      setExpandedSessions(new Set(
        sessions
          .filter(session => 
            (session.match_type === 'round' && session.matching_rounds?.length > 0) ||
            session.match_type === 'session'
          )
          .map(session => session.id)
      ))
    } else {
      setExpandedSessions(new Set())
    }
  }, [searchResults, sessions])

  const toggleSession = (sessionId) => {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this session?')) {
      onDelete('session', sessionId)
    }
  }

  const handleDeleteRound = async (roundId, sessionId, e) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this round?')) {
      onDelete('round', roundId, sessionId)
    }
  }

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m`
  }

  return (
    <div className="sessions">
      {sessions.map(session => (
        <div 
          key={session.id} 
          className={`session ${searchResults ? 'search-result' : ''} ${
            searchResults && session.match_type === 'session' ? 'session-match' : ''
          }`}
          onClick={() => (session.matching_rounds?.length > 0 || session.rounds?.length > 0) ? toggleSession(session.id) : null}
          style={{ cursor: (session.matching_rounds?.length > 0 || session.rounds?.length > 0) ? 'pointer' : 'default' }}
        >
          <div className="session-header">
            <div className="time">
              {formatDate(session.created_at)} {formatTime(session.created_at)}
            </div>
            
            <div className="pattern">{session.pattern}</div>
            {session.goals && <div className="goals">{session.goals}</div>}
          </div>

          {(session.rounds?.length > 0 || session.matching_rounds?.length > 0) && (
            <>
              <div className="action">
                <span className="material-icons-round">
                  {expandedSessions.has(session.id) ? 'expand_less' : 'expand_more'}
                </span>
              </div>

              {expandedSessions.has(session.id) && (
                <div className="rounds">
                  {(searchResults ? 
                    (session.match_type === 'session' ? session.rounds : session.matching_rounds)
                    : session.rounds
                  ).map(round => (
                    <div 
                      key={round.id} 
                      className={`stat-round ${searchResults && session.match_type === 'round' ? 'round-match' : ''}`}
                    >
                      <div className="stat-round-header">
                        <div className="stat-round-task">
                          {round.task?.name}
                        </div>
                        <div className="stat-round-time">{formatTime(round.started_at)}</div>
                        <div className="stat-round-duration">{formatDuration(round.duration)}</div>
                        <button 
                          className="stat-round-delete"
                          onClick={(e) => handleDeleteRound(round.id, session.id, e)}
                        >
                          <span className="material-icons-round">delete</span>
                        </button>
                      </div>
                      {round.notes && (
                        <div className="stat-round-notes">{round.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
} 