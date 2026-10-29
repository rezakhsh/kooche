import { appDb } from '../../../../db/drizzle';
import { auditLog } from '../../../../db/schema';
import { requireStaff } from '../../../../modules/admin/server';
import { storage } from '../../../../modules/media/server';
import { verificationDocument } from '../../../../modules/organizations/verification';

// A business's verification document, for the staff who decide (wave 2 part 4,
// src/modules/organizations/verification.ts). Read from the private key, shown inline, never cached;
// every look is written to audit_log. Gone 7 days after the decision.

export async function GET(request: Request): Promise<Response> {
  const staff = await requireStaff('organization.verify');
  const id = new URL(request.url).searchParams.get('id') ?? '';
  const store = storage();
  if (!/^[0-9a-f-]{36}$/.test(id) || !store) return new Response('not found', { status: 404 });
  const doc = await verificationDocument(appDb(), store, id);
  if (!doc) return new Response('not found', { status: 404 });
  await appDb().insert(auditLog).values({
    actorType: 'staff',
    actorUserId: staff.ctx.userId,
    action: 'organization.document_viewed',
    targetType: 'organization',
    targetId: id,
    sessionId: staff.ctx.sessionId,
    ipAddress: staff.ctx.ip,
  });
  return new Response(new Uint8Array(doc.bytes), {
    headers: {
      'Content-Type': doc.type,
      'Content-Disposition': 'inline; filename="document"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
