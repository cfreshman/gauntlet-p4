import { signInWithEmail, signUpWithEmail, signOut, supabase, getCurrentSession } from './supabase-client.js'
import './auth-ui.css'

export function createAuthUI() {
  const backdrop = document.createElement('div')
  backdrop.className = 'auth-modal-backdrop'
  document.body.appendChild(backdrop)
  
  const modal = document.createElement('div')
  modal.className = 'auth-modal'
  modal.innerHTML = `
    <form class="auth-form">
      <input type="email" id="email" placeholder="Email" required>
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit" id="signin">Sign In</button>
      <button type="button" id="signup">Sign Up</button>
    </form>
  `
  document.body.appendChild(modal)

  function setLoading(isLoading) {
    const buttons = modal.querySelectorAll('button')
    buttons.forEach(button => {
      button.disabled = isLoading
      button.style.opacity = isLoading ? '0.7' : '1'
    })
  }

  function showModal() {
    modal.classList.add('active')
    backdrop.classList.add('active')
    modal.querySelector('#email').focus()
  }

  async function hideModal() {
    // Don't allow hiding the modal if not authenticated
    const { session } = await getCurrentSession()
    if (!session) {
      return
    }
    modal.classList.remove('active')
    backdrop.classList.remove('active')
    modal.querySelector('form').reset()
  }

  // Add sign out button to settings menu
  function addSignOutToMenu() {
    // Check if account section already exists
    if (document.querySelector('#menu .section.account')) {
      return
    }
    
    const menu = document.querySelector('#menu .content')
    const section = document.createElement('section')
    section.className = 'section account'
    section.innerHTML = `
      <h2>Account</h2>
      <button id="signout" class="menu-button">Sign Out</button>
    `
    menu.appendChild(section)

    document.getElementById('signout').addEventListener('click', signOut)
  }

  // Initial state
  async function initAuthState() {
    const { session } = await getCurrentSession()
    if (!session) {
      showModal()
      // Hide main app until signed in
      document.getElementById('main').style.display = 'none'
    } else {
      addSignOutToMenu()
    }
  }
  initAuthState()

  // Auth state change listener
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      hideModal()
      window.location.reload() // Refresh to show login screen
    } else if (event === 'SIGNED_IN') {
      hideModal()
      document.getElementById('main').style.display = 'flex'
      addSignOutToMenu()
    }
  })

  // Handle sign in
  modal.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault()
    setLoading(true)
    
    const email = modal.querySelector('#email').value
    const password = modal.querySelector('#password').value
    
    try {
      const { error } = await signInWithEmail(email, password)
      if (error) throw error
      hideModal()
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  })

  // Handle sign up
  modal.querySelector('#signup').addEventListener('click', async () => {
    setLoading(true)
    
    const email = modal.querySelector('#email').value
    const password = modal.querySelector('#password').value
    
    try {
      const { error } = await signUpWithEmail(email, password)
      if (error) throw error
      alert('Check your email for the confirmation link')
      hideModal()
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  })

  // Close modal when clicking backdrop
  backdrop.addEventListener('click', async (e) => {
    const { session } = await getCurrentSession()
    // Only allow closing if authenticated
    if (session) {
      hideModal()
    }
  })

  return modal
} 