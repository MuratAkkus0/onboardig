"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = Omit<React.ComponentProps<typeof Button>, "type"> & {
  /** Overrides the form status (for client-side submits that do not use a form action). */
  pending?: boolean;
};

/** Submit button that disables itself and shows a spinner while the form is submitting. */
export function SubmitButton({ pending, children, disabled, ...props }: SubmitButtonProps) {
  const status = useFormStatus();
  const isPending = pending ?? status.pending;
  return (
    <Button type="submit" disabled={disabled || isPending} aria-busy={isPending} {...props}>
      {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}
