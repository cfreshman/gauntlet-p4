import { supabase } from '../supabase-client'

export type SearchRound = {
  id: string
  duration: number
  notes: string
  started_at: string
  pattern_position: number
  task: {
    name: string
  }
  score?: number
}

export type SearchSession = {
  id: string
  goals: string
  pattern: string
  created_at: string
  match_type: 'session' | 'round'
  score: number
  matching_rounds: SearchRound[]
}

export type SearchAnalysis = {
  summary: string
  patterns?: string[]
  insights?: string[]
}

export type SearchResponse = {
  results: SearchSession[]
  analysis: SearchAnalysis
}

export async function searchSessions(query: string): Promise<SearchResponse> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Must be logged in to search sessions')

  const { data, error } = await supabase.functions.invoke('search-sessions', {
    body: { 
      query,
      userId: user.id
    }
  })

  if (error) throw error
  return data
} 