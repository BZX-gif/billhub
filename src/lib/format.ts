/** Indian-English date/time helpers (all local time, no timezone surprises). */

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_FORMAT.format(date);
}

export function formatTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  return TIME_FORMAT.format(date);
}

export function formatDateTime(input: string | Date): string {
  return `${formatDate(input)}, ${formatTime(input)}`;
}

export function localDayKey(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDayKey(now = new Date()): string {
  return localDayKey(now);
}

export function addDays(date: Date, delta: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + delta);
  return copy;
}

export function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function dayKeyRange(preset: "today" | "7d" | "30d" | "month", now = new Date()): {
  from: string;
  to: string;
} {
  const to = localDayKey(now);
  if (preset === "today") return { from: to, to };
  if (preset === "7d") return { from: localDayKey(addDays(now, -6)), to };
  if (preset === "30d") return { from: localDayKey(addDays(now, -29)), to };
  return { from: localDayKey(startOfMonth(now)), to };
}

export function isDayKeyInRange(iso: string, from: string, to: string): boolean {
  const key = localDayKey(iso);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function relativeDayLabel(input: string, now = new Date()): string {
  const key = localDayKey(input);
  const today = localDayKey(now);
  const yesterday = localDayKey(addDays(now, -1));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return formatDate(input);
}

export function truncate(value: string, max = 80): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}
