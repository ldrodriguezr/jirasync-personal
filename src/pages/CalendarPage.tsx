import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addMonths, subMonths,
} from 'date-fns';
import { getIssues } from '../lib/db';
import { useApp } from '../context/AppContext';
import type { Issue } from '../types';
import IssueModal from '../components/issues/IssueModal';
import PriorityIcon from '../components/issues/PriorityIcon';

const STATUS_DOT: Record<string, string> = {
  backlog:     'bg-gray-400',
  todo:        'bg-slate-400',
  in_progress: 'bg-blue-500',
  review:      'bg-purple-500',
  done:        'bg-green-500',
};

export default function CalendarPage() {
  const { user, activeProject, profiles } = useApp();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [month, setMonth] = useState(new Date());
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [sprints, setSprints] = useState<import('../types').Sprint[]>([]);

  const load = useCallback(async () => {
    if (!activeProject) return;
    const [iss, { getSprints }] = await Promise.all([
      getIssues(activeProject.id, { includeArchived: false }),
      import('../lib/db'),
    ]);
    setIssues(iss.filter((i: Issue) => i.due_date));
    getSprints(activeProject.id).then(setSprints);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  // Calendar grid
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const issuesByDay = (day: Date) =>
    issues.filter((i) => i.due_date && isSameDay(new Date(i.due_date), day));

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <Calendar size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Select a project to view the calendar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Issues with due dates</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[130px] text-center">
            {format(month, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setMonth(new Date())}
            className="ml-1 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 border-t border-l border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {days.map((day) => {
          const dayIssues = issuesByDay(day);
          const isCurrentMonth = isSameMonth(day, month);
          const todayCell = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`border-b border-r border-gray-200 dark:border-gray-700 p-1.5 min-h-[100px] ${
                isCurrentMonth ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'
              }`}
            >
              {/* Date number */}
              <div className="flex justify-end mb-1">
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    todayCell
                      ? 'bg-blue-600 text-white'
                      : isCurrentMonth
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-300'
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Issues */}
              <div className="space-y-0.5">
                {dayIssues.slice(0, 3).map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => setOpenIssueId(issue.id)}
                    className="w-full text-left flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors group"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        STATUS_DOT[issue.status] ?? 'bg-gray-400'
                      }`}
                    />
                    <span className="truncate text-gray-700 dark:text-gray-300 font-medium">{issue.title}</span>
                    <PriorityIcon priority={issue.priority} size={10} />
                  </button>
                ))}
                {dayIssues.length > 3 && (
                  <p className="text-[10px] text-gray-400 px-1.5">
                    +{dayIssues.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Issue modal */}
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
