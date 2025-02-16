import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { useTimerStore } from '../../store/timerStore'
import { useTaskStore } from '../../store/taskStore'
import { IconButton } from '../common/IconButton'
import { Menu } from '../menu/Menu'
import { Timer } from '../timer/Timer'
import { AICompanion } from '../ai/AICompanion'

export function TopNav() {
  const tasks = useTaskStore(state => state.tasks)
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const pipWindowRef = useRef(null)
  const pipRootRef = useRef(null)

  // Don't show nav if no tasks exist
  if (tasks.length === 0) {
    return null
  }

  useEffect(() => {
    // Create canvas and video elements for standard PIP fallback
    const canvas = document.createElement('canvas')
    canvas.width = 300
    canvas.height = 300
    canvasRef.current = canvas

    const video = document.createElement('video')
    video.id = 'pip'
    video.autoplay = true
    video.muted = true
    video.style.display = 'none'
    document.body.appendChild(video)
    videoRef.current = video

    // Set up video stream from canvas
    const stream = canvas.captureStream()
    video.srcObject = stream

    // Draw timer function for standard PIP
    const drawTimer = () => {
      const { timerState, currentSession } = useTimerStore.getState()
      const { elapsed_time, is_running, pattern_position } = timerState
      
      // Get current round duration from pattern
      const rounds = currentSession?.pattern.split('-').map(Number) || [25]
      const duration = (rounds[pattern_position] || 25) * 60
      const minutes = Math.floor((duration - elapsed_time) / 60)
      const seconds = (duration - elapsed_time) % 60

      const ctx = canvas.getContext('2d')
      
      // Clear canvas
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bgcolor')
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw progress ring
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const radius = 120
      const progress = 1 - (elapsed_time / duration)
      const startAngle = -Math.PI / 2
      const endAngle = startAngle + (2 * Math.PI * progress)

      // Background ring
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--bgcolor2')
      ctx.lineWidth = 12
      ctx.stroke()

      // Progress ring
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--coloraccent')
      ctx.lineWidth = 12
      ctx.lineCap = 'round'
      ctx.stroke()

      // Draw time
      ctx.font = 'bold 64px Inter'
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--color')
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        `${minutes}:${seconds.toString().padStart(2, '0')}`,
        centerX,
        centerY
      )

      requestAnimationFrame(drawTimer)
    }
    drawTimer()

    return () => {
      if (document.pictureInPictureElement === video) {
        document.exitPictureInPicture()
      }
      if (pipWindowRef.current) {
        pipWindowRef.current.close()
      }
      if (pipRootRef.current) {
        pipRootRef.current.unmount()
      }
      video.remove()
    }
  }, [])

  const enterPiP = async () => {
    try {
      // Check if running on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      
      if (isMobile) {
        // For mobile, make the video visible and let user trigger PIP through native controls
        if (videoRef.current) {
          videoRef.current.style.display = 'block'
          videoRef.current.style.position = 'fixed'
          videoRef.current.style.top = '0'
          videoRef.current.style.left = '0'
          videoRef.current.style.width = '100vw'
          videoRef.current.style.height = '100vh'
          videoRef.current.style.objectFit = 'contain'
          videoRef.current.style.backgroundColor = 'black'
          videoRef.current.style.zIndex = '10000'
          
          // Request fullscreen which can then be minimized to PIP on mobile
          await videoRef.current.requestFullscreen()
        }
      } else {
        // Desktop implementation
        if ('documentPictureInPicture' in window) {
          const pipWindow = await documentPictureInPicture.requestWindow({
            width: 300,
            height: 300
          })
          pipWindowRef.current = pipWindow

          // Set up the PIP window
          const container = pipWindow.document.createElement('div')
          container.style.width = '100%'
          container.style.height = '100%'
          container.style.backgroundColor = getComputedStyle(document.body).getPropertyValue('--bgcolor')
          container.className = 'pip-window'
          pipWindow.document.body.appendChild(container)
          
          // Copy styles
          const styles = document.querySelectorAll('style, link[rel="stylesheet"]')
          styles.forEach(style => pipWindow.document.head.appendChild(style.cloneNode(true)))
          
          // Create React root and render Timer
          const root = createRoot(container)
          pipRootRef.current = root
          root.render(<Timer isPip={true} />)
          
          // Clean up when PiP window closes
          pipWindow.addEventListener('unload', () => {
            root.unmount()
            pipRootRef.current = null
            pipWindowRef.current = null
          })
        } else {
          // Fall back to standard PiP
          if (videoRef.current) {
            await videoRef.current.requestPictureInPicture()
          }
        }
      }
    } catch (err) {
      console.error('PIP error:', err)
    }
  }

  return (
    <nav className="top-nav">
      <div className="nav-group">
        <IconButton
          id="newsessionbtn"
          title="Start New Session"
          icon="add_circle"
          className="nav-button"
          onClick={() => document.getElementById('newsession').showModal()}
        />

        <IconButton
          id="plansessionbtn"
          title="Plan Session"
          icon="schedule"
          className="nav-button"
          onClick={() => document.getElementById('sessionplanner').showModal()}
        />

        <IconButton
          id="statbtn"
          title="View Statistics"
          icon="bar_chart"
          className="nav-button"
          onClick={() => document.getElementById('statistics').style.display = 'flex'}
        />

        <IconButton
          id="menubtn"
          title="Open Settings"
          icon="menu"
          className="nav-button"
          onClick={Menu.open}
        />

        <IconButton
          id="aibtn"
          title="AI Companion"
          icon="auto_awesome"
          className="nav-button"
          onClick={AICompanion.open}
        />

        <IconButton
          id="popupbtn"
          title="Toggle PIP Mode"
          icon="picture_in_picture"
          className="nav-button"
          onClick={async () => {
            if (pipWindowRef.current) {
              pipWindowRef.current.close()
            } else if (document.pictureInPictureElement) {
              await document.exitPictureInPicture()
            } else if (videoRef.current && videoRef.current.style.display === 'block') {
              videoRef.current.style.display = 'none'
              if (document.fullscreenElement) {
                await document.exitFullscreen()
              }
            } else {
              await enterPiP()
            }
          }}
        />

        <IconButton
          id="managetaskbtn"
          title="Manage Tasks"
          icon="edit"
          className="nav-button"
          onClick={() => document.getElementById('managetasks').style.display = 'flex'}
        />
      </div>
    </nav>
  )
} 