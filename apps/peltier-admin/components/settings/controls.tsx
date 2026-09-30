import { cn } from "@peltier/shared/utils";

export const control =
  "w-full rounded-lg border bg-card px-3 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60";

export function Field({ label, hint, htmlFor, children, className }: { label: string; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={cn(control, "h-9", props.className)} />;
}

export function TextArea(props: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(control, "min-h-20 py-2 leading-relaxed", props.className)} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        control,
        "h-9 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        className,
      )}
    >
      {children}
    </select>
  );
}

/** A labelled on/off row; a real checkbox, so it posts with the form. */
export function SwitchRow({
  name,
  value,
  defaultChecked,
  label,
  description,
  icon,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40 has-[:disabled]:cursor-default sm:px-5">
      {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-[13px] text-muted-foreground">{description}</span>}
      </span>
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-foreground/15 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-foreground peer-checked:after:translate-x-4 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40 peer-disabled:opacity-60"
      />
    </label>
  );
}

/** Radio option drawn as a selectable card. */
export function RadioCard({
  name,
  value,
  defaultChecked,
  title,
  description,
  icon,
  footer,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <label className="group relative flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-3.5 transition hover:border-foreground/30 has-[:checked]:border-foreground has-[:checked]:shadow-[0_0_0_1px_var(--color-foreground)] has-[:disabled]:cursor-default">
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-has-[:checked]:bg-foreground group-has-[:checked]:text-background">
          {icon}
        </span>
        <span className="text-sm font-medium">{title}</span>
        <span className="ml-auto size-4 rounded-full border-2 border-muted-foreground/40 transition group-has-[:checked]:border-[5px] group-has-[:checked]:border-foreground" />
      </span>
      <span className="text-[13px] leading-snug text-muted-foreground">{description}</span>
      {footer}
    </label>
  );
}
