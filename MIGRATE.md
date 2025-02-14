# Database Migration Guide

## Schema Changes

The database has been redesigned with new table names and structures:

### Old → New Mapping
- `daily_sessions` → `rounds` (completed focus periods)
- `timer_states` → `timer` (current countdown state)
- `tasks` → `tasks` (unchanged, but with cleaner structure)
- NEW: `sessions` (patterns and goals)

## Required Code Changes

### 1. Timer State Management (`src/store/timerStore.js`)

```javascript
// Update timer state queries
const timerState = await supabase
  .from('timer')  // was 'timer_states'
  .select('*')
  .eq('user_id', user.id)
  .maybeSingle()

// Update timer state structure
{
  elapsed_time,     // was 'time'
  is_running,       // was 'running'
  current_session_id,
  current_task_id,
  pattern_position  // was 'pattern_position'
}
```

### 2. Statistics Component (`src/components/statistics/Statistics.jsx`)

```javascript
// Update session fetching
const query = supabase
  .from('rounds')  // was 'daily_sessions'
  .select(`
    *,
    tasks(name)
  `)
  .gte('started_at', startDate.toISOString())  // was 'start_time'
  .lte('started_at', now.toISOString())
  .order('started_at', { ascending: false })

// Update data processing
sessions.forEach(session => {
  const duration = session.duration  // was 'actual_duration'
  // ...
  const date = new Date(session.started_at)  // was 'start_time'
  // ...
})
```

### 3. Session Recording (`src/supabase-client.js`)

```javascript
// Update saveCompletedSession
export async function saveCompletedSession(sessionData) {
  return await supabase
    .from('rounds')  // was 'daily_sessions'
    .insert({
      user_id: user.id,
      task_id: sessionData.taskId,
      started_at: sessionData.startTime,
      duration: sessionData.actualDuration,
      notes: sessionData.notes,
      session_id: sessionData.currentSessionId,
      pattern_position: sessionData.patternPosition
    })
}
```

### 4. Session Management (`src/components/session/NewSessionDialog.jsx`)

```javascript
// Add session creation when starting new pattern
export async function startNewSession(pattern, goals) {
  const { data: session } = await supabase
    .from('sessions')
    .insert({
      pattern,
      goals
    })
    .select()
    .single()

  // Use session.id as current_session_id in timer state
  return session
}
```

### 5. Round History (`src/components/statistics/RoundEntries.jsx`)

```javascript
// Update deletion handling
const handleDelete = async (id) => {
  const { error } = await supabase
    .from('rounds')  // was 'daily_sessions'
    .delete()
    .eq('id', id)
  // ...
}
```

## Migration Steps

1. Deploy new schema
2. Update frontend code with changes above
3. Test all features:
   - Timer functionality
   - Statistics display
   - Session creation
   - Task management
   - Round completion and history

## Breaking Changes

- All existing timer states will be cleared
- Historical data will need to be migrated if preservation is required
- Frontend code must be updated before deployment to prevent errors 