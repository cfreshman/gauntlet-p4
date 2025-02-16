-- Drop ALL existing tables and objects
drop extension if exists vector cascade;
drop table if exists daily_sessions cascade;
drop table if exists timer_states cascade;
drop table if exists round_embeddings cascade;
drop table if exists session_embeddings cascade;
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
drop function if exists update_updated_at_column cascade;
drop function if exists search_sessions cascade;
drop function if exists search_rounds cascade;
drop function if exists reindex_embeddings cascade;

-- Drop existing publications
drop publication if exists supabase_realtime cascade;

-- Enable required extensions
create extension if not exists vector;

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
create index rounds_session_idx on rounds(session_id);

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

-- Create embeddings tables for vector search
create table round_embeddings (
  id uuid primary key references rounds(id) on delete cascade,
  content_embedding vector(1536), -- text-embedding-3-small has 1536 dimensions
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table session_embeddings (
  id uuid primary key references sessions(id) on delete cascade,
  content_embedding vector(1536),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_round_embeddings_updated_at
  before update on round_embeddings
  for each row
  execute function update_updated_at_column();

create trigger update_session_embeddings_updated_at
  before update on session_embeddings
  for each row
  execute function update_updated_at_column();

-- Create indexes for similarity search
create index round_embeddings_vector_idx on round_embeddings 
  using ivfflat (content_embedding vector_cosine_ops)
  with (lists = 100);

create index session_embeddings_vector_idx on session_embeddings 
  using ivfflat (content_embedding vector_cosine_ops)
  with (lists = 100);

-- Add RLS to embeddings tables
alter table round_embeddings enable row level security;
alter table session_embeddings enable row level security;

create policy "Users can view own round embeddings"
  on round_embeddings for select
  using (exists (
    select 1 from rounds r
    where r.id = round_embeddings.id
    and r.user_id = auth.uid()
  ));

create policy "Users can insert own round embeddings"
  on round_embeddings for insert
  with check (exists (
    select 1 from rounds r
    where r.id = round_embeddings.id
    and r.user_id = auth.uid()
  ));

create policy "Users can update own round embeddings"
  on round_embeddings for update
  using (exists (
    select 1 from rounds r
    where r.id = round_embeddings.id
    and r.user_id = auth.uid()
  ));

create policy "Users can delete own round embeddings"
  on round_embeddings for delete
  using (exists (
    select 1 from rounds r
    where r.id = round_embeddings.id
    and r.user_id = auth.uid()
  ));

create policy "Users can view own session embeddings"
  on session_embeddings for select
  using (exists (
    select 1 from sessions s
    where s.id = session_embeddings.id
    and s.user_id = auth.uid()
  ));

create policy "Users can insert own session embeddings"
  on session_embeddings for insert
  with check (exists (
    select 1 from sessions s
    where s.id = session_embeddings.id
    and s.user_id = auth.uid()
  ));

create policy "Users can update own session embeddings"
  on session_embeddings for update
  using (exists (
    select 1 from sessions s
    where s.id = session_embeddings.id
    and s.user_id = auth.uid()
  ));

create policy "Users can delete own session embeddings"
  on session_embeddings for delete
  using (exists (
    select 1 from sessions s
    where s.id = session_embeddings.id
    and s.user_id = auth.uid()
  ));

-- Create reindexing function
create or replace function reindex_embeddings(
  user_id uuid,
  start_date timestamptz default null,
  end_date timestamptz default null
) returns table (
  rounds_reindexed bigint,
  sessions_reindexed bigint
) security definer
set search_path = public
language plpgsql as $$
declare
  rounds_count bigint;
  sessions_count bigint;
begin
  -- Delete existing embeddings for the user's data in the date range
  delete from round_embeddings re
  where exists (
    select 1 from rounds r
    where r.id = re.id
    and r.user_id = reindex_embeddings.user_id
    and (start_date is null or r.started_at >= start_date)
    and (end_date is null or r.started_at <= end_date)
  );

  delete from session_embeddings se
  where exists (
    select 1 from sessions s
    where s.id = se.id
    and s.user_id = reindex_embeddings.user_id
    and (start_date is null or s.created_at >= start_date)
    and (end_date is null or s.created_at <= end_date)
  );

  -- Get count of rounds and sessions that need reindexing
  select count(*) into rounds_count
  from rounds r
  where r.user_id = reindex_embeddings.user_id
    and not exists (
      select 1 from round_embeddings re
      where re.id = r.id
    )
    and (start_date is null or r.started_at >= start_date)
    and (end_date is null or r.started_at <= end_date);

  select count(*) into sessions_count
  from sessions s
  where s.user_id = reindex_embeddings.user_id
    and not exists (
      select 1 from session_embeddings se
      where se.id = s.id
    )
    and (start_date is null or s.created_at >= start_date)
    and (end_date is null or s.created_at <= end_date);

  return query select rounds_count, sessions_count;
end;
$$;

-- Create vector search functions
create or replace function search_sessions(
  query_embedding vector(1536),
  similarity_threshold float,
  user_id uuid
)
returns table (
  id uuid,
  goals text,
  pattern text,
  created_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    s.id,
    s.goals,
    s.pattern,
    s.created_at,
    1 - (se.content_embedding <=> query_embedding) as similarity
  from sessions s
  join session_embeddings se on s.id = se.id
  where s.user_id = search_sessions.user_id
    and 1 - (se.content_embedding <=> query_embedding) > similarity_threshold
  order by similarity desc;
end;
$$;

create or replace function search_rounds(
  query_embedding vector(1536),
  similarity_threshold float,
  user_id uuid
)
returns table (
  id uuid,
  session_id uuid,
  duration integer,
  notes text,
  started_at timestamptz,
  pattern_position integer,
  task_name text,
  session_goals text,
  session_pattern text,
  session_created_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    r.id,
    r.session_id,
    r.duration,
    r.notes,
    r.started_at,
    r.pattern_position,
    t.name as task_name,
    s.goals as session_goals,
    s.pattern as session_pattern,
    s.created_at as session_created_at,
    1 - (re.content_embedding <=> query_embedding) as similarity
  from rounds r
  join round_embeddings re on r.id = re.id
  join sessions s on r.session_id = s.id
  left join tasks t on r.task_id = t.id
  where s.user_id = search_rounds.user_id
    and 1 - (re.content_embedding <=> query_embedding) > similarity_threshold
  order by similarity desc;
end;
$$;

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

-- Enable realtime for timer and ai_chats
alter publication supabase_realtime add table public.timer;
alter publication supabase_realtime add table public.ai_chats; 