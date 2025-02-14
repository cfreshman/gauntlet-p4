import { useEffect, useState } from 'react';
import { deleteRound } from '../../supabase-client';

export default function RoundEntries({ rounds, onDelete }) {
  const [localRounds, setLocalRounds] = useState(rounds);

  useEffect(() => {
    setLocalRounds(rounds);
  }, [rounds]);

  const handleDelete = async (id) => {
    try {
      const { error } = await deleteRound(id);

      if (error) {
        console.error('Error deleting round:', error);
        alert('Failed to delete round: ' + error.message);
        return;
      }

      // Only notify parent if delete was successful
      if (onDelete) {
        onDelete(id);
      }
    } catch (error) {
      console.error('Error deleting round:', error);
      alert('Failed to delete round. Please try again.');
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  return (
    <details id="stat-details" open>
      <summary>
        <h2>Session History</h2>
      </summary>
      <div id="round-entries">
        {localRounds?.length > 0 ? (
          localRounds.map(round => (
            <div key={round.id} className="entry-row">
              <div className="entry-main">
                <div className="entry-task">{round.task?.name || 'No Task'}</div>
                {round.notes && <div className="entry-notes">{round.notes}</div>}
                <div className="entry-time">{new Date(round.started_at).toLocaleString()}</div>
              </div>
              <div className="entry-side">
                <div className="entry-duration">{formatTime(round.duration)}</div>
                <button 
                  className="entry-delete"
                  onClick={() => handleDelete(round.id)}
                >
                  <span className="material-icons-round">delete</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No rounds found</div>
        )}
      </div>
    </details>
  );
} 