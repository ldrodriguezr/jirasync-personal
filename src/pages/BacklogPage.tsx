import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, Plus, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { getIssues, createIssue, updateIssue, getSprints } from '../lib/db';
import { useApp } from '../context/AppContext';
import { useRealtimeIssues } from '../hooks/useRealtimeIssues';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { Issue, Sprint, IssueType, IssueStatus, Priority } from '../types';
import { ISSUE_TYPES, ISSUE_STATUSES, PRIORITIES, STATUS_COLORS } from '../types';
import IssueTypeIcon from '../components/issues/IssueTypeIcon';
import PriorityIcon from '../components/issues/PriorityIcon';
import Avatar from '../components/ui/Avatar';
import IssueModal from '../components/issues/IssueModal';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

interface CreateForm {
  title: string;
  type: IssueType;
  priority: Priority;
  assignee_id: string;
  sprint_id: string;
}

const defaultForm: CreateForm = { title: '', type: 'task', priority: 'medium', assignee_id: '', sprint_id: '' };

export default function BacklogPage() {
  const { user, activeProject, profiles } = useApp();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ ...defaultForm });
  const [createLoading, setCreateLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!activeProject) return;
    const [iss, spr] = await Promise.all([
      getIssues(activeProject.id, { includeArchived: false }),
      getSprints(activeProject.id),
    ]);
    setIssues(iss);
    setSprints(spr);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  // Real-time: auto-refresh on issue changes
  useRealtimeIssues(activeProject?.id ?? null, load);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCreate: () => setShowCreateModal(true),
    onSearch: () => searchRef.current?.focus(),
    onEscape: () => { if (showCreateModal) setShowCreateModal(false); },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !user) return;
    setCreateLoading(true);
    await createIssue({
      project_id: activeProject.id,
      project_key: activeProject.key,
      title: createForm.title,
      type: createForm.type,
      status: createForm.sprint_id ? 'todo' : 'backlog',
      priority: createForm.priority,
      assignee_id: createForm.assignee_id || null,
      reporter_id: user.id,
      sprint_id: createForm.sprint_id || null,
    });
    setCreateLoading(false);
    setShowCreateModal(false);
    setCreateForm({ ...defaultForm });
    await load();
  };

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const moveToSprint = async (issueId: string, sprintId: string | null) => {
    await updateIssue(issueId, {
      sprint_id: sprintId,
      status: sprintId ? 'todo' : 'backlog',
    });
    await load();
  };

  const filtered = issues.filter((i) => {
    if (filterType && i.type !== filterType) return false;
    if (filterAssignee && i.assignee_id !== filterAssignee) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.title.toLowerCase().includes(q) && !i.ticket_id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeSprint = sprints.find((s) => s.status === 'active');
  const planningSprints = sprints.filter((s) => s.status === 'planning');
  const backlogIssues = filtered.filter((i) => !i.sprint_id);

  const getSprintIssues = (sprintId: string) => filtered.filter((i) => i.sprint_id === sprintId);

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <Layers size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-1">No project selected</h3>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{activeProject.name}</h1>
          <p className="text-xs text-gray-400">{activeProject.key} · Backlog</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search... (/)"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All types</option>
            {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All assignees</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
          </select>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Create Issue
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-5xl mx-auto w-full">
        {/* Active Sprint section */}
        {activeSprint && (
          <Section
            id={activeSprint.id}
            title={activeSprint.name}
            subtitle={`Active · ${getSprintIssues(activeSprint.id).length} issues`}
            badge="Active"
            badgeColor="bg-green-100 text-green-700"
            collapsed={collapsedSections.has(activeSprint.id)}
            onToggle={() => toggleSection(activeSprint.id)}
          >
            {getSprintIssues(activeSprint.id).map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                sprints={sprints}
                onClick={() => setOpenIssueId(issue.id)}
                onMoveToSprint={moveToSprint}
              />
            ))}
          </Section>
        )}

        {/* Planning Sprints */}
        {planningSprints.map((sprint) => (
          <Section
            key={sprint.id}
            id={sprint.id}
            title={sprint.name}
            subtitle={`${getSprintIssues(sprint.id).length} issues`}
            badge="Planning"
            badgeColor="bg-blue-100 text-blue-700"
            collapsed={collapsedSections.has(sprint.id)}
            onToggle={() => toggleSection(sprint.id)}
          >
            {getSprintIssues(sprint.id).map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                sprints={sprints}
                onClick={() => setOpenIssueId(issue.id)}
                onMoveToSprint={moveToSprint}
              />
            ))}
          </Section>
        ))}

        {/* Backlog */}
        <Section
          id="backlog"
          title="Backlog"
          subtitle={`${backlogIssues.length} issues`}
          collapsed={collapsedSections.has('backlog')}
          onToggle={() => toggleSection('backlog')}
        >
          {backlogIssues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              sprints={sprints}
              onClick={() => setOpenIssueId(issue.id)}
              onMoveToSprint={moveToSprint}
            />
          ))}
          {backlogIssues.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Backlog is clear!</p>
          )}
        </Section>
      </div>

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add to Backlog">
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Title *</label>
            <input
              required
              autoFocus
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Issue summary..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</label>
              <select value={createForm.type} onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value as IssueType }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Priority</label>
              <select value={createForm.priority} onChange={(e) => setCreateForm((f) => ({ ...f, priority: e.target.value as Priority }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assignee</label>
              <select value={createForm.assignee_id} onChange={(e) => setCreateForm((f) => ({ ...f, assignee_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Unassigned</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sprint</label>
              <select value={createForm.sprint_id} onChange={(e) => setCreateForm((f) => ({ ...f, sprint_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Backlog</option>
                {sprints.filter((s) => s.status !== 'completed').map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" loading={createLoading}>Add Issue</Button>
          </div>
        </form>
      </Modal>

      {openIssueId && user && (
        <IssueModal
          issueId={openIssueId}
          currentUser={user}
          profiles={profiles}
          sprints={sprints}
          onClose={() => setOpenIssueId(null)}
          onDeleted={() => { setOpenIssueId(null); load(); }}
          onUpdated={() => load()}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  id: _id,
  title,
  subtitle,
  badge,
  badgeColor,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        {collapsed ? <ChevronRight size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        <span className="font-semibold text-gray-800">{title}</span>
        {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>}
        {subtitle && <span className="ml-auto text-xs text-gray-400">{subtitle}</span>}
      </button>
      {!collapsed && <div className="divide-y divide-gray-50">{children}</div>}
    </div>
  );
}

function IssueRow({
  issue,
  sprints,
  onClick,
  onMoveToSprint,
}: {
  issue: Issue;
  sprints: Sprint[];
  onClick: () => void;
  onMoveToSprint: (id: string, sprintId: string | null) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer group transition-colors"
      onClick={onClick}
    >
      <GripVertical size={14} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
      <IssueTypeIcon type={issue.type} size={14} />
      <span className="font-mono text-[11px] text-gray-400 w-16 flex-shrink-0">{issue.ticket_id}</span>
      <span className="flex-1 text-sm text-gray-800 truncate">{issue.title}</span>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <select
          value={issue.sprint_id ?? ''}
          onChange={(e) => onMoveToSprint(issue.id, e.target.value || null)}
          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Backlog</option>
          {sprints.filter((s) => s.status !== 'completed').map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${STATUS_COLORS[issue.status]}`}>
        {ISSUE_STATUSES.find((s) => s.value === issue.status)?.label ?? issue.status}
      </span>
      <PriorityIcon priority={issue.priority} size={13} />
      {issue.story_points && (
        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {issue.story_points}
        </span>
      )}
      {issue.assignee && (
        <Avatar name={issue.assignee.full_name ?? issue.assignee.email} size="xs" />
      )}
    </div>
  );
}
