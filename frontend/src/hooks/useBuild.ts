// React hook for build lifecycle and status polling.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BuildStartRequest, BuildStatus } from '@shared/types';
import { cancelBuild, getBuildStatus, launchEditor, startBuild } from '../services/backend';

const INITIAL_STATUS: BuildStatus = {
  status: 'idle',
  code: null,
  error: null,
  startedAt: null,
  finishedAt: null
};

const POLL_INTERVAL_MS = 300;

export function useBuild() {
  const [status, setStatus] = useState<BuildStatus>(INITIAL_STATUS);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [clearToken, setClearToken] = useState(0);
  const pollTimerRef = useRef<number | null>(null);
  const runAfterBuildRef = useRef<BuildStartRequest | null>(null);

  const clearLogs = useCallback(() => {
    setClearToken((prev) => prev + 1);
  }, []);

  const start = useCallback(async (payload: BuildStartRequest) => {
    runAfterBuildRef.current = null;
    clearLogs();
    setStatus({
      status: 'running',
      code: null,
      error: null,
      startedAt: new Date().toISOString(),
      finishedAt: null
    });

    try {
      const result = await startBuild(payload);
      setBuildId(result.buildId);
    } catch (err) {
      setStatus({
        status: 'error',
        code: null,
        error: err instanceof Error ? err.message : 'Failed to start build',
        startedAt: null,
        finishedAt: new Date().toISOString()
      });
      setBuildId(null);
    }
  }, [clearLogs]);

  const startAndRun = useCallback(async (payload: BuildStartRequest) => {
    runAfterBuildRef.current = payload;
    clearLogs();
    setStatus({
      status: 'running',
      code: null,
      error: null,
      startedAt: new Date().toISOString(),
      finishedAt: null
    });

    try {
      const result = await startBuild(payload);
      setBuildId(result.buildId);
    } catch (err) {
      runAfterBuildRef.current = null;
      setStatus({
        status: 'error',
        code: null,
        error: err instanceof Error ? err.message : 'Failed to start build',
        startedAt: null,
        finishedAt: new Date().toISOString()
      });
      setBuildId(null);
    }
  }, [clearLogs]);

  const cancel = useCallback(async () => {
    if (!buildId) {
      return;
    }
    runAfterBuildRef.current = null;

    try {
      await cancelBuild(buildId);
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to cancel build',
        finishedAt: new Date().toISOString()
      }));
    }
  }, [buildId]);

  useEffect(() => {
    if (!buildId || status.status !== 'running') {
      return;
    }

    let cancelled = false;

    const scheduleNext = () => {
      pollTimerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      try {
        const statusResult = await getBuildStatus(buildId);

        if (cancelled) {
          return;
        }

        setStatus(statusResult);

        if (statusResult.status === 'running') {
          scheduleNext();
        } else if (statusResult.status === 'success' && runAfterBuildRef.current) {
          const payload = runAfterBuildRef.current;
          runAfterBuildRef.current = null;
          try {
            await launchEditor(payload);
          } catch (err) {
            console.error('Failed to launch editor after build:', err);
          }
        } else {
          // Build finished with non-success status, clear the run-after flag
          runAfterBuildRef.current = null;
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        runAfterBuildRef.current = null;
        setStatus((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Lost connection to backend',
          finishedAt: new Date().toISOString()
        }));
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [buildId, status.status]);

  return {
    buildId,
    status,
    clearToken,
    isBuilding: status.status === 'running',
    start,
    startAndRun,
    cancel,
    clearLogs
  };
}
