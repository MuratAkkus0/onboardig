import { useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ControlProps {
  id: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
}

interface FormFieldProps {
  label: string;
  /** Already translated error text. */
  error?: string;
  description?: string;
  className?: string;
  /** Render prop: spread the received props onto the input so label and messages are linked. */
  children: (control: ControlProps) => React.ReactNode;
}

/** Label + control + description + error, wired with id / aria-describedby / aria-invalid. */
export function FormField({ label, error, description, className, children }: FormFieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
