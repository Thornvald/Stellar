import { mkdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const nodePath = process.execPath;

const targetDir = path.join(projectRoot, 'src-tauri', 'resources', 'node');
const targetPath = path.join(targetDir, 'node.exe');

await mkdir(targetDir, { recursive: true });
let copied = false;

try {
  await copyFile(nodePath, targetPath);
  copied = true;
} catch (err) {
  if (err && typeof err === 'object' && 'code' in err && err.code === 'EBUSY') {
    try {
      await stat(targetPath);
      console.warn(`Node runtime is locked; using existing ${targetPath}`);
    } catch {
      throw err;
    }
  } else {
    throw err;
  }
}

if (copied) {
  console.log(`Synced node runtime to ${targetPath}`);
}
