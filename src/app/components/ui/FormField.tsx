// ─── Reusable Form Components ────────────────────────────────────
import React from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}

export function FormField({ label, error, children, required }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <span className="text-[11px] font-normal text-red-500">{error}</span>
      )}
    </div>
  );
}

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function TextInput({ hasError, className = "", ...props }: TextInputProps) {
  return (
    <input
      className={`h-10 w-full rounded-lg border bg-input-background px-3 text-[13px] font-normal text-foreground placeholder:text-muted-foreground outline-none transition-all ${
        hasError
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
  return (
    <select
      className={`h-10 w-full cursor-pointer appearance-none rounded-lg border bg-input-background bg-no-repeat bg-[right_12px_center] bg-[length:12px] px-3 text-[13px] font-normal text-foreground outline-none transition-all ${
        hasError
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
