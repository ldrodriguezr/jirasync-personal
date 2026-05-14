import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp, CheckCircle2, Clock, AlertCircle, Users, LayoutDashboard } from 'lucide-react';
import { format, startOfWeek, isAfter, isBefore, parseISO } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getIssueStats, getSprints, getBurndownData, getVelocityData, type BurndownPoint, type VelocityPoint } from '../lib/db';
import { useApp } from '../context/AppContext';
import type { Sprint } from '../types';
import { PRIORITIES, TYPE_COLORS } from '../types';
import Avatar from '../components/ui/Avatar';

interface StatRow {
  status: string;
  type: string;
  priority: string;
  assignee_id: string | null;
  created_at: string;
  due_date: string | null;
  story_points: number | null;
}

export default function DashboardPage() {
  const { activeProject, profiles } = useApp();
  const [stats, setStats] = useState<StatRow[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [burndown, setBurndown] = useState<BurndownPoint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);

  const load = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    const [s, spr] = await Promise.all([
      getIssueStats(activeProject.id),
      getSprints(activeProject.id),
    ]);
    setStats(s as StatRow[]);
    setSprints(spr);
    // Velocity chart
    getVelocityData(activeProject.id).then(setVelocity).catch(console.error);
    // Auto-select active sprint for burndown
    const active = spr.find((sp: Sprint) => sp.status === 'active');
    if (active) {
      setSelectedSprintId(active.id);
      const bd = await getBurndownData(activeProject.id, active.id);
      setBurndown(bd);
    }
    setLoading(false);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <LayoutDashboard size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">No project selected</h3>
      </div>
    );
  }

  const total = stats.length;
  const done = stats.filter((s) => s.status === 'done').length;
  const inProgress = stats.filter((s) => s.status === 'in_progress').length;
  const now = new Date();
  const overdue = stats.filter(
    (s) => s.due_date && s.status !== 'done' && isBefore(parseISO(s.due_date), now)
  ).length;
  const weekStart = startOfWeek(now);
  const createdThisWeek = stats.filter((s) => isAfter(parseISO(s.created_at), weekStart)).length;

  // By status
  const statusCounts: Record<string, number> = {};
  stats.forEach((s) => { statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1; });

  // By type
  const typeCounts: Record<string, number> = {};
  stats.forEach((s) => { typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1; });

  // By assignee
  const assigneeCounts: Record<string, number> = {};
  stats.forEach((s) => {
    const key = s.assignee_id ?? 'unassigned';
    assigneeCounts[key] = (assigneeCounts[key] ?? 0) + 1;
  });

  // By priority
  const priorityCounts: Record<string, number> = {};
  stats.forEach((s) => { priorityCounts[s.priority] = (priorityCounts[s.priority] ?? 0) + 1; });

  const activeSprint = sprints.find((s) => s.status === 'active');
  const totalPoints = stats.reduce((sum, s) => sum + (s.story_points ?? 0), 0);
  const donePoints = stats
    .filter((s) => s.status === 'done')
    .reduce((sum, s) => sum + (s.story_points ?? 0), 0);

  const handleBurndownSprintChange = async (sprintId: string) => {
    if (!activeProject) return;
    setSelectedSprintId(sprintId);
    if (sprintId) {
      const bd = await getBurndownData(activeProject.id, sprintId);
      setBurndown(bd);
    } else {
      setBurndown([]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{activeProject.name}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Dashboard · {format(now, 'MMMM d, yyyy')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={<TrendingUp size={20} />} iconBg="bg-blue-100" iconColor="text-blue-600"
          label="Total Issues" value={total} sub={`${createdThisWeek} this week`} />
        <KpiCard icon={<CheckCircle2 size={20} />} iconBg="bg-green-100" iconColor="text-green-600"
          label="Done" value={done} sub={`${total ? Math.round((done / total) * 100) : 0}% complete`} />
        <KpiCard icon={<Clock size={20} />} iconBg="bg-blue-50" iconColor="text-blue-500"
          label="In Progress" value={inProgress} sub="active work" />
        <KpiCard icon={<AlertCircle size={20} />} iconBg="bg-red-100" iconColor="text-red-600"
          label="Overdue" value={overdue} sub="past due date" />
      </div>

      {/* Story Points progress */}
      {totalPoints > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Story Points Progress</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 bg-gray-100 dark:bg-gray-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(donePoints / totalPoints) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">
              {donePoints} / {totalPoints} pts
            </span>
          </div>
        </div>
      )}

      {/* Active Sprint */}
      {activeSprint && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-green-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Active Sprint</h2>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">{activeSprint.name}</p>
              {activeSprint.goal && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{activeSprint.goal}</p>}
            </div>
            <div className="text-right text-sm text-gray-500 dark:text-gray-400">
              {activeSprint.end_date && (
                <p>Ends {format(parseISO(activeSprint.end_date), 'MMM d')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* By Status */}
        <ChartCard title="Issues by Status">
          {Object.entries(statusCounts).map(([status, count]) => (
            <BarRow
              key={status}
              label={status.replace('_', ' ')}
              count={count}
              total={total}
              color="bg-blue-500"
            />
          ))}
        </ChartCard>

        {/* By Type */}
        <ChartCard title="Issues by Type">
          {Object.entries(typeCounts).map(([type, count]) => (
            <BarRow
              key={type}
              label={type}
              count={count}
              total={total}
              color={typeColorMap[type] ?? 'bg-gray-400'}
            />
          ))}
        </ChartCard>

        {/* By Priority */}
        <ChartCard title="Issues by Priority">
          {PRIORITIES.map(({ value, label }) =>
            priorityCounts[value] ? (
              <BarRow
                key={value}
                label={label}
                count={priorityCounts[value]}
                total={total}
                color={priorityColorMap[value] ?? 'bg-gray-400'}
              />
            ) : null
          )}
        </ChartCard>

        {/* By Assignee */}
        <ChartCard title="Issues by Assignee">
          {Object.entries(assigneeCounts).map(([uid, count]) => {
            const profile = profiles.find((p) => p.id === uid);
            const name = profile?.full_name ?? profile?.email ?? 'Unassigned';
            return (
              <div key={uid} className="flex items-center gap-2.5 mb-2">
                <Avatar name={name} size="xs" />
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{name}</span>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-950 px-2 py-0.5 rounded-full">
                  {count}
                </span>
              </div>
            );
          })}
        </ChartCard>
      </div>

      {/* Burndown Chart */}
      {sprints.filter((s) => s.start_date && s.end_date).length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Burndown Chart</h2>
            <select
              value={selectedSprintId}
              onChange={(e) => handleBurndownSprintChange(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select sprint</option>
              {sprints
                .filter((s) => s.start_date && s.end_date)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
            </select>
          </div>
          {burndown.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={burndown.filter((p) => p.remaining >= 0)} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => format(new Date(String(v) + 'T12:00:00'), 'MMM d')}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(v) => format(new Date(String(v) + 'T12:00:00'), 'MMM d, yyyy')}
                  formatter={(val, name) => [val, name === 'remaining' ? 'Remaining pts' : 'Ideal']}
                />
                <Legend formatter={(v: string) => v === 'remaining' ? 'Actual remaining' : 'Ideal'} />
                <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="remaining" stroke="#3b82f6" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              {selectedSprintId ? 'No story points data for this sprint.' : 'Select a sprint to view its burndown.'}
            </p>
          )}
        </div>
      )}

      {/* Velocity Chart */}
      {velocity.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Velocity</h2>
              <p className="text-xs text-gray-400 mt-0.5">Story points committed vs completed per sprint</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={velocity} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val, name) => [val, name === 'committed' ? 'Committed' : 'Completed']} />
              <Legend formatter={(v) => v === 'committed' ? 'Committed' : 'Completed'} />
              <Bar dataKey="committed" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? (count / total) * 100 : 0;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{label}</span>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{count}</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-950 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const typeColorMap: Record<string, string> = {
  epic: 'bg-purple-500',
  story: 'bg-green-500',
  task: 'bg-blue-500',
  bug: 'bg-red-500',
  subtask: 'bg-sky-400',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _typeColors = TYPE_COLORS;

const priorityColorMap: Record<string, string> = {
  highest: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
  lowest: 'bg-gray-400',
};
