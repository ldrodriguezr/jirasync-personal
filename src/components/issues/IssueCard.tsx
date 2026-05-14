import React from 'react';
import { MessageSquare, Calendar, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import type { Issue } from '../../types';
import IssueTypeIcon from './IssueTypeIcon';
import PriorityIcon from './PriorityIcon';
import Avatar from '../ui/Avatar';

interface IssueCardProps {
  issue: Issue;
  onClick: () => void;
  dragHandleProps?: object;
  draggableRef?: React.Ref<HTMLDivElement>;
  draggableProps?: object;
}

export default function IssueCard({
  issue,
  onClick,
  dragHandleProps,
  draggableRef,
  draggableProps,
}: IssueCardProps) {
  const completedChecks = issue.checklists?.filter((c) => c.is_completed).length ?? 0;
  const totalChecks = issue.checklists?.length ?? 0;
  const commentCount = issue.comments?.filter((c) => !c.is_system).length ?? 0;
  const isOverdue =
    issue.due_date && issue.status !== 'done' && new Date(issue.due_date) < new Date();

  return (
    <div
      ref={draggableRef}
      {...draggableProps}
      {...dragHandleProps}
      onClick={onClick}
      className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-2 shadow-sm cursor-pointer
        hover:border-blue-400 hover:shadow-md transition-all group"
    >
      {/* Type + ticket ID */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <IssueTypeIcon type={issue.type} size={13} />
        <span className="text-[10px] font-mono text-gray-400 font-medium">{issue.ticket_id}</span>
        {issue.tag && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-950 text-gray-500 dark:text-gray-400 font-medium">
            {issue.tag}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-snug mb-2 line-clamp-2">{issue.title}</p>

      {/* Progress bar for checklist */}
      {totalChecks > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <CheckSquare size={10} className="text-gray-400" />
            <span className="text-[10px] text-gray-400">{completedChecks}/{totalChecks}</span>
          </div>
          <div className="h-1 bg-gray-100 dark:bg-gray-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${totalChecks ? (completedChecks / totalChecks) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-2">
          <PriorityIcon priority={issue.priority} size={12} />
          {issue.story_points && (
            <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-[10px] font-bold flex items-center justify-center">
              {issue.story_points}
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <MessageSquare size={10} />
              {commentCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {issue.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              <Calendar size={10} />
              {format(new Date(issue.due_date), 'MMM d')}
            </span>
          )}
          {issue.assignee && (
            <Avatar name={issue.assignee.full_name ?? issue.assignee.email} size="xs" />
          )}
        </div>
      </div>
    </div>
  );
}
