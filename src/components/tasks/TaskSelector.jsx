import { useTaskStore } from '../../store/taskStore'

export function TaskSelector() {
  const { selectedTaskId } = useTaskStore()
  const tasks = useTaskStore(state => state.tasks)

  if (tasks.length === 0) return null

  return (
    <div className="task-selector">
      <h3>Task</h3>
      <select 
        name="task" 
        id="task-select" 
        title="Switch Task"
        value={selectedTaskId || ''}
        onChange={(e) => useTaskStore.getState().selectTask(e.target.value)}
      >
        {tasks.map(task => (
          <option key={task.id} value={task.id}>{task.name}</option>
        ))}
      </select>
    </div>
  )
} 