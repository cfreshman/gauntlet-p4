import React, { useState, useEffect, useRef } from 'react'
import { getAICompanionChat, getChatMessages, deleteChatHistory, type ChatMessage } from '../../api/ai-companion'
import { useTimerStore } from '../../store/timerStore'
import { useAIStore } from '../../store/aiStore'

// Use the imported ChatMessage type instead of redefining it
type Message = ChatMessage

// Static reference to the setIsOpen function
let openAICompanion: (() => void) | null = null

export function AICompanion() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { startNewSession } = useTimerStore()
  const { headerData, isLoading, error, fetchHeaderData } = useAIStore()

  // Store the setIsOpen function for external use
  useEffect(() => {
    openAICompanion = () => setIsOpen(true)
  }, [])

  // Get initial header analysis if not already loaded
  useEffect(() => {
    if (isOpen && !headerData && !isLoading && !error) {
      fetchHeaderData()
    }
  }, [headerData, isLoading, error, isOpen])

  // Convert image to URL when headerData changes
  useEffect(() => {
    if (headerData?.imageUrl && !headerData.imageUrl.startsWith('data:')) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          const dataUrl = canvas.toDataURL('image/png', 0.8)
          useAIStore.getState().updateHeaderImage(dataUrl)
        }
      }
      img.src = headerData.imageUrl
    }
  }, [headerData?.imageUrl])

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Update messages when header data changes
  useEffect(() => {
    if (headerData) {
      console.log('Header data changed, updating messages')
      setMessages(prev => {
        if (prev.length === 0 || prev[0].content !== headerData.message) {
          return [{ type: 'text', content: headerData.message }, ...prev]
        }
        return prev
      })
      
      // Resize textarea after header data loads
      if (textareaRef.current) {
        setTimeout(() => {
          const textarea = textareaRef.current
          if (textarea) {
            textarea.style.height = '1.5rem'
            textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`
          }
        }, 0)
      }
    }
  }, [headerData])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const adjustHeight = () => {
      textarea.style.height = '1.5rem'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`
    }

    adjustHeight()
  }, [inputMessage]) // Run when input changes

  // Initial resize after mount
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const adjustHeight = () => {
      textarea.style.height = '1.5rem'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`
    }

    // Small delay to ensure proper rendering
    setTimeout(adjustHeight, 0)
  }, []) // Run once after mount

  // Run resize when component opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        const textarea = textareaRef.current
        if (textarea) {
          textarea.style.height = '1.5rem'
          textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`
        }
      }, 0)
    }
  }, [isOpen])

  // Load existing messages when component mounts
  useEffect(() => {
    const loadMessages = async () => {
      try {
        console.log('Loading messages...')
        const existingMessages = await getChatMessages()
        console.log('Loaded messages:', existingMessages.length)
        
        // Always use the latest messages from the database
        setMessages(existingMessages)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }
    
    if (isOpen) {
      loadMessages()
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim()) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const newUserMessage: ChatMessage = {
      type: 'text',
      content: userMessage,
      isUser: true
    }
    setMessages(prev => [...prev, newUserMessage])
    setIsThinking(true)

    try {
      // Get AI response
      const response = await getAICompanionChat(userMessage)
      setMessages(prev => [...prev, ...response])
    } catch (err) {
      console.error('Failed to get AI response:', err)
    } finally {
      setIsThinking(false)
    }
  }

  const handleSuggestion = (pattern: string, goals: string) => {
    startNewSession(pattern, goals)
    setIsOpen(false)
  }

  return (
    <div id="aicompanion" style={{ display: isOpen ? 'flex' : 'none' }}>
      <div className="chat-app">
        <button 
          className="reset-button" 
          onClick={async () => {
            try {
              await deleteChatHistory()
              setMessages([])
              fetchHeaderData()
            } catch (err) {
              console.error('Failed to delete chat history:', err)
            }
          }}
        >
          Reset
        </button>
        <button className="close-button" onClick={() => setIsOpen(false)}>
          Close
        </button>

        {isLoading ? (
          <div className="loading">
            <div>Analyzing your sessions...</div>
            <button className="close-loading" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>
        ) : error ? (
          <div className="error">
            <div>{error}</div>
            <button onClick={fetchHeaderData}>Retry</button>
          </div>
        ) : (
          <>
            <div className="messages">
              {headerData && (
                <div className="message header-summary ai">
                  {headerData?.imageUrl && (
                    <div className="ai-header">
                      <div className="ai-image">
                        <img src={headerData.imageUrl} alt="AI generated visualization" />
                      </div>
                    </div>
                  )}
                  <div>{headerData.message}</div>
                  <button className="regenerate-button" onClick={fetchHeaderData}>
                    Regenerate
                  </button>
                </div>
              )}
              
              {messages.map((msg, i) => (
                msg.content !== headerData?.message && (
                  <div key={i} className={`message ${msg.isUser ? 'user' : 'ai'}`}>
                    <div>{msg.content}</div>
                    {msg.type === 'session' && msg.pattern && msg.goals && (
                      <button onClick={() => handleSuggestion(msg.pattern!, msg.goals!)}>
                        <div>{msg.pattern}</div>
                        <div className="goals">{msg.goals}</div>
                      </button>
                    )}
                  </div>
                )
              ))}
              {isThinking && (
                <div className="message ai thinking">
                  <div>Thinking</div>
                  <div className="dots">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form className="chat-form" onSubmit={handleSubmit}>
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => {
                  console.log('Input changed:', e.target.value)
                  setInputMessage(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e as any)
                  }
                }}
                placeholder="Ask about your productivity patterns..."
                maxLength={200}
                rows={1}
                disabled={isThinking}
              />
              <button 
                type="submit" 
                disabled={!inputMessage.trim() || isThinking}
                style={{ alignSelf: 'flex-start' }}
              >
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// Static method to open the AI companion
AICompanion.open = () => {
  if (openAICompanion) {
    openAICompanion()
  }
} 