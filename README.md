# JiraSync Personal

A professional project & issue tracker built with React, Vite, Tailwind and Supabase — inspired by Jira.

## Features

- **Kanban Board** — drag & drop issues between Backlog, To Do, In Progress, Review, and Done
- **Backlog** — prioritized backlog view with sprint assignment inline
- **Issue Types** — Epic, Story, Task, Bug, Sub-task with hierarchy support
- **Issue Detail** — title, description, checklist, comments, links, metadata sidebar
- **Sprints** — create, start, and complete sprints with progress tracking
- **Dashboard** — KPI cards, issues by status/type/priority/assignee charts
- **Projects** — multiple projects, each with its own board and key (e.g. EFX)
- **Auth** — Supabase email/password authentication

## Setup

### 1. Create `.env`

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Run Supabase migration

Open your Supabase project → SQL Editor → paste and run the contents of:
```
supabase/migrations/001_initial_schema.sql
```

### 3. Install & run

```bash
npm install
npm run dev
```

### 4. Deploy (Netlify)

Connect the repo to Netlify. Build settings are in `netlify.toml`.
Add the two env vars in Netlify → Site Settings → Environment Variables.

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS 3
- Supabase (auth + database + RLS)
- @hello-pangea/dnd (drag & drop)
- react-router-dom v6
- lucide-react (icons)
- date-fns
