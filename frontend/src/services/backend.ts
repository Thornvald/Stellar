// Typed RPC client helpers for backend calls.
import { hc } from 'hono/client';
import type { AppType } from '@backend/app';
import type {
  BuildLogsResponse,
  BuildStartRequest,
  BuildStartResponse,
  BuildStatus,
  Config,
  EngineDetectResponse
} from '@shared/types';
import { RPC_BASE_URL } from '@shared/constants';

const client = hc<AppType>(RPC_BASE_URL);

async function parseJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  try {
    const body = await response.json();
    if (body && typeof body.error === 'string') {
      throw new Error(body.error);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }

  throw new Error(`Request failed with status ${response.status}`);
}

export async function fetchConfig(): Promise<Config> {
  const response = await client.api.config.$get();
  return parseJson<Config>(response);
}

export async function saveConfig(config: Config): Promise<void> {
  const response = await client.api.config.$post({ json: config });
  await parseJson<{ ok: boolean }>(response);
}

export async function startBuild(payload: BuildStartRequest): Promise<BuildStartResponse> {
  const response = await client.api.build.start.$post({ json: payload });
  return parseJson<BuildStartResponse>(response);
}

export async function getBuildStatus(buildId: string): Promise<BuildStatus> {
  const response = await client.api.build[':id'].status.$get({ param: { id: buildId } });
  return parseJson<BuildStatus>(response);
}

export async function getBuildLogs(buildId: string, from: number): Promise<BuildLogsResponse> {
  const response = await client.api.build[':id'].logs.$get({
    param: { id: buildId },
    query: { from: String(from) }
  });
  return parseJson<BuildLogsResponse>(response);
}

export async function cancelBuild(buildId: string): Promise<void> {
  const response = await client.api.build[':id'].cancel.$post({ param: { id: buildId } });
  await parseJson<{ ok: boolean }>(response);
}

export async function detectEngines(): Promise<EngineDetectResponse> {
  const response = await client.api.engine.detect.$get();
  return parseJson<EngineDetectResponse>(response);
}

export async function checkHealth(): Promise<void> {
  const response = await client.api.health.$get();
  await parseJson<{ ok: boolean }>(response);
}

export async function waitForBackendReady(options?: {
  maxAttempts?: number;
  baseDelayMs?: number;
}): Promise<void> {
  const maxAttempts = options?.maxAttempts ?? 20;
  const baseDelayMs = options?.baseDelayMs ?? 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await checkHealth();
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }
      // Linear backoff with a cap
      const delay = Math.min(baseDelayMs * attempt, 2000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
