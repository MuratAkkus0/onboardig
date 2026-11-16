import { useFormatter } from "next-intl";
import { cn } from "@/lib/utils";

/** Mono eyebrow: two-digit index (from section order), a short rule and the label. */
export function Eyebrow({ index, label }: { index: number; label: string }) {
  const format = useFormatter();
  return (
    <p className="inline-flex items-center gap-2.5 font-landing-mono text-xs tracking-[0.08em] uppercase">
      <span className="text-brand tabular-nums">
        {format.number(index, { minimumIntegerDigits: 2 })}
      </span>
      <span aria-hidden className="h-px w-6 bg-border" />
      <span className="text-muted-foreground">{label}</span>
    </p>
  );
}

interface SectionHeadingProps {
  id: string;
  index: number;
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "start" | "center";
  className?: string;
}

/** Eyebrow + H2 + optional lead for the landing sections. */
export function SectionHeading({
  id,
  index,
  eyebrow,
  title,
  lead,
  align = "start",
  className,
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={cn(centered && "mx-auto max-w-3xl text-center", className)}>
      <Eyebrow index={index} label={eyebrow} />
      <h2
        id={id}
        className={cn(
          "mt-4 text-section font-semibold text-balance",
          centered ? "mx-auto" : "max-w-[22ch]",
        )}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={cn(
            "mt-5 max-w-[40rem] text-lg leading-relaxed text-pretty text-muted-foreground md:text-xl",
            centered && "mx-auto",
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}
