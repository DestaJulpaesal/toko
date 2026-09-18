import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ override: true });

function normalizeDatabaseUrl(value) {
	if (!value) return value;

	try {
		const url = new URL(value);
		if (!['postgres:', 'postgresql:'].includes(url.protocol)) return value;
		if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '5');
		if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '20');
		return url.toString();
	} catch {
		return value;
	}
}

process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);

const prisma = new PrismaClient({
	log: ['warn', 'error'],
	datasources: { db: { url: process.env.DATABASE_URL } },
});

process.on('beforeExit', async () => {
	await prisma.$disconnect();
});

export default prisma;
