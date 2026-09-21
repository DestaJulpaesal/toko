import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strongPasswordSchema } from '../src/middleware/security.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(backendDir, '..');
const loginSource = fs.readFileSync(path.join(rootDir, 'frontend/src/pages/LoginPage.jsx'), 'utf8');
const seedSource = fs.readFileSync(path.join(backendDir, 'prisma/supabase-seed.sql'), 'utf8');
const packSource = fs.readFileSync(path.join(backendDir, 'scripts/pack.mjs'), 'utf8');
const seedScript = path.join(backendDir, 'scripts/seedDemo.mjs');

assert.match(loginSource, /useState\(\{ email: '', password: '', rememberMe: false \}\)/);
assert.doesNotMatch(loginSource, /cashier@glosir\.com|owner@glosir\.com|Password demo|handleSelectDemo/);
assert.match(seedSource, /app\.glossir_seed_environment/);
assert.match(seedSource, /development/);
assert.match(packSource, /node_modules/);
assert.match(packSource, /backups/);
assert.match(packSource, /uploads/);
const productionSeed = spawnSync(process.execPath, [seedScript], { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' });
assert.equal(productionSeed.status, 1);
assert.match(`${productionSeed.stdout}${productionSeed.stderr}`, /tidak boleh dijalankan di production/i);
assert.equal(strongPasswordSchema.safeParse('12345678').success, false);
assert.equal(strongPasswordSchema.safeParse('Toko-Aman-2026!').success, true);

console.log('Phase 0 security checks passed.');
