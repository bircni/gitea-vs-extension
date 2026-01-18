export function formatRelativeTime(iso?: string): string | undefined {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const deltaMs = Date.now() - date.getTime();
  const seconds = Math.floor(Math.abs(deltaMs) / 1000);

  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4, "w"],
    [12, "mo"],
    [Number.POSITIVE_INFINITY, "y"],
  ];

  let value = seconds;
  let unit = "s";

  for (const [limit, label] of units) {
    if (value < limit) {
      unit = label;
      break;
    }
    value = Math.floor(value / limit);
  }

  const suffix = deltaMs >= 0 ? "ago" : "from now";
  return `${value}${unit} ${suffix}`;
}

export function shortSha(sha?: string): string | undefined {
  if (!sha) {
    return undefined;
  }
  return sha.slice(0, 7);
}

export function formatDuration(start?: string, end?: string): string | undefined {
  if (!start) {
    return undefined;
  }
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return undefined;
  }
  const delta = Math.max(0, endDate.getTime() - startDate.getTime());
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}
