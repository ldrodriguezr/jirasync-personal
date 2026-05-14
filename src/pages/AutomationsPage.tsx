import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Zap, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  getAutomationRules, createAutomationRule, updateAutomationRule,
  deleteAutomationRule, getAutomationLogs, getSprints,
} from '../lib/db';
import { useApp } from '../context/AppContext';
import type { AutomationRule, AutomationTrigger, AutomationAction, Sprint } from '../types';
import { ISSUE_STATUSES, PRIORITIES } from '../types';

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  status_changed:   'Status changes',
  priority_changed: 'Priority changes',
  due_date_reached: 'Due date reached',
  sprint_ended:     'Sprint ends',
  days_in_status:   'Issue stale in status',
  issue_created:    'Issue created',
  assigned_to:      'Issue assigned',
};

const ACTION_LABELS: Record<AutomationAction, string> = {
  change_status:   'Change status to',
  change_priority: 'Change priority to',
  move_to_sprint:  'Move to sprint',
  notify:          'Send notification',
  assign_to:       'Assign to user',
};

const TRIGGER_ICON: Record<string, string> = {
  status_changed: '🔄', priority_changed: '⚡', due_date_reached: '📅',
  sprint_ended: '🏁', days_in_status: '🐌', issue_created: '🆕', assigned_to: '👤',
};

const ACTION_ICON: Record<string, string> = {
  change_status: '🔄', change_priority: '⚡', move_to_sprint: '🏃',
  notify: '🔔', assign_to: '👤',
};

const defaultForm = {
  name: '',
  trigger_type: 'status_changed' as AutomationTrigger,
  trigger_from: '',
  trigger_to: '',
  trigger_days: '3',
  trigger_status: 'in_progress',
  action_type: 'change_status' as AutomationAction,
  action_status: 'done',
  action_priority: 'high',
  action_sprint_id: '',
};

