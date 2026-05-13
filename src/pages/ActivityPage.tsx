import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getActivityFeed } from '../lib/db';
import { useApp } from '../context/AppContext';
import type { ActivityItem } from '../types';
import Avatar from '../components/ui/Avatar';

const ACTION_ICONS: Record<string, string> = {
  created:        '🆕',
  status_changed: '🔄',
  assigned:       '👤',
  commented:      '💬',
  time_logged:    '⏱️',
  archived:       '📦',
  deleted:        '🗑️',
  priority_changed:'⚡',
  sprint_changed: '🏃',
};

export default function ActivityPage() {
  const { activeProject } = useApp();
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    const items = await getActivityFeed(activeProject.id, 100);
    setFeed(items);
    setLoading(false);
  }, [activeProject]);

  useEffect(() => { load(); }, [load]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <Activity size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Select a project to view activity</p>
        </div>
      </div>
    );
  }

  // Group by day
  const grouped: { date: string; items: ActivityItem[] }[] = [];
  feed.forEach((item) => {
    const date = new Date(item.created_at).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) last.items.push(item);
    else grouped.push({ date, items: [item] });
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Activity</h1>
          <p className="text-sm text-gray-500 mt-0.5">Recent changes in {activeProject.name}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {feed.length === 0 && !loading && (
        <div className="text-center py-20 text-gray-400">
          <Activity size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No activity yet. Start working on issues!</p>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(({ date, items }) => (
          <div key={date}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{date}</p>
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-2.5 px-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                  <span className="text-base mt-0.5 flex-shrink-0">
                    {ACTION_ICONS[item.action] ?? '📌'}
                  </span>
                  <Avatar name={item.actor_name} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">{item.actor_name}</span>
                      {' '}
                      <span className="text-gray-600">{item.detail}</span>
                      {item.issue && (
                        <span className="ml-1 text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {item.issue.ticket_id}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
