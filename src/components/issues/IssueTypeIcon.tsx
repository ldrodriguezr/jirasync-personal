import React from 'react';
import { Zap, BookOpen, CheckSquare, Bug, GitBranch, type LucideIcon } from 'lucide-react';
import type { IssueType } from '../../types';

const MAP: Record<IssueType, { Icon: LucideIcon; color: string }> = {
  epic:    { Icon: Zap,         color: 'text-purple-600' },
  story:   { Icon: BookOpen,    color: 'text-green-600'  },
  task:    { Icon: CheckSquare, color: 'text-blue-600'   },
  bug:     { Icon: Bug,         color: 'text-red-600'    },
  subtask: { Icon: GitBranch,   color: 'text-sky-500'    },
};

export default function IssueTypeIcon({ type, size = 14 }: { type: IssueType; size?: number }) {
  const { Icon, color } = MAP[type] ?? MAP.task;
  return <Icon size={size} className={color} />;
}
