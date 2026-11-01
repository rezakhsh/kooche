'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from './ui';

/** A submit button that can't be pressed again while its form is being sent (a double click sends once) */
export function PendingButton({ className = '', disabled, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return <Button type="submit" {...props} disabled={pending || disabled} className={`disabled:cursor-wait disabled:opacity-60 ${className}`} />;
}
