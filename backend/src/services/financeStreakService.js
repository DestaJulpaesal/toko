import prisma from '../config/db.js';

function dateStart(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function updateFinanceLoggingStreak(userId, client = prisma, loggedAt = new Date()) {
  if (!userId) return null;
  const today = dateStart(loggedAt);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const existing = await client.financeLoggingStreak.findUnique({ where: { userId } });
  if (!existing) {
    return client.financeLoggingStreak.create({ data: { userId, currentStreak: 1, longestStreak: 1, totalDaysLogged: 1, lastLoggedDate: today } });
  }
  if (existing.lastLoggedDate && dateStart(existing.lastLoggedDate).getTime() === today.getTime()) return existing;
  const currentStreak = existing.lastLoggedDate && dateStart(existing.lastLoggedDate).getTime() === yesterday.getTime()
    ? existing.currentStreak + 1
    : 1;
  return client.financeLoggingStreak.update({
    where: { userId },
    data: { currentStreak, longestStreak: Math.max(existing.longestStreak, currentStreak), totalDaysLogged: { increment: 1 }, lastLoggedDate: today },
  });
}
