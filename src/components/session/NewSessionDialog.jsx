import { useState, useEffect } from 'react'
import { useTimerStore } from '../../store/timerStore'

const PRESET_PATTERNS = [
  {
    name: 'Classic Pomodoro',
    pattern: '25-5-25-5-25-5-25-15',
    description: '4 focus periods with short breaks and a long break'
  },
  {
    name: 'Deep Focus',
    pattern: '50-10',
    description: 'Extended focus with longer break'
  }
]

function calculateTotalTime(pattern) {
  if (!pattern) return 0
  return pattern.split('-').reduce((sum, time) => sum + parseInt(time, 10), 0)
}

function formatTotalTime(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

export function NewSessionDialog() {
  const [selectedPattern, setSelectedPattern] = useState(PRESET_PATTERNS[0].pattern)
  const [showCustom, setShowCustom] = useState(false)
  const [customPattern, setCustomPattern] = useState(() => {
    return localStorage.getItem('customPattern') || ''
  })
  const [goals, setGoals] = useState('')

  const currentPattern = showCustom ? customPattern : selectedPattern
  const totalTime = calculateTotalTime(currentPattern)
  const isValidPattern = validatePattern(currentPattern)

  // Save custom pattern to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('customPattern', customPattern)
  }, [customPattern])

  function handleSubmit(e) {
    e.preventDefault()
    const pattern = showCustom ? customPattern : selectedPattern
    
    if (!validatePattern(pattern)) {
      alert('Invalid pattern format. Use numbers separated by hyphens (e.g., 25-5-25-15)')
      return
    }

    const { currentSession, roundInfo } = useTimerStore.getState()
    
    if (currentSession && roundInfo.running) {
      if (!confirm('This will end your current session. Are you sure?')) {
        return
      }
    }

    useTimerStore.getState().startNewSession(pattern, goals)
    closeDialog()
  }

  function validatePattern(pattern) {
    return /^(\d+)(-\d+)*$/.test(pattern)
  }

  function closeDialog() {
    setSelectedPattern(PRESET_PATTERNS[0].pattern)
    setShowCustom(false)
    setGoals('')
    document.getElementById('newsession').close()
  }

  return (
    <dialog id="newsession" className="modal">
      <div className="modal-content">
        <h2>Start New Session</h2>
        
        <div className="pattern-select">
          <h3>Choose Pattern</h3>
          <div className="pattern-grid">
            {PRESET_PATTERNS.map(preset => (
              <button
                key={preset.pattern}
                className={`pattern-btn ${selectedPattern === preset.pattern && !showCustom ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedPattern(preset.pattern)
                  setShowCustom(false)
                }}
              >
                <h4>{preset.name}</h4>
                <div className="pattern-preview">{preset.pattern}</div>
                <div className="pattern-desc">{preset.description}</div>
                <div className="pattern-total">{formatTotalTime(calculateTotalTime(preset.pattern))}</div>
              </button>
            ))}
            
            <button
              className={`pattern-btn ${showCustom ? 'selected' : ''}`}
              onClick={() => setShowCustom(true)}
            >
              <h4>Custom Pattern</h4>
              {customPattern && isValidPattern ? (
                <>
                  <div className="pattern-preview">{customPattern}</div>
                  <div className="pattern-desc">Custom focus-break pattern</div>
                  <div className="pattern-total">{formatTotalTime(calculateTotalTime(customPattern))}</div>
                </>
              ) : (
                <div className="pattern-desc">Create your own pattern</div>
              )}
            </button>
          </div>
        </div>

        {showCustom && (
          <div className="custom-pattern-input">
            <h3>Custom Pattern</h3>
            <input
              type="text"
              id="pattern-input"
              placeholder="Example: 25-5-25-5-25-15"
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
            />
            <div className="pattern-help">Format: focus-break-focus-break (minutes)</div>
          </div>
        )}

        <div className="session-goals">
          <h3>Session Goals</h3>
          <textarea
            id="session-goals"
            placeholder="What do you want to accomplish in this session?"
            rows="3"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
          />
        </div>

        <div className="dialog-buttons">
          <button className="secondary" onClick={closeDialog}>
            Cancel
          </button>
          <button className="primary" onClick={handleSubmit}>
            Start Session
          </button>
        </div>
      </div>
    </dialog>
  )
} 