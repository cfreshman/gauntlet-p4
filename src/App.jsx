import { useEffect } from 'react'
import { TopNav } from './components/layout/TopNav'
import { Timer } from './components/timer/Timer'
import { Controls } from './components/timer/Controls'
import { Menu } from './components/menu/Menu'
import { Statistics } from './components/statistics/Statistics'
import { TaskManager } from './components/tasks/TaskManager'
import { NewSessionDialog } from './components/session/NewSessionDialog'
import { CurrentSession } from './components/session/CurrentSession'
import { SyncIndicator } from './components/common/SyncIndicator'
import { FirstLoad } from './components/common/FirstLoad'
import { useThemeStore } from './store/themeStore'
import { useNotificationStore } from './store/notificationStore'
import { useTaskStore } from './store/taskStore'
import { useTimerStore } from './store/timerStore'

export function App() {
  const { theme, accent, setTheme } = useThemeStore()
  const { setup: setupNotifications } = useNotificationStore()
  const loadTasks = useTaskStore(state => state.loadTasks)
  const loadTimerState = useTimerStore(state => state.loadTimerState)

  useEffect(() => {
    // Initial setup
    setTheme(theme, accent)
    setupNotifications()
    loadTasks()
    loadTimerState()
  }, [])

  return (
    <>
      <TopNav />
      
      <main id="main">
        <Timer />
        <Controls />
      </main>

      <Menu />
      <Statistics />
      <TaskManager />
      <NewSessionDialog />
      <CurrentSession />
      <SyncIndicator />
      <FirstLoad />
    </>
  )
} 