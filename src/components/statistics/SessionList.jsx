import { useState } from 'react'
import { deleteSession, deleteRound } from '../../supabase-client'

export function SessionList({ sessions, onDelete }) {
  const [expandedSessions, setExpandedSessions] = useState(new Set())

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

  const handleDeleteRound = async (roundId, sessionId, e) => {
    e.stopPropagation()
    try {
      const { error } = await deleteRound(roundId)
      if (error) throw error
      onDelete('round', roundId, sessionId)
    } catch (error) {
      console.error('Error deleting round:', error)
    }
  }

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation()
    try {
      const { error } = await deleteSession(sessionId)
      if (error) throw error
      onDelete('session', sessionId)
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m`
  }

  if (!sessions?.length) return null

  return (
    <div className="sessions">
      {sessions.map(session => (
        <div 
          key={session.id} 
          className="session"
          onClick={() => session.rounds?.length > 0 ? toggleSession(session.id) : null}
        >
          <div className="time">
            {formatDate(session.created_at)} {formatTime(session.created_at)}
          </div>
          
          <div className="pattern">{session.pattern}</div>
          {session.goals && <div className="goals">{session.goals}</div>}

          {session.rounds?.length > 0 ? (
            <>
              <div className="action">
                <span className="material-icons-round">
                  {expandedSessions.has(session.id) ? 'expand_less' : 'expand_more'}
                </span>
              </div>

              {expandedSessions.has(session.id) && (
                <div className="rounds">
                  {session.rounds.map(round => (
                    <div key={round.id} className="stat-round">
                      <div className="stat-round-header">
                        <div className="stat-round-task">{round.task?.name}</div>
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
          ) : (
            <button 
              className="action"
              onClick={(e) => handleDeleteSession(session.id, e)}
            >
              <span className="material-icons-round">delete</span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
} 