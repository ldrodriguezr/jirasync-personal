import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Filter, Archive, RefreshCw, Layers, Keyboard } from 'lucide-react';
import { getIssues, createIssue, updateIssue, getSprints } from '../lib/db';
import { useApp } from '../context/AppContext';
import { useRealtimeIssues } from '../hooks/useRealtimeIssues';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { Issue, IssueStatus, IssueType, Priority, Sprint } from '../types';
import { ISSUE_STATUSES, PRIORITIES, ISSUE_TYPES, STORY_POINTS } from '../types';
import IssueCard from '../components/issues/IssueCard';
import IssueModal from '../components/issues/IssueModal';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const COLUMNS: { status: IssueStatus; label: string; color: string }[] = [
  { status: 'backlog',     label: 'Backlog',      color: 'bg-gray-200' },
  { status: 'todo',        label: 'To Do',         color: 'bg-slate-300' },
  { status: 'in_progress', label: 'In Progress',   color: 'bg-blue-300' },
  { status: 'review',      label: 'Review',        color: 'bg-purple-300' },
  { status: 'done',        label: 'Done',          color: 'bg-green-300' },
];

interface CreateForm {
  title: string;
  type: IssueType;
  status: IssueStatus;
  priority: Priority;
  assignee_id: string;
  sprint_id: string;
  story_points: string;
  due_date: string;
  tag: string;
  description: string;
  project_field: string;
  requestor: string;
}

const defaultForm: CreateForm = {
  title: '',
  type: 'task',
  status: 'todo',
  priority: 'medium',
  assignee_id: '',
  sprint_id: '',
  story_points: '',
  due_date: '',
  tag: '',
  description: '',
  project_field: '',
  requestor: '',
};

