-- ============================================================
-- JiraSync Personal — Dedicated `jira` schema
-- Includes optional legacy import from public.tasks (main_board)
-- ============================================================

create extension if not exists pgcrypto;
create schema if not exists jira;

grant usage on schema jira to anon, authenticated, service_role;

-- Profiles (extends auth.users, auto-created on signup)
create table if not exists jira.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Projects
create table if not exists jira.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  key text not null,
  description text,
  owner_id uuid references jira.profiles(id),
  color text default '#6366f1',
  created_at timestamptz default now(),
  unique(key)
);

-- Project members
create table if not exists jira.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references jira.projects(id) on delete cascade not null,
  user_id uuid references jira.profiles(id) on delete cascade not null,
  role text not null default 'member', -- admin | manager | member | viewer
  created_at timestamptz default now(),
  unique(project_id, user_id)
);

-- Per-project ticket counter
create table if not exists jira.project_counters (
  project_id uuid references jira.projects(id) on delete cascade primary key,
  counter integer default 1
);

-- Sprints
create table if not exists jira.sprints (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references jira.projects(id) on delete cascade not null,
  name text not null,
  goal text,
  start_date date,
  end_date date,
  status text default 'planning', -- planning | active | completed
  created_at timestamptz default now()
);

-- Issues
create table if not exists jira.issues (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references jira.projects(id) on delete cascade not null,
  ticket_id text not null,
  title text not null,
  description text,
  type text not null default 'task', -- epic | story | task | bug | subtask
  status text not null default 'backlog', -- backlog | todo | in_progress | review | done
  priority text default 'medium', -- highest | high | medium | low | lowest
  story_points integer,
  assignee_id uuid references jira.profiles(id),
  reporter_id uuid references jira.profiles(id),
  sprint_id uuid references jira.sprints(id),
  parent_id uuid references jira.issues(id),
  epic_id uuid references jira.issues(id),
  due_date date,
  tag text,
  project_field text,
  requestor text,
  order_rank integer default 0,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Checklists per issue
create table if not exists jira.issue_checklists (
  id uuid default gen_random_uuid() primary key,
  issue_id uuid references jira.issues(id) on delete cascade not null,
  text text not null,
  is_completed boolean default false,
  order_rank integer default 0,
  created_at timestamptz default now()
);

-- URL links per issue
create table if not exists jira.issue_links (
  id uuid default gen_random_uuid() primary key,
  issue_id uuid references jira.issues(id) on delete cascade not null,
  url text not null,
  label text,
  created_at timestamptz default now()
);

-- Issue relations
create table if not exists jira.issue_relations (
  id uuid default gen_random_uuid() primary key,
  from_issue_id uuid references jira.issues(id) on delete cascade not null,
  to_issue_id uuid references jira.issues(id) on delete cascade not null,
  relation_type text not null, -- blocks | is_blocked_by | relates_to | duplicates
  created_at timestamptz default now()
);

-- Comments / activity log
create table if not exists jira.issue_comments (
  id uuid default gen_random_uuid() primary key,
  issue_id uuid references jira.issues(id) on delete cascade not null,
  author_id uuid references jira.profiles(id),
  author_name text not null,
  body text not null,
  is_system boolean default false,
  created_at timestamptz default now()
);

create or replace function jira.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists issues_updated_at on jira.issues;
create trigger issues_updated_at
  before update on jira.issues
  for each row execute procedure jira.update_updated_at();

-- Next ticket ID in jira schema
create or replace function jira.get_next_ticket_id(p_project_id uuid, p_project_key text)
returns text
language plpgsql
security definer
set search_path = jira, public
as $$
declare
  ticket_num integer;
begin
  insert into jira.project_counters (project_id, counter)
  values (p_project_id, 2)
  on conflict (project_id) do update
    set counter = jira.project_counters.counter + 1
  returning counter - 1 into ticket_num;

  return p_project_key || '-' || ticket_num;
end;
$$;

-- Keep profile creation in public trigger, but write into jira.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = jira, public
as $$
begin
  insert into jira.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Optional legacy import from public.tasks(id='main_board')
-- ============================================================
create or replace function jira.import_legacy_main_board()
returns jsonb
language plpgsql
security definer
set search_path = jira, public
as $$
declare
  board jsonb;
  item jsonb;
  chk jsonb;
  lnk jsonb;
  hist jsonb;
  legacy_count int := 0;
  inserted_count int := 0;
  max_suffix int := 0;
  owner_id uuid;
  project_id uuid;
  issue_id uuid;
  legacy_ticket text;
  suffix_num int;
  mapped_status text;
  mapped_priority text;
  mapped_type text;
begin
  -- Get first user/profile as owner fallback
  select id into owner_id from jira.profiles order by created_at asc limit 1;
  if owner_id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'No users/profiles exist yet. Sign up at least once, then run import again.'
    );
  end if;

  -- Create/find default legacy project
  insert into jira.projects (name, key, description, owner_id, color)
  values ('Legacy Imported Board', 'LEG', 'Imported from old public.tasks main_board', owner_id, '#6366f1')
  on conflict (key) do update
    set name = excluded.name
  returning id into project_id;

  insert into jira.project_members (project_id, user_id, role)
  values (project_id, owner_id, 'admin')
  on conflict (project_id, user_id) do nothing;

  -- Pull legacy JSON payload if exists
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'tasks'
  ) then
    select task_data::jsonb into board
    from public.tasks
    where id = 'main_board'
    limit 1;
  end if;

  if board is null then
    return jsonb_build_object(
      'ok', true,
      'imported', 0,
      'project_id', project_id,
      'note', 'No public.tasks(main_board) found.'
    );
  end if;

  for item in
    select value from jsonb_array_elements(coalesce(board->'tasks', '[]'::jsonb))
  loop
    legacy_count := legacy_count + 1;
    legacy_ticket := coalesce(item->>'ticketId', '');

    mapped_status := case lower(coalesce(item->>'status', ''))
      when 'backlog' then 'backlog'
      when 'to do' then 'todo'
      when 'todo' then 'todo'
      when 'in progress' then 'in_progress'
      when 'review' then 'review'
      when 'done' then 'done'
      else 'backlog'
    end;

    mapped_priority := case lower(coalesce(item->>'priority', ''))
      when 'highest' then 'highest'
      when 'high' then 'high'
      when 'medium' then 'medium'
      when 'low' then 'low'
      when 'lowest' then 'lowest'
      else 'medium'
    end;

    mapped_type := case lower(coalesce(item->>'type', 'task'))
      when 'epic' then 'epic'
      when 'story' then 'story'
      when 'task' then 'task'
      when 'bug' then 'bug'
      when 'subtask' then 'subtask'
      else 'task'
    end;

    insert into jira.issues (
      project_id,
      ticket_id,
      title,
      description,
      type,
      status,
      priority,
      story_points,
      reporter_id,
      due_date,
      tag,
      project_field,
      requestor,
      is_archived,
      order_rank
    )
    values (
      project_id,
      case when legacy_ticket = '' then 'LEG-' || legacy_count else legacy_ticket end,
      coalesce(nullif(item->>'title', ''), 'Untitled issue'),
      nullif(item->>'description', ''),
      mapped_type,
      mapped_status,
      mapped_priority,
      nullif(item->>'storyPoints', '')::int,
      owner_id,
      nullif(item->>'dueDate', '')::date,
      nullif(item->>'tag', ''),
      nullif(item->>'project', ''),
      nullif(item->>'requestor', ''),
      coalesce((item->>'isArchived')::boolean, false),
      legacy_count
    )
    returning id into issue_id;

    inserted_count := inserted_count + 1;

    -- checklist
    for chk in
      select value from jsonb_array_elements(coalesce(item->'checklists', '[]'::jsonb))
    loop
      insert into jira.issue_checklists (issue_id, text, is_completed, order_rank)
      values (
        issue_id,
        coalesce(chk->>'text', ''),
        coalesce((chk->>'isCompleted')::boolean, false),
        coalesce((chk->>'id')::int, 0)
      );
    end loop;

    -- links
    for lnk in
      select value from jsonb_array_elements(coalesce(item->'links', '[]'::jsonb))
    loop
      insert into jira.issue_links (issue_id, url, label)
      values (
        issue_id,
        coalesce(lnk->>'url', ''),
        nullif(lnk->>'label', '')
      );
    end loop;

    -- history/comments
    for hist in
      select value from jsonb_array_elements(coalesce(item->'history', '[]'::jsonb))
    loop
      insert into jira.issue_comments (
        issue_id,
        author_id,
        author_name,
        body,
        is_system,
        created_at
      )
      values (
        issue_id,
        null,
        coalesce(hist->>'author', 'legacy'),
        coalesce(hist->>'text', ''),
        coalesce((hist->>'isSystem')::boolean, false),
        now()
      );
    end loop;

    -- keep ticket counter aligned with max LEG-123 suffix
    begin
      suffix_num := nullif(regexp_replace(coalesce(legacy_ticket, ''), '^[^0-9]*', ''), '')::int;
      if suffix_num is not null and suffix_num > max_suffix then
        max_suffix := suffix_num;
      end if;
    exception when others then
      -- ignore malformed ticket ids
      null;
    end;
  end loop;

  insert into jira.project_counters (project_id, counter)
  values (project_id, greatest(max_suffix + 1, inserted_count + 1, 1))
  on conflict (project_id) do update
    set counter = greatest(jira.project_counters.counter, excluded.counter);

  return jsonb_build_object(
    'ok', true,
    'project_id', project_id,
    'legacy_tasks_seen', legacy_count,
    'imported', inserted_count
  );
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table jira.profiles enable row level security;
alter table jira.projects enable row level security;
alter table jira.project_members enable row level security;
alter table jira.project_counters enable row level security;
alter table jira.sprints enable row level security;
alter table jira.issues enable row level security;
alter table jira.issue_checklists enable row level security;
alter table jira.issue_links enable row level security;
alter table jira.issue_relations enable row level security;
alter table jira.issue_comments enable row level security;

