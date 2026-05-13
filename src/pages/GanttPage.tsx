import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import {
  startOfWeek, endOfWeek, eachDayOfInterval, format, isToday,
  addWeeks, subWeeks, differenceInDays, isWithinInterval, parseISO,
} from 'date-fns';
import { getIssues, getSprints, updateIssue } from '../lib/db';
import { useApp } from '../context/AppContext';
import type { Issue, Sprint } from '../types';
import IssueTypeIcon from '../components/issues/IssueTypeIcon';
import IssueModal from '../components/issues/IssueModal';

const PRIORITY_COLOR: Record<string, string> = {
  highest: 'bg-red-500',
  high:    'bg-orange-400',
  medium:  'bg-blue-400',
  low:     'bg-green-400',
  lowest:  'bg-gray-300',
};

const STATUS_COLOR: Record<string, string> = {
  backlog:     'bg-gray-300',
  todo:        'bg-slate-400',
  in_progress: 'bg-blue-500',
  review:      'bg-purple-500',
  done:        'bg-green-500',
};

const WEEKS_VISIBLE = 6;

export default function GanttPage() {
  const { user, activeProject, profiles } = useApp();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeProject) return;
    const [iss, spr] = await Promise.all([
      getIssues(activeProject.id, { includeArchived: false }),
      getSprints(activeProject.id),
    ]);
    // Only show issues with at least a due_date or created_at
    setIssues(iss);
    setSprints(spr);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <BarChart2 size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Select a project to view the Gantt chart</p>
        </div>
      </div>
    );
  }

  // Build visible days
  const totalDays = WEEKS_VISIBLE * 7;
  const rangeStart = weekStart;
  const rangeEnd = new Date(weekStart.getTime() + totalDays * 86_400_000 - 1);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  // Only issues with due_date
  const ganttIssues = issues.filter((i) => i.due_date);

  // Calculate bar position for an issue
  const getBar = (issue: Issue) => {
    if (!issue.due_date) return null;
    const due = parseISO(issue.due_date);
    // Use created_at as start if no explicit start
    const start = new Date(issue.created_at);
    const barStart = start < rangeStart ? rangeStart : start;
    const barEnd = due > rangeEnd ? rangeEnd : due;
    if (barEnd < rangeStart || barStart > rangeEnd) return null;
    const startOffset = differenceInDays(barStart, rangeStart);
    const duration = Math.max(1, differenceInDays(barEnd, barStart) + 1);
    const pct = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    return { pct, width, done: issue.status === 'done', overdue: due < new Date() && issue.status !== 'done' };
  };

  // Week headers
  const weekHeaders: { label: string; days: number }[] = [];
  for (let i = 0; i < WEEKS_VISIBLE; i++) {
    const ws = addWeeks(weekStart, i);
    weekHeaders.push({ label: format(ws, 'MMM d'), days: 7 });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{activeProject.name}</h1>
          <p className="text-xs text-gray-400">{activeProject.key} · Gantt</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setWeekStart((w) => subWeeks(w, WEEKS_VISIBLE))}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            Today
          </button>
          <button onClick={() => setWeekStart((w) => addWeeks(w, WEEKS_VISIBLE))}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-[900px]">
          {/* Timeline header */}
          <div className="flex sticky top-0 z-10 bg-white border-b border-gray-200">
            {/* Issue label col */}
            <div className="w-64 flex-shrink-0 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200">
              Issue
            </div>
            {/* Days header */}
            <div className="flex-1 relative">
              {/* Week labels */}
              <div className="flex border-b border-gray-100">
                {weekHeaders.map((wh, i) => (
                  <div key={i} className="border-r border-gray-100 text-[10px] text-gray-400 font-semibold px-2 py-1"
                    style={{ width: `${(wh.days / totalDays) * 100}%` }}>
                    {wh.label}
                  </div>
                ))}
              </div>
              {/* Day labels */}
              <div className="flex">
                {days.map((day) => (
                  <div key={day.toISOString()}
                    className={`flex-1 text-center py-1 text-[9px] font-medium border-r border-gray-100 ${
                      isToday(day) ? 'bg-blue-50 text-blue-600' : 'text-gray-300'
                    }`}>
                    {format(day, 'd')}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sprint groups */}
          {sprints.filter((s) => s.status !== 'completed').map((sprint) => {
            const sprintIssues = ganttIssues.filter((i) => i.sprint_id === sprint.id);
            if (sprintIssues.length === 0) return null;
            return (
              <div key={sprint.id}>
                <div className="flex bg-gray-50 border-b border-gray-200">
                  <div className="w-64 flex-shrink-0 px-4 py-1.5 text-[11px] font-semibold text-gray-500 border-r border-gray-200">
                    {sprint.name}
                  </div>
                  <div className="flex-1" />
                </div>
                {sprintIssues.map((issue) => {
                  const bar = getBar(issue);
                  return (
                    <div key={issue.id} className="flex border-b border-gray-100 hover:bg-gray-50 group">
                      {/* Issue label */}
                      <button
                        onClick={() => setOpenIssueId(issue.id)}
                        className="w-64 flex-shrink-0 flex items-center gap-2 px-4 py-2 border-r border-gray-100 text-left"
                      >
                        <IssueTypeIcon type={issue.type} size={12} />
                        <span className="font-mono text-[10px] text-gray-400">{issue.ticket_id}</span>
                        <span className="text-xs text-gray-700 truncate">{issue.title}</span>
                      </button>
                      {/* Bar area */}
                      <div className="flex-1 relative h-9 flex items-center">
                        {/* Today line */}
                        {isWithinInterval(new Date(), { start: rangeStart, end: rangeEnd }) && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-blue-400 z-10 opacity-60"
                            style={{ left: `${(differenceInDays(new Date(), rangeStart) / totalDays) * 100}%` }}
                          />
                        )}
                        {/* Day grid lines */}
                        {days.map((day, i) => (
                          <div key={i} className="absolute top-0 bottom-0 w-px bg-gray-100"
                            style={{ left: `${(i / totalDays) * 100}%` }} />
                        ))}
                        {/* Bar */}
                        {bar && (
                          <div
                            className={`absolute h-5 rounded-full flex items-center px-2 text-white text-[10px] font-medium cursor-pointer
                              ${bar.done ? 'bg-green-400' : bar.overdue ? 'bg-red-400' : PRIORITY_COLOR[issue.priority]}`}
                            style={{ left: `${bar.pct}%`, width: `${bar.width}%`, minWidth: '4px' }}
                            onClick={() => setOpenIssueId(issue.id)}
                            title={issue.title}
                          >
                            <span className="truncate">{bar.width > 5 ? issue.title : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Backlog issues with due dates */}
          {ganttIssues.filter((i) => !i.sprint_id).length > 0 && (
            <div>
              <div className="flex bg-gray-50 border-b border-gray-200">
                <div className="w-64 flex-shrink-0 px-4 py-1.5 text-[11px] font-semibold text-gray-500 border-r border-gray-200">
                  Backlog
                </div>
                <div className="flex-1" />
              </div>
              {ganttIssues.filter((i) => !i.sprint_id).map((issue) => {
                const bar = getBar(issue);
                return (
                  <div key={issue.id} className="flex border-b border-gray-100 hover:bg-gray-50">
                    <button onClick={() => setOpenIssueId(issue.id)}
                      className="w-64 flex-shrink-0 flex items-center gap-2 px-4 py-2 border-r border-gray-100 text-left">
                      <IssueTypeIcon type={issue.type} size={12} />
                      <span className="font-mono text-[10px] text-gray-400">{issue.ticket_id}</span>
                      <span className="text-xs text-gray-700 truncate">{issue.title}</span>
                    </button>
                    <div className="flex-1 relative h-9 flex items-center">
                      {days.map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 w-px bg-gray-100"
                          style={{ left: `${(i / totalDays) * 100}%` }} />
                      ))}
                      {bar && (
                        <div
                          className={`absolute h-5 rounded-full flex items-center px-2 text-white text-[10px] font-medium cursor-pointer
                            ${bar.done ? 'bg-green-400' : bar.overdue ? 'bg-red-400' : PRIORITY_COLOR[issue.priority]}`}
                          style={{ left: `${bar.pct}%`, width: `${bar.width}%`, minWidth: '4px' }}
                          onClick={() => setOpenIssueId(issue.id)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {ganttIssues.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No issues with due dates. Add due dates to see the Gantt chart.</p>
            </div>
          )}
        </div>
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
