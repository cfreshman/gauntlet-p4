import { useState } from 'react'

export function FirstLoad() {
  const [show, setShow] = useState(true)

  const handleClose = () => {
    setShow(false)
    localStorage.setItem('hasVisitedBefore', 'true')
  }

  if (!show) return null

  return (
    <div id="firstload">
      <div id="firstloadcontent">
        <h2>Welcome to Gomodoro</h2>
        <p>
          A <a href="https://github.com/lazy-guy/tomodoro" target="_blank" rel="noopener noreferrer">Tomodoro</a> fork with cloud sync and analytics, built during GauntletAI.
        </p>

        <div className="features">
          <div className="feature">
            <span className="material-icons-round">category</span>
            <div>
              <h3>Tasks</h3>
              <p>Categories of work to track your time against</p>
            </div>
          </div>
          <div className="feature">
            <span className="material-icons-round">schedule</span>
            <div>
              <h3>Sessions</h3>
              <p>Define work/break patterns and session goals</p>
            </div>
          </div>
          <div className="feature">
            <span className="material-icons-round">insights</span>
            <div>
              <h3>Tracking</h3>
              <p>See how you spend time across tasks and days</p>
            </div>
          </div>
        </div>

        <button 
          id="closeintro" 
          className="primary-button"
          onClick={handleClose}
        >
          Get Started
        </button>
      </div>
    </div>
  )
} 