import { supabase } from '../supabase-client'

export type HeaderData = {
  message: string
  imageUrl: string
  cachedAt: string
}

export type ChatMessage = {
  type: 'text' | 'session'
  content: string
  pattern?: string
  goals?: string
  isUser?: boolean
  created_at?: string
}

export async function getChatMessages(): Promise<ChatMessage[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('ai_chats')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching messages:', error)
    throw error
  }

  if (!data) return []
  
  console.log('Fetched messages:', data.length) // Debug log
  
  return data.flatMap(msg => {
    if (msg.role === 'user') {
      return [{
        type: 'text',
        content: msg.content,
        isUser: true,
        created_at: msg.created_at
      }]
    } else {
      // Parse assistant's JSON response
      try {
        const parsedContent = JSON.parse(msg.content)
        if (Array.isArray(parsedContent)) {
          return parsedContent.map(m => ({
            ...m,
            isUser: false,
            created_at: msg.created_at
          }))
        } else {
          return [{
            ...parsedContent,
            isUser: false,
            created_at: msg.created_at
          }]
        }
      } catch (e) {
        console.error('Error parsing assistant message:', e, msg.content) // Debug log
        // Fallback for any unparseable messages
        return [{
          type: 'text',
          content: msg.content,
          isUser: false,
          created_at: msg.created_at
        }]
      }
    }
  })
}

export async function getAICompanionHeader(): Promise<HeaderData> {
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select(`
      id,
      pattern,
      goals,
      created_at,
      rounds (
        id,
        duration,
        notes,
        started_at,
        task:tasks (
          id,
          name
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (sessionsError) throw sessionsError

  // Get current task from timer
  const { data: timer, error: timerError } = await supabase
    .from('timer')
    .select(`
      current_task_id,
      task:tasks (
        id,
        name
      )
    `)
    .single()

  if (timerError) throw timerError

  const { data, error } = await supabase.functions.invoke('ai-companion', {
    body: {
      sessions,
      currentTask: timer?.task,
      message: 'header',
      userId: (await supabase.auth.getUser()).data.user?.id
    }
  })

  if (error) throw error
  return data
}

export async function getAICompanionChat(message: string): Promise<ChatMessage[]> {
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select(`
      id,
      pattern,
      goals,
      created_at,
      rounds (
        id,
        duration,
        notes,
        started_at,
        task:tasks (
          id,
          name
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (sessionsError) throw sessionsError

  // Get current task from timer
  const { data: timer, error: timerError } = await supabase
    .from('timer')
    .select(`
      current_task_id,
      task:tasks (
        id,
        name
      )
    `)
    .single()

  if (timerError) throw timerError

  const { data, error } = await supabase.functions.invoke('ai-companion', {
    body: {
      sessions,
      currentTask: timer?.task,
      message,
      userId: (await supabase.auth.getUser()).data.user?.id
    }
  })

  if (error) throw error
  return data.messages
}

export async function deleteChatHistory(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('ai_chats')
    .delete()
    .eq('user_id', user.id)

  if (error) throw error
} 