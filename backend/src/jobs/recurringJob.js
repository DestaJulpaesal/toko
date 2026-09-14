import cron from 'node-cron';

export function startRecurringJob() {
  if (process.env.ENABLE_RECURRING_JOB === 'false') return null;
  const apiUrl = process.env.INTERNAL_API_URL || `http://127.0.0.1:${process.env.PORT || 5000}`;
  return cron.schedule('0 1 * * *', async () => {
    if (!process.env.INTERNAL_JOB_KEY) return;
    try {
      const response = await fetch(`${apiUrl}/api/finance/recurring/run-due`, {
        method: 'POST',
        headers: { 'x-internal-key': process.env.INTERNAL_JOB_KEY },
      });
      if (!response.ok) console.error(`Recurring job failed with HTTP ${response.status}`);
    } catch (error) {
      console.error('Recurring job request failed:', error.message);
    }
  });
}
