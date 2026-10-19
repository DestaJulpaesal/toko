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
		if ((url.hostname.includes('pooler.supabase.com') || url.port === '6543') && !url.searchParams.has('pgbouncer')) {
			url.searchParams.set('pgbouncer', 'true');
		}
		return url.toString();
	} catch {
		return value;
	}
}

process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);

const logSlowQueries = process.env.NODE_ENV !== 'production' || process.env.LOG_SLOW_QUERIES === 'true';
const prisma = new PrismaClient({
	log: [
		'warn',
		'error',
		...(logSlowQueries ? [{ emit: 'event', level: 'query' }] : []),
	],
	datasources: { db: { url: process.env.DATABASE_URL } },
});

if (logSlowQueries) {
	prisma.$on('query', (event) => {
		if (event.duration > 200) {
			console.warn(`[slow-query] ${event.duration}ms target=${event.target}`);
		}
	});
}

process.on('beforeExit', async () => {
	await prisma.$disconnect();
});

export default prisma;
