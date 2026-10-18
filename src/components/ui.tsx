import type { ComponentProps, ReactNode } from 'react';
import { LogoMark } from './logo';

// Small shared building blocks for forms and pages. Logical (start/end) classes only: the whole
// site is right-to-left.

/** `wide`: the posting form and lists; `logo`: login, with the logo above a centred title */
export function PageShell({ title, children, wide, logo }: { title: string; children: ReactNode; wide?: boolean; logo?: boolean }) {
  return (
    <main className={`mx-auto w-full px-4 py-8 sm:px-6 sm:py-12 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
      {logo && <LogoMark className="mx-auto mb-4 size-14" />}
      <h1 className={`mb-6 text-2xl font-extrabold ${logo ? 'text-center' : ''}`}>{title}</h1>
      {children}
    </main>
  );
}

/** A small coloured label: a listing's status, "your country", "verified" */
export function Pill({ tone, children }: { tone: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'saffron'; children: ReactNode }) {
  const styles = {
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-green-50 text-green-800',
    warning: 'bg-amber-50 text-amber-800',
    danger: 'bg-red-50 text-red-800',
    neutral: 'bg-neutral-100 text-neutral-700',
    saffron: 'bg-saffron-50 text-saffron-700',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${styles}`}>{children}</span>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-5 ${className}`}>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  className = '',
  ...props
}: ComponentProps<'input'> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      <input
        {...props}
        className={`block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 ${className}`}
      />
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

const buttonStyles = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/60',
  accent: 'bg-saffron-500 text-neutral-900 hover:bg-saffron-400',
  secondary: 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${buttonStyles[variant]} ${className}`}
    />
  );
}

export function LinkButton({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'a'> & { variant?: keyof typeof buttonStyles }) {
  return (
    <a
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${buttonStyles[variant]} ${className}`}
    />
  );
}

export function Alert({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-brand-200 bg-brand-50 text-brand-800',
    info: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  }[tone];
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </p>
  );
}
