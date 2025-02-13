import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { supabase } from '../../supabase-client'

export const useTaskStore = create(
  persist(
    (set, get) => ({
      tasks: [],
      selectedTaskId: null,
      
      loadTasks: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })

          if (error) throw error
          
          set({ 
            tasks: tasks.map(task => ({
              id: task.id,
              name: task.name
            }))
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
            }]
          }))

          return task.id
        } catch (error) {
          console.error('Error creating task:', error)
          // If offline or error, create local task
          const task = {
            id: nanoid(),
            name: title
          }
          
          set(state => ({
            tasks: [...state.tasks, task]
          }))
          
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
        set({ selectedTaskId: id })
      },
      
      getSelectedTask: () => {
        const state = get()
        return state.tasks.find(task => task.id === state.selectedTaskId)
      }
    }),
    {
      name: 'gomodoro-tasks'
    }
  )
) 