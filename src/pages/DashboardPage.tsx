import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp, CheckCircle2, Clock, AlertCircle, Users, LayoutDashboard } from 'lucide-react';
import { format, startOfWeek, isAfter, isBefore, parseISO } from 'date-fns';
import { getIssueStats, getSprints } from '../lib/db';
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

  const load = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    const [s, spr] = await Promise.all([
      getIssueStats(activeProject.id),
      getSprints(activeProject.id),
    ]);
    setStats(s as StatRow[]);
    setSprints(spr);
    setLoading(false);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <LayoutDashboard size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600">No project selected</h3>
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
        <h1 className="text-2xl font-bold text-gray-900">{activeProject.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Dashboard · {format(now, 'MMMM d, yyyy')}</p>
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Story Points Progress</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(donePoints / totalPoints) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
              {donePoints} / {totalPoints} pts
            </span>
          </div>
        </div>
      )}

      {/* Active Sprint */}
      {activeSprint && (
        <div className="bg-white rounded-xl border border-green-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Active Sprint</h2>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{activeSprint.name}</p>
              {activeSprint.goal && <p className="text-sm text-gray-500 mt-0.5">{activeSprint.goal}</p>}
            </div>
            <div className="text-right text-sm text-gray-500">
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
                <span className="text-xs text-gray-700 flex-1 truncate">{name}</span>
                <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                  {count}
                </span>
              </div>
            );
          })}
        </ChartCard>
      </div>
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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? (count / total) * 100 : 0;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 capitalize">{label}</span>
        <span className="text-xs font-semibold text-gray-600">{count}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
