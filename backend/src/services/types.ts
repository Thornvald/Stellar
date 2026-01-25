// Service contracts for backend dependencies.
import type {
  BuildLogsResponse,
  BuildStartRequest,
  BuildStartResponse,
  BuildStatus,
  Config
} from '@stellar/shared';

export type ConfigStore = {
  load: () => Promise<Config>;
  save: (config: Config) => Promise<void>;
  getPath: () => string;
};

export type BuildManager = {
  startBuild: (payload: BuildStartRequest) => Promise<BuildStartResponse>;
  getStatus: (buildId: string) => BuildStatus | null;
  getLogs: (buildId: string, from: number) => BuildLogsResponse | null;
  cancelBuild: (buildId: string) => Promise<boolean>;
};
