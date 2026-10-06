// ─── Reusable Form Components ────────────────────────────────────
import React from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
  controlId?: string;
  description?: string;
}

export function FormField({ label, error, children, required, controlId, description }: FormFieldProps) {
  const generatedId = React.useId();
  const element = React.isValidElement<React.InputHTMLAttributes<HTMLInputElement>>(children) ? children : null;
  const labelable = element && element.type !== React.Fragment && (typeof element.type !== "string" || ["input", "select", "textarea", "button", "meter", "output", "progress"].includes(element.type));
  const control = labelable ? element : null;
  const id = controlId || control?.props.id || `field-${generatedId}`;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [control?.props["aria-describedby"], descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="eflow-form-field">
      <label className="eflow-field-label" htmlFor={id}>
        {label}
        {required && <span className="eflow-field-required" aria-hidden="true"> *</span>}
      </label>
      {control ? React.cloneElement(control, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : control.props["aria-invalid"], "aria-required": required || control.props["aria-required"] }) : children}
      {description && <span id={descriptionId} className="eflow-field-description">{description}</span>}
      {error && (
        <span id={errorId} role="alert" className="eflow-field-error">{error}</span>
      )}
    </div>
  );
}

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function TextInput({ hasError, className = "", ...props }: TextInputProps) {
  const invalid = hasError || props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <input
      className={`eflow-form-input h-10 w-full rounded-lg border bg-input-background px-3 text-[13px] font-normal text-foreground placeholder:text-muted-foreground outline-none transition-all ${
        invalid
          ? "border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/10"
          : "border-border hover:border-neutral-400 focus:border-ring focus:ring-2 focus:ring-ring/15"
      } ${className}`}
      {...props}
    />
  );
}

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function SelectInput({ hasError, options, placeholder, className = "", ...props }: SelectInputProps) {
  const invalid = hasError || props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <select
      className={`eflow-form-input h-10 w-full cursor-pointer appearance-none rounded-lg border bg-input-background bg-no-repeat bg-[right_12px_center] bg-[length:12px] px-3 text-[13px] font-normal text-foreground outline-none transition-all ${
        invalid
          ? "border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/10"
          : "border-border hover:border-neutral-400 focus:border-ring focus:ring-2 focus:ring-ring/15"
      } ${className}`}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='%235d706c'/%3E%3C/svg%3E")` }}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
