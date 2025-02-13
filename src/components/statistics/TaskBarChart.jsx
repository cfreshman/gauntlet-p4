export function TaskBarChart({ data }) {
  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const maxTime = Math.max(...data.map(item => item.time))

  return (
    <div id="timespent" className="stat-chart scrollbar">
      {data.map((item, index) => (
        <div key={index} className="task-bar-container">
          <div className="legend">{item.name}</div>
          <div className="bar-container">
            <div 
              className="bar"
              style={{ 
                width: `${(item.time / maxTime) * 100}%`,
                backgroundColor: `hsl(${(index * 360) / data.length}, 70%, 60%)`
              }}
            >
              <div className="tooltip">{formatTime(item.time)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 