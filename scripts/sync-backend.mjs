import { copyFile, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFile = path.join(rootDir, 'backend', 'dist', 'server.cjs');
const targetDir = path.join(rootDir, 'src-tauri', 'resources', 'backend', 'dist');
const targetFile = path.join(targetDir, 'server.cjs');

try {
  const sourceStat = await stat(sourceFile);
  if (!sourceStat.isFile()) {
    throw new Error('Backend bundle is not a file.');
  }
} catch (error) {
  console.error('Backend bundle not found. Run "npm run build -w backend" first.');
  throw error;
}

await rm(targetDir, { recursive: true, force: true });
await mkdir(path.dirname(targetDir), { recursive: true });
await mkdir(targetDir, { recursive: true });
await copyFile(sourceFile, targetFile);

console.log(`Synced backend bundle to ${targetFile}`);
