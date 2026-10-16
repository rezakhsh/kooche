import type { ComponentProps, ReactNode } from 'react';

// Small shared building blocks for forms and pages. Logical (start/end) classes only: the whole
// site is right-to-left.

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
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
        className={`block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 ${className}`}
      />
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

const buttonStyles = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-700/60',
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
      className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${buttonStyles[variant]} ${className}`}
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
      className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${buttonStyles[variant]} ${className}`}
    />
  );
}

export function Alert({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  }[tone];
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </p>
  );
}