drop policy if exists "Read profiles" on jira.profiles;
drop policy if exists "Insert own profile" on jira.profiles;
drop policy if exists "Update own profile" on jira.profiles;
create policy "Read profiles" on jira.profiles for select using (auth.role() = 'authenticated');
create policy "Insert own profile" on jira.profiles for insert with check (auth.uid() = id);
create policy "Update own profile" on jira.profiles for update using (auth.uid() = id);

drop policy if exists "Read projects" on jira.projects;
drop policy if exists "Create projects" on jira.projects;
drop policy if exists "Update own projects" on jira.projects;
drop policy if exists "Delete own projects" on jira.projects;
create policy "Read projects" on jira.projects for select using (auth.role() = 'authenticated');
create policy "Create projects" on jira.projects for insert with check (auth.role() = 'authenticated');
create policy "Update own projects" on jira.projects for update using (auth.uid() = owner_id);
create policy "Delete own projects" on jira.projects for delete using (auth.uid() = owner_id);

drop policy if exists "Read project members" on jira.project_members;
drop policy if exists "Manage project members" on jira.project_members;
create policy "Read project members" on jira.project_members for select using (auth.role() = 'authenticated');
create policy "Manage project members" on jira.project_members for all using (auth.role() = 'authenticated');

drop policy if exists "Manage counters" on jira.project_counters;
create policy "Manage counters" on jira.project_counters for all using (auth.role() = 'authenticated');

