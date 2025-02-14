create table timer (
  user_id uuid primary key references auth.users(id),
  elapsed_time integer not null,       -- Current time in seconds
  is_running boolean not null,         -- Whether timer is counting
  current_session_id uuid references sessions(id),  -- Current active session
  current_task_id uuid references tasks(id),       -- Currently selected task
  pattern_position integer,            -- Position in current pattern (0-based)
  updated_at timestamp with time zone default now()
); 