import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Play, CheckCircle, Trash2, Zap, Calendar, Target } from 'lucide-react';
import { format } from 'date-fns';
import { getSprints, createSprint, updateSprint, deleteSprint, getIssues } from '../lib/db';
import { useApp } from '../context/AppContext';
import type { Sprint, Issue } from '../types';
import { STATUS_COLORS } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import IssueTypeIcon from '../components/issues/IssueTypeIcon';

interface SprintForm {
  name: string;
  goal: string;
  start_date: string;
  end_date: string;
}

const defaultForm: SprintForm = { name: '', goal: '', start_date: '', end_date: '' };

export default function SprintsPage() {
  const { activeProject } = useApp();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SprintForm>({ ...defaultForm });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeProject) return;
    const [spr, iss] = await Promise.all([
      getSprints(activeProject.id),
      getIssues(activeProject.id, { includeArchived: false }),
    ]);
    setSprints(spr);
    setIssues(iss);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditingId(null); setForm({ ...defaultForm }); setShowModal(true); };
  const openEdit = (s: Sprint) => {
    setEditingId(s.id);
    setForm({ name: s.name, goal: s.goal ?? '', start_date: s.start_date ?? '', end_date: s.end_date ?? '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    setLoading(true);
    if (editingId) {
      await updateSprint(editingId, { name: form.name, goal: form.goal || null, start_date: form.start_date || null, end_date: form.end_date || null });
    } else {
      await createSprint({
        project_id: activeProject.id,
        name: form.name,
        goal: form.goal || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      });
    }
    setLoading(false);
    setShowModal(false);
    await load();
  };

  const handleStartSprint = async (sprint: Sprint) => {
    const active = sprints.find((s) => s.status === 'active');
    if (active && active.id !== sprint.id) {
      alert('You already have an active sprint. Complete it before starting another.');
      return;
    }
    await updateSprint(sprint.id, { status: 'active' });
    await load();
  };

  const handleCompleteSprint = async (sprint: Sprint) => {
    if (!confirm(`Complete sprint "${sprint.name}"? Open issues will remain in the sprint.`)) return;
    await updateSprint(sprint.id, { status: 'completed' });
    await load();
  };

  const handleDeleteSprint = async (sprint: Sprint) => {
    if (!confirm(`Delete sprint "${sprint.name}"? Issues will be moved to backlog.`)) return;
    await deleteSprint(sprint.id);
    await load();
  };

  const getSprintIssues = (sprintId: string) => issues.filter((i) => i.sprint_id === sprintId);

  const statusOrder: Record<string, number> = { active: 0, planning: 1, completed: 2 };
  const sorted = [...sprints].sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <Zap size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">No project selected</h3>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{activeProject.name}</h1>
          <p className="text-xs text-gray-400">{activeProject.key} · Sprints</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> New Sprint</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl mx-auto w-full">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <Zap size={48} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-1">No sprints yet</h3>
            <p className="text-sm text-gray-400 mb-6">Create your first sprint to start planning</p>
            <Button onClick={openCreate}><Plus size={16} /> Create Sprint</Button>
          </div>
        )}

        {sorted.map((sprint) => {
          const sprintIssues = getSprintIssues(sprint.id);
          const doneCount = sprintIssues.filter((i) => i.status === 'done').length;
          const totalPoints = sprintIssues.reduce((sum, i) => sum + (i.story_points ?? 0), 0);
          const donePoints = sprintIssues
            .filter((i) => i.status === 'done')
            .reduce((sum, i) => sum + (i.story_points ?? 0), 0);
          const progress = sprintIssues.length ? (doneCount / sprintIssues.length) * 100 : 0;

          const statusLabel = { active: 'Active', planning: 'Planning', completed: 'Completed' }[sprint.status];
          const statusColor = {
            active: 'bg-green-100 text-green-700',
            planning: 'bg-blue-100 text-blue-700',
            completed: 'bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400',
          }[sprint.status];

          return (
            <div key={sprint.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Sprint header */}
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sprint.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
                    </div>
                    {sprint.goal && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <Target size={13} className="text-gray-400" />
                        {sprint.goal}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      {sprint.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {format(new Date(sprint.start_date), 'MMM d')} – {sprint.end_date ? format(new Date(sprint.end_date), 'MMM d, yyyy') : '—'}
                        </span>
                      )}
                      <span>{sprintIssues.length} issues · {doneCount} done · {totalPoints}pts total ({donePoints}pts done)</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(sprint)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                      Edit
                    </button>
                    {sprint.status === 'planning' && (
                      <Button size="sm" onClick={() => handleStartSprint(sprint)}>
                        <Play size={12} /> Start
                      </Button>
                    )}
                    {sprint.status === 'active' && (
                      <Button size="sm" variant="secondary" onClick={() => handleCompleteSprint(sprint)}>
                        <CheckCircle size={12} /> Complete
                      </Button>
                    )}
                    <button onClick={() => handleDeleteSprint(sprint)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {sprintIssues.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Issue list */}
              {sprintIssues.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {sprintIssues.map((issue) => (
                    <div key={issue.id} className="flex items-center gap-3 px-5 py-2.5">
                      <IssueTypeIcon type={issue.type} size={13} />
                      <span className="font-mono text-[11px] text-gray-400 w-16 flex-shrink-0">{issue.ticket_id}</span>
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{issue.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${STATUS_COLORS[issue.status]}`}>
                        {issue.status.replace('_', ' ')}
                      </span>
                      {issue.story_points && (
                        <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-[10px] font-bold flex items-center justify-center">
                          {issue.story_points}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Sprint' : 'New Sprint'}>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Sprint Name *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Sprint 1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Sprint Goal</label>
            <input value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              placeholder="What will the team accomplish?" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">End Date</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>{editingId ? 'Save' : 'Create Sprint'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
