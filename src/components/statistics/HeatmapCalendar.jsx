import { useState } from 'react'

export function HeatmapCalendar({ data, dailyDistribution }) {
  const [activeCell, setActiveCell] = useState(null)
  
  // Generate array of hour labels (00:00 - 23:00)
  const hours = Array.from({ length: 24 }, (_, i) => 
    `${i.toString().padStart(2, '0')}:00`
  )
  
  // Generate array of day labels
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  // Calculate daily totals and find max
  const dailyTotals = Object.entries(data).reduce((acc, [dayIndex, hours]) => {
    acc[dayIndex] = Object.values(hours).reduce((sum, mins) => sum + (mins || 0), 0)
    return acc
  }, {})
  const maxDailyTotal = Math.max(...Object.values(dailyTotals), 0)

  // Calculate hourly totals and find max
  const hourlyTotals = Array.from({ length: 24 }, (_, hourIndex) => {
    return Object.values(data).reduce((sum, day) => 
      sum + (day[hourIndex] || 0), 0
    )
  })
  const maxHourlyTotal = Math.max(...hourlyTotals, 0)

  // Find max minutes for individual day cells
  const maxDayHourlyTotal = Math.max(
    ...Object.values(data).flatMap(day => 
      Object.values(day).map(mins => mins || 0)
    ),
    0
  )

  // Get color intensity for a cell
  const getColorIntensity = (minutes, max) => {
    if (!minutes || max === 0) return 0
    return Math.log(minutes + 1) / Math.log(max + 1)
  }

  // Format minutes for display
  const formatDuration = (minutes) => {
    if (!minutes) return '0m'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  // Get color for a day based on its index
  const getDayColor = (dayIndex) => {
    const dayName = days[dayIndex]
    return `hsl(${(dayIndex * 360) / 7}, 70%, 60%)`
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

      <div className="daily-distribution">
        {hours.map((hour, hourIndex) => {
          const minutes = hourlyTotals[hourIndex] || 0
          const intensity = getColorIntensity(minutes, maxHourlyTotal)
          
          return (
            <div
              key={`daily-${hourIndex}`}
              className="heatmap-cell"
              style={{
                '--intensity': intensity,
                '--accent-color': 'var(--coloraccent)'
              }}
              onClick={() => setActiveCell({ day: 'Total', hour, minutes })}
              onMouseEnter={() => setActiveCell({ day: 'Total', hour, minutes })}
              onMouseLeave={() => setActiveCell(null)}
            />
          )
        })}
      </div>

      <div className="heatmap-container">
        {days.map((day, dayIndex) => (
          hours.map((hour, hourIndex) => {
            const minutes = data[dayIndex]?.[hourIndex] || 0
            const intensity = getColorIntensity(minutes, maxDayHourlyTotal)
            
            return (
              <div
                key={`${dayIndex}-${hourIndex}`}
                className="heatmap-cell"
                style={{
                  '--intensity': intensity,
                  '--accent-color': getDayColor(dayIndex)
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