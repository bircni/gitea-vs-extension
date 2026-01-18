// ...existing code...
import { formatDuration, formatRelativeTime, shortSha } from "../util/time";

test("formatRelativeTime handles undefined and invalid input", () => {
  expect(formatRelativeTime(undefined)).toBeUndefined();
  expect(formatRelativeTime("not-a-date")).toBeUndefined();
});

test("formatRelativeTime uses seconds and minutes", () => {
  const originalNow = Date.now;
  Date.now = () => new Date("2024-01-01T00:00:10Z").getTime();
  try {
    expect(formatRelativeTime("2024-01-01T00:00:05Z")).toBe("5s ago");
    expect(formatRelativeTime("2024-01-01T00:00:00Z")).toBe("10s ago");
    expect(formatRelativeTime("2023-12-31T23:59:00Z")).toBe("1m ago");
  } finally {
    Date.now = originalNow;
  }
});

test("formatDuration formats seconds, minutes, and hours", () => {
  expect(formatDuration("2024-01-01T00:00:00Z", "2024-01-01T00:00:30Z")).toBe("30s");
  expect(formatDuration("2024-01-01T00:00:00Z", "2024-01-01T00:01:30Z")).toBe("1m");
  expect(formatDuration("2024-01-01T00:00:00Z", "2024-01-01T01:00:00Z")).toBe("1h");
});

test("formatDuration handles missing end time", () => {
  const duration = formatDuration("2024-01-01T00:00:00Z");
  expect(duration).toBeTruthy();
  expect(duration).toMatch(/^\d+(s|m|h)$/);
});

test("formatDuration returns undefined for invalid dates", () => {
  expect(formatDuration("not-a-date", "2024-01-01T00:00:00Z")).toBeUndefined();
});

test("shortSha returns a 7-character prefix", () => {
  expect(shortSha(undefined)).toBeUndefined();
  expect(shortSha("abcdef123456")).toBe("abcdef1");
});
