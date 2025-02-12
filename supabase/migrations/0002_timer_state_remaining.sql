alter table timer_states 
add column remaining_time integer,
add column started_at timestamp with time zone; 