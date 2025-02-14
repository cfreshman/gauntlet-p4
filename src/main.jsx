import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { createAuthUI } from '../auth-ui'
import { supabase } from './supabase-client'
import './index.css'

// Create auth UI
const authUI = createAuthUI()

// Initialize auth state
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    document.body.classList.add('authenticated')
    authUI.style.display = 'none'
  } else {
    document.body.classList.remove('authenticated')
    authUI.style.display = 'flex'
  }
}

// Handle authentication state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    document.body.classList.add('authenticated')
    authUI.style.display = 'none'
  } else if (event === 'SIGNED_OUT') {
    document.body.classList.remove('authenticated')
    authUI.style.display = 'flex'
  }
})

// Initialize auth before rendering
initAuth().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}) 