export default function BoardPage() {
  const { user, activeProject, profiles, projectTags } = useApp();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ ...defaultForm });
  const [createLoading, setCreateLoading] = useState(false);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [search, setSearch] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [quickAddCol, setQuickAddCol] = useState<IssueStatus | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const quickAddRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    const [iss, spr] = await Promise.all([
      getIssues(activeProject.id, { includeArchived: showArchived }),
      getSprints(activeProject.id),
    ]);
    setIssues(iss);
    setSprints(spr);
    setLoading(false);
  }, [activeProject, showArchived]);

  const handleQuickAdd = useCallback(async (status: IssueStatus) => {
    if (!quickAddTitle.trim() || !activeProject || !user) return;
    await createIssue({
      project_id: activeProject.id,
      project_key: activeProject.key,
      title: quickAddTitle.trim(),
      type: 'task',
      status,
      priority: 'medium',
      reporter_id: user.id,
    });
    setQuickAddTitle('');
    setQuickAddCol(null);
    load();
  }, [quickAddTitle, activeProject, user, load]);

  const openQuickAdd = useCallback((status: IssueStatus) => {
    setQuickAddCol(status);
    setQuickAddTitle('');
    setTimeout(() => quickAddRef.current?.focus(), 30);
  }, []);

  // Real-time: auto-refresh when any issue changes in this project
  useRealtimeIssues(activeProject?.id ?? null, load);

  // Load on mount and when active project changes
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (activeProject) load(); }, [activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCreate: () => { if (!openIssueId) setShowCreateModal(true); },
    onSearch: () => { searchRef.current?.focus(); },
    onEscape: () => {
      if (showCreateModal) setShowCreateModal(false);
      else if (openIssueId) setOpenIssueId(null);
    },
  });

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatus = destination.droppableId as IssueStatus;
    const issue = issues.find((i) => i.id === draggableId);
    if (!issue || issue.status === newStatus) return;

    // Optimistic update
    setIssues((prev) =>
      prev.map((i) => (i.id === draggableId ? { ...i, status: newStatus } : i))
    );
    await updateIssue(draggableId, { status: newStatus });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !user) return;
    setCreateLoading(true);
    const newIssue = await createIssue({
      project_id: activeProject.id,
      project_key: activeProject.key,
      title: createForm.title,
      description: createForm.description || undefined,
      type: createForm.type,
      status: createForm.status,
      priority: createForm.priority,
      assignee_id: createForm.assignee_id || null,
      reporter_id: user.id,
      sprint_id: createForm.sprint_id || null,
      story_points: createForm.story_points ? Number(createForm.story_points) : null,
      due_date: createForm.due_date || null,
      tag: createForm.tag || null,
      project_field: createForm.project_field || null,
      requestor: createForm.requestor || null,
    });
    setCreateLoading(false);
    if (newIssue) {
      setShowCreateModal(false);
      setCreateForm({ ...defaultForm });
      setOpenIssueId(newIssue.id);
      await load();
    }
  };

  const filtered = issues.filter((i) => {
    if (filterAssignee && i.assignee_id !== filterAssignee) return false;
    if (filterPriority && i.priority !== filterPriority) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !i.title.toLowerCase().includes(q) &&
        !i.ticket_id.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <Layers size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-1">No project selected</h3>
        <p className="text-sm text-gray-400">Select a project from the sidebar to view its board</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{activeProject.name}</h1>
          <p className="text-xs text-gray-400">{activeProject.key} · Board</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues... (/)"
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
          />
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All assignees</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors
              ${showArchived ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800'}`}
          >
            <Archive size={14} />
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
          <button onClick={load} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowShortcuts(true)}
            className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard size={14} />
          </button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Create Issue <span className="text-blue-200 text-[10px] ml-1 hidden sm:inline">(C)</span>
          </Button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-h-full" style={{ minWidth: `${COLUMNS.length * 300}px` }}>
            {COLUMNS.map(({ status, label, color }) => {
              const colIssues = filtered.filter((i) => i.status === status);
              return (
                <div key={status} className="flex flex-col w-72 flex-shrink-0">
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{label}</span>
                    <span className="ml-auto text-xs bg-gray-200 text-gray-600 dark:text-gray-400 rounded-full px-2 py-0.5 font-medium">
                      {colIssues.length}
                    </span>
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={status}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 rounded-xl p-2 min-h-[200px] transition-colors
                          ${snapshot.isDraggingOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : 'bg-gray-100 dark:bg-gray-950'}`}
                      >
                        {colIssues.map((issue, index) => (
                          <Draggable key={issue.id} draggableId={issue.id} index={index}>
                            {(prov) => (
                              <IssueCard
                                issue={issue}
                                onClick={() => setOpenIssueId(issue.id)}
                                draggableRef={prov.innerRef}
                                draggableProps={prov.draggableProps}
                                dragHandleProps={prov.dragHandleProps ?? undefined}
                              />
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {/* Inline quick-add */}
                        {quickAddCol === status ? (
                          <div className="mt-1 bg-white dark:bg-gray-900 rounded-lg border border-blue-300 shadow-sm p-2">
                            <textarea
                              ref={quickAddRef}
                              value={quickAddTitle}
                              onChange={(e) => setQuickAddTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleQuickAdd(status);
                                } else if (e.key === 'Escape') {
                                  setQuickAddCol(null);
                                  setQuickAddTitle('');
                                }
                              }}
                              placeholder="Issue title... (Enter to create, Esc to cancel)"
                              rows={2}
                              className="w-full text-sm resize-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
                            />
                            <div className="flex items-center justify-end gap-2 mt-1.5">
                              <button
                                onClick={() => { setQuickAddCol(null); setQuickAddTitle(''); }}
                                className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-400 px-2 py-1 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleQuickAdd(status)}
                                disabled={!quickAddTitle.trim()}
                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors"
                              >
                                Create
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => openQuickAdd(status)}
                            className="w-full mt-1 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-400 py-1.5 px-2 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Plus size={13} /> Add issue
                          </button>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Issue" size="lg">
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Title *
            </label>
            <input
              required
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Issue summary..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Type</label>
              <select
                value={createForm.type}
                onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value as IssueType }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Status</label>
              <select
                value={createForm.status}
                onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value as IssueStatus }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                {ISSUE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Priority</label>
              <select
                value={createForm.priority}
                onChange={(e) => setCreateForm((f) => ({ ...f, priority: e.target.value as Priority }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Assignee</label>
              <select
                value={createForm.assignee_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, assignee_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Sprint</label>
              <select
                value={createForm.sprint_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, sprint_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Backlog</option>
                {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Story Points</label>
              <select
                value={createForm.story_points}
                onChange={(e) => setCreateForm((f) => ({ ...f, story_points: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">—</option>
                {STORY_POINTS.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Due Date</label>
              <input
                type="date"
                value={createForm.due_date}
                onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Tag</label>
              <select
                value={createForm.tag}
                onChange={(e) => setCreateForm((f) => ({ ...f, tag: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">None</option>
                {projectTags.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Description</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Add more details..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Project(s)</label>
              <input
                type="text"
                value={createForm.project_field}
                onChange={(e) => setCreateForm((f) => ({ ...f, project_field: e.target.value }))}
                placeholder="e.g. df-key-uat"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Requestor</label>
              <input
                type="text"
                value={createForm.requestor}
                onChange={(e) => setCreateForm((f) => ({ ...f, requestor: e.target.value }))}
                placeholder="email or name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" loading={createLoading}>Create Issue</Button>
          </div>
        </form>
      </Modal>

      {/* Issue Detail Modal */}
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

      {/* Keyboard shortcuts help */}
      <Modal open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Keyboard Shortcuts">
        <div className="p-5 space-y-3">
          {[
            ['C', 'Create new issue'],
            ['/', 'Focus search'],
            ['Esc', 'Close modal / dialog'],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center gap-4">
              <kbd className="px-2.5 py-1 bg-gray-100 dark:bg-gray-950 border border-gray-300 rounded text-xs font-mono font-semibold text-gray-700 dark:text-gray-300 min-w-[2.5rem] text-center">
                {key}
              </kbd>
              <span className="text-sm text-gray-600 dark:text-gray-400">{desc}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
