import { useState, useEffect } from 'react'
import { useTaskStore } from '../../store/taskStore'
import { PageLayout } from '../common/PageLayout'

export function TaskManager() {
  const { tasks, addTask, deleteTask } = useTaskStore()
  const [newTaskName, setNewTaskName] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Add event listener to show/hide task manager
    const tasksEl = document.getElementById('managetasks')
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'style') {
          const display = tasksEl.style.display
          setIsOpen(display === 'flex')
        }
      })
    })
    
    observer.observe(tasksEl, { attributes: true })
    return () => observer.disconnect()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedName = newTaskName.trim()
    if (!trimmedName) return
    
    await addTask(trimmedName)
    setNewTaskName('')
  }

  // If there are no tasks, show the forced task creation UI
  if (tasks.length === 0) {
    return (
      <div id="managetasks" style={{ display: 'flex' }}>
        <div className="tasks-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ color: 'var(--coloraccent)', marginBottom: '1rem' }}>Welcome to Gomodoro</h1>
          <div style={{ marginBottom: '2rem', maxWidth: '500px', lineHeight: '1.6' }}>
            Before you can start using the timer, you need to create at least one task to track.
            Tasks help you categorize and analyze how you spend your focus time.
          </div>
          
          <form id="newtask" className="task" onSubmit={handleSubmit} style={{ maxWidth: '400px', width: '100%' }}>
            <input
              type="text"
              maxLength="25"
              placeholder="Enter your first task (e.g., Coding, Writing, Study)"
              className="task-input"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              style={{ padding: '1rem' }}
              autoFocus
            />
            <span 
              className="material-icons-round"
              onClick={handleSubmit}
              style={{ cursor: 'pointer' }}
            >
              add
            </span>
          </form>
        </div>
      </div>
    )
  }

  // Normal task management UI when tasks exist
  return (
    <PageLayout
      id="managetasks"
      title="Tasks"
      onClose={() => setIsOpen(false)}
      isOpen={isOpen}
    >
      <div className="task-count">
        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
      </div>
      <div id="task-container">
        {tasks.map(task => (
          <div key={task.id} className="task">
            <div className="task-name">{task.name}</div>
            <span 
              className="material-icons-round"
              onClick={() => deleteTask(task.id)}
              style={{ cursor: 'pointer' }}
            >
              delete
            </span>
          </div>
        ))}
      </div>

      <form id="newtask" className="task" onSubmit={handleSubmit}>
        <input
          type="text"
          maxLength="25"
          placeholder="Add new task"
          className="task-input"
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
        />
        <span 
          className="material-icons-round"
          onClick={handleSubmit}
          style={{ cursor: 'pointer' }}
        >
          add
        </span>
      </form>
    </PageLayout>
  )
} 