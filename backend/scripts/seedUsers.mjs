import prisma from '../src/config/db.js';
import { randomBytes } from 'node:crypto';

if (process.env.NODE_ENV === 'production') {
  console.error('seedUsers tidak boleh dijalankan pada NODE_ENV=production.');
  process.exit(1);
}

const seedPassword = process.env.SEED_DEFAULT_PASSWORD || randomBytes(24).toString('base64url');
if (!process.env.SEED_DEFAULT_PASSWORD) {
  console.log(`Password seed sementara (catat sekarang, tidak disimpan kembali): ${seedPassword}`);
}

async function seedUsers() {
  console.log('Seeding user accounts...');

  const usersToCreate = [
    {
      name: 'Owner Glosir',
      email: 'owner@glosir.com',
      password: seedPassword,
      role: 'OWNER',
      phone: '081234567890',
    },
    {
      name: 'Admin Glosir',
      email: 'admin@glosir.com',
      password: seedPassword,
      role: 'ADMIN',
      phone: '081234567891',
    },
    {
      name: 'Kasir Glosir',
      email: 'kasir@glosir.com',
      password: seedPassword,
      role: 'CASHIER',
      phone: '081234567892',
    },
  ];

  for (const u of usersToCreate) {
    const hashRows = await prisma.$queryRaw`SELECT crypt(${u.password}, gen_salt('bf')) AS hash`;
    const passwordHash = hashRows[0].hash;

    const existingUser = await prisma.user.findUnique({ where: { email: u.email } });

    if (existingUser) {
      await prisma.user.update({
        where: { email: u.email },
        data: {
          name: u.name,
          role: u.role,
          phone: u.phone,
          passwordHash: passwordHash,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`Updated user: ${u.email}`);
    } else {
      await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          passwordHash: passwordHash,
          role: u.role,
          phone: u.phone,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`Created user: ${u.email}`);
    }
  }

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  console.log('\nCurrent users in database:', allUsers);
}

seedUsers()
  .catch((e) => {
    console.error('Error seeding users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
