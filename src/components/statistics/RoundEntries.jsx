import { useEffect, useState } from 'react';
import { supabase } from '../../../supabase-client';

export default function RoundEntries({ sessions, onDelete }) {
  const [localSessions, setLocalSessions] = useState(sessions);

  useEffect(() => {
    setLocalSessions(sessions);
  }, [sessions]);

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('daily_sessions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting entry:', error);
        alert('Failed to delete session: ' + error.message);
        return;
      }

      // Only notify parent if delete was successful
      if (onDelete) {
        onDelete(id);
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete session. Please try again.');
    }
  };

  const formatTime = (minutes) => `${minutes}m`;

  return (
    <details id="stat-details" open>
      <summary>
        <h2>Session History</h2>
      </summary>
      <div id="round-entries">
        {localSessions?.length > 0 ? (
          localSessions.map(entry => (
            <div key={entry.id} className="entry-row">
              <div className="entry-main">
                <div className="entry-task">{entry.tasks?.name || 'No Task'}</div>
                {entry.notes && <div className="entry-notes">{entry.notes}</div>}
                <div className="entry-time">{new Date(entry.start_time).toLocaleString()}</div>
              </div>
              <div className="entry-side">
                <div className="entry-duration">{formatTime(Math.round(entry.actual_duration / 60))}</div>
                <button 
                  className="entry-delete"
                  onClick={() => handleDelete(entry.id)}
                >
                  <span className="material-icons-round">delete</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No sessions found</div>
        )}
      </div>
    </details>
  );
} 