import { create } from 'zustand'
import { getAICompanionHeader } from '../api/ai-companion'

type HeaderData = {
  message: string
  imageUrl: string
  cachedAt: string
}

type AIStore = {
  headerData: HeaderData | null
  isLoading: boolean
  error: string | null
  fetchHeaderData: () => Promise<void>
  updateHeaderImage: (base64Image: string) => void
}

// Load cached data from localStorage
function loadCachedData(): HeaderData | null {
  const cached = localStorage.getItem('ai_header_data')
  if (!cached) return null
  return JSON.parse(cached)
}

export const useAIStore = create<AIStore>((set) => ({
  headerData: loadCachedData(),
  isLoading: false,
  error: null,

  fetchHeaderData: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await getAICompanionHeader()
      // Cache the data
      localStorage.setItem('ai_header_data', JSON.stringify(data))
      set({ headerData: data })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load AI analysis' })
    } finally {
      set({ isLoading: false })
    }
  },

  updateHeaderImage: (base64Image: string) => {
    set(state => {
      if (!state.headerData) return state
      const newData = {
        ...state.headerData,
        imageUrl: base64Image
      }
      // Update cache
      localStorage.setItem('ai_header_data', JSON.stringify(newData))
      return { headerData: newData }
    })
  }
})) 