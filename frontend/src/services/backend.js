// Tauri command wrappers for backend calls.
import { invoke } from '@tauri-apps/api/core';
export async function fetchConfig() {
    return invoke('get_config');
}
export async function saveConfig(config) {
    await invoke('save_config', { config });
}
export async function startBuild(payload) {
    const buildId = await invoke('start_build', {
        projectPath: payload.projectPath,
        unrealEnginePath: payload.unrealEnginePath
    });
    return { buildId };
}
export async function getBuildStatus(buildId) {
    return invoke('get_build_status', { buildId });
}
export async function getBuildLogs(buildId, from) {
    return invoke('get_build_logs', { buildId, from });
}
export async function cancelBuild(buildId) {
    await invoke('cancel_build', { buildId });
}
export async function detectEngines() {
    const installs = await invoke('detect_engines');
    return { installs };
}
// No longer needed - Tauri commands are always available
export async function checkHealth() {
    // No-op, commands are always ready
}
export async function waitForBackendReady() {
    // No-op, Tauri commands are always ready
}
