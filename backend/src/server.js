import 'dotenv/config';
import app from './app.js';
import prisma from './config/db.js';
import { startNightlyRecap } from './jobs/nightlyRecap.js';
import { startRecurringJob } from './jobs/recurringJob.js';
import { startReminderJob } from './jobs/reminderJob.js';
import { startDailyLoggingReminderJob } from './jobs/dailyLoggingReminder.js';
import { startBackupJob } from './jobs/backupJob.js';
import { startEmailNotificationJob } from './jobs/emailNotificationJob.js';
import { startExpiryNotificationJob } from './jobs/expiryNotificationJob.js';
import { initializeEmailService } from './services/emailService.js';
import { warmHomepageCache } from './services/homepageHandler.js';

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
    warmHomepageCache(prisma).catch((error) => {
      console.error('Homepage startup prefetch failed:', error.message);
    });
    startNightlyRecap();
    startRecurringJob();
    startReminderJob();
    startDailyLoggingReminderJob();
    startBackupJob();
    initializeEmailService();
    startEmailNotificationJob();
    startExpiryNotificationJob();
  });
}

startServer();
