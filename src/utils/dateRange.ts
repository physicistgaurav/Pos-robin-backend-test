// utils/dateRange.ts

export type RangeMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface DateRange {
  from: string;
  to:   string;
  mode: RangeMode | 'custom';
}

const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000; // UTC+5:45

/** Convert a UTC Date to what the clock shows in NPT */
function toNPTWallClock(utcDate: Date): Date {
  return new Date(utcDate.getTime() + NPT_OFFSET_MS);
}

/** Given a Date that represents a wall-clock time in NPT, convert back to UTC */
function fromNPTWallClock(nptWall: Date): Date {
  return new Date(nptWall.getTime() - NPT_OFFSET_MS);
}

/**
 * Returns a Date (in UTC) that corresponds to 00:00:00.000 NPT
 * on the same calendar day as the given UTC instant.
 */
function startOfNPTDay(utcDate: Date): Date {
  const npt = toNPTWallClock(utcDate);
  npt.setUTCHours(0, 0, 0, 0);          // zero out time while still in NPT wall-clock space
  return fromNPTWallClock(npt);
}

/**
 * Returns a Date (in UTC) that corresponds to 23:59:59.999 NPT
 * on the same calendar day as the given UTC instant.
 */
function endOfNPTDay(utcDate: Date): Date {
  const npt = toNPTWallClock(utcDate);
  npt.setUTCHours(23, 59, 59, 999);
  return fromNPTWallClock(npt);
}

/** Add/subtract calendar days in NPT space */
function addNPTDays(utcDate: Date, days: number): Date {
  const npt = toNPTWallClock(utcDate);
  npt.setUTCDate(npt.getUTCDate() + days);
  return fromNPTWallClock(npt);
}

/**
 * Query params arrive here as Date objects (Joi.date() converts them), but may
 * also be plain strings. A date-only value ("2026-10-01", i.e. exactly UTC
 * midnight) names a Kathmandu CALENDAR DAY; anything with a real time of day is
 * an exact instant.
 */
type DateInput = string | Date;
function parseDateInput(x: DateInput): { date: Date; dateOnly: boolean } {
  if (typeof x === 'string') {
    const date = new Date(x.trim());
    if (isNaN(date.getTime())) throw new Error(`Invalid date: ${x}`);
    return { date, dateOnly: /^\d{4}-\d{2}-\d{2}$/.test(x.trim()) };
  }
  if (isNaN(x.getTime())) throw new Error('Invalid date');
  const dateOnly =
    x.getUTCHours() === 0 && x.getUTCMinutes() === 0 && x.getUTCSeconds() === 0 && x.getUTCMilliseconds() === 0;
  return { date: x, dateOnly };
}

/** Start of the Kathmandu day (as a UTC ISO instant) for a date-only value, or for the day containing an instant */
export function nptDayStartUTC(input: DateInput): string {
  const { date, dateOnly } = parseDateInput(input);
  if (dateOnly) {
    return fromNPTWallClock(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))).toISOString();
  }
  return startOfNPTDay(date).toISOString();
}

/** End (23:59:59.999) of the Kathmandu day (as a UTC ISO instant) for a date-only value, or for the day containing an instant */
export function nptDayEndUTC(input: DateInput): string {
  const { date, dateOnly } = parseDateInput(input);
  if (dateOnly) {
    return fromNPTWallClock(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))).toISOString();
  }
  return endOfNPTDay(date).toISOString();
}

/** Last N full Kathmandu days ending now: from = NPT 00:00 (N-1 days ago), to = now */
export function lastNNPTDays(n: number): { from: string; to: string } {
  const now = new Date();
  return {
    from: startOfNPTDay(addNPTDays(now, -(n - 1))).toISOString(),
    to: now.toISOString(),
  };
}

/** Today in Kathmandu: from = NPT 00:00 today, to = now */
export function todayNPT(): { from: string; to: string } {
  const now = new Date();
  return {
    from: startOfNPTDay(now).toISOString(),
    to: now.toISOString(),
  };
}

export function resolveDateRange(
  mode:        RangeMode | undefined,
  customFrom?: DateInput,
  customTo?:   DateInput,
): DateRange {
  const now = new Date();

  // ── Custom range ───────────────────────────────────────────────────────
  // Date-only values (2026-10-01) are Kathmandu calendar days: from = 00:00 NPT,
  // to = 23:59:59.999 NPT. Full timestamps are used exactly as given.
  if (customFrom && customTo) {
    const f = parseDateInput(customFrom);
    const t = parseDateInput(customTo);
    return {
      from: f.dateOnly ? nptDayStartUTC(customFrom) : f.date.toISOString(),
      to:   t.dateOnly ? nptDayEndUTC(customTo)     : t.date.toISOString(),
      mode: 'custom',
    };
  }

  // 'custom' without from/to (allowed by one validator) falls back to weekly
  const effectiveMode: RangeMode = mode && mode !== ('custom' as any) ? mode : 'weekly';

  switch (effectiveMode) {

    // ── Daily: 00:00:00 NPT today → now ───────────────────────────────────
    case 'daily': {
      return {
        from: startOfNPTDay(now).toISOString(),
        to:   now.toISOString(),
        mode: 'daily',
      };
    }

    // ── Weekly: Sunday 00:00 NPT → min(Saturday 23:59 NPT, now) ──────────
    case 'weekly': {
      const nptNow    = toNPTWallClock(now);
      const dayOfWeek = nptNow.getUTCDay();          // 0 = Sunday in NPT

      // Roll back to Sunday in NPT space
      const nptSunday = new Date(nptNow);
      nptSunday.setUTCDate(nptNow.getUTCDate() - dayOfWeek);
      nptSunday.setUTCHours(0, 0, 0, 0);

      const sunday = fromNPTWallClock(nptSunday);

      // Saturday = Sunday + 6 days, end of that NPT day
      const saturdayUTC = addNPTDays(sunday, 6);
      const saturday    = endOfNPTDay(saturdayUTC);

      return {
        from: sunday.toISOString(),
        to:   (saturday > now ? now : saturday).toISOString(),
        mode: 'weekly',
      };
    }

    // ── Monthly: 1st of NPT month 00:00 → min(last day 23:59 NPT, now) ───
    case 'monthly': {
      const nptNow = toNPTWallClock(now);

      const nptFirst = new Date(nptNow);
      nptFirst.setUTCDate(1);
      nptFirst.setUTCHours(0, 0, 0, 0);

      const firstOfMonth = fromNPTWallClock(nptFirst);

      // Last day: go to first of next month, subtract 1 day
      const nptLastDay = new Date(nptNow);
      nptLastDay.setUTCMonth(nptNow.getUTCMonth() + 1, 0); // day 0 of next month = last day of this month
      nptLastDay.setUTCHours(23, 59, 59, 999);

      const lastOfMonth = fromNPTWallClock(nptLastDay);

      return {
        from: firstOfMonth.toISOString(),
        to:   (lastOfMonth > now ? now : lastOfMonth).toISOString(),
        mode: 'monthly',
      };
    }

    // ── Yearly: Jan 1 00:00 NPT → min(Dec 31 23:59 NPT, now) ─────────────
    case 'yearly': {
      const nptNow = toNPTWallClock(now);
      const year   = nptNow.getUTCFullYear();

      const nptJan1 = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const jan1    = fromNPTWallClock(nptJan1);

      const nptDec31 = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      const dec31    = fromNPTWallClock(nptDec31);

      return {
        from: jan1.toISOString(),
        to:   (dec31 > now ? now : dec31).toISOString(),
        mode: 'yearly',
      };
    }
  }
}