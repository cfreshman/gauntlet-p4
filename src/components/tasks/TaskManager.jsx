import { useState, useEffect } from 'react'
import { useTaskStore } from '../../store/taskStore'
import { IconButton } from '../common/IconButton'
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

  return (
    <PageLayout
      id="managetasks"
      title="Tasks"
      onClose={() => setIsOpen(false)}
      isOpen={isOpen}
    >
      {tasks.length > 0 ? (
        <>
          <div className="task-count">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </div>
          <div id="task-container">
            {tasks.map(task => (
              <div key={task.id} className="task">
                <div className="task-name">{task.title}</div>
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
        </>
      ) : (
        <div className="empty-state">
          <span className="material-icons-round">task</span>
          <div>No tasks yet</div>
          <div>Create a task to get started</div>
        </div>
      )}

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