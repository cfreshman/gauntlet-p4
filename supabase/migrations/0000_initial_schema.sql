-- Drop our tables if they exist
drop table if exists daily_sessions, timer_states, tasks cascade;

-- Drop old tables
drop table if exists pomodoro_sessions cascade;

-- Drop existing trigger
drop trigger if exists on_auth_user_created on auth.users;

-- Drop existing publications
drop publication if exists supabase_realtime cascade;

-- Create base publication
create publication supabase_realtime;

-- Create tasks table
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  created_at timestamp with time zone default now()
);

-- Add unique constraint on user_id + name
create unique index tasks_user_name_idx on tasks(user_id, name);

alter table tasks enable row level security;

create policy "Users can view own tasks"
  on tasks for select using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on tasks for insert with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on tasks for update using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on tasks for delete using (auth.uid() = user_id);

-- Create timer states table
create table timer_states (
  user_id uuid primary key references auth.users(id),
  current text not null,
  time integer not null,
  remaining_time integer,
  started_at timestamp with time zone,
  running boolean not null,
  focus_num integer not null,
  selected_task text,
  session_pattern text,           -- The current session pattern (e.g., "25-5-25-15") if a session is active
  session_goals text,             -- Goals for the current session
  pattern_position integer,       -- Current position in the pattern (0-based index)
  updated_at timestamp with time zone default now()
);

alter table timer_states enable row level security;
alter table timer_states replica identity full;  -- Enable realtime

create policy "Users can view own timer state"
  on timer_states for select using (auth.uid() = user_id);

create policy "Users can update own timer state"
  on timer_states for update using (auth.uid() = user_id);

create policy "Users can insert own timer state"
  on timer_states for insert with check (auth.uid() = user_id);

-- Create daily sessions table
create table daily_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  task_id uuid references tasks(id),
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  timer_duration integer not null,    -- What they set the timer to
  actual_duration integer not null,   -- How long they actually worked
  notes text,                        -- Context about what they did
  created_at timestamp with time zone default now()
);

create index sessions_user_time_idx on daily_sessions(user_id, start_time);

alter table daily_sessions enable row level security;

create policy "Users can view own sessions"
  on daily_sessions for select using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on daily_sessions for insert with check (auth.uid() = user_id);

-- Enable realtime
alter publication supabase_realtime add table public.timer_states; 