// File and directory dialog helpers with Tauri fallback.
function hasTauri() {
    return typeof window !== 'undefined' && '__TAURI__' in window;
}
async function openDialog(options) {
    const dialog = await import('@tauri-apps/plugin-dialog');
    return dialog.open(options);
}
function normalizeDialogResult(result) {
    if (!result) {
        return null;
    }
    if (Array.isArray(result)) {
        return typeof result[0] === 'string' ? result[0] : null;
    }
    return typeof result === 'string' ? result : null;
}
export async function selectProjectPath() {
    if (!hasTauri()) {
        const manual = window.prompt('Enter the full path to the .uproject file');
        return manual ? manual.trim() : null;
    }
    try {
        const result = await openDialog({
            title: 'Select Unreal Project',
            filters: [
                {
                    name: 'Unreal Project',
                    extensions: ['uproject']
                }
            ]
        });
        return normalizeDialogResult(result);
    }
    catch (error) {
        console.error('Failed to open project dialog', error);
        return null;
    }
}
export async function selectEnginePath() {
    if (!hasTauri()) {
        const manual = window.prompt('Enter the Unreal Engine installation directory');
        return manual ? manual.trim() : null;
    }
    try {
        const result = await openDialog({
            title: 'Select Unreal Engine Installation Folder',
            directory: true
        });
        return normalizeDialogResult(result);
    }
    catch (error) {
        console.error('Failed to open engine path dialog', error);
        return null;
    }
}
