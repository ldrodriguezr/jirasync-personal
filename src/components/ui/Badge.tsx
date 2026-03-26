import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export default function Badge({ children, color, className = '' }: BadgeProps) {
  return (
    <span
      style={color ? { backgroundColor: color + '22', color } : undefined}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold
        ${!color ? 'bg-gray-100 text-gray-700' : ''} ${className}`}
    >
      {children}
    </span>
  );
}
