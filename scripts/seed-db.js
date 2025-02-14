import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load development environment variables
dotenv.config({ path: '.env.development' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables in .env.development')
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Sample tasks that might be used during a workday
const SAMPLE_TASKS = [
  'Coding',
  'Documentation',
  'Code Review',
  'Bug Fixes',
  'Meeting Prep',
  'Learning',
  'Project Planning',
  'Email/Admin'
]

// Realistic time distributions (in minutes)
const SESSION_DURATIONS = [
  25, // Standard Pomodoro
  30, // Slightly longer
  45, // Extended session
  20  // Shorter session
]

// Generate a random date between start and end
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

// Generate a random duration with some variance
function randomDuration() {
  const baseTime = SESSION_DURATIONS[Math.floor(Math.random() * SESSION_DURATIONS.length)]
  // Add some random variance (-2 to +5 minutes)
  return baseTime + Math.floor(Math.random() * 7) - 2
}

// Generate sessions for a single day
function generateDaySessions(userId, tasks, date) {
  const sessions = []
  // Generate 4-8 sessions per day
  const numSessions = 4 + Math.floor(Math.random() * 5)
  
  let currentTime = new Date(date)
  currentTime.setHours(9) // Start at 9 AM

  for (let i = 0; i < numSessions; i++) {
    // Add some random time between sessions (15-45 minutes)
    currentTime = new Date(currentTime.getTime() + (15 + Math.floor(Math.random() * 30)) * 60000)
    
    const timerDuration = 25 * 60 // Standard 25 minutes in seconds
    const actualDuration = randomDuration() * 60 // Convert to seconds
    
    sessions.push({
      user_id: userId,
      task_id: tasks[Math.floor(Math.random() * tasks.length)].id,
      start_time: currentTime.toISOString(),
      end_time: new Date(currentTime.getTime() + actualDuration * 1000).toISOString(),
      timer_duration: timerDuration,
      actual_duration: actualDuration,
      notes: `Sample session ${i + 1} for ${currentTime.toDateString()}`
    })

    // Move time forward by the session duration
    currentTime = new Date(currentTime.getTime() + actualDuration * 1000)
  }

  return sessions
}

async function seedDatabase() {
  try {
    // Sign in with test user
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD
    })

    if (signInError) throw signInError
    console.log('Signed in as test user')

    // Create tasks
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .insert(SAMPLE_TASKS.map(name => ({
        user_id: user.id,
        name
      })))
      .select()

    if (taskError) throw taskError
    console.log('Created sample tasks')

    // Generate sessions for the last 30 days
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    // Create sessions and rounds
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      // Only generate sessions for weekdays
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        // Create a session for this day
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            user_id: user.id,
            pattern: '25-5-25-5-25-5-25-15',
            goals: `Sample goals for ${d.toDateString()}`,
            created_at: d.toISOString()
          })
          .select()
          .single()

        if (sessionError) throw sessionError

        // Generate 4-8 focus rounds for this session
        const numRounds = 4 + Math.floor(Math.random() * 5)
        let currentTime = new Date(d)
        currentTime.setHours(9) // Start at 9 AM

        for (let i = 0; i < numRounds; i++) {
          // Add some random time between rounds (15-45 minutes)
          currentTime = new Date(currentTime.getTime() + (15 + Math.floor(Math.random() * 30)) * 60000)
          
          const duration = randomDuration() * 60 // Convert to seconds
          
          const { error: roundError } = await supabase
            .from('rounds')
            .insert({
              user_id: user.id,
              session_id: session.id,
              task_id: tasks[Math.floor(Math.random() * tasks.length)].id,
              started_at: currentTime.toISOString(),
              duration: duration,
              notes: `Sample round ${i + 1} for ${currentTime.toDateString()}`,
              pattern_position: i * 2 // Only store focus rounds, not breaks
            })

          if (roundError) throw roundError

          // Move time forward by the round duration plus break
          currentTime = new Date(currentTime.getTime() + duration * 1000 + 5 * 60000) // Add 5 min break
        }
      }
    }

    console.log('Created sample sessions and rounds')
    console.log('Database seeding completed successfully')

  } catch (error) {
    console.error('Error seeding database:', error)
    console.error('Error details:', error.message)
  }
}

// Run the seeding
seedDatabase() 