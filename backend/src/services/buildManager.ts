// Build manager that runs Unreal build commands and captures logs.
import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import type {
  BuildLogsResponse,
  BuildStartRequest,
  BuildStartResponse,
  BuildStatus
} from '@stellar/shared';
import type { BuildManager } from './types.js';

const MAX_LOG_LINES = 5000;

type BuildJob = {
  id: string;
  status: BuildStatus['status'];
  logs: string[];
  logOffset: number;
  startedAt: string;
  finishedAt: string | null;
  code: number | null;
  error: string | null;
  cancelRequested: boolean;
  process: ChildProcess | null;
};

class BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildError';
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function findEditorTarget(sourceDir: string): Promise<string | null> {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (entry.name.endsWith('Editor.Target.cs')) {
      return entry.name.replace('.Target.cs', '');
    }
  }

  return null;
}

async function resolveTargetName(projectPath: string): Promise<string> {
  const projectDir = path.dirname(projectPath);
  const sourceDir = path.join(projectDir, 'Source');

  if (await dirExists(sourceDir)) {
    const target = await findEditorTarget(sourceDir);
    if (target) {
      return target;
    }
  }

  const projectName = path.basename(projectPath, path.extname(projectPath));
  return `${projectName}Editor`;
}

function buildUbtPath(unrealEnginePath: string): string {
  return path.join(
    unrealEnginePath,
    'Engine',
    'Binaries',
    'DotNET',
    'UnrealBuildTool',
    'UnrealBuildTool.dll'
  );
}

function appendLog(job: BuildJob, message: string) {
  job.logs.push(message);
  if (job.logs.length > MAX_LOG_LINES) {
    job.logs.shift();
    job.logOffset += 1;
  }
}

function finalizeJob(job: BuildJob, status: BuildStatus['status'], code: number | null, error: string | null) {
  if (job.finishedAt) {
    return;
  }

  job.status = status;
  job.code = code;
  job.error = error;
  job.finishedAt = new Date().toISOString();

  if (status === 'success') {
    appendLog(job, 'Build completed successfully.');
  } else if (status === 'cancelled') {
    appendLog(job, 'Build cancelled.');
  } else if (status === 'error') {
    appendLog(job, error ?? 'Build failed.');
  }
}

function createJob(): BuildJob {
  return {
    id: crypto.randomUUID(),
    status: 'running',
    logs: [],
    logOffset: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    code: null,
    error: null,
    cancelRequested: false,
    process: null
  };
}

export function createBuildManager(): BuildManager {
  const jobs = new Map<string, BuildJob>();
  let activeJobId: string | null = null;

  async function startBuild(payload: BuildStartRequest): Promise<BuildStartResponse> {
    if (activeJobId) {
      throw new BuildError('Another build is already running.');
    }

    const projectPath = payload.projectPath.trim();
    const enginePath = payload.unrealEnginePath.trim();

    if (!projectPath) {
      throw new BuildError('Project path is empty.');
    }

    if (!enginePath) {
      throw new BuildError('Unreal Engine path is empty.');
    }

    if (!(await pathExists(projectPath))) {
      throw new BuildError('Project path does not exist.');
    }

    if (!(await pathExists(enginePath))) {
      throw new BuildError('Unreal Engine path does not exist.');
    }

    const targetName = await resolveTargetName(projectPath);
    const ubtPath = buildUbtPath(enginePath);

    if (!(await pathExists(ubtPath))) {
      throw new BuildError('UnrealBuildTool not found.');
    }

    const job = createJob();
    jobs.set(job.id, job);
    activeJobId = job.id;

    const projectArg = `-Project=${projectPath}`;
    appendLog(job, `Starting build for ${targetName}...`);
    appendLog(
      job,
      `Command: dotnet "${ubtPath}" ${targetName} Win64 Development ${projectArg} -WaitMutex`
    );

    const child = spawn(
      'dotnet',
      [ubtPath, targetName, 'Win64', 'Development', projectArg, '-WaitMutex'],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    job.process = child;

    const stdoutReader = readline.createInterface({ input: child.stdout });
    stdoutReader.on('line', (line) => appendLog(job, line));

    const stderrReader = readline.createInterface({ input: child.stderr });
    stderrReader.on('line', (line) => appendLog(job, line));

    child.on('error', (error) => {
      finalizeJob(job, 'error', null, error.message);
      activeJobId = null;
    });

    child.on('close', (code) => {
      if (job.cancelRequested) {
        finalizeJob(job, 'cancelled', code ?? null, 'Build cancelled.');
        activeJobId = null;
        return;
      }

      if (code === 0) {
        finalizeJob(job, 'success', code, null);
      } else {
        finalizeJob(job, 'error', code ?? null, `Build failed with exit code ${code ?? 'unknown'}.`);
      }
      activeJobId = null;
    });

    return { buildId: job.id };
  }

  function getStatus(buildId: string): BuildStatus | null {
    const job = jobs.get(buildId);
    if (!job) {
      return null;
    }

    return {
      status: job.status,
      code: job.code,
      error: job.error,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt
    };
  }

  function getLogs(buildId: string, from: number): BuildLogsResponse | null {
    const job = jobs.get(buildId);
    if (!job) {
      return null;
    }

    const startIndex = Math.max(0, from - job.logOffset);
    const lines = startIndex < job.logs.length ? job.logs.slice(startIndex) : [];

    return {
      lines,
      nextIndex: job.logOffset + job.logs.length,
      finished: job.status !== 'running'
    };
  }

  async function cancelBuild(buildId: string): Promise<boolean> {
    const job = jobs.get(buildId);
    if (!job || job.status !== 'running' || !job.process) {
      return false;
    }

    job.cancelRequested = true;
    appendLog(job, 'Cancel requested.');

    const killed = job.process.kill();
    if (!killed) {
      appendLog(job, 'Failed to stop build process.');
      finalizeJob(job, 'error', null, 'Failed to stop build process.');
      activeJobId = null;
    }

    return killed;
  }

  return {
    startBuild,
    getStatus,
    getLogs,
    cancelBuild
  };
}
