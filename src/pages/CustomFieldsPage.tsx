import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, SlidersHorizontal, GripVertical } from 'lucide-react';
import {
  getCustomFieldDefs, createCustomFieldDef, updateCustomFieldDef, deleteCustomFieldDef,
} from '../lib/db';
import { useApp } from '../context/AppContext';
import type { CustomFieldDef, CustomFieldType } from '../types';

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text:    'Text',
  number:  'Number',
  select:  'Dropdown',
  date:    'Date',
  boolean: 'Checkbox',
};

const FIELD_TYPE_ICON: Record<CustomFieldType, string> = {
  text: 'Aa', number: '123', select: '▾', date: '📅', boolean: '☑',
};

export default function CustomFieldsPage() {
  const { activeProject } = useApp();
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', field_type: 'text' as CustomFieldType, options: '', is_required: false });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOptions, setEditOptions] = useState('');

  const load = useCallback(async () => {
    if (!activeProject) return;
    const data = await getCustomFieldDefs(activeProject.id);
    setFields(data);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!activeProject || !form.name.trim()) return;
    setSaving(true);
    const options = form.field_type === 'select'
      ? form.options.split('\n').map((o) => o.trim()).filter(Boolean)
      : null;
    await createCustomFieldDef({
      project_id:  activeProject.id,
      name:        form.name.trim(),
      field_type:  form.field_type,
      options,
      is_required: form.is_required,
      order_rank:  fields.length,
    });
    setForm({ name: '', field_type: 'text', options: '', is_required: false });
    setShowForm(false);
    await load();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this field? All values will be lost.')) return;
    await deleteCustomFieldDef(id);
    await load();
  };

  const handleSaveOptions = async (field: CustomFieldDef) => {
    const options = editOptions.split('\n').map((o) => o.trim()).filter(Boolean);
    await updateCustomFieldDef(field.id, { options });
    setEditingId(null);
    await load();
  };

  const handleToggleRequired = async (field: CustomFieldDef) => {
    await updateCustomFieldDef(field.id, { is_required: !field.is_required });
    await load();
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <SlidersHorizontal size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Select a project to manage custom fields</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Custom Fields</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Add custom fields to issues in <span className="font-medium">{activeProject.name}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <Plus size={16} /> New Field
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">New Custom Field</h3>
          <div className="space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Field name (e.g. Client Name, Risk Level)"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Type</label>
                <select
                  value={form.field_type}
                  onChange={(e) => setForm((f) => ({ ...f, field_type: e.target.value as CustomFieldType }))}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_required}
                    onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  Required
                </label>
              </div>
            </div>
            {form.field_type === 'select' && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Options (one per line)</label>
                <textarea
                  value={form.options}
                  onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                  placeholder={"Option A\nOption B\nOption C"}
                  rows={4}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setShowForm(false); setForm({ name: '', field_type: 'text', options: '', is_required: false }); }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!form.name.trim() || saving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
                {saving ? 'Creating...' : 'Create Field'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fields list */}
      <div className="space-y-2">
        {fields.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <SlidersHorizontal size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No custom fields yet.</p>
            <p className="text-xs mt-1">Add fields to capture extra info on issues.</p>
          </div>
        )}
        {fields.map((field) => (
          <div key={field.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <GripVertical size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
              <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {FIELD_TYPE_ICON[field.field_type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{field.name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded font-medium">
                    {FIELD_TYPE_LABELS[field.field_type]}
                  </span>
                  {field.is_required && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-medium">Required</span>
                  )}
                </div>
                {field.field_type === 'select' && field.options && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {field.options.join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleToggleRequired(field)}
                  className="text-[11px] px-2 py-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  {field.is_required ? 'Optional' : 'Required'}
                </button>
                {field.field_type === 'select' && (
                  <button
                    onClick={() => { setEditingId(editingId === field.id ? null : field.id); setEditOptions((field.options ?? []).join('\n')); }}
                    className="text-[11px] px-2 py-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                    Edit options
                  </button>
                )}
                <button onClick={() => handleDelete(field.id)}
                  className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Edit options */}
            {editingId === field.id && (
              <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Options (one per line)</label>
                <textarea
                  value={editOptions}
                  onChange={(e) => setEditOptions(e.target.value)}
                  rows={4}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setEditingId(null)}
                    className="text-xs px-3 py-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">Cancel</button>
                  <button onClick={() => handleSaveOptions(field)}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">Save</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {fields.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
          These fields appear in every issue modal for this project.
        </p>
      )}
    </div>
  );
}
