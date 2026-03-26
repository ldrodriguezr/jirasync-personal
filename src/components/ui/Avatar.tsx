import React from 'react';

interface AvatarProps {
  name: string | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const PALETTE = [
  '#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

function getColor(name: string): string {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return PALETTE[n % PALETTE.length];
}

const sizeMap = { xs: 'w-5 h-5 text-[10px]', sm: 'w-7 h-7 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' };

export default function Avatar({ name, size = 'sm', className = '' }: AvatarProps) {
  const display = name ?? '?';
  const initials = display
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      style={{ backgroundColor: getColor(display) }}
      className={`${sizeMap[size]} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
      title={display}
    >
      {initials}
    </div>
  );
}
