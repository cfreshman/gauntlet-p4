import { useState, useEffect } from 'react'
import { useTaskStore } from '../../store/taskStore'
import { PageLayout } from '../common/PageLayout'
import { TaskBarChart } from './TaskBarChart'
import RoundEntries from './RoundEntries'
import { supabase } from '../../../supabase-client'

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
  monthlyDistribution: {}
}

export function Statistics() {
  const { tasks } = useTaskStore()
  const [selectedPeriod, setSelectedPeriod] = useState('7')
  const [selectedTasks, setSelectedTasks] = useState(['all'])
  const [stats, setStats] = useState(DEFAULT_STATS)
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // If no tasks are selected, show no data
    if (!selectedTasks.length) {
      setStats(DEFAULT_STATS)
      return
    }

    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    if (selectedPeriod !== 'all') {
      startDate.setDate(startDate.getDate() - parseInt(selectedPeriod))
    } else {
      startDate = new Date(0) // Beginning of time
    }

    // Build query
    let query = supabase
      .from('daily_sessions')
      .select(`
        *,
        task:tasks(id, name)
      `)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', now.toISOString())

    if (!selectedTasks.includes('all')) {
      query = query.in('task_id', selectedTasks)
    }

    const { data: sessions, error } = await query

    if (error) {
      console.error('Error fetching sessions:', error)
      return
    }

    if (!sessions?.length) {
      setStats(DEFAULT_STATS)
      return
    }

    // Process sessions
    const taskDist = {}
    const hourlyDist = {}
    const dailyDist = {}
    const monthlyDist = {}
    let total = 0
    let shortest = Infinity
    let longest = 0

    sessions.forEach(session => {
      const duration = session.actual_duration
      if (!duration) return

      // Task distribution
      const taskName = session.task?.name || 'Deleted Task'
      taskDist[taskName] = (taskDist[taskName] || 0) + duration

      // Time distributions
      const date = new Date(session.start_time)
      const hour = date.getHours()
      const hourKey = `${hour}:00-${hour + 1}:00`
      const dayKey = date.toLocaleDateString('en-US', { weekday: 'long' })
      const monthKey = date.toLocaleDateString('en-US', { month: 'long' })

      hourlyDist[hourKey] = (hourlyDist[hourKey] || 0) + duration
      dailyDist[dayKey] = (dailyDist[dayKey] || 0) + duration
      monthlyDist[monthKey] = (monthlyDist[monthKey] || 0) + duration

      // Update totals
      total += duration
      shortest = Math.min(shortest, duration)
      longest = Math.max(longest, duration)
    })

    setStats({
      total,
      rounds: sessions.length,
      average: Math.round(total / sessions.length),
      shortest: shortest === Infinity ? 0 : shortest,
      longest,
      taskDistribution: Object.entries(taskDist).map(([name, time]) => ({ name, time })),
      hourlyDistribution: hourlyDist,
      dailyDistribution: dailyDist,
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
                {task.title}
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

      <h2>Monthly Distribution</h2>
      <TaskBarChart 
        data={Object.entries(stats.monthlyDistribution).map(([name, time]) => ({ name, time }))} 
      />

      <RoundEntries />
    </PageLayout>
  )
} 