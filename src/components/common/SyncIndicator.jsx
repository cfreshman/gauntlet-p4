import { useState, useEffect } from 'react'

export function SyncIndicator() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const showIndicator = () => {
      setActive(true)
      setTimeout(() => setActive(false), 2000)
    }

    window.addEventListener('sync-start', showIndicator)
    return () => window.removeEventListener('sync-start', showIndicator)
  }, [])

  return (
    <div className={`sync-indicator ${active ? 'active' : ''}`}>
      <div className="sync-spinner" />
      <span>Syncing...</span>
    </div>
  )
} 