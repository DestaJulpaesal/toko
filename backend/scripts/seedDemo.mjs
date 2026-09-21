import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV === 'production') {
  console.error('Seed demo tidak boleh dijalankan di production.');
  process.exit(1);
}

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const seedFile = path.join(root, 'backend', 'prisma', 'supabase-seed.sql');
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL atau DIRECT_URL wajib diisi untuk seed development.');
  process.exit(1);
}

const command = spawn('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-c', "select set_config('app.glossir_seed_environment', 'development', false);", '-f', seedFile], {
  stdio: 'inherit',
  shell: false,
});
command.on('error', (error) => {
  console.error(`Seed development gagal dijalankan: ${error.message}`);
  process.exit(1);
});
command.on('exit', (code) => process.exit(code ?? 1));
