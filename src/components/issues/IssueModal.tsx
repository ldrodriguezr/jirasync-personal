import React, { useEffect, useState } from 'react';
import {
  X, Trash2, Archive, ArchiveRestore, Plus, Link as LinkIcon,
  Send, ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  getIssue, updateIssue, deleteIssue, archiveIssue,
  addChecklist, toggleChecklist, deleteChecklist,
  addLink, deleteLink, addComment,
} from '../../lib/db';
import type { Issue, IssueType, IssueStatus, Priority, Profile, Sprint } from '../../types';
import {
  ISSUE_TYPES, ISSUE_STATUSES, PRIORITIES, STORY_POINTS,
  TAGS, STATUS_COLORS,
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
  const [issue, setIssue] = useState<Issue | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCheckText, setNewCheckText] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newComment, setNewComment] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const loadIssue = async () => {
    const data = await getIssue(issueId);
    if (data) {
      setIssue(data);
      setTitle(data.title);
      setDescription(data.description ?? '');
    }
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
        <div className="bg-white rounded-xl p-8">
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
        className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden"
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
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex max-h-[80vh] overflow-hidden">
          {/* Left — main content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 border-r border-gray-100">
            {/* Title */}
            <div>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveText}
                rows={2}
                className="w-full text-xl font-bold text-gray-900 resize-none border-0 focus:outline-none focus:ring-0 p-0 bg-transparent leading-snug"
                placeholder="Issue title..."
              />
            </div>

            {/* Description */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleSaveText}
                rows={4}
                className="w-full text-sm text-gray-700 resize-y border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="Add a description..."
              />
            </div>

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Checklist {totalChecks > 0 && `(${completedChecks}/${totalChecks})`}
                </p>
              </div>
              {totalChecks > 0 && (
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
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
                    <span className={`flex-1 text-sm ${c.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
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
                  className="flex-1 text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <div key={sub.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                      <IssueTypeIcon type={sub.type} size={12} />
                      <span className="font-mono text-[10px] text-gray-400">{sub.ticket_id}</span>
                      <span className="text-sm text-gray-700 flex-1">{sub.title}</span>
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
                  className="flex-1 text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="w-32 text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddLink}
                  className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
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
                          <span className="text-xs font-semibold text-gray-700">{c.author_name}</span>
                          <span className="text-[10px] text-gray-400">
                            {format(new Date(c.created_at), 'MMM d, HH:mm')}
                          </span>
                          {c.is_system && <span className="text-[10px] text-gray-400 italic">system</span>}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="flex gap-2">
                <Avatar name={currentUser.full_name ?? currentUser.email} size="xs" />
                <div className="flex-1 flex gap-2">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    className="flex-1 text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
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
          <div className="w-64 flex-shrink-0 overflow-y-auto p-5 space-y-4 bg-gray-50/50">
            {/* Status */}
            <Field label="Status">
              <select
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            {/* Tag */}
            <Field label="Tag">
              <select
                value={issue.tag ?? ''}
                onChange={(e) => handleTagChange(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {TAGS.map((t) => (
                  <option key={t} value={t}>{t}</option>
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
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            {/* Dates */}
            <div className="pt-2 border-t border-gray-200 space-y-1">
              <p className="text-[10px] text-gray-400">
                Created {format(new Date(issue.created_at), 'MMM d, yyyy')}
              </p>
              <p className="text-[10px] text-gray-400">
                Updated {format(new Date(issue.updated_at), 'MMM d, yyyy HH:mm')}
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-gray-200 space-y-2">
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
