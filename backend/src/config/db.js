import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

process.on('beforeExit', async () => {
	await prisma.$disconnect();
});

export default prisma;
