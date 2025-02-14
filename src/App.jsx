import { useEffect, useState } from 'react'
import { TopNav } from './components/layout/TopNav'
import { Timer } from './components/timer/Timer'
import { Controls } from './components/timer/Controls'
import { Menu } from './components/menu/Menu'
import { Statistics } from './components/statistics/Statistics'
import { TaskManager } from './components/tasks/TaskManager'
import { TaskSelector } from './components/tasks/TaskSelector'
import { NewSessionDialog } from './components/session/NewSessionDialog'
import { CurrentSession } from './components/session/CurrentSession'
import { SyncIndicator } from './components/common/SyncIndicator'
import { FirstLoad } from './components/common/FirstLoad'
import { useThemeStore } from './store/themeStore'
import { useNotificationStore } from './store/notificationStore'
import { useTaskStore } from './store/taskStore'
import { useTimerStore } from './store/timerStore'
import { supabase, subscribeToTimer } from './supabase-client'

export function App() {
  const { theme, accent, setTheme } = useThemeStore()
  const { setup: setupNotifications } = useNotificationStore()
  const loadTasks = useTaskStore(state => state.loadTasks)
  const tasks = useTaskStore(state => state.tasks)
  const loadTimerState = useTimerStore(state => state.loadTimerState)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initial setup
    async function initialize() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setTheme(theme, accent)
          setupNotifications()
          await Promise.all([
            loadTasks(),
            loadTimerState()
          ])

          // Subscribe to timer changes
          const subscription = await subscribeToTimer(async (payload) => {
            if (payload.eventType === 'UPDATE') {
              const { elapsed_time, is_running, pattern_position, current_session_id, current_task_id } = payload.new
              const timerState = useTimerStore.getState().timerState
              
              // Only update if the state is different
              if (timerState.elapsed_time !== elapsed_time ||
                  timerState.is_running !== is_running ||
                  timerState.pattern_position !== pattern_position ||
                  timerState.current_session_id !== current_session_id ||
                  timerState.current_task_id !== current_task_id) {
                await loadTimerState()
              }
            }
          })

          return () => {
            subscription.unsubscribe()
          }
        }
      } catch (error) {
        console.error('Error initializing app:', error)
      } finally {
        setIsLoading(false)
      }
    }

    const cleanup = initialize()
    return () => {
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then(fn => fn && fn())
      }
    }
  }, [])

  // Subscribe to auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTheme(theme, accent)
        setupNotifications()
        await Promise.all([
          loadTasks(),
          loadTimerState()
        ])
      }
    })

    return () => subscription?.unsubscribe()
  }, [])

  if (isLoading) {
    return (
      <div className="loading">
        <svg viewBox="0 0 120 120">
          <circle
            className="loading-ring"
            cx="60"
            cy="60"
            r="54"
            fill="none"
            strokeWidth="8"
          />
        </svg>
      </div>
    )
  }

  // If no tasks exist, only show the task manager and first load
  if (tasks.length === 0) {
    return (
      <>
        <FirstLoad />
        <TaskManager />
      </>
    )
  }

  return (
    <>
      <TopNav />
      
      <main id="main">
        <Timer />
        <Controls />
      </main>

      <TaskSelector />
      <CurrentSession />
      <Menu />
      <Statistics />
      <TaskManager />
      <NewSessionDialog />
      <SyncIndicator />
    </>
  )
} 