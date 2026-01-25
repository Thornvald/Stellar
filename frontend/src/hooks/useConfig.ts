// React hook for loading and persisting configuration via Tauri commands.
import { useCallback, useEffect, useState } from 'react';
import type { Config } from '@shared/types';
import { fetchConfig, saveConfig } from '../services/backend';

const EMPTY_CONFIG: Config = {
  projects: [],
  unrealEnginePath: null
};

export function useConfig() {
  const [config, setConfig] = useState<Config>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchConfig();
      setConfig(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load config';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = useCallback(async (next: Config) => {
    setConfig(next);
    try {
      await saveConfig(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    config,
    loading,
    error,
    reload,
    updateConfig: persist
  };
}
