import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribes to real-time changes on the jira.issues table for a given project.
 * Calls `onRefresh` whenever any INSERT, UPDATE or DELETE event fires.
 *
 * Requirements: enable Realtime on the `jira.issues` table in your Supabase project
 * (Database → Replication → supabase_realtime publication → add jira.issues).
 */
export function useRealtimeIssues(projectId: string | null, onRefresh: () => void) {
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`issues-${projectId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'jira',
          table: 'issues',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          onRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, onRefresh]);
}
