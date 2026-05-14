import { useEffect, useRef, useCallback } from 'react';
import { getIssues, getDependencies } from '../lib/db';
import type { Issue } from '../types';

interface SmartNotifConfig {
  projectId: string | undefined;
  userId: string | undefined;
  enabled?: boolean;
}

const STORAGE_KEY = 'mytask_smart_notified';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

function getNotified(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
}

function markNotified(key: string) {
  const data = getNotified();
  data[key] = Date.now();
  // Clean entries older than 24h
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  Object.keys(data).forEach((k) => { if (data[k] < cutoff) delete data[k]; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function notify(title: string, body: string, tag: string) {
  if (Notification.permission !== 'granted') return;
  const notified = getNotified();
  if (notified[tag]) return; // Already notified recently
  markNotified(tag);
  new Notification(title, { body, icon: '/vite.svg', tag });
}

export function useSmartNotifications({ projectId, userId, enabled = true }: SmartNotifConfig) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    if (!projectId || !userId || !enabled) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') return;

    try {
      const issues = await getIssues(projectId, { includeArchived: false });
      const myIssues = issues.filter((i) => i.assignee_id === userId);
      const now = new Date();

      // 1) Overdue issues
      const overdue = myIssues.filter(
        (i) => i.due_date && i.status !== 'done' && new Date(i.due_date) < now
      );
      overdue.forEach((i) => {
        notify(
          '⚠️ Overdue task',
          `${i.ticket_id}: ${i.title} was due ${new Date(i.due_date!).toLocaleDateString()}`,
          `overdue-${i.id}`
        );
      });

      // 2) Due within 24 hours
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const dueSoon = myIssues.filter(
        (i) => i.due_date && i.status !== 'done' &&
               new Date(i.due_date) > now && new Date(i.due_date) <= tomorrow
      );
      dueSoon.forEach((i) => {
        notify(
          '⏰ Due soon',
          `${i.ticket_id}: ${i.title} is due today or tomorrow`,
          `duesoon-${i.id}`
        );
      });

      // 3) Blocked tasks — check if any dependency is now done
      for (const issue of myIssues.filter((i) => i.status !== 'done')) {
        const deps = await getDependencies(issue.id);
        const allResolved = deps.length > 0 && deps.every((d) => {
          const dep = d.depends_on as Issue | undefined;
          return dep?.status === 'done';
        });
        if (allResolved && deps.length > 0) {
          notify(
            '🔓 Unblocked!',
            `${issue.ticket_id}: ${issue.title} — all blockers are resolved`,
            `unblocked-${issue.id}`
          );
        }
      }

      // 4) Stale in-progress (no update in 3+ days)
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const stale = myIssues.filter(
        (i) => i.status === 'in_progress' && new Date(i.updated_at) < threeDaysAgo
      );
      stale.forEach((i) => {
        notify(
          '🐌 Stale task',
          `${i.ticket_id}: ${i.title} has been in progress for 3+ days without updates`,
          `stale-${i.id}`
        );
      });
    } catch (err) {
      console.error('Smart notifications check failed:', err);
    }
  }, [projectId, userId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Initial check after 10s
    const timeout = setTimeout(check, 10_000);
    intervalRef.current = setInterval(check, CHECK_INTERVAL);
    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check, enabled]);
}
