import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { APP_CONFIG, F2B_CONFIG } from "@/config/app";

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Interprets the value of an `<input type="datetime-local">` ("2026-03-29T14:30") as wall-clock
 * time in Europe/Berlin and returns the matching instant. Returns null for malformed input.
 */
export function parseBerlinLocal(value: string): Date | null {
  const match = LOCAL_INPUT.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const zoned = new TZDate(year, month - 1, day, hour, minute, 0, APP_CONFIG.i18n.timeZone);
  if (Number.isNaN(zoned.getTime())) return null;
  // Reject values the calendar rolled over (e.g. 2026-02-31).
  if (zoned.getMonth() !== month - 1 || zoned.getDate() !== day) return null;
  return new Date(zoned.getTime());
}

/** Formats an instant as the `datetime-local` value (Europe/Berlin wall-clock time). */
export function toBerlinLocalInput(date: Date): string {
  return format(new TZDate(date, APP_CONFIG.i18n.timeZone), F2B_CONFIG.dateTime.localInputFormat);
}
