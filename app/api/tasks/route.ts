import { z } from 'zod';
import { requireRole } from '@/lib/rbac/guard';
import { createClient } from '@/lib/supabase/server';
import { reconcileTask } from '@/lib/assignment/engine';
import { getNotifier } from '@/lib/notifications';

const CreateTaskSchema = z.object({
  name: z.string().min(1).max(200),
  slot_start: z.string().datetime({ offset: true }),
  slot_end: z.string().datetime({ offset: true }),
  volunteers_needed: z.number().int().positive().max(500),
  skills_required: z.array(z.string().min(1)).default([]),
  event_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const guard = await requireRole(request, 'tasks.create');
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation failed', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (new Date(parsed.data.slot_end) <= new Date(parsed.data.slot_start)) {
    return Response.json(
      { error: 'slot_end must be after slot_start' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .insert({
      name: parsed.data.name,
      slot_start: parsed.data.slot_start,
      slot_end: parsed.data.slot_end,
      volunteers_needed: parsed.data.volunteers_needed,
      skills_required: parsed.data.skills_required,
      event_id: parsed.data.event_id ?? null,
    })
    .select('id, name, slot_start, slot_end, volunteers_needed, skills_required, event_id')
    .single();

  if (tErr || !task) {
    return Response.json(
      { error: 'failed to create task', detail: tErr?.message },
      { status: 500 }
    );
  }

  const result = await reconcileTask(task.id, supabase);

  if (result.notifications.length > 0) {
    await getNotifier().send(result.notifications);
  }

  return Response.json({
    ok: true,
    task,
    reconcile: {
      filled: result.filled,
      waitlisted: result.waitlisted,
      still_short: result.still_short,
    },
  });
}

export async function GET(request: Request) {
  const guard = await requireRole(request, 'tasks.view');
  if (guard) return guard;

  const supabase = await createClient();

  const { data: tasks, error: tErr } = await supabase
    .from('tasks')
    .select('id, name, slot_start, slot_end, volunteers_needed, skills_required, event_id, created_at')
    .order('slot_start', { ascending: true });

  if (tErr) {
    return Response.json(
      { error: 'failed to fetch tasks', detail: tErr.message },
      { status: 500 }
    );
  }

  const { data: counts } = await supabase
    .from('assignments')
    .select('task_id, status');

  const countsByTask = new Map<string, { assigned: number; waitlist: number; dropped: number }>();
  for (const c of counts ?? []) {
    const entry = countsByTask.get(c.task_id) ?? { assigned: 0, waitlist: 0, dropped: 0 };
    if (c.status === 'assigned') entry.assigned++;
    else if (c.status === 'waitlist') entry.waitlist++;
    else if (c.status === 'dropped') entry.dropped++;
    countsByTask.set(c.task_id, entry);
  }

  const enriched = (tasks ?? []).map((t) => ({
    ...t,
    counts: countsByTask.get(t.id) ?? { assigned: 0, waitlist: 0, dropped: 0 },
    fill_status:
      (countsByTask.get(t.id)?.assigned ?? 0) >= t.volunteers_needed
        ? 'full'
        : (countsByTask.get(t.id)?.assigned ?? 0) > 0
        ? 'partial'
        : 'empty',
  }));

  return Response.json({ ok: true, tasks: enriched });
}
