import { notFound } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { businessBySlug, roleIn, type Role } from '../../../modules/organizations/organizations';
import { requireSession } from '../../../modules/users/server';

/** A business page only its members open (manage, team, billing, edit); 404 for everyone else */
export async function memberOf(slug: string, path: string, roles: readonly Role[] = ['owner', 'manager', 'staff']) {
  const { user } = await requireSession(path);
  const found = await businessBySlug(appDb(), slug);
  if (!found) notFound();
  const role = await roleIn(appDb(), user.id, found.org.id);
  if (!role || !roles.includes(role)) notFound();
  return { user, org: found.org, cityFa: found.cityFa, cityLocal: found.cityLocal, role };
}
