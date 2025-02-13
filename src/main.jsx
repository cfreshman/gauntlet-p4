import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { createAuthUI } from '../auth-ui'
import { supabase } from '../supabase-client'
import './index.css'

// Create auth UI
createAuthUI()

// Handle authentication state
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    document.body.classList.add('authenticated')
  } else if (event === 'SIGNED_OUT') {
    document.body.classList.remove('authenticated')
  }
})

// Check initial auth state
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    document.body.classList.add('authenticated')
  } else {
    document.body.classList.remove('authenticated')
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
) 