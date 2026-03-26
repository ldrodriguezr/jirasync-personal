-- ============================================================
-- JiraSync Personal — Initial Schema
-- Run this in your Supabase SQL Editor (project dashboard)
-- ============================================================

-- Profiles (extends auth.users, auto-created on signup)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Projects
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  key text not null,                    -- short uppercase key, e.g. EFX
  description text,
  owner_id uuid references public.profiles(id),
  color text default '#6366f1',
  created_at timestamptz default now(),
  unique(key)
);

-- Project members
create table if not exists public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null default 'member',  -- admin | manager | member | viewer
  created_at timestamptz default now(),
  unique(project_id, user_id)
);

-- Per-project ticket counter
create table if not exists public.project_counters (
  project_id uuid references public.projects(id) on delete cascade primary key,
  counter integer default 1
);

-- Sprints
create table if not exists public.sprints (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  goal text,
  start_date date,
  end_date date,
  status text default 'planning',       -- planning | active | completed
  created_at timestamptz default now()
);

-- Issues (core table — supports Epics, Stories, Tasks, Bugs, Sub-tasks)
create table if not exists public.issues (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  ticket_id text not null,              -- e.g. EFX-1
  title text not null,
  description text,
  type text not null default 'task',    -- epic | story | task | bug | subtask
  status text not null default 'backlog', -- backlog | todo | in_progress | review | done
  priority text default 'medium',       -- highest | high | medium | low | lowest
  story_points integer,
  assignee_id uuid references public.profiles(id),
  reporter_id uuid references public.profiles(id),
  sprint_id uuid references public.sprints(id),
  parent_id uuid references public.issues(id),   -- for subtasks
  epic_id uuid references public.issues(id),     -- link to parent epic
  due_date date,
  tag text,
  project_field text,                   -- free-text "project(s)" label
  requestor text,                       -- legacy free-text requestor
  order_rank integer default 0,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Checklists per issue
create table if not exists public.issue_checklists (
  id uuid default gen_random_uuid() primary key,
  issue_id uuid references public.issues(id) on delete cascade not null,
  text text not null,
  is_completed boolean default false,
  order_rank integer default 0,
  created_at timestamptz default now()
);

-- URL attachments / links per issue
create table if not exists public.issue_links (
  id uuid default gen_random_uuid() primary key,
  issue_id uuid references public.issues(id) on delete cascade not null,
  url text not null,
  label text,
  created_at timestamptz default now()
);

-- Relations between issues (blocks, relates_to, duplicates)
create table if not exists public.issue_relations (
  id uuid default gen_random_uuid() primary key,
  from_issue_id uuid references public.issues(id) on delete cascade not null,
  to_issue_id uuid references public.issues(id) on delete cascade not null,
  relation_type text not null,          -- blocks | is_blocked_by | relates_to | duplicates
  created_at timestamptz default now()
);

-- Comments & system activity log per issue
create table if not exists public.issue_comments (
  id uuid default gen_random_uuid() primary key,
  issue_id uuid references public.issues(id) on delete cascade not null,
  author_id uuid references public.profiles(id),
  author_name text not null,
  body text not null,
  is_system boolean default false,
  created_at timestamptz default now()
);

-- Auto-update updated_at on issues
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists issues_updated_at on public.issues;
create trigger issues_updated_at
  before update on public.issues
  for each row execute procedure update_updated_at();

-- Function: get next ticket ID atomically
create or replace function get_next_ticket_id(p_project_id uuid, p_project_key text)
returns text as $$
declare
  ticket_num integer;
begin
  insert into public.project_counters (project_id, counter)
  values (p_project_id, 2)
  on conflict (project_id) do update
    set counter = project_counters.counter + 1
  returning counter - 1 into ticket_num;
  return p_project_key || '-' || ticket_num;
end;
$$ language plpgsql security definer;

-- Function: auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_counters enable row level security;
alter table public.sprints enable row level security;
alter table public.issues enable row level security;
alter table public.issue_checklists enable row level security;
alter table public.issue_links enable row level security;
alter table public.issue_relations enable row level security;
alter table public.issue_comments enable row level security;

-- Profiles
create policy "Read profiles" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Update own profile" on public.profiles for update using (auth.uid() = id);

-- Projects — any authenticated user can read/create; owners can update/delete
create policy "Read projects" on public.projects for select using (auth.role() = 'authenticated');
create policy "Create projects" on public.projects for insert with check (auth.role() = 'authenticated');
create policy "Update own projects" on public.projects for update using (auth.uid() = owner_id);
create policy "Delete own projects" on public.projects for delete using (auth.uid() = owner_id);

-- Project members
create policy "Read project members" on public.project_members for select using (auth.role() = 'authenticated');
create policy "Manage project members" on public.project_members for all using (auth.role() = 'authenticated');

-- Counters
create policy "Manage counters" on public.project_counters for all using (auth.role() = 'authenticated');

-- Sprints
create policy "Read sprints" on public.sprints for select using (auth.role() = 'authenticated');
create policy "Manage sprints" on public.sprints for all using (auth.role() = 'authenticated');

-- Issues
create policy "Read issues" on public.issues for select using (auth.role() = 'authenticated');
create policy "Manage issues" on public.issues for all using (auth.role() = 'authenticated');

-- Issue sub-entities
create policy "Manage checklists" on public.issue_checklists for all using (auth.role() = 'authenticated');
create policy "Manage links" on public.issue_links for all using (auth.role() = 'authenticated');
create policy "Manage relations" on public.issue_relations for all using (auth.role() = 'authenticated');
create policy "Manage comments" on public.issue_comments for all using (auth.role() = 'authenticated');
