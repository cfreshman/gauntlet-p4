import { useState } from 'react'
import { useThemeStore } from '../../store/themeStore'
import { useNotificationStore } from '../../store/notificationStore'
import { useAudioStore } from '../../store/audioStore'
import { PageLayout } from '../common/PageLayout'
import { signOut } from '../../supabase-client'

let openMenu = null

export function Menu() {
  const [isOpen, setIsOpen] = useState(false)
  const { theme, accent, setTheme, getThemeColors } = useThemeStore()
  const { enabled: notifEnabled, silent, setNotificationSettings } = useNotificationStore()
  const { audioType, setAudioType } = useAudioStore()

  // Store the setIsOpen function for external use
  openMenu = () => setIsOpen(true)

  return (
    <PageLayout
      id="menu"
      title="Settings"
      onClose={() => setIsOpen(false)}
      isOpen={isOpen}
    >
      <section className="section">
        <h2>Appearance</h2>
        <div className="setting">
          <label htmlFor="theme-select">Theme:</label>
          <select
            name="theme"
            id="theme-select"
            title="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="dark">Dark</option>
            <option value="black">Black</option>
            <option value="light">Light</option>
            <option value="white">White</option>
          </select>
        </div>

        <div className="setting" id="accents">
          <h3>Accent Color:</h3>
          <div id="colors">
            {getThemeColors().map(color => (
              <button
                key={color}
                className="color"
                style={{ backgroundColor: `var(--coloraccent-${color})` }}
                data-active={accent === color}
                onClick={() => setTheme(theme, color)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Sounds & Notifications</h2>
        <div className="setting">
          <label htmlFor="notif-select">Notifications:</label>
          <select
            name="notif"
            id="notif-select"
            title="Notification Type"
            value={notifEnabled ? (silent ? 'silent' : 'enabled') : 'disabled'}
            onChange={(e) => {
              const value = e.target.value
              setNotificationSettings(
                value !== 'disabled',
                value === 'silent'
              )
            }}
          >
            <option value="enabled">Enabled</option>
            <option value="silent">Silent</option>
            <option value="disabled">Disabled</option>
          </select>
          <br /><br />
          Make sure that your browser allows notifications from this site.
        </div>

        <div className="setting">
          <label htmlFor="audio-select">White Noise:</label>
          <select
            name="audio"
            id="audio-select"
            title="Audio Type"
            value={audioType}
            onChange={(e) => setAudioType(e.target.value)}
          >
            <option value="disabled">Disabled</option>
            <option value="noise">Enabled</option>
          </select>
          <br /><br />
          If enabled, white noise will be played during focus sessions.
          Make sure that your browser allows sound from this site.
        </div>
      </section>

      <section className="section">
        <h2>Account</h2>
        <button 
          className="action-button"
          onClick={async () => {
            await signOut()
            setIsOpen(false)
          }}
        >
          Sign Out
        </button>
      </section>

      <section className="section">
        <h2>About Gomodoro</h2>
        <div id="about-desc">
          Gomodoro is an AI-enhanced Pomodoro timer that helps you track and analyze your focus sessions.
          It extends the open-source Tomodoro timer with cloud sync and AI features.
          Built as part of GauntletAI.
        </div>
        
        <a
          href="https://github.com/lazy-guy/tomodoro"
          id="github-link"
          target="_blank"
          className="button-link"
          rel="noopener noreferrer"
        >
          <img alt="GitHub" src="/GitHub-Mark-64px.png" />
          View Original Tomodoro
        </a>

        <div className="support-text">Support the original Tomodoro creator:</div>
        <a 
          href="https://ko-fi.com/Z8Z6E84CZ" 
          target="_blank" 
          id="kofi-link"
          rel="noopener noreferrer"
        >
          <img
            height="36"
            style={{ border: 0, height: 36 }}
            src="https://cdn.ko-fi.com/cdn/kofi2.png?v=3"
            alt="Support the original Tomodoro creator on Ko-fi"
          />
        </a>
      </section>

      <section className="section">
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
      </section>
    </PageLayout>
  )
}

// Export the open function for external use
Menu.open = () => openMenu?.(); 