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

  function handleSubmit(e) {
    e.preventDefault()
    if (!newTaskName.trim()) return
    
    addTask(newTaskName)
    setNewTaskName('')
  }

  return (
    <PageLayout
      id="managetasks"
      title="Tasks"
      onClose={() => setIsOpen(false)}
      isOpen={isOpen}
    >
      <h2>Your Tasks</h2>

      <div id="task-container">
        {tasks.map(task => (
          <div key={task.id} className="task">
            <div className="task-name">{task.title}</div>
            <IconButton
              title="Delete Task"
              icon="delete"
              onClick={() => deleteTask(task.id)}
            />
          </div>
        ))}
      </div>

      <form id="newtask" className="task" onSubmit={handleSubmit}>
        <input
          id="new-task-name"
          name="taskname"
          type="text"
          maxLength="25"
          placeholder="Add New Task"
          className="task-input"
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
        />
        <button type="submit" title="Create new task" id="new-task-btn">
          <span className="material-icons-round">add</span>
        </button>
      </form>
    </PageLayout>
  )
} 