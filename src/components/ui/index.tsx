/**
 * Shared interface primitives.
 *
 * Small and deliberately plain: one Button, one Card, one field style. Consistency
 * comes from a handful of tokens rather than a large component library.
 */

import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/* ------------------------------------------------------------------ Button */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-cgci-700 text-white hover:bg-cgci-800 active:bg-cgci-900 disabled:bg-ink-300 disabled:text-ink-500',
  secondary:
    'border border-ink-300 bg-white text-ink-800 hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-400',
  ghost: 'text-cgci-700 hover:bg-cgci-50 active:bg-cgci-100 disabled:text-ink-400',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:text-ink-400',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    />
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'aside';
}) {
  return (
    <Tag
      className={clsx(
        'rounded-lg border border-ink-200 bg-white shadow-[0_1px_2px_rgb(23_28_27/0.06)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------- Badge */

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue';

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 border-ink-200',
  green: 'bg-cgci-50 text-cgci-800 border-cgci-200',
  amber: 'bg-route-50 text-route-600 border-route-100',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- Empty / err */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-ink-300 bg-white px-6 py-10 text-center">
      {icon && <div className="mb-3 flex justify-center text-ink-400">{icon}</div>}
      <h3 className="text-base font-semibold text-ink-800">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-prose text-sm text-ink-600">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900"
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-red-800">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- Skeletons */

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={clsx('skeleton h-4', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-lg border border-ink-200 bg-white p-4">
      <SkeletonLine className="w-1/3" />
      <SkeletonLine className="w-2/3" />
      <SkeletonLine className="w-1/2" />
    </div>
  );
}

/* ------------------------------------------------------------- Section head */

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}