import { z } from 'zod';
import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';
import { getNotifier } from '@/lib/notifications';
import { rejectionNotification } from '@/lib/notifications/templates';

const RejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(request, 'volunteers.reject');
  if (guard) return guard;

  const { id } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const parsed = RejectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation failed', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: volunteer, error: vErr } = await supabase
    .from('volunteers')
    .select('id, status, notes, profiles:profile_id(full_name, email)')
    .eq('id', id)
    .single();

  if (vErr || !volunteer) {
    return Response.json({ error: 'volunteer not found' }, { status: 404 });
  }

  if (volunteer.status === 'rejected') {
    return Response.json({ ok: true, already: 'rejected' });
  }

  const { error: upErr } = await supabase
    .from('volunteers')
    .update({
      status: 'rejected',
      notes: parsed.data.reason
        ? (volunteer.notes ? `${volunteer.notes}\n\n` : '') +
          `Rejection reason: ${parsed.data.reason}`
        : volunteer.notes,
    })
    .eq('id', id);

  if (upErr) {
    return Response.json(
      { error: 'failed to update status', detail: upErr.message },
      { status: 500 }
    );
  }

  const profile = Array.isArray(volunteer.profiles)
    ? volunteer.profiles[0]
    : volunteer.profiles;

  if (profile) {
    await getNotifier().send([
      rejectionNotification(
        { full_name: profile.full_name, email: profile.email },
        parsed.data.reason
      ),
    ]);
  }

  return Response.json({
    ok: true,
    volunteer_id: id,
    status: 'rejected',
  });
}
