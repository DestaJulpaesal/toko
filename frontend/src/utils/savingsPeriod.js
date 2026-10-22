const CADENCE_DAYS = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 365.2425 / 12,
  YEARLY: 365.2425,
};

const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function getSavingsPeriodRange(period, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = period === 'month'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === 'year'
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
  const elapsedDays = Math.floor((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1;

  return { start: toDateKey(start), end: toDateKey(end), elapsedDays };
}

export function getExpectedSavingsAmount(amount, frequency, elapsedDays) {
  const cadenceDays = CADENCE_DAYS[frequency] || CADENCE_DAYS.DAILY;
  return Number(amount || 0) * elapsedDays / cadenceDays;
}

export function getSavingsDepositsInRange(deposits, range) {
  return deposits.filter((deposit) => {
    const date = (deposit.date || deposit.depositDate || '').slice(0, 10);
    return date >= range.start && date <= range.end;
  });
}
