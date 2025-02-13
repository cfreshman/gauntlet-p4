import { create } from 'zustand'
import { persist } from 'zustand/middleware'

class AudioController {
  constructor() {
    this.audioCtx = null
    this.noiseSource = null
    this.gain = null
    this.noiseTimeout = null
    this.isWhiteNoiseRunning = false
    this.isFadingOut = false
  }

  initNoise() {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext()
    }
    const bufferSize = this.audioCtx.sampleRate * 3
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate)
    let data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    this.noiseSource = this.audioCtx.createBufferSource()
    this.noiseSource.buffer = buffer

    this.gain = this.audioCtx.createGain()
    this.noiseSource.connect(this.gain)
    this.gain.connect(this.audioCtx.destination)
  }

  playNoise() {
    this.noiseSource.loop = true
    this.noiseSource.start()
    this.isWhiteNoiseRunning = true
  }

  stopNoise() {
    if (this.noiseSource) {
      this.noiseSource.stop()
    }
    this.isWhiteNoiseRunning = false
    this.isFadingOut = false
  }

  fadeOut() {
    if (!this.isWhiteNoiseRunning) return
    this.isFadingOut = true
    this.gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 1)
    this.noiseTimeout = setTimeout(() => this.stopNoise(), 1000)
  }

  fadeIn(volume) {
    clearTimeout(this.noiseTimeout)
    if (!this.isFadingOut) {
      this.initNoise()
      this.gain.gain.setValueAtTime(0, this.audioCtx.currentTime)
      this.gain.gain.linearRampToValueAtTime(volume / 100, this.audioCtx.currentTime + 1)
      this.playNoise()
    } else {
      this.gain.gain.setValueAtTime(this.gain.gain.value, this.audioCtx.currentTime)
      this.gain.gain.linearRampToValueAtTime(volume / 100, this.audioCtx.currentTime + 1)
    }
  }

  setVolume(volume) {
    if (this.gain) {
      this.gain.gain.linearRampToValueAtTime(volume / 100, this.audioCtx.currentTime)
    }
  }
}

export const useAudioStore = create(
  persist(
    (set, get) => {
      const controller = new AudioController()

      return {
        audioType: 'disabled',
        volume: 80,
        controller,

        setAudioType: (type) => {
          const { volume } = get()
          if (type !== 'noise' && controller.isWhiteNoiseRunning) {
            controller.fadeOut()
          }
          set({ audioType: type })
        },

        setVolume: (volume) => {
          controller.setVolume(volume)
          set({ volume })
        },

        fadeIn: () => {
          const { volume } = get()
          controller.fadeIn(volume)
        },

        fadeOut: () => {
          controller.fadeOut()
        }
      }
    },
    {
      name: 'gomodoro-audio',
      partialize: (state) => ({
        audioType: state.audioType,
        volume: state.volume
      })
    }
  )
) 