import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const releaseDir = path.join(root, 'release');
const stagingDir = path.join(releaseDir, 'glosir');
const archivePath = path.join(releaseDir, `glosir-release-${new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')}.zip`);
const excludedNames = new Set(['.git', 'node_modules', 'dist', 'release', 'backups', 'uploads']);

async function copyClean(source, destination) {
  const entries = await fs.readdir(source, { withFileTypes: true });
  await fs.mkdir(destination, { recursive: true });
  for (const entry of entries) {
    if (excludedNames.has(entry.name) || entry.name === '.env' || entry.name.startsWith('.env.')) continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyClean(sourcePath, destinationPath);
    else if (entry.isFile()) await fs.copyFile(sourcePath, destinationPath);
  }
}

await fs.rm(releaseDir, { recursive: true, force: true });
await fs.mkdir(releaseDir, { recursive: true });
await copyClean(root, stagingDir);

await execFileAsync('powershell.exe', [
  '-NoProfile', '-NonInteractive', '-Command',
  `Compress-Archive -Path '${stagingDir.replaceAll("'", "''")}\\*' -DestinationPath '${archivePath.replaceAll("'", "''")}' -CompressionLevel Optimal`,
]);

await fs.rm(stagingDir, { recursive: true, force: true });
console.log(`Paket rilis bersih dibuat: ${path.relative(root, archivePath)}`);
