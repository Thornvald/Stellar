// Unreal Engine install detector for common install locations.
import { promises as fs } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { EngineInstall } from '@stellar/shared';

type Candidate = {
  name: string;
  path: string;
  versionHint?: string | null;
};

type LauncherInstallRecord = {
  InstallLocation?: string;
  AppName?: string;
  AppVersion?: string;
  DisplayName?: string;
};

const WINDOWS_BASE_DIRS = [
  process.env.PROGRAMFILES,
  process.env['PROGRAMFILES(X86)']
]
  .filter((value): value is string => Boolean(value))
  .map((base) => path.join(base, 'Epic Games'));

const WINDOWS_MANIFEST_DIR = path.join(
  process.env.ProgramData ?? 'C:\\ProgramData',
  'Epic',
  'EpicGamesLauncher',
  'Data',
  'Manifests'
);

const WINDOWS_LAUNCHER_PATHS = [
  path.join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'UnrealEngineLauncher', 'LauncherInstalled.dat'),
  path.join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'LauncherInstalled.dat')
];

const DARWIN_BASE_DIRS = [
  path.join('/Users', 'Shared', 'Epic Games'),
  path.join(os.homedir(), 'Epic Games')
];

const LINUX_BASE_DIRS = [
  path.join(os.homedir(), 'Epic Games'),
  path.join(os.homedir(), '.local', 'share', 'Epic Games'),
  path.join('/opt', 'Epic Games')
];

// Directory names to skip - these are not UE installations
const SKIP_DIRECTORY_NAMES = new Set([
  'launcher',
  'epicgameslauncher',
  'epic games launcher',
  'epic online services',
  'directxredist',
  'vcredist'
]);

function getBaseDirs(): string[] {
  if (process.platform === 'win32') {
    return WINDOWS_BASE_DIRS;
  }
  if (process.platform === 'darwin') {
    return DARWIN_BASE_DIRS;
  }
  return LINUX_BASE_DIRS;
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch (err) {
    return false;
  }
}

function shouldSkipDirectory(name: string): boolean {
  return SKIP_DIRECTORY_NAMES.has(name.toLowerCase());
}

async function listCandidates(baseDir: string): Promise<Candidate[]> {
  try {
    if (!(await dirExists(baseDir))) {
      return [];
    }

    const entries: Dirent[] = await fs.readdir(baseDir, { withFileTypes: true });
    return entries
      .filter((entry: Dirent) => entry.isDirectory() && !shouldSkipDirectory(entry.name))
      .map((entry: Dirent) => ({
        name: entry.name,
        path: path.join(baseDir, entry.name),
        versionHint: parseVersionFromName(entry.name)
      }));
  } catch (err) {
    console.warn(`Failed to list candidates in ${baseDir}:`, err);
    return [];
  }
}

function parseVersionFromName(name: string): string | null {
  const match = name.match(/UE[_-]([0-9]+(?:\.[0-9]+)*)/i);
  if (match && match[1]) {
    return match[1];
  }
  const generic = name.match(/([0-9]+(?:\.[0-9]+)*)/);
  if (generic && generic[1]) {
    return generic[1];
  }
  return null;
}

function compareVersionsDesc(a: string | null, b: string | null): number {
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  const aParts = a.split('.').map((part) => Number.parseInt(part, 10));
  const bParts = b.split('.').map((part) => Number.parseInt(part, 10));
  const max = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < max; i += 1) {
    const aValue = aParts[i] ?? 0;
    const bValue = bParts[i] ?? 0;
    if (aValue !== bValue) {
      return bValue - aValue;
    }
  }
  return 0;
}

async function isEngineRoot(candidatePath: string): Promise<boolean> {
  // Check for Engine/ subdirectory
  const engineDir = path.join(candidatePath, 'Engine');
  if (!(await dirExists(engineDir))) {
    return false;
  }

  // Verify it's actually a UE installation by checking for key markers
  // UE has Engine/Binaries and Engine/Build directories
  const binariesDir = path.join(engineDir, 'Binaries');
  const buildDir = path.join(engineDir, 'Build');

  const hasBinaries = await dirExists(binariesDir);
  const hasBuild = await dirExists(buildDir);

  return hasBinaries || hasBuild;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    return null;
  }
}

