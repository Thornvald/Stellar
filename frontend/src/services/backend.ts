// Tauri command wrappers for backend calls.
import { invoke } from '@tauri-apps/api/core';
import type {
  BuildLogsResponse,
  BuildStatus,
  Config,
  EngineInstall
} from '@shared/types';

export async function fetchConfig(): Promise<Config> {
  return invoke<Config>('get_config');
}

export async function saveConfig(config: Config): Promise<void> {
  await invoke('save_config', { config });
}

export async function startBuild(payload: {
  projectPath: string;
  unrealEnginePath: string;
}): Promise<{ buildId: string }> {
  const buildId = await invoke<string>('start_build', {
    projectPath: payload.projectPath,
    unrealEnginePath: payload.unrealEnginePath
  });
  return { buildId };
}

export async function getBuildStatus(buildId: string): Promise<BuildStatus> {
  return invoke<BuildStatus>('get_build_status', { buildId });
}

export async function getBuildLogs(buildId: string, from: number): Promise<BuildLogsResponse> {
  return invoke<BuildLogsResponse>('get_build_logs', { buildId, from });
}

export async function cancelBuild(buildId: string): Promise<void> {
  await invoke('cancel_build', { buildId });
}

export async function detectEngines(): Promise<{ installs: EngineInstall[] }> {
  const installs = await invoke<EngineInstall[]>('detect_engines');
  return { installs };
}

// No longer needed - Tauri commands are always available
export async function checkHealth(): Promise<void> {
  // No-op, commands are always ready
}

export async function waitForBackendReady(): Promise<void> {
  // No-op, Tauri commands are always ready
}
