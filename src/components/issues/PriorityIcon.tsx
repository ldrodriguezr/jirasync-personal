import React from 'react';
import { ArrowUp, ChevronUp, Minus, ChevronDown, ArrowDown, type LucideIcon } from 'lucide-react';
import type { Priority } from '../../types';

const MAP: Record<Priority, { Icon: LucideIcon; color: string; label: string }> = {
  highest: { Icon: ArrowUp,    color: 'text-red-600',    label: 'Highest' },
  high:    { Icon: ChevronUp,  color: 'text-orange-500', label: 'High'    },
  medium:  { Icon: Minus,      color: 'text-yellow-500', label: 'Medium'  },
  low:     { Icon: ChevronDown,color: 'text-blue-400',   label: 'Low'     },
  lowest:  { Icon: ArrowDown,  color: 'text-gray-400',   label: 'Lowest'  },
};

export default function PriorityIcon({
  priority,
  size = 14,
  showLabel = false,
}: {
  priority: Priority;
  size?: number;
  showLabel?: boolean;
}) {
  const { Icon, color, label } = MAP[priority] ?? MAP.medium;
  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <Icon size={size} />
      {showLabel && <span className="text-xs">{label}</span>}
    </span>
  );
}
