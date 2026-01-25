// Shared domain types used across UI and backend.
export type ProjectConfig = {
  name: string;
  path: string;
};

export type Config = {
  projects: ProjectConfig[];
  unrealEnginePath: string | null;
};

export type EngineInstall = {
  id: string;
  name: string;
  path: string;
  version: string | null;
};

export type BuildStartRequest = {
  projectPath: string;
  unrealEnginePath: string;
};

export type BuildStartResponse = {
  buildId: string;
};

export type BuildStatus = {
  status: 'idle' | 'running' | 'success' | 'error' | 'cancelled';
  code: number | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type BuildLogsResponse = {
  lines: string[];
  nextIndex: number;
  finished: boolean;
};

export type EngineDetectResponse = {
  installs: EngineInstall[];
};
