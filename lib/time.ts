// Format timestamp to UTC string (date + hour only)
export function formatUTC(timestamp: number): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp * 1000);
  return date.toISOString().replace("T", " ").slice(0, 13) + ":00 UTC";
}

// Format timestamp to short UTC (date only)
export function formatUTCDate(timestamp: number): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp * 1000);
  return date.toISOString().slice(0, 10);
}

// Format timestamp to UTC time only (hour only)
export function formatUTCTime(timestamp: number): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp * 1000);
  return date.toISOString().slice(11, 13) + ":00 UTC";
}

// Format Date to UTC display
export function dateToUTC(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
