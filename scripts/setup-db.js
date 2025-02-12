import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY // We'll need to add this to .env
)

async function setupDatabase() {
  try {
    // Create tables
    const { error: tasksError } = await supabase.rpc('exec_sql', {
      sql_query: `
        create table if not exists tasks (
          id uuid default uuid_generate_v4() primary key,
          user_id uuid references auth.users(id),
          name text not null,
          created_at timestamp with time zone default now()
        );
      `
    })
    if (tasksError) throw tasksError

    const { error: sessionsError } = await supabase.rpc('exec_sql', {
      sql_query: `
        create table if not exists pomodoro_sessions (
          id uuid default uuid_generate_v4() primary key,
          user_id uuid references auth.users(id),
          task_id uuid references tasks(id),
          duration integer not null,
          type text check (type in ('focus', 'short', 'long')),
          completed boolean default true,
          created_at timestamp with time zone default now()
        );
      `
    })
    if (sessionsError) throw sessionsError

    // Enable RLS
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql_query: `
        alter table tasks enable row level security;
        alter table pomodoro_sessions enable row level security;
      `
    })
    if (rlsError) throw rlsError

    // Create policies
    const { error: policiesError } = await supabase.rpc('exec_sql', {
      sql_query: `
        create policy "Users can view own tasks"
          on tasks for select using (auth.uid() = user_id);

        create policy "Users can insert own tasks"
          on tasks for insert with check (auth.uid() = user_id);

        create policy "Users can update own tasks"
          on tasks for update using (auth.uid() = user_id);

        create policy "Users can delete own tasks"
          on tasks for delete using (auth.uid() = user_id);

        create policy "Users can view own sessions"
          on pomodoro_sessions for select using (auth.uid() = user_id);

        create policy "Users can insert own sessions"
          on pomodoro_sessions for insert with check (auth.uid() = user_id);
      `
    })
    if (policiesError) throw policiesError

    console.log('Database setup completed successfully')
  } catch (error) {
    console.error('Error setting up database:', error)
    process.exit(1)
  }
}

setupDatabase() 