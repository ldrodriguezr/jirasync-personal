import React, { useState } from 'react';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { createProject, updateProject, deleteProject } from '../lib/db';
import { useApp } from '../context/AppContext';
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
  const { user, projects, activeProject, setActiveProject, refreshProjects } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>(defaultForm);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200">
          <FolderOpen size={48} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-1">No projects yet</h3>
          <p className="text-sm text-gray-400 mb-6">Create your first project to start tracking work</p>
          <Button onClick={openCreate}><Plus size={16} /> Create Project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-xl border-2 p-5 cursor-pointer transition-all hover:shadow-md
                ${activeProject?.id === p.id ? 'border-blue-500 shadow-blue-100 shadow-md' : 'border-gray-200'}`}
              onClick={() => setActiveProject(p)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: p.color + '22' }}>
                    <span className="font-bold text-sm" style={{ color: p.color }}>{p.key}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{p.name}</h3>
                    <span className="text-[10px] text-gray-400 font-mono">{p.key}</span>
                  </div>
                </div>
                {activeProject?.id === p.id && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
                )}
              </div>
              {p.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(p.id); }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Project' : 'New Project'}>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!editingId && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Project Key * (2–4 letters, e.g. EFX)
              </label>
              <input
                required
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) }))}
                placeholder="EFX"
                maxLength={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
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
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
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
    </div>
  );
}
