import { signInWithEmail, signUpWithEmail, signOut, supabase } from '../supabase-client'
import './auth-ui.css'

export function createAuthUI() {
  // Create auth container
  const container = document.createElement('div')
  container.className = 'auth-container'
  container.style.display = 'none' // Start hidden until we check auth state
  
  // Create auth box
  const box = document.createElement('div')
  box.className = 'auth-box'
  
  box.innerHTML = `
    <h1 class="auth-title">Welcome to Gomodoro</h1>
    <p class="auth-description">
      Sign in to track your focus sessions and sync across devices.
    </p>
    <form class="auth-form">
      <input type="email" id="email" placeholder="Email" required>
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit" id="signin">Sign In</button>
      <button type="button" id="signup">Sign Up</button>
    </form>
  `
  
  container.appendChild(box)
  document.body.appendChild(container)

  // Handle sign in
  box.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = box.querySelector('#email').value
    const password = box.querySelector('#password').value
    
    try {
      const { error } = await signInWithEmail(email, password)
      if (error) throw error
    } catch (error) {
      alert(error.message)
    }
  })

  // Handle sign up
  box.querySelector('#signup').addEventListener('click', async () => {
    const email = box.querySelector('#email').value
    const password = box.querySelector('#password').value
    
    try {
      // Sign up the user
      const { error: signUpError } = await signUpWithEmail(email, password)
      if (signUpError) throw signUpError

      // Sign in immediately after signup
      await signInWithEmail(email, password)
    } catch (error) {
      alert(error.message)
    }
  })

  // Add sign out button to menu
  const menu = document.querySelector('#menu .content')
  if (menu) {
    const section = document.createElement('section')
    section.className = 'section account'
    section.innerHTML = `
      <h2>Account</h2>
      <button id="signout" class="menu-button">Sign Out</button>
    `
    menu.appendChild(section)

    document.getElementById('signout')?.addEventListener('click', async () => {
      try {
        const { error } = await signOut()
        if (error) throw error
      } catch (error) {
        console.error('Error signing out:', error)
        alert('Error signing out. Please try again.')
      }
    })
  }

  return container
} 