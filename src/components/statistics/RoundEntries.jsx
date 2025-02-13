import { useEffect, useState } from 'react';
import { supabase } from '../../../supabase-client';

export default function RoundEntries({ selectedTasks }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!selectedTasks?.length) {
      setEntries([]);
      return;
    }

    const fetchEntries = async () => {
      const { data, error } = await supabase
        .from('focus_rounds')
        .select('*')
        .in('task_id', selectedTasks)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching entries:', error);
        return;
      }

      setEntries(data || []);
    };

    fetchEntries();
  }, [selectedTasks]);

  const handleDelete = async (id) => {
    const { error } = await supabase
      .from('focus_rounds')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting entry:', error);
      return;
    }

    setEntries(entries.filter(entry => entry.id !== id));
  };

  const formatTime = (minutes) => `${minutes}m`;

  if (!entries.length) return null;

  return (
    <div id="stat-details">
      <div id="round-entries">
        {entries.map(entry => (
          <div key={entry.id} className="entry-row">
            <div className="entry-main">
              <div className="entry-task">{entry.task_name}</div>
              {entry.notes && <div className="entry-notes">{entry.notes}</div>}
              <div className="entry-time">{new Date(entry.created_at).toLocaleString()}</div>
            </div>
            <div className="entry-side">
              <div className="entry-duration">{formatTime(entry.duration)}</div>
              <button 
                className="entry-delete"
                onClick={() => handleDelete(entry.id)}
              >
                <span className="material-icons-round">delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 