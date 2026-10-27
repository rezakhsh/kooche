import { eq } from 'drizzle-orm';
import { Alert, Button, Field } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { users } from '../../../db/schema';
import { fieldDir } from '../../../lib/field-dir';
import { TaskPage } from '../../../components/settings';
import { messages } from '../../../messages/fa';
import { isPlaceholderName, MAX_DISPLAY_NAME } from '../../../modules/users/profile';
import { requireSession } from '../../../modules/users/server';
import { saveNameAction } from './actions';

export const metadata = { title: messages.account.name, robots: { index: false } };

// The name others see on listings, in chats and on the seller page (approved Oct 21, 2026)

const ERRORS = new Set(['required', 'too_short', 'too_long', 'reserved', 'rate_limited'] as const);
type ErrorCode = typeof ERRORS extends Set<infer T> ? T : never;

export default async function NamePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const { user } = await requireSession('/account/name');
  const [row] = await appDb().select({ name: users.displayName }).from(users).where(eq(users.id, user.id));
  const t = messages.account;
  const current = row && !isPlaceholderName(row.name) ? row.name : '';
  const code = ERRORS.has(error as ErrorCode) ? (error as ErrorCode) : null;
  return (
    <TaskPage title={t.name} back="/account/settings" backLabel={messages.account.back}>
      <form action={saveNameAction} className="space-y-5">
        {saved && <Alert tone="success">{t.nameSaved}</Alert>}
        {code && <Alert tone="error">{t.nameErrors[code]}</Alert>}
        <Field
          label={t.name}
          hint={t.nameHint}
          name="displayName"
          defaultValue={current}
          maxLength={MAX_DISPLAY_NAME}
          minLength={2}
          required
          autoComplete="name"
          dir={fieldDir(current)}
          data-auto-dir=""
        />
        <Button type="submit" className="w-full">
          {t.nameSave}
        </Button>
      </form>
    </TaskPage>
  );
}
