// Embedded terminal view for live build output.
import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

type BuildLogPayload = {
  buildId: string;
  line: string;
};

type TerminalPanelProps = {
  clearToken: number;
};

export default function TerminalPanel({ clearToken }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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
    let unlisten: UnlistenFn | null = null;

    const setup = async () => {
      const fn = await listen<BuildLogPayload>('build-log', (event) => {
        terminalRef.current?.writeln(event.payload.line);
      });

      if (cancelled) {
        fn();
      } else {
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

  return (
    <div className="log-panel">
      <div className="log-header terminal-header">
        <div className="terminal-bar">
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span className="terminal-title">Build Terminal</span>
        </div>
        <p className="muted">Live build output (scroll to review)</p>
      </div>
      <div className="terminal-body" ref={containerRef} />
    </div>
  );
}
