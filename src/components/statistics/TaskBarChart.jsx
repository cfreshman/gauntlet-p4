export function TaskBarChart({ data }) {
  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  // Handle empty data or all zero values
  const maxTime = Math.max(...data.map(item => item.time || 0), 0)
  if (maxTime === 0) {
    return (
      <div id="timespent" className="stat-chart scrollbar">
        {data.map((item, index) => (
          <div key={index} className="task-bar-container">
            <div className="legend">{item.name}</div>
            <div className="bar-container">
              <div className="bar" style={{ width: '0%' }}>
                <span className="bar-value">0m</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div id="timespent" className="stat-chart scrollbar">
      {data.map((item, index) => (
        <div key={index} className="task-bar-container">
          <div className="legend">{item.name}</div>
          <div className="bar-container">
            <div 
              className="bar"
              style={{ 
                width: `${((item.time || 0) / maxTime) * 100}%`,
                backgroundColor: `hsl(${(index * 360) / data.length}, 70%, 60%)`
              }}
            >
              <span className="bar-value">{formatTime(item.time || 0)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 