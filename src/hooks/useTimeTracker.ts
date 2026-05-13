import { useCallback, useEffect, useRef, useState } from 'react';
import { getRunningTimer, startTimer, stopTimer, formatDuration } from '../lib/db';

export function useTimeTracker(issueId: string, userId: string) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTick = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  const startTick = (from: Date) => {
    stopTick();
    tickRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - from.getTime()) / 1000));
    }, 1000);
  };

  // Check for existing running timer on mount
  useEffect(() => {
    getRunningTimer(issueId, userId).then((entry) => {
      if (entry) {
        const from = new Date(entry.started_at);
        setRunning(true);
        setStartedAt(from);
        setElapsed(Math.round((Date.now() - from.getTime()) / 1000));
        startTick(from);
      }
    }).catch(console.error);
    return () => stopTick();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId, userId]);

  const start = useCallback(async () => {
    setLoading(true);
    const entry = await startTimer(issueId, userId);
    if (entry) {
      const from = new Date(entry.started_at);
      setRunning(true);
      setStartedAt(from);
      setElapsed(0);
      startTick(from);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId, userId]);

  const stop = useCallback(async (note?: string) => {
    setLoading(true);
    stopTick();
    await stopTimer(issueId, userId, note);
    setRunning(false);
    setStartedAt(null);
    setElapsed(0);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId, userId]);

  return {
    running,
    elapsed,
    elapsedFormatted: formatDuration(elapsed),
    startedAt,
    loading,
    start,
    stop,
  };
}
