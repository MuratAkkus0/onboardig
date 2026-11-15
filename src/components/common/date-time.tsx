import { useFormatter } from "next-intl";

interface DateTimeProps {
  value: Date | string;
  /** "date" for date-only values, "dateTime" (default) for instants. */
  variant?: "date" | "dateTime";
}

/** Renders an instant in Europe/Berlin (time zone comes from the next-intl request config). */
export function DateTime({ value, variant = "dateTime" }: DateTimeProps) {
  const format = useFormatter();
  const date = typeof value === "string" ? new Date(value) : value;
  const formatted =
    variant === "date"
      ? format.dateTime(date, { dateStyle: "medium" })
      : format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });
  return <time dateTime={date.toISOString()}>{formatted}</time>;
}
