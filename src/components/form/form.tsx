import type { ReactNode } from "react";
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { useTranslations } from "use-intl";
import { Button } from "~/components/ui/button";
import { Choice, Field, Input, Select, Textarea } from "~/components/ui/field";

// Every admin form: TanStack Form bound to the design's fields. A field
// knows its own value, errors and label wiring; pages only say which field
// and what it is called:
//
//   const form = useAppForm({ defaultValues, validators: { onSubmit: schema }, onSubmit })
//   <form.AppField name="name">{(field) => <field.TextField label="Nom" />}</form.AppField>
//   <form.AppForm><form.SubmitButton label="Enregistrer" /></form.AppForm>
const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

// A schema's message is a key of formErrors ("required", "invalidEmail"…), so the
// same schema speaks every language; anything else reads as "invalid".
function useFieldError(): string | undefined {
  const field = useFieldContext<unknown>();
  const t = useTranslations("formErrors");
  const { errors, isTouched } = field.state.meta;
  const submitted = field.form.state.submissionAttempts > 0;
  if (errors.length === 0 || (!isTouched && !submitted)) return undefined;

  const first: unknown = errors[0];
  const message =
    typeof first === "string"
      ? first
      : typeof first === "object" && first && "message" in first
        ? String(first.message)
        : "";
  return t.has(message as "required") ? t(message as "required") : t("invalidValue");
}

function TextField({
  label,
  hint,
  labelAction,
  ...input
}: {
  label: ReactNode;
  hint?: ReactNode;
  labelAction?: ReactNode;
  type?: "text" | "email" | "tel" | "url" | "number" | "password" | "search";
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url";
  autoComplete?: string;
  placeholder?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  // Phone numbers, emails and codes read left to right on Arabic pages too.
  dir?: "ltr";
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={input.required}
      labelAction={labelAction}
    >
      {(control) => (
        <Input
          {...control}
          {...input}
          name={field.name}
          value={field.state.value}
          onChange={(event) => field.handleChange(event.target.value)}
          onBlur={field.handleBlur}
        />
      )}
    </Field>
  );
}

function TextareaField({
  label,
  hint,
  rows,
  placeholder,
  required,
}: {
  label: ReactNode;
  hint?: ReactNode;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) => (
        <Textarea
          {...control}
          rows={rows}
          placeholder={placeholder}
          name={field.name}
          value={field.state.value}
          onChange={(event) => field.handleChange(event.target.value)}
          onBlur={field.handleBlur}
        />
      )}
    </Field>
  );
}

function SelectField({
  label,
  hint,
  options,
  required,
}: {
  label: ReactNode;
  hint?: ReactNode;
  options: ReadonlyArray<{ value: string; label: string }>;
  required?: boolean;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) => (
        <Select
          {...control}
          name={field.name}
          value={field.state.value}
          onChange={(event) => field.handleChange(event.target.value)}
          onBlur={field.handleBlur}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function CheckboxField({ label }: { label: ReactNode }) {
  const field = useFieldContext<boolean>();
  return (
    <Choice
      label={label}
      name={field.name}
      checked={field.state.value}
      onChange={(event) => field.handleChange(event.target.checked)}
      onBlur={field.handleBlur}
    />
  );
}

// The form's main action, busy while it is being sent.
function SubmitButton({
  label,
  size = "lg",
  variant = "primary",
  className,
}: {
  label: ReactNode;
  size?: "md" | "lg";
  variant?: "primary" | "danger";
  className?: string;
}) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button
          type="submit"
          variant={variant}
          size={size}
          busy={isSubmitting}
          className={className}
        >
          {label}
        </Button>
      )}
    </form.Subscribe>
  );
}

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextareaField, SelectField, CheckboxField },
  formComponents: { SubmitButton },
});
