import { supabase } from './supabase';
import type {
  Project,
  Issue,
  IssueChecklist,
  IssueLink,
  IssueComment,
  Sprint,
  Profile,
  ProjectTag,
  IssueStatus,
  IssueType,
  Priority,
} from '../types';

const jiraDb = supabase.schema('jira');

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await jiraDb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data } = await jiraDb.from('profiles').select('*').order('full_name');
  return data ?? [];
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<void> {
  await jiraDb.from('profiles').upsert(profile);
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const { data } = await jiraDb
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function createProject(
  payload: Pick<Project, 'name' | 'key' | 'description' | 'color'> & { owner_id: string }
): Promise<Project | null> {
  const { data } = await jiraDb.from('projects').insert(payload).select().single();
  if (data) {
    // add owner as admin member
    await jiraDb.from('project_members').insert({
      project_id: data.id,
      user_id: payload.owner_id,
      role: 'admin',
    });
  }
  return data;
}

export async function updateProject(
  id: string,
  payload: Partial<Pick<Project, 'name' | 'description' | 'color'>>
): Promise<void> {
  await jiraDb.from('projects').update(payload).eq('id', id);
}

export async function deleteProject(id: string): Promise<void> {
  await jiraDb.from('projects').delete().eq('id', id);
}

// ── Sprints ───────────────────────────────────────────────────────────────────

export async function getSprints(projectId: string): Promise<Sprint[]> {
  const { data } = await jiraDb
    .from('sprints')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function createSprint(payload: {
  project_id: string;
  name: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
}): Promise<Sprint | null> {
  const { data } = await jiraDb.from('sprints').insert(payload).select().single();
  return data;
}

export async function updateSprint(
  id: string,
  payload: Partial<Pick<Sprint, 'name' | 'goal' | 'start_date' | 'end_date' | 'status'>>
): Promise<void> {
  await jiraDb.from('sprints').update(payload).eq('id', id);
}

export async function deleteSprint(id: string): Promise<void> {
  // Detach issues from sprint before deleting
  await jiraDb.from('issues').update({ sprint_id: null }).eq('sprint_id', id);
  await jiraDb.from('sprints').delete().eq('id', id);
}

// ── Issues ────────────────────────────────────────────────────────────────────

export async function getIssues(
  projectId: string,
  options: {
    includeArchived?: boolean;
    sprintId?: string | null;
    type?: IssueType;
    status?: IssueStatus;
    assigneeId?: string;
  } = {}
): Promise<Issue[]> {
  let q = jiraDb
    .from('issues')
    .select(
      `*, assignee:assignee_id(id,email,full_name,avatar_url), reporter:reporter_id(id,email,full_name,avatar_url)`
    )
    .eq('project_id', projectId)
    .is('parent_id', null); // top-level only in lists

  if (!options.includeArchived) q = q.eq('is_archived', false);
  if (options.sprintId !== undefined)
    options.sprintId === null ? (q = q.is('sprint_id', null)) : (q = q.eq('sprint_id', options.sprintId));
  if (options.type) q = q.eq('type', options.type);
  if (options.status) q = q.eq('status', options.status);
  if (options.assigneeId) q = q.eq('assignee_id', options.assigneeId);

  const { data } = await q.order('order_rank').order('created_at');
  return (data as Issue[]) ?? [];
}

export async function getIssue(id: string): Promise<Issue | null> {
  const { data } = await jiraDb
    .from('issues')
    .select(
      `*,
       assignee:assignee_id(id,email,full_name,avatar_url),
       reporter:reporter_id(id,email,full_name,avatar_url),
       checklists:issue_checklists(*),
       links:issue_links(*),
       comments:issue_comments(*),
       subtasks:issues!parent_id(*),
       parent:parent_id(id,ticket_id,title,type),
       epic:epic_id(id,ticket_id,title)`
    )
    .eq('id', id)
    .single();
  return data as Issue | null;
}

export async function createIssue(payload: {
  project_id: string;
  project_key: string;
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  priority: Priority;
  story_points?: number | null;
  assignee_id?: string | null;
  reporter_id?: string | null;
  sprint_id?: string | null;
  parent_id?: string | null;
  epic_id?: string | null;
  due_date?: string | null;
  tag?: string | null;
  project_field?: string | null;
  requestor?: string | null;
}): Promise<Issue | null> {
  const { project_key, ...rest } = payload;

  // Get next ticket ID atomically
  const { data: ticketData } = await jiraDb.rpc('get_next_ticket_id', {
    p_project_id: rest.project_id,
    p_project_key: project_key,
  });

  const { data } = await jiraDb
    .from('issues')
    .insert({ ...rest, ticket_id: ticketData as string })
    .select()
    .single();
  return data as Issue | null;
}

export async function updateIssue(id: string, payload: Partial<Issue>): Promise<void> {
  // Strip joined fields
  const { assignee, reporter, checklists, links, comments, subtasks, parent, epic, sprint, ...rest } = payload;
  void assignee; void reporter; void checklists; void links; void comments;
  void subtasks; void parent; void epic; void sprint;
  await jiraDb.from('issues').update(rest).eq('id', id);
}

export async function deleteIssue(id: string): Promise<void> {
  await jiraDb.from('issues').delete().eq('id', id);
}

export async function archiveIssue(id: string, archived: boolean): Promise<void> {
  await jiraDb.from('issues').update({ is_archived: archived }).eq('id', id);
}

export async function reorderIssue(id: string, rank: number): Promise<void> {
  await jiraDb.from('issues').update({ order_rank: rank }).eq('id', id);
}

// ── Checklists ────────────────────────────────────────────────────────────────

export async function addChecklist(issueId: string, text: string): Promise<IssueChecklist | null> {
  const { data } = await jiraDb
    .from('issue_checklists')
    .insert({ issue_id: issueId, text })
    .select()
    .single();
  return data;
}

export async function toggleChecklist(id: string, isCompleted: boolean): Promise<void> {
  await jiraDb.from('issue_checklists').update({ is_completed: isCompleted }).eq('id', id);
}

export async function deleteChecklist(id: string): Promise<void> {
  await jiraDb.from('issue_checklists').delete().eq('id', id);
}

// ── Links ─────────────────────────────────────────────────────────────────────

export async function addLink(issueId: string, url: string, label?: string): Promise<IssueLink | null> {
  const { data } = await jiraDb
    .from('issue_links')
    .insert({ issue_id: issueId, url, label })
    .select()
    .single();
  return data;
}

export async function deleteLink(id: string): Promise<void> {
  await jiraDb.from('issue_links').delete().eq('id', id);
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(payload: {
  issue_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  is_system?: boolean;
}): Promise<IssueComment | null> {
  const { data } = await jiraDb.from('issue_comments').insert(payload).select().single();
  return data;
}

// ── Dashboard helpers ─────────────────────────────────────────────────────────

export async function getIssueStats(projectId: string) {
  const { data } = await jiraDb
    .from('issues')
    .select('status, type, priority, assignee_id, created_at, due_date, story_points')
    .eq('project_id', projectId)
    .eq('is_archived', false);
  return data ?? [];
}

// ── Burndown data ─────────────────────────────────────────────────────────────

export interface BurndownPoint {
  date: string;      // 'YYYY-MM-DD'
  remaining: number; // story points remaining on that day
  ideal: number;     // ideal remaining on that day
}

/**
 * Generates daily burndown data for a sprint.
 * Uses updated_at as a proxy for when issues were moved to 'done'.
 */
export async function getBurndownData(
  projectId: string,
  sprintId: string
): Promise<BurndownPoint[]> {
  const sprints = await getSprints(projectId);
  const sprint = sprints.find((s) => s.id === sprintId);
  if (!sprint?.start_date || !sprint?.end_date) return [];

  const { data: issues } = await jiraDb
    .from('issues')
    .select('story_points, status, updated_at')
    .eq('project_id', projectId)
    .eq('sprint_id', sprintId)
    .eq('is_archived', false);

  if (!issues || issues.length === 0) return [];

  const startDate = new Date(sprint.start_date);
  const endDate = new Date(sprint.end_date);
  const today = new Date();
  const cutoff = today < endDate ? today : endDate;

  const totalPoints = issues.reduce(
    (sum: number, i: { story_points: number | null }) => sum + (i.story_points ?? 0),
    0
  );

  // Build day-by-day series
  const points: BurndownPoint[] = [];
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

  for (let d = 0; d < days; d++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];

    // Ideal: linear decay from totalPoints to 0
    const ideal = Math.round(totalPoints * (1 - d / (days - 1)));

    // Actual: only compute up to today (future is undefined)
    if (date > cutoff) {
      points.push({ date: dateStr, remaining: -1, ideal });
      continue;
    }

    const burned = (
      issues as Array<{ story_points: number | null; status: string; updated_at: string }>
    )
      .filter(
        (i) =>
          i.status === 'done' &&
          i.updated_at &&
          new Date(i.updated_at) <= new Date(dateStr + 'T23:59:59Z')
      )
      .reduce((sum, i) => sum + (i.story_points ?? 0), 0);

    points.push({ date: dateStr, remaining: totalPoints - burned, ideal });
  }

  return points;
}

// ── Project Tags ──────────────────────────────────────────────────────────────

export async function getProjectTags(projectId: string): Promise<ProjectTag[]> {
  const { data } = await jiraDb
    .from('project_tags')
    .select('*')
    .eq('project_id', projectId)
    .order('name');
  return (data as ProjectTag[]) ?? [];
}

export async function createProjectTag(
  projectId: string,
  name: string,
  color = '#6366f1'
): Promise<ProjectTag | null> {
  const { data } = await jiraDb
    .from('project_tags')
    .insert({ project_id: projectId, name: name.trim(), color })
    .select()
    .single();
  return data as ProjectTag | null;
}

export async function deleteProjectTag(id: string): Promise<void> {
  await jiraDb.from('project_tags').delete().eq('id', id);
}
