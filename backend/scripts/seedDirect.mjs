import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('Seeding database from supabase-seed.sql...');
  const seedPath = path.join(__dirname, '..', 'prisma', 'supabase-seed.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');

  // Remove the DO block check for environment setting
  const cleanedSql = sql.replace(/do \$\$[\s\S]*?end \$\$;/gi, '');
  
  // Split statements by semicolon
  const statements = cleanedSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch (err) {
      console.error('Error executing statement:', err.message);
    }
  }

  const pCount = await prisma.product.count();
  const cCount = await prisma.category.count();
  const parcelCount = await prisma.parcel.count();
  console.log(`Database seeded successfully! Products: ${pCount}, Categories: ${cCount}, Parcels: ${parcelCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
