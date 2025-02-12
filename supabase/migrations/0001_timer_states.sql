create table timer_states (
  user_id uuid primary key references auth.users(id),
  current text not null,
  time integer not null,
  running boolean not null,
  focus_num integer not null,
  selected_task text,
  updated_at timestamp with time zone default now()
);

alter table timer_states enable row level security;

-- Enable realtime
alter table timer_states replica all;

-- Enable realtime publication
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table timer_states;

create policy "Users can view own timer state"
  on timer_states for select using (auth.uid() = user_id);

create policy "Users can update own timer state"
  on timer_states for update using (auth.uid() = user_id);

create policy "Users can insert own timer state"
  on timer_states for insert with check (auth.uid() = user_id); 