drop policy if exists "Read sprints" on jira.sprints;
drop policy if exists "Manage sprints" on jira.sprints;
create policy "Read sprints" on jira.sprints for select using (auth.role() = 'authenticated');
create policy "Manage sprints" on jira.sprints for all using (auth.role() = 'authenticated');

drop policy if exists "Read issues" on jira.issues;
drop policy if exists "Manage issues" on jira.issues;
create policy "Read issues" on jira.issues for select using (auth.role() = 'authenticated');
create policy "Manage issues" on jira.issues for all using (auth.role() = 'authenticated');

drop policy if exists "Manage checklists" on jira.issue_checklists;
drop policy if exists "Manage links" on jira.issue_links;
drop policy if exists "Manage relations" on jira.issue_relations;
drop policy if exists "Manage comments" on jira.issue_comments;
create policy "Manage checklists" on jira.issue_checklists for all using (auth.role() = 'authenticated');
create policy "Manage links" on jira.issue_links for all using (auth.role() = 'authenticated');
create policy "Manage relations" on jira.issue_relations for all using (auth.role() = 'authenticated');
create policy "Manage comments" on jira.issue_comments for all using (auth.role() = 'authenticated');

grant all on all tables in schema jira to authenticated, service_role;
grant all on all sequences in schema jira to authenticated, service_role;
