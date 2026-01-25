// Typed RPC client helpers for backend calls.
import { hc } from 'hono/client';
import { RPC_BASE_URL } from '@shared/constants';
const client = hc(RPC_BASE_URL);
async function parseJson(response) {
    if (response.ok) {
        return response.json();
    }
    try {
        const body = await response.json();
        if (body && typeof body.error === 'string') {
            throw new Error(body.error);
        }
    }
    catch (error) {
        if (error instanceof Error) {
            throw error;
        }
    }
    throw new Error(`Request failed with status ${response.status}`);
}
export async function fetchConfig() {
    const response = await client.api.config.$get();
    return parseJson(response);
}
export async function saveConfig(config) {
    const response = await client.api.config.$post({ json: config });
    await parseJson(response);
}
export async function startBuild(payload) {
    const response = await client.api.build.start.$post({ json: payload });
    return parseJson(response);
}
export async function getBuildStatus(buildId) {
    const response = await client.api.build[':id'].status.$get({ param: { id: buildId } });
    return parseJson(response);
}
export async function getBuildLogs(buildId, from) {
    const response = await client.api.build[':id'].logs.$get({
        param: { id: buildId },
        query: { from: String(from) }
    });
    return parseJson(response);
}
export async function cancelBuild(buildId) {
    const response = await client.api.build[':id'].cancel.$post({ param: { id: buildId } });
    await parseJson(response);
}
export async function detectEngines() {
    const response = await client.api.engine.detect.$get();
    return parseJson(response);
}
export async function checkHealth() {
    const response = await client.api.health.$get();
    await parseJson(response);
}
export async function waitForBackendReady(options) {
    const maxAttempts = options?.maxAttempts ?? 20;
    const baseDelayMs = options?.baseDelayMs ?? 500;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await checkHealth();
            return;
        }
        catch (err) {
            if (attempt === maxAttempts) {
                throw err;
            }
            // Linear backoff with a cap
            const delay = Math.min(baseDelayMs * attempt, 2000);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}
