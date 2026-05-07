-- ────────────────────────────────────────────────────────────────────────────
-- 003 · Project tags
-- Replaces the hardcoded TAGS constant with a per-project tags table.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists jira.project_tags (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references jira.projects(id) on delete cascade,
  name       text not null,
  color      text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

-- Row-level security: same policy as other jira tables
alter table jira.project_tags enable row level security;

create policy "Authenticated users can manage project tags"
  on jira.project_tags
  for all
  to authenticated
  using (true)
  with check (true);

-- Seed default tags for existing projects (optional, can be removed)
insert into jira.project_tags (project_id, name, color)
select id, tag, '#6366f1'
from jira.projects,
     unnest(array['Finance','Project','Cloud','Meeting','Bug','Feature']) as tag
on conflict do nothing;
