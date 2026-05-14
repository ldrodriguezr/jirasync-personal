import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, AlertTriangle, CheckCircle2, Clock, Layers } from 'lucide-react';
import { getIssues, getSprints } from '../lib/db';
import { useApp } from '../context/AppContext';
import type { Issue, Sprint } from '../types';

type ProjectHealth = 'on-track' | 'at-risk' | 'delayed' | 'no-data';

interface ProjectStats {
  id: string;
  name: string;
  key: string;
  color: string;
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  pct: number;
  health: ProjectHealth;
  activeSprint: Sprint | null;
  sprintProgress: number;
}

const HEALTH_CONFIG: Record<ProjectHealth, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  'on-track': { label: 'On Track',  color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-100 dark:bg-green-900/30',  icon: <CheckCircle2 size={13} /> },
  'at-risk':  { label: 'At Risk',   color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: <AlertTriangle size={13} /> },
  'delayed':  { label: 'Delayed',   color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-100 dark:bg-red-900/30',       icon: <AlertTriangle size={13} /> },
  'no-data':  { label: 'No Data',   color: 'text-gray-500 dark:text-gray-400',     bg: 'bg-gray-100 dark:bg-gray-800',        icon: <Clock size={13} /> },
};

export default function PortfolioPage() {
  const { projects, setActiveProject } = useApp();
  const [stats, setStats] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    const all: ProjectStats[] = await Promise.all(
      projects.map(async (project) => {
        const [issues, sprints] = await Promise.all([
          getIssues(project.id, { includeArchived: false }),
          getSprints(project.id),
        ]);

        const total = issues.length;
        const done = issues.filter((i) => i.status === 'done').length;
        const inProgress = issues.filter((i) => i.status === 'in_progress').length;
        const now = new Date();
        const overdue = issues.filter((i) => i.due_date && i.status !== 'done' && new Date(i.due_date) < now).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        const activeSprint = sprints.find((s) => s.status === 'active') ?? null;
        let sprintProgress = 0;
        if (activeSprint) {
          const sprintIssues = issues.filter((i) => i.sprint_id === activeSprint.id);
          const sprintDone = sprintIssues.filter((i) => i.status === 'done').length;
          sprintProgress = sprintIssues.length > 0 ? Math.round((sprintDone / sprintIssues.length) * 100) : 0;
        }

        let health: ProjectHealth = 'no-data';
        if (total > 0) {
          if (overdue > 3 || pct < 20) health = 'delayed';
          else if (overdue > 0 || pct < 50) health = 'at-risk';
          else health = 'on-track';
        }

        return { id: project.id, name: project.name, key: project.key, color: project.color, total, done, inProgress, overdue, pct, health, activeSprint, sprintProgress };
      })
    );
    setStats(all);
    setLoading(false);
  }, [projects]);

  useEffect(() => { load(); }, [load]);

  const summary = {
    total: stats.reduce((s, p) => s + p.total, 0),
    done: stats.reduce((s, p) => s + p.done, 0),
    overdue: stats.reduce((s, p) => s + p.overdue, 0),
    onTrack: stats.filter((p) => p.health === 'on-track').length,
    atRisk: stats.filter((p) => p.health === 'at-risk').length,
    delayed: stats.filter((p) => p.health === 'delayed').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Portfolio</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">All projects at a glance</p>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Total Issues', value: summary.total, color: 'text-gray-700 dark:text-gray-300' },
            { label: 'Completed', value: summary.done, color: 'text-green-600 dark:text-green-400' },
            { label: 'Overdue', value: summary.overdue, color: 'text-red-500' },
            { label: 'On Track', value: summary.onTrack, color: 'text-green-600 dark:text-green-400' },
            { label: 'At Risk / Delayed', value: summary.atRisk + summary.delayed, color: 'text-yellow-600 dark:text-yellow-400' },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Project cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.map((p) => {
            const health = HEALTH_CONFIG[p.health];
            return (
              <div
                key={p.id}
                onClick={() => { setActiveProject(projects.find((pr) => pr.id === p.id)!); navigate('/board'); }}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
              >
                {/* Project header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: p.color }}>
                      {p.key.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{p.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{p.key}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${health.color} ${health.bg}`}>
                    {health.icon} {health.label}
                  </span>
                </div>

                {/* Overall progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>Overall progress</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{p.pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      p.pct >= 75 ? 'bg-green-500' : p.pct >= 40 ? 'bg-blue-500' : 'bg-yellow-500'
                    }`} style={{ width: `${p.pct}%` }} />
                  </div>
                </div>

                {/* Sprint progress */}
                {p.activeSprint && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span className="truncate">{p.activeSprint.name}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300 ml-2">{p.sprintProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${p.sprintProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{p.total}</span> issues
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-400">
                    <span className="font-semibold">{p.done}</span> done
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    <span className="font-semibold">{p.inProgress}</span> in progress
                  </span>
                  {p.overdue > 0 && (
                    <span className="text-xs text-red-500 font-semibold ml-auto flex items-center gap-1">
                      <AlertTriangle size={11} /> {p.overdue} overdue
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {stats.length === 0 && (
            <div className="col-span-2 text-center py-16 text-gray-400 dark:text-gray-500">
              <Layers size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No projects yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
