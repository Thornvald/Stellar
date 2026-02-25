// Log output panel with auto-scroll behavior.
import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../types';

const NEAR_BOTTOM_THRESHOLD_PX = 4;

type LogPanelProps = {
  logs: LogEntry[];
};

function isNearBottom(element: HTMLDivElement): boolean {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <
    NEAR_BOTTOM_THRESHOLD_PX
  );
}

export default function LogPanel({ logs }: LogPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const rafRef = useRef<number | null>(null);
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

  return (
    <div className="log-panel">
      <div className="log-header terminal-header">
        <div className="terminal-bar">
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span className="terminal-title">Build Log</span>
        </div>
        <p className="muted">Streaming output from the backend</p>
      </div>
      <div
        className={`log-body${isPinned ? ' pinned' : ''}`}
        ref={containerRef}
        onScroll={() => {
          const container = containerRef.current;
          if (container) {
            const shouldStick = isNearBottom(container);
            stickToBottomRef.current = shouldStick;
            setIsPinned(shouldStick);
          }
        }}
      >
        {logs.length === 0 ? (
          <div className="log-empty">No logs yet.</div>
        ) : (
          logs.map((entry, index) => (
            <div key={`${index}-${entry.message}`} className={`log-line log-${entry.level}`}>
              {entry.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
