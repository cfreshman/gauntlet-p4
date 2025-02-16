import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from '../supabase-client'
import { useTimerStore } from './timerStore'

export const useTaskStore = create((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  
  loadTasks: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Make sure timer record exists first
      await useTimerStore.getState().loadTimerState()

      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      
      set(state => {
        const tasks = tasksData.map(task => ({
          id: task.id,
          name: task.name
        }))
        // If we have tasks but no selection, select the first task
        const selectedTaskId = state.selectedTaskId || (tasks.length > 0 ? tasks[0].id : null)
        if (selectedTaskId) {
          // Only sync if the task exists in the database
          const taskExists = tasks.some(task => task.id === selectedTaskId)
          if (taskExists) {
            useTimerStore.getState().setCurrentTask(selectedTaskId)
          }
        }
        return { tasks, selectedTaskId }
      })
    } catch (error) {
      console.error('Error loading tasks:', error)
    }
  },

  addTask: async (title) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Must be logged in to create tasks')

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          name: title,
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error

      set(state => ({
        tasks: [...state.tasks, {
          id: task.id,
          name: task.name
        }],
        selectedTaskId: task.id
      }))

      // Set as current task in timer store
      useTimerStore.getState().setCurrentTask(task.id)

      return task.id
    } catch (error) {
      console.error('Error creating task:', error)
      // If offline or error, create local task
      const task = {
        id: nanoid(),
        name: title
      }
      
      set(state => ({
        tasks: [...state.tasks, task],
        selectedTaskId: task.id
      }))

      // Set as current task in timer store
      useTimerStore.getState().setCurrentTask(task.id)
      
      return task.id
    }
  },
  
  deleteTask: async (id) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .match({ id })

      if (error) throw error

      set(state => ({
        tasks: state.tasks.filter(task => task.id !== id),
        selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId
      }))
    } catch (error) {
      console.error('Error deleting task:', error)
      // If offline or error, just delete locally
      set(state => ({
        tasks: state.tasks.filter(task => task.id !== id),
        selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId
      }))
    }
  },
  
  selectTask: (id) => {
    console.log('Task store: selecting task:', id)
    set({ selectedTaskId: id })
    // Sync with timer store
    useTimerStore.getState().setCurrentTask(id)
  },
  
  getSelectedTask: () => {
    const state = get()
    return state.tasks.find(task => task.id === state.selectedTaskId)
  }
})) 