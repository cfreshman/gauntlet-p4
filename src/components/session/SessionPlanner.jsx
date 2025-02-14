import { useState } from 'react'
import { useTaskStore } from '../../store/taskStore'
import { useTimerStore } from '../../store/timerStore'
import { getTaskHistory, getSessionPatterns } from '../../supabase-client'
import { planSession } from '../../api/plan-session'
import { supabase } from '../../supabase-client'

export function SessionPlanner() {
  const [timeBlock, setTimeBlock] = useState(120) // Default 2 hours
  const [isLoading, setIsLoading] = useState(false)
  const [suggestedPlan, setSuggestedPlan] = useState(null)
  const [error, setError] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)
  
  const tasks = useTaskStore(state => state.tasks)
  const selectedTaskId = useTaskStore(state => state.selectedTaskId)

  const handlePlanSession = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Get user ID from Supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Get last 30 days of task history
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      
      // Convert date to ISO format for Supabase
      const isoStartDate = startDate.toISOString()
      
      // Fetch historical data
      const [taskHistory, sessionPatterns] = await Promise.all([
        getTaskHistory(selectedTaskId, isoStartDate),
        getSessionPatterns(user.id, isoStartDate)
      ])

      // Process data for LLM
      const taskData = {
        task: tasks.find(t => t.id === selectedTaskId),
        timeBlockMinutes: timeBlock,
        sessions: sessionPatterns.map(session => ({
          pattern: session.pattern,
          goals: session.goals,
          rounds: session.rounds || []
        }))
      }

      // Call LLM API
      const plan = await planSession(taskData)
      
      // Convert pattern to cycles format for UI
      const cycles = plan.pattern.split('-').reduce((acc, duration, i) => {
        if (i % 2 === 0) {
          acc.push({ focus: parseInt(duration), break: parseInt(plan.pattern.split('-')[i + 1] || 0) })
        }
        return acc
      }, [])

      setSuggestedPlan({
        cycles,
        explanation: plan.explanation
      })
    } catch (error) {
      console.error('Error generating session plan:', error)
      setError('Failed to generate plan. Please try again.')
      
      // Fallback to default pattern if no data or error
      setSuggestedPlan({
        cycles: [
          { focus: 25, break: 5 },
          { focus: 25, break: 5 },
          { focus: 25, break: 15 }
        ],
        explanation: "Using standard Pomodoro pattern as a fallback."
      })
    } finally {
      setIsLoading(false)
    }
  }

  const startPlannedSession = async () => {
    if (!suggestedPlan) return
    
    // Convert cycles to pattern string (e.g., "25-5-25-5-25-15")
    const pattern = suggestedPlan.cycles
      .map(cycle => `${cycle.focus}-${cycle.break}`)
      .join('-')
    
    await useTimerStore.getState().startNewSession(pattern)
    closeDialog()
  }

  function closeDialog() {
    setSuggestedPlan(null)
    setTimeBlock(120)
    setShowExplanation(false)
    document.getElementById('sessionplanner').close()
  }

  return (
    <dialog id="sessionplanner" className="modal">
      <div className="modal-content">
        <h2>Plan Session</h2>
        
        <div className="task-select">
          <h3>Task</h3>
          <select 
            value={selectedTaskId || ''}
            onChange={(e) => useTaskStore.getState().selectTask(e.target.value)}
          >
            {tasks.map(task => (
              <option key={task.id} value={task.id}>{task.name}</option>
            ))}
          </select>
        </div>

        <div className="time-select">
          <h3>Available Time</h3>
          <select
            value={timeBlock}
            onChange={(e) => setTimeBlock(Number(e.target.value))}
          >
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
            <option value={180}>3 hours</option>
            <option value={240}>4 hours</option>
            <option value={300}>5 hours</option>
            <option value={360}>6 hours</option>
            <option value={420}>7 hours</option>
            <option value={480}>8 hours</option>
          </select>
        </div>

        <button 
          className="action-button"
          onClick={handlePlanSession}
          disabled={isLoading || !selectedTaskId}
        >
          {isLoading ? 'Planning...' : 'Plan Session'}
        </button>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {suggestedPlan && (
          <div className="suggested-plan">
            <h3>Suggested Plan</h3>
            
            <div className="pattern-grid">
              <div className="pattern-btn selected">
                <h4>AI Recommended Pattern</h4>
                <div className="pattern-preview">
                  {suggestedPlan.cycles.map(cycle => `${cycle.focus}-${cycle.break}`).join('-')}
                </div>
                <div className="pattern-desc">
                  Personalized pattern based on your task history and preferences
                </div>
                <div className="pattern-total">
                  Total: {suggestedPlan.cycles.reduce((sum, cycle) => sum + cycle.focus + cycle.break, 0)}m
                </div>
              </div>
            </div>

            <button 
              className="explanation-toggle"
              onClick={() => setShowExplanation(!showExplanation)}
              aria-expanded={showExplanation}
            >
              <span className="material-icons-round">
                expand_more
              </span>
              View AI Explanation
            </button>
            
            <div className={`plan-explanation ${showExplanation ? 'visible' : ''}`}>
              {suggestedPlan.explanation}
            </div>
          </div>
        )}

        <div className="dialog-buttons">
          <button className="secondary" onClick={closeDialog}>
            Cancel
          </button>
          {suggestedPlan && (
            <button className="primary" onClick={startPlannedSession}>
              Start Session
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
} 