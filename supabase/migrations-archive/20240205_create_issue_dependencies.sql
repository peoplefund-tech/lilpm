-- Create issue_dependencies table for Gantt chart links
create table if not exists public.issue_dependencies (
  id uuid default gen_random_uuid() primary key,
  source_issue_id uuid references public.issues(id) on delete cascade not null,
  target_issue_id uuid references public.issues(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent duplicate links
  unique(source_issue_id, target_issue_id),
  -- Prevent self-reference
  constraint no_self_reference check (source_issue_id != target_issue_id)
);

-- Enable RLS
alter table public.issue_dependencies enable row level security;

-- Policies
-- 1. Drop existing policies to prevent conflicts (Idempotency)
drop policy if exists "Users can view dependencies of their team" on public.issue_dependencies;
drop policy if exists "Users can insert dependencies for their team" on public.issue_dependencies;
drop policy if exists "Users can delete dependencies for their team" on public.issue_dependencies;

-- 2. Re-create policies
create policy "Users can view dependencies of their team"
  on public.issue_dependencies for select
  using (
    exists (
      select 1 from public.issues
      where issues.id = issue_dependencies.source_issue_id
      and issues.team_id in (
        select team_id from public.team_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can insert dependencies for their team"
  on public.issue_dependencies for insert
  with check (
    exists (
      select 1 from public.issues
      where issues.id = source_issue_id
      and issues.team_id in (
        select team_id from public.team_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can delete dependencies for their team"
  on public.issue_dependencies for delete
  using (
    exists (
      select 1 from public.issues
      where issues.id = source_issue_id
      and issues.team_id in (
        select team_id from public.team_members where user_id = auth.uid()
      )
    )
  );
