// React hook for build lifecycle and log polling.
import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelBuild, getBuildLogs, getBuildStatus, startBuild } from '../services/backend';
import { classifyLog } from '../utils/logs';
const INITIAL_STATUS = {
    status: 'idle',
    code: null,
    error: null,
    startedAt: null,
    finishedAt: null
};
const POLL_INTERVAL_MS = 300;
export function useBuild() {
    const [status, setStatus] = useState(INITIAL_STATUS);
    const [buildId, setBuildId] = useState(null);
    const [logs, setLogs] = useState([]);
    const cursorRef = useRef(0);
    const pollTimerRef = useRef(null);
    const clearLogs = useCallback(() => {
        setLogs([]);
        cursorRef.current = 0;
    }, []);
    const appendLogs = useCallback((lines) => {
        if (lines.length === 0) {
            return;
        }
        setLogs((prev) => [
            ...prev,
            ...lines.map((line) => ({
                message: line,
                level: classifyLog(line)
            }))
        ]);
    }, []);
    const start = useCallback(async (payload) => {
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
        }
        catch (err) {
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
        try {
            await cancelBuild(buildId);
        }
        catch (err) {
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
                const [logResult, statusResult] = await Promise.all([
                    getBuildLogs(buildId, cursorRef.current),
                    getBuildStatus(buildId)
                ]);
                if (cancelled) {
                    return;
                }
                cursorRef.current = logResult.nextIndex;
                appendLogs(logResult.lines);
                setStatus(statusResult);
                if (statusResult.status === 'running') {
                    scheduleNext();
                }
            }
            catch (err) {
                if (cancelled) {
                    return;
                }
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
    }, [appendLogs, buildId, status.status]);
    return {
        buildId,
        status,
        logs,
        isBuilding: status.status === 'running',
        start,
        cancel,
        clearLogs
    };
}