export default function AutomationsPage() {
  const { activeProject, profiles } = useApp();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, Awaited<ReturnType<typeof getAutomationLogs>>>>({});

  const load = useCallback(async () => {
    if (!activeProject) return;
    const [r, s] = await Promise.all([
      getAutomationRules(activeProject.id),
      getSprints(activeProject.id),
    ]);
    setRules(r);
    setSprints(s);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!activeProject || !form.name.trim()) return;
    setSaving(true);

    const triggerValue: Record<string, unknown> = {};
    if (form.trigger_type === 'status_changed') {
      if (form.trigger_from) triggerValue['from'] = form.trigger_from;
      if (form.trigger_to)   triggerValue['to']   = form.trigger_to;
    } else if (form.trigger_type === 'days_in_status') {
      triggerValue['days']   = Number(form.trigger_days);
      triggerValue['status'] = form.trigger_status;
    } else if (form.trigger_type === 'priority_changed') {
      if (form.trigger_to) triggerValue['to'] = form.trigger_to;
    }

    const actionValue: Record<string, unknown> = {};
    if (form.action_type === 'change_status')   actionValue['status']    = form.action_status;
    if (form.action_type === 'change_priority') actionValue['priority']  = form.action_priority;
    if (form.action_type === 'move_to_sprint')  actionValue['sprint_id'] = form.action_sprint_id;

    await createAutomationRule({
      project_id:    activeProject.id,
      name:          form.name.trim(),
      is_active:     true,
      trigger_type:  form.trigger_type,
      trigger_value: triggerValue,
      action_type:   form.action_type,
      action_value:  actionValue,
    });
    setForm(defaultForm);
    setShowForm(false);
    await load();
    setSaving(false);
  };

  const handleToggle = async (rule: AutomationRule) => {
    await updateAutomationRule(rule.id, { is_active: !rule.is_active });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this automation?')) return;
    await deleteAutomationRule(id);
    await load();
  };

  const handleExpandLogs = async (ruleId: string) => {
    if (expandedLogs === ruleId) { setExpandedLogs(null); return; }
    setExpandedLogs(ruleId);
    if (!logs[ruleId]) {
      const l = await getAutomationLogs(ruleId);
      setLogs((prev) => ({ ...prev, [ruleId]: l }));
    }
  };

  const describeRule = (rule: AutomationRule) => {
    const tv = rule.trigger_value ?? {};
    const av = rule.action_value ?? {};
    let trigger = TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type;
    if (rule.trigger_type === 'status_changed') {
      if (tv['from'] && tv['to']) trigger = `Status changes from "${tv['from']}" to "${tv['to']}"`;
      else if (tv['to']) trigger = `Status changes to "${tv['to']}"`;
    } else if (rule.trigger_type === 'days_in_status') {
      trigger = `Issue in "${tv['status']}" for ${tv['days']} days`;
    }
    let action = ACTION_LABELS[rule.action_type] ?? rule.action_type;
    if (rule.action_type === 'change_status')   action = `Change status to "${av['status']}"`;
    if (rule.action_type === 'change_priority') action = `Change priority to "${av['priority']}"`;
    if (rule.action_type === 'move_to_sprint')  action = `Move to sprint`;
    return { trigger, action };
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <Zap size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Select a project to manage automations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Automations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Rules that run automatically when conditions are met
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <Plus size={16} /> New Rule
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">New Automation Rule</h3>
          <div className="space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Rule name (e.g. Close done issues)"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Trigger */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">WHEN (Trigger)</p>
              <select
                value={form.trigger_type}
                onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value as AutomationTrigger }))}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {form.trigger_type === 'status_changed' && (
                <div className="flex gap-2">
                  <select value={form.trigger_from} onChange={(e) => setForm((f) => ({ ...f, trigger_from: e.target.value }))}
                    className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Any status</option>
                    {ISSUE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <span className="self-center text-gray-400 text-sm">→</span>
                  <select value={form.trigger_to} onChange={(e) => setForm((f) => ({ ...f, trigger_to: e.target.value }))}
                    className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Any status</option>
                    {ISSUE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
              {form.trigger_type === 'days_in_status' && (
                <div className="flex gap-2">
                  <input type="number" value={form.trigger_days} onChange={(e) => setForm((f) => ({ ...f, trigger_days: e.target.value }))}
                    min="1" placeholder="Days"
                    className="w-20 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="self-center text-gray-500 text-sm">days in</span>
                  <select value={form.trigger_status} onChange={(e) => setForm((f) => ({ ...f, trigger_status: e.target.value }))}
                    className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {ISSUE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Action */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">THEN (Action)</p>
              <select value={form.action_type} onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value as AutomationAction }))}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(ACTION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {form.action_type === 'change_status' && (
                <select value={form.action_status} onChange={(e) => setForm((f) => ({ ...f, action_status: e.target.value }))}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ISSUE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              )}
              {form.action_type === 'change_priority' && (
                <select value={form.action_priority} onChange={(e) => setForm((f) => ({ ...f, action_priority: e.target.value }))}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              )}
              {form.action_type === 'move_to_sprint' && (
                <select value={form.action_sprint_id} onChange={(e) => setForm((f) => ({ ...f, action_sprint_id: e.target.value }))}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select sprint...</option>
                  {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setShowForm(false); setForm(defaultForm); }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!form.name.trim() || saving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
                {saving ? 'Creating...' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-3">
        {rules.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <Zap size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No automations yet.</p>
            <p className="text-xs mt-1">Create your first rule to automate repetitive tasks.</p>
          </div>
        )}
        {rules.map((rule) => {
          const { trigger, action } = describeRule(rule);
          const ruleLogs = logs[rule.id] ?? [];
          return (
            <div key={rule.id} className={`bg-white dark:bg-gray-900 rounded-xl border transition-colors shadow-sm ${
              rule.is_active ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-800 opacity-60'
            }`}>
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{rule.name}</p>
                    {!rule.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded font-medium">Paused</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      {TRIGGER_ICON[rule.trigger_type]} {trigger}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">→</span>
                    <span className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                      {ACTION_ICON[rule.action_type]} {action}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {rule.run_count > 0 && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {rule.run_count} runs
                    </span>
                  )}
                  <button onClick={() => handleExpandLogs(rule.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded transition-colors" title="View logs">
                    {expandedLogs === rule.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button onClick={() => handleToggle(rule)}
                    className={`transition-colors ${rule.is_active ? 'text-blue-500 hover:text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}
                    title={rule.is_active ? 'Pause' : 'Activate'}>
                    {rule.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => handleDelete(rule.id)}
                    className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 p-1 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Logs */}
              {expandedLogs === rule.id && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Clock size={10} /> Execution Log
                  </p>
                  {ruleLogs.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">No executions yet</p>
                  ) : (
                    <div className="space-y-1">
                      {ruleLogs.map((log) => (
                        <div key={log.id} className="flex items-center gap-2 text-xs">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            log.result === 'success' ? 'bg-green-500' :
                            log.result === 'error' ? 'bg-red-500' : 'bg-gray-300'
                          }`} />
                          <span className="text-gray-600 dark:text-gray-400 flex-1">{log.detail}</span>
                          <span className="text-gray-400 dark:text-gray-500 text-[10px]">
                            {formatDistanceToNow(new Date(log.ran_at), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
