import { useState, useEffect } from 'react'
import { useTaskStore } from '../../store/taskStore'
import { PageLayout } from '../common/PageLayout'
import { PieChart } from './PieChart'
import { TaskBarChart } from './TaskBarChart'
import { RoundEntries } from './RoundEntries'
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
      <div className="setting">
        <h3>Show Statistics of:</h3>
        <div id="filters" className="scrollbar">
          <label className="task-chip">
            <input
              type="checkbox"
              id="all"
              checked={selectedTasks.includes('all')}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedTasks(['all'])
                } else {
                  setSelectedTasks([])
                }
              }}
            />
            <span className="chip-task-name">All Tasks</span>
          </label>
          {tasks.map(task => (
            <label key={task.id} className="task-chip">
              <input
                type="checkbox"
                checked={selectedTasks.includes(task.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTasks(prev => 
                      prev.includes('all') ? [task.id] : [...prev, task.id]
                    )
                  } else {
                    setSelectedTasks(prev => prev.filter(id => id !== task.id))
                  }
                }}
              />
              <span className="chip-task-name">{task.title}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="setting">
        <label htmlFor="stat-time-select">Time Period: </label>
        <select
          id="stat-time-select"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
        >
          {Object.entries(TIME_PERIODS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <br /><br />
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
      </div>

      <h2>Time Distribution:</h2>
      <div id="pie-container">
        <PieChart data={stats.taskDistribution} />
        <TaskBarChart data={stats.taskDistribution} />
      </div>

      <div id="remark-hourly" className="remark">
        You were most productive between{' '}
        <span className="remark-value">
          {getMostProductiveTime(stats.hourlyDistribution)}
        </span>
      </div>

      <div id="remark-daily" className="remark">
        You were most productive on{' '}
        <span className="remark-value">
          {getMostProductiveTime(stats.dailyDistribution)}
        </span>
      </div>

      <div id="remark-monthly" className="remark">
        You were most productive in{' '}
        <span className="remark-value">
          {getMostProductiveTime(stats.monthlyDistribution)}
        </span>
      </div>

      <RoundEntries />
    </PageLayout>
  )
} 