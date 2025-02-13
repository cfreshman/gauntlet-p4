import { useState, useEffect } from 'react'

export function FirstLoad() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisitedBefore')
    if (!hasVisited) {
      setShow(true)
      localStorage.setItem('hasVisitedBefore', 'true')
    }
  }, [])

  if (!show) return null

  return (
    <div id="firstload">
      <div id="firstloadcontent">
        <h2>Welcome to Gomodoro!</h2>
        <p>
          Gomodoro is an AI-enhanced Pomodoro timer that helps you track and analyze your focus sessions. 
          Built as part of the GauntletAI project, it extends the open-source Tomodoro timer with cloud sync and AI features.
        </p>
        
        <br /><br />
        <h2>Features</h2>
        <ul id="new-list">
          <li>
            <h3>Cloud Sync & Analytics</h3>
            <div className="whats-new-desc">
              Your tasks and focus sessions are synced across devices and analyzed to provide insights into your productivity patterns.
            </div>
          </li>
          <li>
            <h3>AI Integration</h3>
            <div className="whats-new-desc">
              Coming soon: AI-powered task analysis and productivity insights.
            </div>
          </li>
        </ul>
        
        <br /><br />
        <h2>About PIP mode</h2>
        <p>
          Gomodoro supports Always on Top mode, or Picture-In-Picture mode, right in the browser.<br />
          PIP mode is supported on Chromium based browsers (tested on Chrome and Edge).<br />
          Safari not tested but might work.<br />
          On desktop Firefox, PIP button will only make the video visible but will not activate PIP. 
          To switch to PIP mode, right click on the video and select "Watch in Picture-In-Picture".
        </p>
        
        <br /><br />
        <h2>PIP mode on Chrome for Android</h2>
        <p>
          If you are using Chrome for Android, then the PIP button will make the video element visible. 
          In order to switch to PIP mode, make the video fullscreen and then go to your device's homescreen 
          (by pressing home button or using navigation gesture) without exiting fullscreen. 
          PIP Mode will be activated.
        </p>
      </div>
      
      <button 
        id="closeintro" 
        className="hover-shadow"
        onClick={() => setShow(false)}
      >
        Let's Get Started!
      </button>
    </div>
  )
} 