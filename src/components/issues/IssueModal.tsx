import React, { useEffect, useRef, useState } from 'react';
import {
  X, Trash2, Archive, ArchiveRestore, Plus, Link as LinkIcon,
  Send, ExternalLink, Eye, Pencil, Play, Square, Clock, GitBranch,
} from 'lucide-react';
import { format } from 'date-fns';
import { marked } from 'marked';
import {
  getIssue, updateIssue, deleteIssue, archiveIssue,
  addChecklist, toggleChecklist, deleteChecklist,
  addLink, deleteLink, addComment,
  getTimeEntries, logManualTime, deleteTimeEntry, formatDuration,
  getDependencies, addDependency, removeDependency,
  logActivity,
} from '../../lib/db';
import { useTimeTracker } from '../../hooks/useTimeTracker';
import { useApp } from '../../context/AppContext';
import type { Issue, IssueType, IssueStatus, Priority, Profile, Sprint, TimeEntry, IssueDependency } from '../../types';
import {
  ISSUE_TYPES, ISSUE_STATUSES, PRIORITIES, STORY_POINTS,
  STATUS_COLORS,
} from '../../types';
import IssueTypeIcon from './IssueTypeIcon';
import PriorityIcon from './PriorityIcon';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';

interface IssueModalProps {
  issueId: string;
  currentUser: Profile;
  profiles: Profile[];
  sprints: Sprint[];
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
}

