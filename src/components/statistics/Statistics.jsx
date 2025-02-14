import { useState, useEffect } from 'react'
import { useTaskStore } from '../../store/taskStore'
import { PageLayout } from '../common/PageLayout'
import { TaskBarChart } from './TaskBarChart'
import { SessionList } from './SessionList'
import { HeatmapCalendar } from './HeatmapCalendar'
import { getSessions } from '../../supabase-client'

const TIME_PERIODS = {
  '0': 'Today',
  '1': 'Past Day',
  '7': 'Past Week',
  '365': 'Past Year',
  'all': 'All Time'
}

const DEFAULT_STATS = {
  total: 0,
  rounds: 0,
  average: 0,
  shortest: 0,
  longest: 0,
  taskDistribution: [],
  hourlyDistribution: {},
  dailyDistribution: {},
  weeklyHeatmap: {},
  monthlyDistribution: {}
}

export function Statistics() {
  const { tasks } = useTaskStore()
  const [selectedPeriod, setSelectedPeriod] = useState('7')
  const [selectedTasks, setSelectedTasks] = useState(['all'])
  const [stats, setStats] = useState(DEFAULT_STATS)
  const [sessions, setSessions] = useState([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Add event listener to show/hide statistics
    const statsEl = document.getElementById('statistics')
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'style') {
          const display = statsEl.style.display
          setIsOpen(display === 'flex')
          if (display === 'flex') {
            fetchStats() // Refresh stats when opened
          }
        }
      })
    })
    
    observer.observe(statsEl, { attributes: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchStats()
    }
  }, [selectedPeriod, selectedTasks])

  async function fetchStats() {
    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    if (selectedPeriod !== 'all') {
      startDate.setDate(startDate.getDate() - parseInt(selectedPeriod))
    } else {
      startDate = new Date(0) // Beginning of time
    }

    // Fetch sessions with their rounds
    const { data: sessionsData, error: sessionsError } = await getSessions(startDate, now)

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      return
    }

    setSessions(sessionsData || [])

    // If no sessions or no tasks selected, show no data
    if (!sessionsData?.length || !selectedTasks.length) {
      setStats(DEFAULT_STATS)
      return
    }

    // Process rounds for stats
    const taskDist = {}
    const hourlyDist = {}
    const dailyDist = {}
    const monthlyDist = {}
    const weeklyHeatmap = {}
    let total = 0
    let roundCount = 0
    let shortest = Infinity
    let longest = 0

    sessionsData.forEach(session => {
      session.rounds?.forEach(round => {
        // Skip if task filter is active and this round's task isn't selected
        if (!selectedTasks.includes('all') && !selectedTasks.includes(round.task_id)) {
          return
        }

        const duration = round.duration
        if (!duration) return

        roundCount++

        // Task distribution
        const taskName = round.task?.name || 'No Task'
        taskDist[taskName] = (taskDist[taskName] || 0) + duration

        // Time distributions
        const date = new Date(round.started_at)
        const hour = date.getHours()
        const hourKey = `${hour}:00-${hour + 1}:00`
        const dayKey = date.toLocaleDateString('en-US', { weekday: 'long' })
        const monthKey = date.toLocaleDateString('en-US', { month: 'long' })

        // Weekly heatmap data
        const dayIndex = date.getDay() // 0-6 for Sunday-Saturday
        weeklyHeatmap[dayIndex] = weeklyHeatmap[dayIndex] || {}
        weeklyHeatmap[dayIndex][hour] = (weeklyHeatmap[dayIndex][hour] || 0) + Math.floor(duration / 60) // Convert seconds to minutes

        hourlyDist[hourKey] = (hourlyDist[hourKey] || 0) + duration
        dailyDist[dayKey] = (dailyDist[dayKey] || 0) + duration
        monthlyDist[monthKey] = (monthlyDist[monthKey] || 0) + duration

        // Update totals
        total += duration
        shortest = Math.min(shortest, duration)
        longest = Math.max(longest, duration)
      })
    })

    setStats({
      total,
      rounds: roundCount,
      average: roundCount > 0 ? Math.round(total / roundCount) : 0,
      shortest: shortest === Infinity ? 0 : shortest,
      longest,
      taskDistribution: Object.entries(taskDist).map(([name, time]) => ({ name, time })),
      hourlyDistribution: hourlyDist,
      dailyDistribution: dailyDist,
      weeklyHeatmap,
      monthlyDistribution: monthlyDist
    })
  }

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  function getMostProductiveTime(distribution) {
    const entries = Object.entries(distribution)
    if (!entries.length) return 'No data available'
    return entries.sort((a, b) => b[1] - a[1])[0][0]
  }

  const handleDelete = (type, id, sessionId) => {
    if (type === 'round') {
      setSessions(prev => prev.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            rounds: session.rounds.filter(round => round.id !== id)
          }
        }
        return session
      }))
    } else if (type === 'session') {
      setSessions(prev => prev.filter(session => session.id !== id))
    }
    fetchStats()
  }

  return (
    <PageLayout
      id="statistics"
      title="Statistics"
      onClose={() => setIsOpen(false)}
      isOpen={isOpen}
    >
      <div className="statistics-filters">
        <div className="filter-group">
          <label>Time Period</label>
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            {Object.entries(TIME_PERIODS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Show Statistics</label>
          <div id="filters">
            <label className="task-chip">
              <input
                type="checkbox"
                checked={selectedTasks.includes('all')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTasks(['all'])
                  } else {
                    setSelectedTasks([])
                  }
                }}
              />
              All Tasks
            </label>
            {tasks.map(task => (
              <label key={task.id} className="task-chip">
                <input
                  type="checkbox"
                  checked={selectedTasks.includes(task.id)}
                  onChange={(e) => {
                    setSelectedTasks(prev => {
                      if (e.target.checked) {
                        // If checking a task
                        const newSelection = prev.filter(id => id !== 'all')
                        return [...newSelection, task.id]
                      } else {
                        // If unchecking a task
                        const newSelection = prev.filter(id => id !== task.id)
                        // If no tasks selected, leave it empty instead of defaulting to 'all'
                        return newSelection
                      }
                    })
                  }}
                />
                {task.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <br />
      <h2>Overview</h2>
      <div id="stat-summary" className="remark">
        You focused for a total duration of
        <span id="stat-summary-total">{formatTime(stats.total)}</span>
        consisting of
        <span id="stat-summary-rounds">{stats.rounds} Focus Rounds</span>
        with an average round duration of
        <span id="stat-summary-average">{formatTime(stats.average)}</span>
        <br /><br />
        Shortest round duration: <span id="stat-summary-shortest">{formatTime(stats.shortest)}</span>
        <br />
        Longest round duration: <span id="stat-summary-longest">{formatTime(stats.longest)}</span>
        <br /><br />
        Most productive time: <span>{getMostProductiveTime(stats.hourlyDistribution)}</span>
        <br />
        Most productive day: <span>{getMostProductiveTime(stats.dailyDistribution)}</span>
        <br />
        Most productive month: <span>{getMostProductiveTime(stats.monthlyDistribution)}</span>
      </div>

      <h2>Task Distribution</h2>
      <TaskBarChart data={stats.taskDistribution} />

      <h2>Daily Distribution</h2>
      <TaskBarChart 
        data={[
          { name: 'Monday', time: stats.dailyDistribution['Monday'] || 0 },
          { name: 'Tuesday', time: stats.dailyDistribution['Tuesday'] || 0 },
          { name: 'Wednesday', time: stats.dailyDistribution['Wednesday'] || 0 },
          { name: 'Thursday', time: stats.dailyDistribution['Thursday'] || 0 },
          { name: 'Friday', time: stats.dailyDistribution['Friday'] || 0 },
          { name: 'Saturday', time: stats.dailyDistribution['Saturday'] || 0 },
          { name: 'Sunday', time: stats.dailyDistribution['Sunday'] || 0 }
        ]} 
      />

      <h2>Hourly Distribution</h2>
      <TaskBarChart 
        data={[
          { name: '00:00 - 03:00', time: Object.entries(stats.hourlyDistribution)
            .filter(([hour]) => parseInt(hour) >= 0 && parseInt(hour) < 3)
            .reduce((sum, [_, time]) => sum + time, 0) },
          { name: '03:00 - 06:00', time: Object.entries(stats.hourlyDistribution)
            .filter(([hour]) => parseInt(hour) >= 3 && parseInt(hour) < 6)
            .reduce((sum, [_, time]) => sum + time, 0) },
          { name: '06:00 - 09:00', time: Object.entries(stats.hourlyDistribution)
            .filter(([hour]) => parseInt(hour) >= 6 && parseInt(hour) < 9)
            .reduce((sum, [_, time]) => sum + time, 0) },
          { name: '09:00 - 12:00', time: Object.entries(stats.hourlyDistribution)
            .filter(([hour]) => parseInt(hour) >= 9 && parseInt(hour) < 12)
            .reduce((sum, [_, time]) => sum + time, 0) },
          { name: '12:00 - 15:00', time: Object.entries(stats.hourlyDistribution)
            .filter(([hour]) => parseInt(hour) >= 12 && parseInt(hour) < 15)
            .reduce((sum, [_, time]) => sum + time, 0) },
          { name: '15:00 - 18:00', time: Object.entries(stats.hourlyDistribution)
            .filter(([hour]) => parseInt(hour) >= 15 && parseInt(hour) < 18)
            .reduce((sum, [_, time]) => sum + time, 0) },
          { name: '18:00 - 21:00', time: Object.entries(stats.hourlyDistribution)
            .filter(([hour]) => parseInt(hour) >= 18 && parseInt(hour) < 21)
            .reduce((sum, [_, time]) => sum + time, 0) },
          { name: '21:00 - 24:00', time: Object.entries(stats.hourlyDistribution)
            .filter(([hour]) => parseInt(hour) >= 21 && parseInt(hour) < 24)
            .reduce((sum, [_, time]) => sum + time, 0) }
        ]} 
      />

      <h2>Weekly Focus Heatmap</h2>
      <HeatmapCalendar data={stats.weeklyHeatmap} />

      <h2>Monthly Distribution</h2>
      <TaskBarChart 
        data={Object.entries(stats.monthlyDistribution).map(([name, time]) => ({ name, time }))} 
      />

      <h2>Session History</h2>
      <SessionList sessions={sessions} onDelete={handleDelete} />
    </PageLayout>
  )
} 