import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  title,
  subtitle,
  action,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("panel p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="label-xs">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export type Tone = "favorable" | "caution" | "critical" | "unknown" | "earth" | "sun" | "relay";

const toneClasses: Record<Tone, string> = {
  favorable: "text-favorable border-favorable/40 bg-favorable/10",
  caution: "text-caution border-caution/40 bg-caution/10",
  critical: "text-critical border-critical/40 bg-critical/10",
  unknown: "text-unknown border-unknown/40 bg-unknown/10",
  earth: "text-earth border-earth/40 bg-earth/10",
  sun: "text-sun border-sun/40 bg-sun/10",
  relay: "text-relay border-relay/40 bg-relay/10",
};

export function Badge({
  tone = "unknown",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.6875rem] tracking-[0.1em] uppercase",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Metric({
  label,
  value,
  unit,
  tone,
  hint,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div>
      <p className="label-xs">{label}</p>
      <p
        className={cn(
          "metric mt-1 text-2xl leading-none",
          tone ? toneClasses[tone].split(" ")[0] : "text-foreground",
        )}
      >
        {value}
        {unit && <span className="ml-1 text-sm text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" }) {
  const variants = {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary/85 border border-primary/40 font-medium",
    outline: "border border-border bg-panel-strong/60 text-foreground hover:bg-accent",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-accent/60",
  } as const;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm transition-colors duration-150 disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-xs">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-input bg-background/60 px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors focus:border-ring";

export function ScoreBar({ value, tone }: { value: number; tone: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all duration-300", `bg-${tone}`)}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      This application is a research and educational prototype for mission planning
      visualization. Results are not a substitute for formal NASA, agency, or mission-specific
      engineering analysis, certification, navigation products, or operational flight rules.
    </p>
  );
}