export default function IssueModal({
  issueId,
  currentUser,
  profiles,
  sprints,
  onClose,
  onDeleted,
  onUpdated,
}: IssueModalProps) {
  const { projectTags, activeProject } = useApp();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCheckText, setNewCheckText] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newComment, setNewComment] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descPreview, setDescPreview] = useState(false);
  // Time tracking
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [manualMins, setManualMins] = useState('');
  const [manualNote, setManualNote] = useState('');
  const timer = useTimeTracker(issueId, currentUser.id);
  // Dependencies
  const [deps, setDeps] = useState<IssueDependency[]>([]);
  const [depTicketId, setDepTicketId] = useState('');
  // @mentions in comments
  const [mentionSuggestions, setMentionSuggestions] = useState<Profile[]>([]);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const loadIssue = async () => {
    const data = await getIssue(issueId);
    if (data) {
      setIssue(data);
      setTitle(data.title);
      setDescription(data.description ?? '');
    }
    const [entries, dependencies] = await Promise.all([
      getTimeEntries(issueId),
      getDependencies(issueId),
    ]);
    setTimeEntries(entries);
    setDeps(dependencies);
  };

  useEffect(() => { loadIssue(); }, [issueId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!issue) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-8">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const patch = async (updates: Partial<Issue>) => {
    setSaving(true);
    await updateIssue(issue.id, updates);
    await loadIssue();
    onUpdated();
    setSaving(false);
  };

  const handleSaveText = async () => {
    await patch({ title, description });
  };

  const handleStatusChange = (s: string) => patch({ status: s as IssueStatus });
  const handleTypeChange = (t: string) => patch({ type: t as IssueType });
  const handlePriorityChange = (p: string) => patch({ priority: p as Priority });
  const handleAssigneeChange = (id: string) => patch({ assignee_id: id || null });
  const handleSprintChange = (id: string) => patch({ sprint_id: id || null });
  const handleDueDateChange = (d: string) => patch({ due_date: d || null });
  const handleStoryPointsChange = (sp: string) => patch({ story_points: sp ? Number(sp) : null });
  const handleTagChange = (t: string) => patch({ tag: t || null });
  const handleProjectFieldChange = (v: string) => patch({ project_field: v || null });
  const handleRequestorChange = (v: string) => patch({ requestor: v || null });

  const handleAddCheck = async () => {
    if (!newCheckText.trim()) return;
    await addChecklist(issue.id, newCheckText.trim());
    setNewCheckText('');
    await loadIssue();
  };

  // Time tracking handlers
  const handleLogManual = async () => {
    const mins = parseFloat(manualMins);
    if (!mins || mins <= 0) return;
    await logManualTime(issue.id, currentUser.id, Math.round(mins * 60), manualNote || undefined);
    if (activeProject) {
      await logActivity({
        project_id: activeProject.id, issue_id: issue.id,
        actor_name: currentUser.full_name ?? currentUser.email,
        action: 'time_logged',
        detail: `logged ${mins}m on "${issue.title}"`,
      });
    }
    setManualMins(''); setManualNote('');
    const entries = await getTimeEntries(issueId);
    setTimeEntries(entries);
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteTimeEntry(id);
    const entries = await getTimeEntries(issueId);
    setTimeEntries(entries);
  };

  const handleTimerToggle = async () => {
    if (timer.running) {
      await timer.stop();
      if (activeProject) {
        await logActivity({
          project_id: activeProject.id, issue_id: issue.id,
          actor_name: currentUser.full_name ?? currentUser.email,
          action: 'time_logged',
          detail: `logged ${timer.elapsedFormatted} on "${issue.title}"`,
        });
      }
      const entries = await getTimeEntries(issueId);
      setTimeEntries(entries);
    } else {
      await timer.start();
    }
  };

  // Dependencies
  const handleAddDep = async () => {
    if (!depTicketId.trim() || !activeProject) return;
    // Find issue by ticket_id (search in loaded issues via project)
    const { getIssues } = await import('../../lib/db');
    const all = await getIssues(activeProject.id, { includeArchived: false });
    const found = all.find((i) => i.ticket_id.toLowerCase() === depTicketId.trim().toLowerCase());
    if (!found) { alert(`Issue "${depTicketId}" not found`); return; }
    if (found.id === issue.id) { alert('Cannot depend on itself'); return; }
    await addDependency(issue.id, found.id);
    setDepTicketId('');
    const d = await getDependencies(issueId);
    setDeps(d);
  };

  const handleRemoveDep = async (depId: string) => {
    await removeDependency(depId);
    const d = await getDependencies(issueId);
    setDeps(d);
  };

  // @mentions in comment textarea
  const handleCommentChange = (val: string) => {
    setNewComment(val);
    const at = val.lastIndexOf('@');
    if (at !== -1 && at === val.length - 1) {
      setMentionSuggestions(profiles.slice(0, 5));
    } else if (at !== -1) {
      const query = val.slice(at + 1).toLowerCase();
      if (!query.includes(' ')) {
        setMentionSuggestions(profiles.filter((p) =>
          (p.full_name ?? p.email).toLowerCase().includes(query)
        ).slice(0, 5));
      } else {
        setMentionSuggestions([]);
      }
    } else {
      setMentionSuggestions([]);
    }
  };

  const insertMention = (profile: Profile) => {
    const at = newComment.lastIndexOf('@');
    const mention = `@${profile.full_name ?? profile.email} `;
    setNewComment(newComment.slice(0, at) + mention);
    setMentionSuggestions([]);
    commentRef.current?.focus();
  };

  const handleToggleCheck = async (id: string, current: boolean) => {
    await toggleChecklist(id, !current);
    await loadIssue();
  };

  const handleDeleteCheck = async (id: string) => {
    await deleteChecklist(id);
    await loadIssue();
  };

  const handleAddLink = async () => {
    if (!newLinkUrl.trim()) return;
    await addLink(issue.id, newLinkUrl.trim(), newLinkLabel.trim() || undefined);
    setNewLinkUrl('');
    setNewLinkLabel('');
    await loadIssue();
  };

  const handleDeleteLink = async (id: string) => {
    await deleteLink(id);
    await loadIssue();
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addComment({
      issue_id: issue.id,
      author_id: currentUser.id,
      author_name: currentUser.full_name ?? currentUser.email,
      body: newComment.trim(),
    });
    setNewComment('');
    await loadIssue();
  };

  const handleArchive = async () => {
    await archiveIssue(issue.id, !issue.is_archived);
    onUpdated();
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${issue.title}"? This cannot be undone.`)) return;
    await deleteIssue(issue.id);
    onDeleted();
    onClose();
  };

  const completedChecks = (issue.checklists ?? []).filter((c) => c.is_completed).length;
  const totalChecks = (issue.checklists ?? []).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-4 px-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-slate-800 text-white">
          <IssueTypeIcon type={issue.type} size={16} />
          <span className="font-mono text-sm text-slate-300">{issue.ticket_id}</span>
          {issue.is_archived && (
            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">ARCHIVED</span>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="p-1 hover:bg-white dark:bg-gray-900/10 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex max-h-[80vh] overflow-hidden">
          {/* Left — main content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 border-r border-gray-100 dark:border-gray-800">
            {/* Title */}
            <div>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveText}
                rows={2}
                className="w-full text-xl font-bold text-gray-900 dark:text-gray-100 resize-none border-0 focus:outline-none focus:ring-0 p-0 bg-transparent leading-snug"
                placeholder="Issue title..."
              />
            </div>

            {/* Description with markdown preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</p>
                <button
                  onClick={() => setDescPreview((v) => !v)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-300"
                >
                  {descPreview
                    ? <><Pencil size={11} /> Edit</>
                    : <><Eye size={11} /> Preview</>}
                </button>
              </div>
              {descPreview ? (
                <div
                  className="min-h-[96px] border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: description
                      ? marked.parse(description) as string
                      : '<span class="text-gray-400 italic">No description.</span>',
                  }}
                />
              ) : (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleSaveText}
                  rows={4}
                  className="w-full text-sm text-gray-700 dark:text-gray-300 resize-y border border-gray-200 dark:border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 font-mono"
                  placeholder="Add a description... (supports **markdown**)"
                />
              )}
            </div>

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Checklist {totalChecks > 0 && `(${completedChecks}/${totalChecks})`}
                </p>
              </div>
              {totalChecks > 0 && (
                <div className="h-1.5 bg-gray-100 dark:bg-gray-950 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(completedChecks / totalChecks) * 100}%` }}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                {(issue.checklists ?? []).sort((a, b) => a.order_rank - b.order_rank).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 group/check">
                    <input
                      type="checkbox"
                      checked={c.is_completed}
                      onChange={() => handleToggleCheck(c.id, c.is_completed)}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0"
                    />
                    <span className={`flex-1 text-sm ${c.is_completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {c.text}
                    </span>
                    <button
                      onClick={() => handleDeleteCheck(c.id)}
                      className="opacity-0 group-hover/check:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  value={newCheckText}
                  onChange={(e) => setNewCheckText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCheck()}
                  placeholder="Add item..."
                  className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={handleAddCheck}
                  className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Subtasks */}
            {issue.type !== 'subtask' && (issue.subtasks ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Sub-tasks ({issue.subtasks?.length})
                </p>
                <div className="space-y-1.5">
                  {(issue.subtasks ?? []).map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
                      <IssueTypeIcon type={sub.type} size={12} />
                      <span className="font-mono text-[10px] text-gray-400">{sub.ticket_id}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{sub.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[sub.status]}`}>
                        {sub.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Links</p>
              <div className="space-y-1.5 mb-2">
                {(issue.links ?? []).map((l) => (
                  <div key={l.id} className="flex items-center gap-2 group/link">
                    <LinkIcon size={12} className="text-blue-500 flex-shrink-0" />
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex-1 truncate"
                    >
                      {l.label ?? l.url}
                    </a>
                    <ExternalLink size={11} className="text-gray-300" />
                    <button
                      onClick={() => handleDeleteLink(l.id)}
                      className="opacity-0 group-hover/link:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />
                <input
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="w-32 text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={handleAddLink}
                  className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* ── Time Tracking ───────────────────────────────── */}
            <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <Clock size={12} /> Time Tracking
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTimerToggle}
                  disabled={timer.loading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    timer.running ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {timer.running ? <Square size={11} /> : <Play size={11} />}
                  {timer.running ? `Stop (${timer.elapsedFormatted})` : 'Start Timer'}
                </button>
              </div>
              <div className="flex gap-2">
                <input type="number" value={manualMins} onChange={(e) => setManualMins(e.target.value)}
                  placeholder="mins" className="w-16 text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100" />
                <input value={manualNote} onChange={(e) => setManualNote(e.target.value)}
                  placeholder="Note (optional)" className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100" />
                <button onClick={handleLogManual} disabled={!manualMins}
                  className="text-xs bg-gray-800 text-white px-2.5 py-1.5 rounded hover:bg-gray-700 disabled:opacity-40">Log</button>
              </div>
              {timeEntries.filter((e) => e.stopped_at).length > 0 && (
                <div className="space-y-1">
                  {timeEntries.filter((e) => e.stopped_at).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1 group">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{formatDuration(entry.duration_secs ?? 0)}</span>
                      {entry.note && <span className="truncate text-gray-400">{entry.note}</span>}
                      <span className="ml-auto text-gray-300 text-[10px]">{format(new Date(entry.started_at), 'MMM d')}</span>
                      <button onClick={() => handleDeleteEntry(entry.id)} className="opacity-0 group-hover:opacity-100 text-red-400">×</button>
                    </div>
                  ))}
                  <p className="text-[10px] text-gray-400 text-right font-medium">
                    Total: {formatDuration(timeEntries.filter((e) => e.stopped_at).reduce((s, e) => s + (e.duration_secs ?? 0), 0))}
                  </p>
                </div>
              )}
            </div>

            {/* ── Dependencies ─────────────────────────────────── */}
            <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <GitBranch size={12} /> Blocked By
              </p>
              <div className="flex gap-2">
                <input value={depTicketId} onChange={(e) => setDepTicketId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddDep(); }}
                  placeholder="Ticket ID (e.g. PROJ-42)"
                  className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100" />
                <button onClick={handleAddDep} disabled={!depTicketId.trim()}
                  className="text-xs bg-gray-800 text-white px-2.5 py-1.5 rounded hover:bg-gray-700 disabled:opacity-40">Add</button>
              </div>
              {deps.length > 0 ? (
                <div className="space-y-1">
                  {deps.map((dep) => (
                    <div key={dep.id} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5 group">
                      <IssueTypeIcon type={(dep.depends_on as Issue)?.type ?? 'task'} size={11} />
                      <span className="font-mono text-gray-400 text-[11px]">{(dep.depends_on as Issue)?.ticket_id}</span>
                      <span className="flex-1 truncate text-gray-600 dark:text-gray-400">{(dep.depends_on as Issue)?.title}</span>
                      <span className={`text-[10px] px-1 py-0.5 rounded ${STATUS_COLORS[(dep.depends_on as Issue)?.status] ?? 'bg-gray-100 dark:bg-gray-950 text-gray-500 dark:text-gray-400'}`}>
                        {(dep.depends_on as Issue)?.status?.replace('_', ' ')}
                      </span>
                      <button onClick={() => handleRemoveDep(dep.id)} className="opacity-0 group-hover:opacity-100 text-red-400">×</button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-400">No dependencies</p>}
            </div>

            {/* Activity / Comments */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Activity</p>
              <div className="space-y-3 mb-3 max-h-56 overflow-y-auto">
                {(issue.comments ?? [])
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((c) => (
                    <div key={c.id} className={`flex gap-2.5 ${c.is_system ? 'opacity-60' : ''}`}>
                      <Avatar name={c.author_name} size="xs" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.author_name}</span>
                          <span className="text-[10px] text-gray-400">
                            {format(new Date(c.created_at), 'MMM d, HH:mm')}
                          </span>
                          {c.is_system && <span className="text-[10px] text-gray-400 italic">system</span>}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="flex gap-2">
                <Avatar name={currentUser.full_name ?? currentUser.email} size="xs" />
                <div className="flex-1 flex gap-2 relative">
                  <textarea
                    ref={commentRef}
                    value={newComment}
                    onChange={(e) => handleCommentChange(e.target.value)}
                    placeholder="Add a comment... (@ to mention)"
                    rows={2}
                    className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  {mentionSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 w-52 overflow-hidden">
                      {mentionSuggestions.map((p) => (
                        <button key={p.id} onClick={() => insertMention(p)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-sm text-left">
                          <Avatar name={p.full_name ?? p.email} size="xs" />
                          <span>{p.full_name ?? p.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleAddComment}
                    className="self-end p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right — metadata sidebar */}
          <div className="w-64 flex-shrink-0 overflow-y-auto p-5 space-y-4 bg-gray-50 dark:bg-gray-800/50">
            {/* Status */}
            <Field label="Status">
              <select
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                {ISSUE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>

            {/* Type */}
            <Field label="Type">
              <div className="flex items-center gap-2">
                <IssueTypeIcon type={issue.type} size={14} />
                <select
                  value={issue.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                >
                  {ISSUE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </Field>

            {/* Priority */}
            <Field label="Priority">
              <div className="flex items-center gap-2">
                <PriorityIcon priority={issue.priority} size={14} />
                <select
                  value={issue.priority}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </Field>

            {/* Assignee */}
            <Field label="Assignee">
              <div className="flex items-center gap-2">
                <Avatar name={issue.assignee?.full_name ?? issue.assignee?.email} size="xs" />
                <select
                  value={issue.assignee_id ?? ''}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Unassigned</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                  ))}
                </select>
              </div>
            </Field>

            {/* Sprint */}
            <Field label="Sprint">
              <select
                value={issue.sprint_id ?? ''}
                onChange={(e) => handleSprintChange(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Backlog</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>

            {/* Story points */}
            <Field label="Story Points">
              <select
                value={issue.story_points?.toString() ?? ''}
                onChange={(e) => handleStoryPointsChange(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">—</option>
                {STORY_POINTS.map((sp) => (
                  <option key={sp} value={sp}>{sp}</option>
                ))}
              </select>
            </Field>

            {/* Due Date */}
            <Field label="Due Date">
              <input
                type="date"
                value={issue.due_date ?? ''}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </Field>

            {/* Tag */}
            <Field label="Tag">
              <select
                value={issue.tag ?? ''}
                onChange={(e) => handleTagChange(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">None</option>
                {projectTags.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </Field>

            {/* Project field (free text) */}
            <Field label="Project(s)">
              <input
                type="text"
                value={issue.project_field ?? ''}
                onChange={(e) => handleProjectFieldChange(e.target.value)}
                onBlur={(e) => handleProjectFieldChange(e.target.value)}
                placeholder="e.g. df-key-kls-uat"
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </Field>

            {/* Requestor */}
            <Field label="Requestor">
              <input
                type="text"
                value={issue.requestor ?? ''}
                onChange={(e) => handleRequestorChange(e.target.value)}
                onBlur={(e) => handleRequestorChange(e.target.value)}
                placeholder="email or name"
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </Field>

            {/* Dates */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
              <p className="text-[10px] text-gray-400">
                Created {format(new Date(issue.created_at), 'MMM d, yyyy')}
              </p>
              <p className="text-[10px] text-gray-400">
                Updated {format(new Date(issue.updated_at), 'MMM d, yyyy HH:mm')}
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
              {saving && (
                <p className="text-xs text-blue-500 text-center">Saving...</p>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                onClick={handleArchive}
              >
                {issue.is_archived ? <><ArchiveRestore size={13} /> Restore</> : <><Archive size={13} /> Archive</>}
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="w-full justify-center"
                onClick={handleDelete}
              >
                <Trash2 size={13} /> Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  );
}
