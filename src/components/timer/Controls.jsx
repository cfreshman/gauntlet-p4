import { useState } from 'react'
import { useTimerStore } from '../../store/timerStore'
import { useAudioStore } from '../../store/audioStore'
import { IconButton } from '../common/IconButton'

export function Controls() {
  const { roundInfo } = useTimerStore()
  const { focusNum } = roundInfo
  const { volume, setVolume, audioType } = useAudioStore()
  const [showVolume, setShowVolume] = useState(false)

  return (
    <div className="controls-container">
      <IconButton
        id="resetround"
        title="Reset Current Timer"
        icon="replay"
        className="control-button"
        onClick={() => useTimerStore.getState().resetRoundInfo()}
      />

      <div id="roundno" title="Number of Focus Rounds" className="round-number">
        {focusNum}
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
        className="control-button"
        onClick={() => useTimerStore.getState().nextRound()}
      />
    </div>
  )
} 