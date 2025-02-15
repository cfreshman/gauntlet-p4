import { supabase } from '../supabase-client'

export async function planSession(taskData) {
  try {
    const { data, error } = await supabase.functions.invoke('plan-session', {
      body: { 
        task: taskData.task.name,
        timeBlockMinutes: taskData.timeBlockMinutes,
        goals: taskData.goals,
        sessions: taskData.sessions.map(session => ({
          pattern: session.pattern,
          goals: session.goals,
          rounds: session.rounds.map(round => ({
            duration: round.duration,
            notes: round.notes
          }))
        }))
      }
    })

    if (error) throw error
    return data

  } catch (error) {
    console.error('Error planning session:', error)
    return {
      pattern: '25-5-25-5-25-15',
      explanation: 'Failed to get AI recommendations. Using default Pomodoro pattern.'
    }
  }
} 