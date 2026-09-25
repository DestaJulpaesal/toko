import prisma from '../src/config/db.js';

async function seedUsers() {
  console.log('Seeding user accounts...');

  const usersToCreate = [
    {
      name: 'Owner Glosir',
      email: 'owner@glosir.com',
      password: 'Glosir2026!',
      role: 'OWNER',
      phone: '081234567890',
    },
    {
      name: 'Admin Glosir',
      email: 'admin@glosir.com',
      password: 'Glosir2026!',
      role: 'ADMIN',
      phone: '081234567891',
    },
    {
      name: 'Kasir Glosir',
      email: 'kasir@glosir.com',
      password: 'Glosir2026!',
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
