// ── Enums / union types ────────────────────────────────────────────────────────

export type IssueType = 'epic' | 'story' | 'task' | 'bug' | 'subtask';

export type IssueStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'done';

export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';

export type ProjectRole = 'admin' | 'manager' | 'member' | 'viewer';

export type SprintStatus = 'planning' | 'active' | 'completed';

export type RelationType =
  | 'blocks'
  | 'is_blocked_by'
  | 'relates_to'
  | 'duplicates'
  | 'is_duplicated_by';

// ── DB entities ────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  owner_id: string;
  color: string;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
  profile?: Profile;
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: SprintStatus;
  created_at: string;
}

export interface Issue {
  id: string;
  project_id: string;
  ticket_id: string;
  title: string;
  description: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: Priority;
  story_points: number | null;
  assignee_id: string | null;
  reporter_id: string | null;
  sprint_id: string | null;
  parent_id: string | null;
  epic_id: string | null;
  due_date: string | null;
  tag: string | null;
  project_field: string | null;
  requestor: string | null;
  order_rank: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined / computed
  assignee?: Profile | null;
  reporter?: Profile | null;
  sprint?: Sprint | null;
  checklists?: IssueChecklist[];
  links?: IssueLink[];
  comments?: IssueComment[];
  subtasks?: Issue[];
  parent?: Issue | null;
  epic?: Issue | null;
}

export interface IssueChecklist {
  id: string;
  issue_id: string;
  text: string;
  is_completed: boolean;
  order_rank: number;
  created_at: string;
}

export interface IssueLink {
  id: string;
  issue_id: string;
  url: string;
  label: string | null;
  created_at: string;
}

export interface IssueRelation {
  id: string;
  from_issue_id: string;
  to_issue_id: string;
  relation_type: RelationType;
  created_at: string;
  related_issue?: Issue;
}

export interface IssueComment {
  id: string;
  issue_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  is_system: boolean;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const ISSUE_STATUSES: { value: IssueStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

export const ISSUE_TYPES: { value: IssueType; label: string }[] = [
  { value: 'epic', label: 'Epic' },
  { value: 'story', label: 'Story' },
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'subtask', label: 'Sub-task' },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'highest', label: 'Highest' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'lowest', label: 'Lowest' },
];

export const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

/** @deprecated Tags are now stored per-project in Supabase (jira.project_tags).
 *  This constant is kept as a fallback while the migration is applied. */
export const TAGS = ['Finance', 'Project', 'Cloud', 'Meeting', 'Bug', 'Feature'];

// ── Project tags ───────────────────────────────────────────────────────────────

export interface ProjectTag {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: string;
}

export const STATUS_COLORS: Record<IssueStatus, string> = {
  backlog: 'bg-gray-100 text-gray-700',
  todo: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  highest: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-blue-400',
  lowest: 'text-gray-400',
};

export const TYPE_COLORS: Record<IssueType, string> = {
  epic: 'text-purple-600',
  story: 'text-green-600',
  task: 'text-blue-600',
  bug: 'text-red-600',
  subtask: 'text-sky-500',
};

// ── Tier 1 Types ──────────────────────────────────────────────────────────────

export interface TimeEntry {
  id: string;
  issue_id: string;
  user_id: string;
  started_at: string;
  stopped_at: string | null;
  duration_secs: number | null;
  note: string | null;
  created_at: string;
  actor_name?: string;
}

export interface IssueDependency {
  id: string;
  issue_id: string;
  depends_on_id: string;
  depends_on?: Issue;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  project_id: string;
  issue_id: string | null;
  user_id: string | null;
  actor_name: string;
  action: string;
  detail: string | null;
  created_at: string;
  issue?: { ticket_id: string; title: string } | null;
}

// ── Tier 2 Types ──────────────────────────────────────────────────────────────

export type AutomationTrigger =
  | 'status_changed'
  | 'priority_changed'
  | 'due_date_reached'
  | 'sprint_ended'
  | 'days_in_status'
  | 'issue_created'
  | 'assigned_to';

export type AutomationAction =
  | 'change_status'
  | 'change_priority'
  | 'move_to_sprint'
  | 'notify'
  | 'assign_to';

export interface AutomationRule {
  id: string;
  project_id: string;
  name: string;
  is_active: boolean;
  trigger_type: AutomationTrigger;
  trigger_value: Record<string, unknown> | null;
  action_type: AutomationAction;
  action_value: Record<string, unknown> | null;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
}

export interface AutomationLog {
  id: string;
  rule_id: string;
  issue_id: string | null;
  result: 'success' | 'skipped' | 'error';
  detail: string | null;
  ran_at: string;
}

export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'boolean';

export interface CustomFieldDef {
  id: string;
  project_id: string;
  name: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  order_rank: number;
  created_at: string;
}

export interface CustomFieldValue {
  id: string;
  issue_id: string;
  field_id: string;
  value: string | null;
  field?: CustomFieldDef;
  created_at: string;
  updated_at: string;
}
