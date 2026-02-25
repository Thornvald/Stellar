import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Log output panel with auto-scroll behavior.
import { useEffect, useRef, useState } from 'react';
const NEAR_BOTTOM_THRESHOLD_PX = 4;
function isNearBottom(element) {
    return (element.scrollHeight - element.scrollTop - element.clientHeight <
        NEAR_BOTTOM_THRESHOLD_PX);
}
export default function LogPanel({ logs }) {
    const containerRef = useRef(null);
    const stickToBottomRef = useRef(true);
    const rafRef = useRef(null);
    const [isPinned, setIsPinned] = useState(true);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        if (stickToBottomRef.current) {
            if (rafRef.current) {
                window.cancelAnimationFrame(rafRef.current);
            }
            rafRef.current = window.requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
            });
        }
    }, [logs]);
    useEffect(() => {
        return () => {
            if (rafRef.current) {
                window.cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);
    return (_jsxs("div", { className: "log-panel", children: [_jsxs("div", { className: "log-header terminal-header", children: [_jsxs("div", { className: "terminal-bar", children: [_jsx("span", { className: "terminal-dot" }), _jsx("span", { className: "terminal-dot" }), _jsx("span", { className: "terminal-dot" }), _jsx("span", { className: "terminal-title", children: "Build Log" })] }), _jsx("p", { className: "muted", children: "Streaming output from the backend" })] }), _jsx("div", { className: `log-body${isPinned ? ' pinned' : ''}`, ref: containerRef, onScroll: () => {
                    const container = containerRef.current;
                    if (container) {
                        const shouldStick = isNearBottom(container);
                        stickToBottomRef.current = shouldStick;
                        setIsPinned(shouldStick);
                    }
                }, children: logs.length === 0 ? (_jsx("div", { className: "log-empty", children: "No logs yet." })) : (logs.map((entry, index) => (_jsx("div", { className: `log-line log-${entry.level}`, children: entry.message }, `${index}-${entry.message}`)))) })] }));
}
