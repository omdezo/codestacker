export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function setHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(hours);
  return result;
}

export function setMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(minutes);
  return result;
}

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Returns { gte: start-of-day, lte: end-of-day } for a given date. */
export function dayRange(date: Date | string): { gte: Date; lte: Date } {
  const d = new Date(date);
  return { gte: startOfDay(d), lte: endOfDay(d) };
}

/** Returns { gte: today 00:00, lt: tomorrow 00:00 } for daily limits. */
export function todayRange(): { gte: Date; lt: Date } {
  const start = startOfDay();
  return { gte: start, lt: addDays(start, 1) };
}

/** Returns a Date N days ago from now. */
export function daysAgo(n: number): Date {
  return addDays(new Date(), -n);
}
