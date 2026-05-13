import { useEffect } from 'react';
import type { Issue } from '../types';

const STORAGE_KEY = 'mytask_notified_issues';
const DAYS_AHEAD = 2;

function getNotifiedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markNotified(id: string) {
  const set = getNotifiedSet();
  set.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
}

/**
 * Requests browser notification permission and fires notifications for
 * any issue whose due_date is within DAYS_AHEAD days and hasn't been
 * notified yet in this browser.
 */
export function useDueDateNotifications(issues: Issue[]) {
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (issues.length === 0) return;

    const run = async () => {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') return;

      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + DAYS_AHEAD);

      const notified = getNotifiedSet();

      issues.forEach((issue) => {
        if (!issue.due_date || issue.status === 'done') return;
        if (notified.has(issue.id)) return;

        const due = new Date(issue.due_date);
        if (due <= cutoff && due >= now) {
          const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
          const label = daysLeft === 0 ? 'due today' : daysLeft === 1 ? 'due tomorrow' : `due in ${daysLeft} days`;

          new Notification(`⚠️ ${issue.ticket_id} ${label}`, {
            body: issue.title,
            icon: '/favicon.ico',
            tag: issue.id, // prevents duplicates in the notification tray
          });
          markNotified(issue.id);
        } else if (due < now) {
          // Overdue
          if (notified.has(`overdue_${issue.id}`)) return;
          new Notification(`🔴 Overdue: ${issue.ticket_id}`, {
            body: issue.title,
            icon: '/favicon.ico',
            tag: `overdue_${issue.id}`,
          });
          markNotified(`overdue_${issue.id}`);
        }
      });
    };

    run().catch(console.error);
  }, [issues]);
}
