import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import {
  startOfWeek, eachDayOfInterval, format, isToday,
  addWeeks, subWeeks, differenceInDays, isWithinInterval, parseISO, addDays,
} from 'date-fns';
import { getIssues, getSprints, updateIssue } from '../lib/db';
import { useApp } from '../context/AppContext';
import type { Issue, Sprint } from '../types';
import IssueTypeIcon from '../components/issues/IssueTypeIcon';
import IssueModal from '../components/issues/IssueModal';

const PRIORITY_COLOR: Record<string, string> = {
  highest: 'bg-red-500', high: 'bg-orange-400', medium: 'bg-blue-400',
  low: 'bg-green-400', lowest: 'bg-gray-300',
};

const WEEKS_VISIBLE = 6;

export default function GanttPage() {
  const { user, activeProject, profiles } = useApp();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ issueId: string; startX: number; origDue: string } | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!activeProject) return;
    const [iss, spr] = await Promise.all([
      getIssues(activeProject.id, { includeArchived: false }),
      getSprints(activeProject.id),
    ]);
    setIssues(iss);
    setSprints(spr);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  // Drag handlers for resizing due date
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setDragDelta(e.clientX - dragging.startX);
    };
    const onUp = async () => {
      if (!chartRef.current) { setDragging(null); return; }
      const chartWidth = chartRef.current.offsetWidth;
      const dayWidth = chartWidth / (WEEKS_VISIBLE * 7);
      const daysDelta = Math.round(dragDelta / dayWidth);
      if (daysDelta !== 0) {
        const newDue = addDays(parseISO(dragging.origDue), daysDelta);
        await updateIssue(dragging.issueId, { due_date: format(newDue, 'yyyy-MM-dd') });
        await load();
      }
      setDragging(null);
      setDragDelta(0);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [dragging, dragDelta, load]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <BarChart2 size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">Select a project to view the Gantt chart</p>
      </div>
    );
  }

  const totalDays = WEEKS_VISIBLE * 7;
  const rangeStart = weekStart;
  const rangeEnd = new Date(weekStart.getTime() + totalDays * 86_400_000 - 1);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const ganttIssues = issues.filter((i) => i.due_date);

  const getBar = (issue: Issue) => {
    if (!issue.due_date) return null;
    let due = parseISO(issue.due_date);
    // If dragging this issue, adjust due
    if (dragging?.issueId === issue.id && chartRef.current) {
      const dayWidth = chartRef.current.offsetWidth / totalDays;
      const daysDelta = Math.round(dragDelta / dayWidth);
      due = addDays(due, daysDelta);
    }
    const start = new Date(issue.created_at);
    const barStart = start < rangeStart ? rangeStart : start;
    const barEnd = due > rangeEnd ? rangeEnd : due;
    if (barEnd < rangeStart || barStart > rangeEnd) return null;
    const startOffset = differenceInDays(barStart, rangeStart);
    const duration = Math.max(1, differenceInDays(barEnd, barStart) + 1);
    return {
      pct: (startOffset / totalDays) * 100,
      width: (duration / totalDays) * 100,
      done: issue.status === 'done',
      overdue: due < new Date() && issue.status !== 'done',
    };
  };

  const weekHeaders: { label: string; days: number }[] = [];
  for (let i = 0; i < WEEKS_VISIBLE; i++) {
    const ws = addWeeks(weekStart, i);
    weekHeaders.push({ label: format(ws, 'MMM d'), days: 7 });
  }

  const renderIssueRow = (issue: Issue) => {
    const bar = getBar(issue);
    return (
      <div key={issue.id} className="flex border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 group">
        <button
          onClick={() => setOpenIssueId(issue.id)}
          className="w-64 flex-shrink-0 flex items-center gap-2 px-4 py-2 border-r border-gray-100 dark:border-gray-800 text-left"
        >
          <IssueTypeIcon type={issue.type} size={12} />
          <span className="font-mono text-[10px] text-gray-400">{issue.ticket_id}</span>
          <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{issue.title}</span>
        </button>
        <div className="flex-1 relative h-9 flex items-center">
          {isWithinInterval(new Date(), { start: rangeStart, end: rangeEnd }) && (
            <div className="absolute top-0 bottom-0 w-px bg-blue-400 z-10 opacity-60"
              style={{ left: `${(differenceInDays(new Date(), rangeStart) / totalDays) * 100}%` }} />
          )}
          {days.map((_, i) => (
            <div key={i} className="absolute top-0 bottom-0 w-px bg-gray-100 dark:bg-gray-800"
              style={{ left: `${(i / totalDays) * 100}%` }} />
          ))}
          {bar && (
            <div
              className={`absolute h-5 rounded-full flex items-center px-2 text-white dark:text-gray-100 text-[10px] font-medium
                ${bar.done ? 'bg-green-400' : bar.overdue ? 'bg-red-400' : PRIORITY_COLOR[issue.priority]}
                ${dragging?.issueId === issue.id ? 'opacity-70' : ''}`}
              style={{ left: `${bar.pct}%`, width: `${bar.width}%`, minWidth: '4px' }}
            >
              <span className="flex-1 truncate cursor-pointer" onClick={() => setOpenIssueId(issue.id)}>
                {bar.width > 5 ? issue.title : ''}
              </span>
              {/* Drag handle on right edge */}
              <div
                className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 rounded-r-full"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragging({ issueId: issue.id, startX: e.clientX, origDue: issue.due_date! });
                }}
                title="Drag to change due date"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{activeProject.name}</h1>
          <p className="text-xs text-gray-400">{activeProject.key} · Gantt</p>
        </div>
        <p className="ml-4 text-[10px] text-gray-400 italic hidden md:block">Drag right edge of bars to change due date</p>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setWeekStart((w) => subWeeks(w, WEEKS_VISIBLE))}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            Today
          </button>
          <button onClick={() => setWeekStart((w) => addWeeks(w, WEEKS_VISIBLE))}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto" ref={chartRef}>
        <div className="min-w-[900px]">
          {/* Timeline header */}
          <div className="flex sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="w-64 flex-shrink-0 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200 dark:border-gray-700">
              Issue
            </div>
            <div className="flex-1 relative">
              <div className="flex border-b border-gray-100 dark:border-gray-800">
                {weekHeaders.map((wh, i) => (
                  <div key={i} className="border-r border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 font-semibold px-2 py-1"
                    style={{ width: `${(wh.days / totalDays) * 100}%` }}>
                    {wh.label}
                  </div>
                ))}
              </div>
              <div className="flex">
                {days.map((day) => (
                  <div key={day.toISOString()}
                    className={`flex-1 text-center py-1 text-[9px] font-medium border-r border-gray-100 dark:border-gray-800 ${
                      isToday(day) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'
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
                <div className="flex bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <div className="w-64 flex-shrink-0 px-4 py-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                    {sprint.name}
                  </div>
                  <div className="flex-1" />
                </div>
                {sprintIssues.map(renderIssueRow)}
              </div>
            );
          })}

          {/* Backlog */}
          {ganttIssues.filter((i) => !i.sprint_id).length > 0 && (
            <div>
              <div className="flex bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="w-64 flex-shrink-0 px-4 py-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">Backlog</div>
                <div className="flex-1" />
              </div>
              {ganttIssues.filter((i) => !i.sprint_id).map(renderIssueRow)}
            </div>
          )}

          {ganttIssues.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Add due dates to issues to see the Gantt chart</p>
            </div>
          )}
        </div>
      </div>

      {openIssueId && user && (
        <IssueModal issueId={openIssueId} currentUser={user} profiles={profiles} sprints={sprints}
          onClose={() => setOpenIssueId(null)} onDeleted={() => { setOpenIssueId(null); load(); }}
          onUpdated={() => load()} />
      )}
    </div>
  );
}
