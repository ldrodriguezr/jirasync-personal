import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FolderOpen, Tag, X, Github, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { createProject, updateProject, deleteProject, getProjectTags, createProjectTag, deleteProjectTag, getGitHubSettings, upsertGitHubSettings, syncFromGitHub, type GitHubSettings, type SyncResult } from '../lib/db';
import { useApp } from '../context/AppContext';
import type { ProjectTag } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const COLORS = [
  '#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#0EA5E9',
];

interface ProjectForm {
  name: string;
  key: string;
  description: string;
  color: string;
}

const defaultForm: ProjectForm = { name: '', key: '', description: '', color: COLORS[0] };

export default function ProjectsPage() {
  const { user, projects, activeProject, setActiveProject, refreshProjects, refreshTags } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>(defaultForm);
  const [loading, setLoading] = useState(false);
  // Tags management
  const [tagsProjectId, setTagsProjectId] = useState<string | null>(null);
  const [tags, setTags] = useState<ProjectTag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [tagLoading, setTagLoading] = useState(false);
  // GitHub sync
  const [ghProjectId, setGhProjectId] = useState<string | null>(null);
  const [ghSettings, setGhSettings] = useState<Partial<GitHubSettings>>({ sync_prs: true, sync_issues: false, default_type: 'task' });
  const [ghSyncing, setGhSyncing] = useState(false);
  const [ghResult, setGhResult] = useState<SyncResult | null>(null);

  const openCreate = () => { setEditingId(null); setForm(defaultForm); setShowModal(true); };
  const openEdit = (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    setEditingId(id);
    setForm({ name: p.name, key: p.key, description: p.description ?? '', color: p.color });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      if (editingId) {
        await updateProject(editingId, { name: form.name, description: form.description, color: form.color });
      } else {
        const p = await createProject({
          name: form.name,
          key: form.key.toUpperCase(),
          description: form.description,
          color: form.color,
          owner_id: user.id,
        });
        if (p) setActiveProject(p);
      }
      await refreshProjects();
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"? All issues will be permanently deleted.`)) return;
    await deleteProject(id);
    if (activeProject?.id === id) setActiveProject(null);
    await refreshProjects();
  };

  const openTagManager = async (projectId: string) => {
    setTagsProjectId(projectId);
    const t = await getProjectTags(projectId);
    setTags(t);
    setNewTagName('');
  };

  const openGitHubSync = async (projectId: string) => {
    setGhProjectId(projectId);
    setGhResult(null);
    const existing = await getGitHubSettings(projectId);
    setGhSettings(existing ?? { sync_prs: true, sync_issues: false, default_type: 'task' });
  };

  const handleGitHubSave = async () => {
    if (!ghProjectId || !ghSettings.owner || !ghSettings.repo) return;
    await upsertGitHubSettings(ghProjectId, ghSettings);
  };

  const handleGitHubSync = async () => {
    if (!ghProjectId || !ghSettings.owner || !ghSettings.repo) return;
    setGhSyncing(true);
    setGhResult(null);
    await upsertGitHubSettings(ghProjectId, ghSettings);
    const full = await getGitHubSettings(ghProjectId);
    if (full) {
      const res = await syncFromGitHub(ghProjectId, full);
      setGhResult(res);
    }
    setGhSyncing(false);
  };

  const handleAddTag = async () => {
    if (!newTagName.trim() || !tagsProjectId) return;
    setTagLoading(true);
    const tag = await createProjectTag(tagsProjectId, newTagName.trim());
    if (tag) setTags((prev) => [...prev, tag]);
    setNewTagName('');
    setTagLoading(false);
    if (tagsProjectId === activeProject?.id) refreshTags();
  };

  const handleDeleteTag = async (tagId: string) => {
    await deleteProjectTag(tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    if (tagsProjectId === activeProject?.id) refreshTags();
  };

  // Load tags when active project changes
  useEffect(() => {
    if (tagsProjectId) {
      getProjectTags(tagsProjectId).then(setTags);
    }
  }, [tagsProjectId]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
          <FolderOpen size={48} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-1">No projects yet</h3>
          <p className="text-sm text-gray-400 mb-6">Create your first project to start tracking work</p>
          <Button onClick={openCreate}><Plus size={16} /> Create Project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`bg-white dark:bg-gray-900 rounded-xl border-2 p-5 cursor-pointer transition-all hover:shadow-md
                ${activeProject?.id === p.id ? 'border-blue-500 shadow-blue-100 shadow-md' : 'border-gray-200 dark:border-gray-700'}`}
              onClick={() => setActiveProject(p)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: p.color + '22' }}>
                    <span className="font-bold text-sm" style={{ color: p.color }}>{p.key}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight">{p.name}</h3>
                    <span className="text-[10px] text-gray-400 font-mono">{p.key}</span>
                  </div>
                </div>
                {activeProject?.id === p.id && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
                )}
              </div>
              {p.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(p.id); }}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openTagManager(p.id); }}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                >
                  <Tag size={12} /> Tags
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openGitHubSync(p.id); }}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100 px-2 py-1 rounded hover:bg-gray-100 dark:bg-gray-950 transition-colors"
                >
                  <Github size={12} /> GitHub
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tag Manager Modal */}
      <Modal open={!!tagsProjectId} onClose={() => setTagsProjectId(null)} title="Manage Tags">
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tags for <strong>{projects.find((p) => p.id === tagsProjectId)?.name}</strong>
          </p>
          <div className="flex gap-2">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="New tag name..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            <Button onClick={handleAddTag} loading={tagLoading}>
              <Plus size={14} /> Add
            </Button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tags.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No tags yet. Add one above.</p>
            )}
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{tag.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteTag(tag.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Project' : 'New Project'}>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Project Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  key: editingId ? f.key : e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4),
                }));
              }}
              placeholder="My Project"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {!editingId && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Project Key * (2–4 letters, e.g. EFX)
              </label>
              <input
                required
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) }))}
                placeholder="EFX"
                maxLength={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="What's this project about?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>{editingId ? 'Save Changes' : 'Create Project'}</Button>
          </div>
        </form>
      </Modal>

      {/* GitHub Sync Modal */}
      <Modal open={!!ghProjectId} onClose={() => { setGhProjectId(null); setGhResult(null); }} title="GitHub Sync" size="md">
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sync open PRs and issues from a GitHub repository as Jira issues in <strong>{projects.find((p) => p.id === ghProjectId)?.name}</strong>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Owner / Org</label>
              <input
                value={ghSettings.owner ?? ''}
                onChange={(e) => setGhSettings((s) => ({ ...s, owner: e.target.value }))}
                placeholder="e.g. ldrodriguezr"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Repository</label>
              <input
                value={ghSettings.repo ?? ''}
                onChange={(e) => setGhSettings((s) => ({ ...s, repo: e.target.value }))}
                placeholder="e.g. jirasync-personal"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">GitHub Token <span className="font-normal text-gray-400">(optional for private repos)</span></label>
            <input
              type="password"
              value={ghSettings.token ?? ''}
              onChange={(e) => setGhSettings((s) => ({ ...s, token: e.target.value }))}
              placeholder="ghp_..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={ghSettings.sync_prs ?? true}
                onChange={(e) => setGhSettings((s) => ({ ...s, sync_prs: e.target.checked }))}
                className="rounded"
              />
              Sync open PRs
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={ghSettings.sync_issues ?? false}
                onChange={(e) => setGhSettings((s) => ({ ...s, sync_issues: e.target.checked }))}
                className="rounded"
              />
              Sync open issues
            </label>
          </div>

          {ghResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${ghResult.errors.length > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {ghResult.errors.length > 0
                ? <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                : <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />}
              <div>
                <p className="font-medium">{ghResult.created} issue{ghResult.created !== 1 ? 's' : ''} created · {ghResult.skipped} skipped</p>
                {ghResult.errors.map((e, i) => <p key={i} className="text-xs mt-0.5">{e}</p>)}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button onClick={handleGitHubSave} variant="secondary">
              Save settings
            </Button>
            <Button
              onClick={handleGitHubSync}
              loading={ghSyncing}
              disabled={!ghSettings.owner || !ghSettings.repo}
            >
              <RefreshCw size={14} /> {ghSyncing ? 'Syncing...' : 'Sync now'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
