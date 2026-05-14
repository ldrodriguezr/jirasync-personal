import React, { useCallback, useEffect, useState } from 'react';
import { Users, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { getIssues, getSprints } from '../lib/db';
import { useApp } from '../context/AppContext';
import type { Issue, Sprint } from '../types';
import IssueTypeIcon from '../components/issues/IssueTypeIcon';
import PriorityIcon from '../components/issues/PriorityIcon';
import Avatar from '../components/ui/Avatar';
import IssueModal from '../components/issues/IssueModal';

const CAPACITY_PER_PERSON = 8; // default story points per sprint per person

export default function WorkloadPage() {
  const { user, activeProject, profiles } = useApp();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeProject) return;
    const [iss, spr] = await Promise.all([
      getIssues(activeProject.id, { includeArchived: false }),
      getSprints(activeProject.id),
    ]);
    setIssues(iss);
    setSprints(spr);
    // Auto-select active sprint
    const active = spr.find((s) => s.status === 'active');
    if (active) setSelectedSprintId(active.id);
    else if (spr.length > 0) setSelectedSprintId(spr[0].id);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <Users size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Select a project to view workload</p>
        </div>
      </div>
    );
  }

  const sprintIssues = issues.filter((i) =>
    selectedSprintId ? i.sprint_id === selectedSprintId : !i.sprint_id
  );

  // Group by assignee
  const byAssignee = profiles.map((profile) => {
    const assigned = sprintIssues.filter((i) => i.assignee_id === profile.id);
    const points = assigned.reduce((sum, i) => sum + (i.story_points ?? 0), 0);
    const done = assigned.filter((i) => i.status === 'done').length;
    const inProgress = assigned.filter((i) => i.status === 'in_progress').length;
    const overdue = assigned.filter(
      (i) => i.due_date && i.status !== 'done' && new Date(i.due_date) < new Date()
    ).length;
    return { profile, assigned, points, done, inProgress, overdue };
  }).filter((p) => p.assigned.length > 0);

  // Unassigned
  const unassigned = sprintIssues.filter((i) => !i.assignee_id);

  const getLoadColor = (points: number) => {
    if (points === 0) return 'bg-gray-200';
    if (points <= CAPACITY_PER_PERSON * 0.6) return 'bg-green-400';
    if (points <= CAPACITY_PER_PERSON) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  const getLoadLabel = (points: number) => {
    if (points === 0) return { text: 'No load', color: 'text-gray-400' };
    if (points <= CAPACITY_PER_PERSON * 0.6) return { text: 'Under capacity', color: 'text-green-600' };
    if (points <= CAPACITY_PER_PERSON) return { text: 'On track', color: 'text-yellow-600' };
    return { text: 'Overloaded', color: 'text-red-600' };
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Workload</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Capacity planning by team member</p>
        </div>
        <select
          value={selectedSprintId}
          onChange={(e) => setSelectedSprintId(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">All / Backlog</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.status === 'active' ? '(Active)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Issues</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{sprintIssues.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Team Members Active</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{byAssignee.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-red-500 mb-1">Overloaded</p>
          <p className="text-2xl font-bold text-red-600">
            {byAssignee.filter((a) => a.points > CAPACITY_PER_PERSON).length}
          </p>
        </div>
      </div>

      {/* Workload rows */}
      <div className="space-y-4">
        {byAssignee.map(({ profile, assigned, points, done, inProgress, overdue }) => {
          const pct = Math.min((points / CAPACITY_PER_PERSON) * 100, 100);
          const loadLabel = getLoadLabel(points);
          return (
            <div key={profile.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Person header */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <Avatar name={profile.full_name ?? profile.email} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {profile.full_name ?? profile.email}
                  </p>
                  <p className={`text-xs font-medium ${loadLabel.color}`}>{loadLabel.text}</p>
                </div>
                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-green-500" />
                    {done} done
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-blue-500" />
                    {inProgress} in progress
                  </span>
                  {overdue > 0 && (
                    <span className="flex items-center gap-1 text-red-500 font-semibold">
                      <AlertTriangle size={12} />
                      {overdue} overdue
                    </span>
                  )}
                </div>
                {/* Points bar */}
                <div className="w-32">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>{points} pts</span>
                    <span>{CAPACITY_PER_PERSON} cap</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-950 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getLoadColor(points)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Issues list */}
              <div className="divide-y divide-gray-50">
                {assigned.map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => setOpenIssueId(issue.id)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 text-left transition-colors"
                  >
                    <IssueTypeIcon type={issue.type} size={13} />
                    <span className="font-mono text-[11px] text-gray-400 w-16 flex-shrink-0">{issue.ticket_id}</span>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{issue.title}</span>
                    <PriorityIcon priority={issue.priority} size={12} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                      issue.status === 'done' ? 'bg-green-100 text-green-700' :
                      issue.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400'
                    }`}>
                      {issue.status.replace('_', ' ')}
                    </span>
                    {issue.story_points && (
                      <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {issue.story_points}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Unassigned */}
        {unassigned.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 overflow-hidden opacity-70">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Users size={14} className="text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Unassigned ({unassigned.length})</p>
            </div>
            <div className="divide-y divide-gray-50">
              {unassigned.map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => setOpenIssueId(issue.id)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 text-left"
                >
                  <IssueTypeIcon type={issue.type} size={13} />
                  <span className="font-mono text-[11px] text-gray-400 w-16 flex-shrink-0">{issue.ticket_id}</span>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{issue.title}</span>
                  <PriorityIcon priority={issue.priority} size={12} />
                </button>
              ))}
            </div>
          </div>
        )}

        {byAssignee.length === 0 && unassigned.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No issues in this sprint</p>
          </div>
        )}
      </div>

      {openIssueId && user && (
        <IssueModal
          issueId={openIssueId}
          currentUser={user}
          profiles={profiles}
          sprints={sprints}
          onClose={() => setOpenIssueId(null)}
          onDeleted={() => { setOpenIssueId(null); load(); }}
          onUpdated={() => load()}
        />
      )}
    </div>
  );
}
