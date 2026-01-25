// Copies resources to the release folder for standalone exe testing
import { copyFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resourcesSource = path.join(rootDir, 'src-tauri', 'resources');
const releaseDir = path.join(rootDir, 'src-tauri', 'target', 'release');
const resourcesTarget = path.join(releaseDir, 'resources');

try {
  await mkdir(resourcesTarget, { recursive: true });
  await cp(resourcesSource, resourcesTarget, { recursive: true });
  console.log(`Synced resources to ${resourcesTarget}`);
} catch (error) {
  console.error('Failed to sync resources to release folder:', error.message);
  process.exit(1);
}
