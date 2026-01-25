// UI-only types for logs and rendering.
export type LogLevel = 'info' | 'warning' | 'error' | 'success';

export type LogEntry = {
  message: string;
  level: LogLevel;
};
