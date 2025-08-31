export function formatTimeInterval(start: string, end: string): string {
  if (!start || !end) return '';
  const startDate = new Date(`1970-01-01T${start}`);
  const endDate = new Date(`1970-01-01T${end}`);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';
  const diffMs = endDate.getTime() - startDate.getTime();
  const sign = diffMs < 0 ? '-' : '';
  const absMs = Math.abs(diffMs);
  const totalMinutes = Math.floor(absMs / 60000);
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}
