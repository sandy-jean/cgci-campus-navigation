/**
 * Form primitives.
 *
 * Every control is wired to a real <label>, an optional hint, and an
 * `aria-describedby` / `aria-invalid` pair, so required fields and validation
 * messages are announced rather than only shown in colour.
 */

import clsx from 'clsx';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const CONTROL =
  'w-full rounded-md border bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 transition-colors disabled:bg-ink-100 disabled:text-ink-500';

function controlClass(invalid: boolean, extra?: string) {
  return clsx(
    CONTROL,
    invalid
      ? 'border-red-400 focus:border-red-500'
      : 'border-ink-300 hover:border-ink-400 focus:border-cgci-600',
    extra,
  );
}

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (ids: { controlId: string; describedBy: string | undefined }) => ReactNode;
  className?: string;
}

function FieldShell({
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldShellProps) {
  const controlId = useId();
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={clsx('space-y-1.5', className)}>
      <label htmlFor={controlId} className="block text-sm font-medium text-ink-800">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ controlId, describedBy })}
      {hint && (
        <p id={hintId} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- Input */

export function TextField({
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {({ controlId, describedBy }) => (
        <input
          id={controlId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          className={controlClass(Boolean(error))}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

/* ------------------------------------------------------------------ Select */

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  hint,
  error,
  required,
  options,
  placeholder,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string | null;
  options: SelectOption[];
  placeholder?: string;
}) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {({ controlId, describedBy }) => (
        <select
          id={controlId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          className={controlClass(Boolean(error))}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

/* ---------------------------------------------------------------- Textarea */

export function TextAreaField({
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string | null;
}) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {({ controlId, describedBy }) => (
        <textarea
          id={controlId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          rows={3}
          className={clsx(controlClass(Boolean(error)), 'resize-y')}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

/* ----------------------------------------------------------------- Checkbox */

export function CheckboxField({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={clsx('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        aria-describedby={hintId}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-400 text-cgci-700 accent-cgci-700"
        {...rest}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink-800">
          {label}
        </label>
        {hint && (
          <p id={hintId} className="text-xs text-ink-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}