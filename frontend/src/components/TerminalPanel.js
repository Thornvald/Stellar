import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Embedded terminal view for live build output.
import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
export default function TerminalPanel({ clearToken }) {
    const containerRef = useRef(null);
    const terminalRef = useRef(null);
    const fitAddonRef = useRef(null);
    useEffect(() => {
        const terminal = new Terminal({
            fontFamily: '"Cascadia Code", "Consolas", "Courier New", monospace',
            fontSize: 12.5,
            lineHeight: 1.45,
            scrollback: 5000,
            disableStdin: true,
            theme: {
                background: 'transparent',
                foreground: '#e2e2e2',
                cursor: '#ffffff',
                selectionBackground: 'rgba(255, 255, 255, 0.25)'
            }
        });
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;
        if (containerRef.current) {
            terminal.open(containerRef.current);
            fitAddon.fit();
        }
        const resizeObserver = new ResizeObserver(() => {
            fitAddonRef.current?.fit();
        });
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        return () => {
            resizeObserver.disconnect();
            terminal.dispose();
        };
    }, []);
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.clear();
        }
    }, [clearToken]);
    useEffect(() => {
        let cancelled = false;
        let unlisten = null;
        const setup = async () => {
            const fn = await listen('build-log', (event) => {
                terminalRef.current?.writeln(event.payload.line);
            });
            if (cancelled) {
                fn();
            }
            else {
                unlisten = fn;
            }
        };
        setup();
        return () => {
            cancelled = true;
            if (unlisten) {
                unlisten();
            }
        };
    }, []);
    return (_jsxs("div", { className: "log-panel", children: [_jsxs("div", { className: "log-header terminal-header", children: [_jsxs("div", { className: "terminal-bar", children: [_jsx("span", { className: "terminal-dot" }), _jsx("span", { className: "terminal-dot" }), _jsx("span", { className: "terminal-dot" }), _jsx("span", { className: "terminal-title", children: "Build Terminal" })] }), _jsx("p", { className: "muted", children: "Live build output (scroll to review)" })] }), _jsx("div", { className: "terminal-body", ref: containerRef })] }));
}
