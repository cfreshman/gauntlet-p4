import { useState, useEffect } from 'react'
import { supabase } from '../../../supabase-client'

export function RoundEntries() {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    async function fetchEntries() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('daily_sessions')
        .select(`
          *,
          task:tasks(name)
        `)
        .order('start_time', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching entries:', error)
        return
      }

      setEntries(data || [])
    }

    fetchEntries()
  }, [])

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes} minutes`
  }

  async function handleDelete(id) {
    const { error } = await supabase
      .from('daily_sessions')
      .delete()
      .match({ id })

    if (error) {
      console.error('Error deleting entry:', error)
      return
    }

    setEntries(entries.filter(entry => entry.id !== id))
  }

  return (
    <details id="stat-details">
      <summary><h2>Focus Round Records</h2></summary>
      <div id="round-entries">
        {entries.map(entry => (
          <div key={entry.id} className="round-entry">
            <div className="round-entry-header">
              <div className="round-entry-name">{entry.task?.name || 'Deleted Task'}</div>
              <div className="round-entry-duration">
                {formatTime(entry.actual_duration)}
              </div>
            </div>
            <div className="round-entry-time">
              {new Date(entry.start_time).toLocaleString()}
            </div>
            {entry.notes && (
              <div className="round-entry-notes">{entry.notes}</div>
            )}
            <button 
              className="entry-delete"
              onClick={() => handleDelete(entry.id)}
            >
              Delete Entry
            </button>
          </div>
        ))}
      </div>
    </details>
  )
} 