function formatLabel(name: string, version: string | null): string {
  if (version) {
    return `Unreal Engine ${version}`;
  }
  if (name) {
    return `Unreal Engine (${name})`;
  }
  return 'Unreal Engine';
}

async function listManifestCandidates(): Promise<Candidate[]> {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    if (!(await dirExists(WINDOWS_MANIFEST_DIR))) {
      return [];
    }

    const entries = await fs.readdir(WINDOWS_MANIFEST_DIR, { withFileTypes: true });
    const manifests = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.item'));
    const candidates: Candidate[] = [];

    for (const entry of manifests) {
      try {
        const filePath = path.join(WINDOWS_MANIFEST_DIR, entry.name);
        const data = await readJsonFile<LauncherInstallRecord>(filePath);
        if (!data || !data.InstallLocation) {
          continue;
        }
        const name = data.DisplayName || data.AppName || path.basename(data.InstallLocation);
        candidates.push({
          name,
          path: data.InstallLocation,
          versionHint: data.AppVersion ?? parseVersionFromName(name)
        });
      } catch (err) {
        console.warn(`Failed to read manifest ${entry.name}:`, err);
      }
    }

    return candidates;
  } catch (err) {
    console.warn('Failed to list manifest candidates:', err);
    return [];
  }
}

async function listLauncherCandidates(): Promise<Candidate[]> {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    for (const launcherPath of WINDOWS_LAUNCHER_PATHS) {
      try {
        const data = await readJsonFile<{ InstallationList?: LauncherInstallRecord[] }>(launcherPath);
        if (!data || !Array.isArray(data.InstallationList)) {
          continue;
        }
        return data.InstallationList
          .filter((entry) => Boolean(entry.InstallLocation))
          .map((entry) => {
            const name =
              entry.DisplayName || entry.AppName || path.basename(entry.InstallLocation ?? 'Unreal Engine');
            return {
              name,
              path: entry.InstallLocation ?? '',
              versionHint: entry.AppVersion ?? parseVersionFromName(name)
            };
          });
      } catch (err) {
        console.warn(`Failed to read launcher file ${launcherPath}:`, err);
      }
    }
  } catch (err) {
    console.warn('Failed to list launcher candidates:', err);
  }

  return [];
}

export async function detectUnrealEngineInstalls(): Promise<EngineInstall[]> {
  const baseDirs = getBaseDirs();
  const candidates: Candidate[] = [];

  // Collect candidates from base directories
  for (const baseDir of baseDirs) {
    try {
      const discovered = await listCandidates(baseDir);
      candidates.push(...discovered);
    } catch (err) {
      console.warn(`Failed to scan base directory ${baseDir}:`, err);
    }
  }

  // Collect candidates from Windows manifests
  try {
    const manifestCandidates = await listManifestCandidates();
    candidates.push(...manifestCandidates);
  } catch (err) {
    console.warn('Failed to scan manifest candidates:', err);
  }

  // Collect candidates from Windows launcher files
  try {
    const launcherCandidates = await listLauncherCandidates();
    candidates.push(...launcherCandidates);
  } catch (err) {
    console.warn('Failed to scan launcher candidates:', err);
  }

  const installs: EngineInstall[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    try {
      // Skip known non-engine directories by name
      const dirName = path.basename(candidate.path);
      if (shouldSkipDirectory(dirName)) {
        continue;
      }

      // Normalize path for deduplication
      const normalizedPath = path.normalize(candidate.path);
      if (seen.has(normalizedPath)) {
        continue;
      }
      if (!(await isEngineRoot(candidate.path))) {
        continue;
      }

      const version = candidate.versionHint ?? parseVersionFromName(candidate.name);
      const label = formatLabel(candidate.name, version);
      installs.push({
        id: normalizedPath,
        name: label,
        path: normalizedPath,
        version
      });
      seen.add(normalizedPath);
    } catch (err) {
      console.warn(`Failed to validate candidate ${candidate.path}:`, err);
    }
  }

  installs.sort((a, b) => compareVersionsDesc(a.version, b.version));
  return installs;
}
