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
}

// Load cached data from localStorage
const loadCachedData = (): HeaderData | null => {
  const cached = localStorage.getItem('ai_header_data')
  if (cached) {
    const data = JSON.parse(cached)
    // Check if cache is less than 24 hours old
    const cacheAge = Date.now() - new Date(data.cachedAt).getTime()
    if (cacheAge < 24 * 60 * 60 * 1000) {
      return data
    }
  }
  return null
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
  }
})) 