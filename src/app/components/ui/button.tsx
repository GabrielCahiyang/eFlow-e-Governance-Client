import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import {
  ActionBlockerStopButton,
  ActionBlockersModal,
  normalizeBlockers,
  type ActionBlockerInput,
} from "./action-blockers";
import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-120 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:ring-2 aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border bg-background text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & {
  asChild?: boolean;
  pending?: boolean;
  disabledReason?: string;
  blockers?: ActionBlockerInput;
  blockerActionLabel?: string;
  blockerCompact?: boolean;
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  className,
  variant,
  size = "default",
  asChild = false,
  pending = false,
  disabledReason,
  blockers,
  blockerActionLabel,
  blockerCompact = false,
  disabled,
  onClick,
  ...props
}, ref) {
  const Comp = asChild ? Slot : "button";
  const unavailable = disabled || pending;
  const reasonId = React.useId();
  const [blockersOpen, setBlockersOpen] = React.useState(false);

  const normalizedBlockers = React.useMemo(
    () => (unavailable && !pending ? normalizeBlockers(blockers ?? disabledReason) : []),
    [unavailable, pending, blockers, disabledReason],
  );
  const hasStopBlocker = normalizedBlockers.length > 0;
  const derivedLabel =
    blockerActionLabel ||
    (typeof props["aria-label"] === "string" && props["aria-label"]) ||
    (typeof props.children === "string" ? props.children : "this action");

  const buttonNode = (
    <Comp
      {...props}
      ref={ref}
      data-slot="button"
      data-size={size}
      disabled={unavailable}
      aria-disabled={unavailable || undefined}
      aria-busy={pending || undefined}
      aria-describedby={unavailable && disabledReason ? [props["aria-describedby"], reasonId].filter(Boolean).join(" ") : props["aria-describedby"]}
      title={hasStopBlocker ? props.title : unavailable ? disabledReason || props.title : props.title}
      onClick={(event) => { if (unavailable) { event.preventDefault(); return; } onClick?.(event); }}
      className={cn(buttonVariants({ variant, size, className }))}
    />
  );

  if (!hasStopBlocker) {
    return (
      <>
        {buttonNode}
        {unavailable && disabledReason && <span id={reasonId} className="sr-only">{disabledReason}</span>}
      </>
    );
  }

  return (
    <span className="eflow-action-blocker-group" data-slot="action-blocker-group">
      {buttonNode}
      <ActionBlockerStopButton
        actionLabel={derivedLabel}
        count={normalizedBlockers.length}
        compact={blockerCompact || size === "icon"}
        size={size === "sm" || size === "icon" ? "sm" : "md"}
        onClick={() => setBlockersOpen(true)}
      />
      <ActionBlockersModal
        open={blockersOpen}
        actionLabel={derivedLabel}
        blockers={normalizedBlockers}
        onClose={() => setBlockersOpen(false)}
      />
      {unavailable && disabledReason && <span id={reasonId} className="sr-only">{disabledReason}</span>}
    </span>
  );
});

const IconButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "asChild"> & { label: string }>(function IconButton({ label, ...props }, ref) {
  return <Button type="button" size="icon" {...props} ref={ref} aria-label={label} />;
});

export { Button, IconButton, buttonVariants };
