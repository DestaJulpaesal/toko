// Ganti kerangka halaman admin lama dengan <AdminShell>.
// Pakai:  node scripts/migrate-shell.mjs          (dry-run, hanya laporan)
//         node scripts/migrate-shell.mjs --write  (tulis perubahan, backup .bak dibuat)
import fs from 'node:fs';
import path from 'node:path';

const write = process.argv.includes('--write');
const dir = path.resolve('src/pages');
const OPEN = /<div className="admin-shell([^"]*)">\s*<AdminSidebar active=("[^"]*"|\{[^}]*\})\s*\/>\s*<main className="admin-main([^"]*)">/;
const CLOSE = /<\/main>\s*<\/div>/g;

let ok = 0; const manual = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.jsx') && !f.includes('DRAFT'))) {
  const p = path.join(dir, file);
  let src = fs.readFileSync(p, 'utf8');
  if (!src.includes('<AdminSidebar')) continue;
  const m = src.match(OPEN);
  if (!m) { manual.push(file); continue; }
  // hanya 1 pola & 1 penutup yang cocok, kalau tidak -> manual
  const closes = [...src.matchAll(CLOSE)];
  if (src.split('<AdminSidebar').length !== 2 || closes.length < 1) { manual.push(file); continue; }
  const last = closes[closes.length - 1];
  const cls = m[1].replace(/\badmin-shell\b/g, '').trim();
  const mainCls = m[3].trim();
  const props = [`active=${m[2]}`, cls && `className="${cls}"`, mainCls && `mainClassName="${mainCls}"`].filter(Boolean).join(' ');
  let out = src.slice(0, m.index) + `<AdminShell ${props}>` + src.slice(m.index + m[0].length, last.index) + '</AdminShell>' + src.slice(last.index + last[0].length);
  out = out.replace(/import AdminSidebar from '\.\.\/components\/AdminSidebar';?/, "import AdminShell from '../layouts/AdminShell';");
  if (out.includes('<AdminSidebar') || !out.includes("layouts/AdminShell")) { manual.push(file); continue; }
  if (write) { fs.writeFileSync(p + '.bak', src); fs.writeFileSync(p, out); }
  ok++; console.log((write ? 'DIUBAH  ' : 'BISA    ') + file);
}
console.log(`\n${ok} halaman ${write ? 'berhasil diubah' : 'bisa diubah otomatis'}.`);
if (manual.length) console.log('Perlu manual:\n  ' + manual.join('\n  '));
