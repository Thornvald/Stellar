// File-based config store for persisted app state.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Config, ProjectConfig } from '@stellar/shared';
import type { ConfigStore } from './types.js';

const APP_FOLDER = 'stellar-ts';
const CONFIG_FILE = 'config.json';

const DEFAULT_CONFIG: Config = {
  projects: [],
  unrealEnginePath: null
};

function getConfigDir(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }

  return process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
}

function getConfigPath(): string {
  return path.join(getConfigDir(), APP_FOLDER, CONFIG_FILE);
}

function normalizeConfig(value: unknown): Config {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_CONFIG };
  }

  const raw = value as Partial<Config>;
  const projects = Array.isArray(raw.projects) ? raw.projects : [];
  const normalizedProjects: ProjectConfig[] = [];

  for (const entry of projects) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    const projectPath = typeof entry.path === 'string' ? entry.path.trim() : '';

    if (name && projectPath) {
      normalizedProjects.push({ name, path: projectPath });
    }
  }

  const unrealEnginePath =
    typeof raw.unrealEnginePath === 'string' && raw.unrealEnginePath.trim()
      ? raw.unrealEnginePath.trim()
      : null;

  return {
    projects: normalizedProjects,
    unrealEnginePath
  };
}

async function ensureDirExists(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export function createConfigStore(): ConfigStore {
  const configPath = getConfigPath();

  return {
    getPath: () => configPath,
    async load() {
      try {
        const contents = await fs.readFile(configPath, 'utf8');
        return normalizeConfig(JSON.parse(contents));
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
          return { ...DEFAULT_CONFIG };
        }

        console.warn('Failed to read config, using defaults.', err);
        return { ...DEFAULT_CONFIG };
      }
    },
    async save(config: Config) {
      await ensureDirExists(configPath);
      const payload = JSON.stringify(normalizeConfig(config), null, 2);
      await fs.writeFile(configPath, payload, 'utf8');
    }
  };
}
