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

// Sample goals for sessions
const SAMPLE_GOALS = [
  'Complete feature implementation',
  'Review and fix reported bugs',
  'Write documentation for new API',
  'Plan next sprint tasks',
  'Learn new framework concepts',
  'Catch up on code reviews',
  'Prepare for team meeting',
  'Clear email backlog'
]

// Sample notes for rounds
const SAMPLE_NOTES = [
  'Made good progress on implementation',
  'Fixed critical bug in authentication',
  'Completed API documentation section',
  'Organized tasks and priorities',
  'Learned about new React features',
  'Reviewed and approved PRs',
  'Created meeting agenda',
  'Responded to important emails'
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
        const goals = SAMPLE_GOALS[Math.floor(Math.random() * SAMPLE_GOALS.length)]
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            user_id: user.id,
            pattern: '25-5-25-5-25-5-25-15',
            goals,
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
          const notes = SAMPLE_NOTES[Math.floor(Math.random() * SAMPLE_NOTES.length)]
          
          const { data: round, error: roundError } = await supabase
            .from('rounds')
            .insert({
              user_id: user.id,
              session_id: session.id,
              task_id: tasks[Math.floor(Math.random() * tasks.length)].id,
              started_at: currentTime.toISOString(),
              duration: duration,
              notes,
              pattern_position: i * 2 // Only store focus rounds, not breaks
            })
            .select()
            .single()

          if (roundError) throw roundError

          // Move time forward by the round duration plus break
          currentTime = new Date(currentTime.getTime() + duration * 1000 + 5 * 60000) // Add 5 min break
        }

        console.log(`Created session for ${d.toDateString()} with ${numRounds} rounds`)
      }
    }

    console.log('Created sample sessions and rounds')
    console.log('Database seeding completed successfully')
    console.log('\nTo generate embeddings for search functionality:')
    console.log('1. Open the browser console')
    console.log('2. Run: await reindexEmbeddings()')
    console.log('This will generate embeddings for all sessions and rounds')

  } catch (error) {
    console.error('Error seeding database:', error)
    console.error('Error details:', error.message)
  }
}

// Run the seeding
seedDatabase() 