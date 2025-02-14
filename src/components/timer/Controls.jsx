import { useState } from 'react'
import { useTimerStore } from '../../store/timerStore'
import { useAudioStore } from '../../store/audioStore'
import { IconButton } from '../common/IconButton'

export function Controls() {
  const { timerState, currentSession } = useTimerStore()
  const { pattern_position } = timerState
  const [isNexting, setIsNexting] = useState(false)
  // Calculate focus round number (every even position is a focus round)
  const focusNum = Math.floor((pattern_position + 2) / 2)
  // Calculate total focus rounds from pattern
  const totalRounds = currentSession ? 
    Math.ceil(currentSession.pattern.split('-').length / 2) : 
    1
  
  const { volume, setVolume, audioType } = useAudioStore()
  const [showVolume, setShowVolume] = useState(false)

  const handleNext = async () => {
    if (isNexting) return
    setIsNexting(true)
    try {
      await useTimerStore.getState().nextRound()
    } catch (error) {
      console.error('Error moving to next round:', error)
      // Force reload timer state to ensure sync
      await useTimerStore.getState().loadTimerState()
    } finally {
      setIsNexting(false)
    }
  }

  return (
    <div className="controls-container">
      <IconButton
        id="resetround"
        title="Reset Current Timer"
        icon="replay"
        className="control-button"
        onClick={() => useTimerStore.getState().setElapsedTime(0)}
      />

      <div id="roundno" title="Number of Focus Rounds" className="round-number">
        {focusNum}/{totalRounds}
      </div>

      {audioType === 'noise' && (
        <div 
          id="slider-container" 
          onMouseEnter={() => setShowVolume(true)}
          onMouseLeave={() => setShowVolume(false)}
        >
          <div id="slider-overlay" className={showVolume ? 'active' : ''}>
            <span id="volume-value">{volume}</span>
            <input
              type="range"
              orient="vertical"
              id="volume-slider"
              min="0"
              max="100"
              step="1"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
            />
          </div>

          <IconButton
            id="volume-button"
            title="Adjust White Noise Volume"
            icon={volume === 0 ? 'volume_off' : 'volume_up'}
            className="control-button"
            onClick={() => setVolume(volume === 0 ? 80 : 0)}
          />
        </div>
      )}

      <IconButton
        id="next"
        title="Next Round"
        icon="skip_next"
        className={`control-button ${isNexting ? 'disabled' : ''}`}
        onClick={handleNext}
        disabled={isNexting}
      />
    </div>
  )
} 