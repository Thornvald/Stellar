// React hook for loading and persisting configuration via RPC.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchConfig, saveConfig, waitForBackendReady } from '../services/backend';
const EMPTY_CONFIG = {
    projects: [],
    unrealEnginePath: null
};
export function useConfig() {
    const [config, setConfig] = useState(EMPTY_CONFIG);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const retryRef = useRef(0);
    const retryTimerRef = useRef(null);
    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await waitForBackendReady();
            const next = await fetchConfig();
            setConfig(next);
            retryRef.current = 0;
            if (retryTimerRef.current) {
                window.clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load config';
            setError(message);
            const isNetworkError = message.toLowerCase().includes('failed to fetch') ||
                message.toLowerCase().includes('network') ||
                message.toLowerCase().includes('load failed');
            if (isNetworkError && retryRef.current < 5 && !retryTimerRef.current) {
                retryRef.current += 1;
                retryTimerRef.current = window.setTimeout(() => {
                    retryTimerRef.current = null;
                    void reload();
                }, 1500);
            }
        }
        finally {
            setLoading(false);
        }
    }, []);
    const persist = useCallback(async (next) => {
        setConfig(next);
        try {
            await saveConfig(next);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save config');
        }
    }, []);
    useEffect(() => {
        void reload();
        return () => {
            if (retryTimerRef.current) {
                window.clearTimeout(retryTimerRef.current);
            }
        };
    }, [reload]);
    return {
        config,
        loading,
        error,
        reload,
        updateConfig: persist
    };
}
