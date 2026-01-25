import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Main application layout and orchestration for the UI.
import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import ProjectList from './components/ProjectList';
import EnginePathCard from './components/EnginePathCard';
import BuildControls from './components/BuildControls';
import LogPanel from './components/LogPanel';
import { useConfig } from './hooks/useConfig';
import { useBuild } from './hooks/useBuild';
import { selectEnginePath, selectProjectPath } from './services/dialogs';
import { detectEngines, waitForBackendReady } from './services/backend';
import Starfield from './components/Starfield';
function extractProjectName(projectPath) {
    const segments = projectPath.split(/[/\\]/);
    const file = segments[segments.length - 1] ?? '';
    return file.replace(/\.uproject$/i, '');
}
function isValidIndex(index, list) {
    return typeof index === 'number' && index >= 0 && index < list.length;
}
export default function App() {
    const { config, loading, error, updateConfig } = useConfig();
    const { status, logs, isBuilding, start, cancel, clearLogs } = useBuild();
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [uiMessage, setUiMessage] = useState(null);
    const [engineCandidates, setEngineCandidates] = useState([]);
    const [hasCheckedEngines, setHasCheckedEngines] = useState(false);
    const [engineDetectError, setEngineDetectError] = useState(null);
    useEffect(() => {
        if (!isValidIndex(selectedIndex, config.projects)) {
            setSelectedIndex(null);
        }
    }, [config.projects, selectedIndex]);
    useEffect(() => {
        if (loading || hasCheckedEngines || config.unrealEnginePath) {
            return;
        }
        const runDetection = async () => {
            setHasCheckedEngines(true);
            setEngineDetectError(null);
            try {
                await waitForBackendReady({ maxAttempts: 30, baseDelayMs: 500 });
            }
            catch (err) {
                console.warn('Backend not ready for engine detection:', err);
                setEngineDetectError('Backend service is not responding. Please restart the application.');
                return;
            }
            try {
                const result = await detectEngines();
                if (result.installs.length === 1) {
                    const install = result.installs[0];
                    await updateConfig({
                        ...config,
                        unrealEnginePath: install.path
                    });
                }
                else if (result.installs.length > 1) {
                    setEngineCandidates(result.installs);
                }
                else {
                    setEngineDetectError('No Unreal Engine installations found. Use "Set Engine Path" to manually select your installation.');
                }
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to detect Unreal Engine installs.';
                console.warn('Engine auto-detect failed', err);
                setEngineDetectError(message);
            }
        };
        runDetection();
    }, [config, hasCheckedEngines, loading, updateConfig]);
    const canBuild = useMemo(() => {
        return isValidIndex(selectedIndex, config.projects)
            && Boolean(config.unrealEnginePath)
            && !isBuilding;
    }, [selectedIndex, config.projects, config.unrealEnginePath, isBuilding]);
    const handleAddProject = async () => {
        setUiMessage(null);
        const projectPath = await selectProjectPath();
        if (!projectPath) {
            return;
        }
        const name = extractProjectName(projectPath);
        if (!name) {
            setUiMessage('Could not determine project name.');
            return;
        }
        if (config.projects.some((project) => project.path === projectPath)) {
            setUiMessage('Project already added.');
            return;
        }
        const nextProjects = [...config.projects, { name, path: projectPath }];
        await updateConfig({
            ...config,
            projects: nextProjects
        });
        setSelectedIndex(nextProjects.length - 1);
    };
    const handleRemoveProject = async (index) => {
        const nextProjects = config.projects.filter((_, idx) => idx !== index);
        await updateConfig({
            ...config,
            projects: nextProjects
        });
        if (selectedIndex === index) {
            setSelectedIndex(null);
        }
        else if (selectedIndex !== null && selectedIndex > index) {
            setSelectedIndex(selectedIndex - 1);
        }
    };
    const handleSelectEnginePath = async () => {
        setUiMessage(null);
        setEngineDetectError(null);
        setEngineCandidates([]);
        const enginePath = await selectEnginePath();
        if (!enginePath) {
            return;
        }
        await updateConfig({
            ...config,
            unrealEnginePath: enginePath
        });
    };
    const handlePickDetected = async (install) => {
        setEngineCandidates([]);
        setEngineDetectError(null);
        await updateConfig({
            ...config,
            unrealEnginePath: install.path
        });
    };
    const handleRetryDetect = async () => {
        setEngineDetectError(null);
        setEngineCandidates([]);
        try {
            await waitForBackendReady({ maxAttempts: 30, baseDelayMs: 500 });
            const result = await detectEngines();
            if (result.installs.length === 1) {
                const install = result.installs[0];
                await updateConfig({
                    ...config,
                    unrealEnginePath: install.path
                });
            }
            else if (result.installs.length > 1) {
                setEngineCandidates(result.installs);
            }
            else {
                setEngineDetectError('No Unreal Engine installations found. Use "Set Engine Path" to manually select your installation.');
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to detect Unreal Engine installs.';
            console.warn('Engine retry detect failed', err);
            setEngineDetectError(message);
        }
    };
    const handleBuild = async () => {
        setUiMessage(null);
        if (isBuilding) {
            return;
        }
        if (!isValidIndex(selectedIndex, config.projects) || !config.unrealEnginePath) {
            setUiMessage('Select a project and engine path first.');
            return;
        }
        await start({
            projectPath: config.projects[selectedIndex].path,
            unrealEnginePath: config.unrealEnginePath
        });
    };
    return (_jsxs(_Fragment, { children: [_jsx(Starfield, {}), _jsxs("div", { className: "app", children: [_jsx(Header, {}), _jsxs("div", { className: "grid", children: [_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "panel-header", children: [_jsxs("div", { children: [_jsx("p", { className: "section-label", children: "Projects" }), _jsx("p", { className: "muted", children: "Your Unreal project list" })] }), _jsx("button", { className: "primary-button", type: "button", onClick: handleAddProject, children: "Add Project" })] }), loading ? (_jsx("div", { className: "panel-message", children: "Loading configuration..." })) : (_jsx(ProjectList, { projects: config.projects, selectedIndex: selectedIndex, onSelect: setSelectedIndex, onRemove: handleRemoveProject }))] }), _jsxs("section", { className: "panel", children: [_jsx(EnginePathCard, { enginePath: config.unrealEnginePath, onSelect: handleSelectEnginePath, detectedEngines: engineCandidates, onPickDetected: handlePickDetected, detectError: engineDetectError, onRetryDetect: handleRetryDetect }), _jsx(BuildControls, { canBuild: canBuild, isBuilding: isBuilding, status: status, onBuild: handleBuild, onCancel: cancel, onClearLogs: clearLogs }), _jsx(LogPanel, { logs: logs })] })] }), (uiMessage || error) && (_jsx("div", { className: "alert", children: uiMessage ?? error }))] })] }));
}
