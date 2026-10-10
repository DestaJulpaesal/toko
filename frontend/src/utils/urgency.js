export function getUrgencyState(deadline) {
  const targetTime = new Date(deadline).getTime();
  const diffMs = Math.max(targetTime - Date.now(), 0);
  const totalSeconds = Math.floor(diffMs / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    isActive: diffMs > 0,
    days,
    hours,
    minutes,
    seconds,
    parts: { days, hours, minutes, seconds },
  };
}
