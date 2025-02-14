import { useState } from 'react'

export function HeatmapCalendar({ data }) {
  const [activeCell, setActiveCell] = useState(null)
  
  // Generate array of hour labels (00:00 - 23:00)
  const hours = Array.from({ length: 24 }, (_, i) => 
    `${i.toString().padStart(2, '0')}:00`
  )
  
  // Generate array of day labels
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  // Find max minutes for color scaling
  const maxMinutes = Math.max(
    ...Object.values(data).map(day => 
      Math.max(...Object.values(day))
    )
  )

  // Get color intensity for a cell
  const getColorIntensity = (minutes) => {
    if (!minutes) return 0
    // Use a log scale for better visualization of varying durations
    return Math.log(minutes + 1) / Math.log(maxMinutes + 1)
  }

  // Format minutes for display
  const formatDuration = (minutes) => {
    if (!minutes) return '0m'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  return (
    <div className="heatmap">
      <div className="heatmap-info">
        {activeCell ? (
          <>
            <div className="info-time">
              {activeCell.day} {activeCell.hour}
            </div>
            <div className="info-duration">
              {formatDuration(activeCell.minutes)}
            </div>
          </>
        ) : (
          <div className="info-time">
            Select a cell to see details
          </div>
        )}
      </div>

      <div className="heatmap-container">
        {days.map((day, dayIndex) => (
          hours.map((hour, hourIndex) => {
            const minutes = data[dayIndex]?.[hourIndex] || 0
            const intensity = getColorIntensity(minutes)
            
            return (
              <div
                key={`${dayIndex}-${hourIndex}`}
                className="heatmap-cell"
                style={{
                  '--intensity': intensity,
                  '--accent-color': 'var(--coloraccent)'
                }}
                onClick={() => setActiveCell({ day, hour, minutes })}
                onMouseEnter={() => setActiveCell({ day, hour, minutes })}
                onMouseLeave={() => setActiveCell(null)}
              />
            )
          })
        ))}
      </div>
    </div>
  )
} 