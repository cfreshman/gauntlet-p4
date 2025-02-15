-- Drop ALL existing tables and objects
drop table if exists daily_sessions cascade;
drop table if exists timer_states cascade;
drop table if exists rounds cascade;
drop table if exists timer cascade;
drop table if exists ai_chats cascade;
drop table if exists pomodoro_sessions cascade;
drop table if exists sessions cascade;
drop table if exists tasks cascade;

-- Drop auth data
delete from auth.users;
delete from auth.identities;

-- Drop existing trigger
drop trigger if exists on_auth_user_created on auth.users;

-- Drop existing publications
drop publication if exists supabase_realtime cascade;

-- Create base publication
create publication supabase_realtime;

-- Create tasks table (work categories)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  created_at timestamp with time zone default now()
);

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

-- Create sessions table (pattern and goals)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  pattern text not null,              -- e.g., "25-5-25-15"
  goals text,                         -- What user wants to accomplish
  created_at timestamp with time zone default now()
);

alter table sessions enable row level security;

create policy "Users can view own sessions"
  on sessions for select using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on sessions for insert with check (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on sessions for delete using (auth.uid() = user_id);

-- Create rounds table (completed focus periods)
create table rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  session_id uuid references sessions(id),
  task_id uuid references tasks(id),
  started_at timestamp with time zone not null,  -- When the round started
  duration integer not null,           -- How long they worked
  notes text,                         -- What was accomplished
  pattern_position integer not null    -- Position in session pattern
);

create index rounds_user_time_idx on rounds(user_id, started_at);

alter table rounds enable row level security;

create policy "Users can view own rounds"
  on rounds for select using (auth.uid() = user_id);

create policy "Users can insert own rounds"
  on rounds for insert with check (auth.uid() = user_id);

create policy "Users can update own rounds"
  on rounds for update using (auth.uid() = user_id);

create policy "Users can delete own rounds"
  on rounds for delete using (auth.uid() = user_id);

-- Create timer table (current countdown state)
create table timer (
  user_id uuid primary key references auth.users(id),
  elapsed_time integer not null,       -- Current time in seconds
  is_running boolean not null,         -- Whether timer is counting
  current_session_id uuid references sessions(id),  -- Current active session
  current_task_id uuid references tasks(id),       -- Currently selected task
  pattern_position integer,            -- Position in current pattern (0-based)
  updated_at timestamp with time zone default now()
);

alter table timer enable row level security;
alter table timer replica identity full;  -- Enable realtime

create policy "Users can view own timer"
  on timer for select using (auth.uid() = user_id);

create policy "Users can update own timer"
  on timer for update using (auth.uid() = user_id);

create policy "Users can insert own timer"
  on timer for insert with check (auth.uid() = user_id);

-- Enable realtime for timer
alter publication supabase_realtime add table public.timer;

-- Create ai_chats table (conversation history)
create table ai_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default now()
);

create index ai_chats_user_time_idx on ai_chats(user_id, created_at);

alter table ai_chats enable row level security;

create policy "Users can view own chat history"
  on ai_chats for select using (auth.uid() = user_id);

create policy "Users can insert own messages"
  on ai_chats for insert with check (auth.uid() = user_id);

create policy "Users can delete own messages"
  on ai_chats for delete using (auth.uid() = user_id);

-- Enable realtime for ai_chats
alter publication supabase_realtime add table public.ai_chats; 