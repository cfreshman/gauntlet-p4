-- Create tables
create table if not exists tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id),
  name text not null,
  created_at timestamp with time zone default now()
);

create table if not exists pomodoro_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id),
  task_id uuid references tasks(id),
  duration integer not null,
  type text check (type in ('focus', 'short', 'long')),
  completed boolean default true,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table tasks enable row level security;
alter table pomodoro_sessions enable row level security;

-- Create policies
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