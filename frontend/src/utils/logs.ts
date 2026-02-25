// Log classification helpers for UI styling.
import type { LogLevel } from '../types';

const RULES: Array<{ level: LogLevel; test: (message: string) => boolean }> = [
  {
    level: 'error',
    test: (message) => {
      const lower = message.toLowerCase();
      return lower.includes('error') || lower.includes('fail');
    }
  },
  {
    level: 'warning',
    test: (message) => {
      const lower = message.toLowerCase();
      return lower.includes('warning') || lower.includes('cancel');
    }
  },
  {
    level: 'success',
    test: (message) => message.toLowerCase().includes('success')
  }
];

export function classifyLog(message: string): LogLevel {
  for (const rule of RULES) {
    if (rule.test(message)) {
      return rule.level;
    }
  }
  return 'info';
}
