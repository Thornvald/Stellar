import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function formatStatus(status) {
    switch (status.status) {
        case 'running':
            return 'Build in progress';
        case 'success':
            return 'Build completed';
        case 'cancelled':
            return 'Build cancelled';
        case 'error':
            return status.error ? `Build error: ${status.error}` : 'Build failed';
        default:
            return 'Idle';
    }
}
export default function BuildControls({ canBuild, isBuilding, status, onBuild, onCancel, onClearLogs }) {
    return (_jsxs("div", { className: "build-controls", children: [_jsxs("div", { className: "status-block", children: [_jsx("p", { className: "section-label", children: "Status" }), _jsx("p", { className: `status-text status-${status.status}`, children: formatStatus(status) })] }), _jsxs("div", { className: "button-row", children: [_jsx("button", { className: "primary-button", type: "button", onClick: onBuild, disabled: !canBuild, children: isBuilding ? 'Building...' : 'Build Project' }), _jsx("button", { className: "ghost-button", type: "button", onClick: onCancel, disabled: !isBuilding, children: "Cancel" }), _jsx("button", { className: "ghost-button", type: "button", onClick: onClearLogs, children: "Clear Logs" })] })] }));
}
