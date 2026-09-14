import 'dotenv/config';
import app from './app.js';
import prisma from './config/db.js';
import { startNightlyRecap } from './jobs/nightlyRecap.js';
import { startRecurringJob } from './jobs/recurringJob.js';
import { startReminderJob } from './jobs/reminderJob.js';
import { startDailyLoggingReminderJob } from './jobs/dailyLoggingReminder.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET wajib di-set di environment variable');
  }
  try {
    await prisma.$connect();
    console.log('Database connection ready');
  } catch (error) {
    console.warn(`Database warm-up failed: ${error.message}`);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startNightlyRecap();
    startRecurringJob();
    startReminderJob();
    startDailyLoggingReminderJob();
  });
}

startServer();
