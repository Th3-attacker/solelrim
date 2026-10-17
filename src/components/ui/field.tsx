import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "~/lib/cn";
import { Icon } from "./icon";

// The props a control receives from its Field: its id for the label, the
// hint and error it is described by, and whether it is invalid.
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
};

// Label above, hint below, and an error that says what to do.
export function Field({
  label,
  hint,
  error,
  required,
  className,
  labelAction,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  // Something at the end of the label row ("Mot de passe oublié ?").
  labelAction?: ReactNode;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold">
          {label}
        </label>
        {labelAction}
      </div>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required,
      })}
      {error && (
        <p id={errorId} className="text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-[12px] text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

const control =
  "w-full min-w-0 rounded-control border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-faint aria-invalid:border-danger aria-invalid:outline-3 aria-invalid:outline-bad-bg focus-visible:border-brand focus-visible:outline-3 focus-visible:outline-tint focus-visible:outline-offset-0 disabled:bg-tile disabled:text-faint";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  // A unit before the value ("MRU") or a hint after it ("Ctrl K").
  leading?: ReactNode;
  trailing?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, ...props },
  ref,
) {
  if (!leading && !trailing) {
    return <input ref={ref} className={cn(control, "h-[42px]", className)} {...props} />;
  }
  return (
    <div
      className={cn(
        "flex h-[42px] items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-[14px] has-aria-invalid:border-danger has-focus-visible:border-brand has-focus-visible:outline-3 has-focus-visible:outline-tint has-disabled:bg-tile",
        className,
      )}
    >
      {leading && <span className="flex-none text-[13px] font-semibold text-muted">{leading}</span>}
      <input
        ref={ref}
        className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint disabled:text-faint"
        {...props}
      />
      {trailing && <span className="flex-none text-[12px] text-muted">{trailing}</span>}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, "py-2.5", className)} {...props} />;
});

// The browser's own select: the most accessible choice, and the native
// picker on phones.
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(control, "h-[42px] appearance-none pe-9", className)}
          {...props}
        >
          {children}
        </select>
        <Icon
          name="chevronDown"
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
      </div>
    );
  },
);

// A box or a round choice with its words, the whole line clickable.
export function Choice({
  type = "checkbox",
  label,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "checkbox" | "radio";
  label: ReactNode;
}) {
  return (
    <label className={cn("inline-flex min-h-10 cursor-pointer items-center gap-2.5", className)}>
      <input type={type} className="size-[18px] flex-none cursor-pointer accent-brand" {...props} />
      <span>{label}</span>
    </label>
  );
}

// On/off that applies at once (a setting), not a form value to submit.
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex h-[26px] w-11 flex-none cursor-pointer rounded-full p-[3px] transition-colors disabled:opacity-55",
        checked ? "justify-end bg-brand" : "justify-start bg-line-strong",
        className,
      )}
    >
      <span className="block size-5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]" />
    </button>
  );
}

// One choice among a few, side by side. Real radio buttons underneath: the
// arrow keys move between them.
export function Segmented<Value extends string>({
  label,
  name,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  name: string;
  options: ReadonlyArray<{ value: Value; label: ReactNode }>;
  value: Value;
  onChange: (value: Value) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-control bg-tile p-[3px]",
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="inline-flex h-8 flex-none cursor-pointer items-center rounded-lg px-3 text-[13px] whitespace-nowrap font-semibold text-muted has-checked:bg-surface has-checked:text-brand has-checked:shadow-[0_1px_3px_rgb(15_23_42/0.12)] has-focus-visible:outline-2 has-focus-visible:outline-brand"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

// A small quantity, one step at a time (a cart line).
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  label,
  decreaseLabel,
  increaseLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const buttonClass =
    "inline-flex size-10 items-center justify-center rounded-control border border-line-strong bg-surface text-ink disabled:opacity-40";
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-2">
      <button
        type="button"
        className={buttonClass}
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Icon name="minus" />
      </button>
      <output aria-live="polite" className="min-w-6 text-center font-bold tabular-nums">
        {value}
      </output>
      <button
        type="button"
        className={buttonClass}
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
