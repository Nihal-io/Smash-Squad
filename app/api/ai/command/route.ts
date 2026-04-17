import { z } from 'zod';
import { requireRole } from '@/lib/rbac/guard';
import { parseCommand } from '@/lib/ai/parse-command';

const CommandRequestSchema = z.object({
  text: z.string().min(1).max(500),
});

/** Wall clock in Asia/Kolkata as ISO-8601 with +05:30 (IST has no DST). */
function currentTimeIsoIST(): string {
  const d = new Date();
  const wall = d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
  return `${wall.replace(' ', 'T')}+05:30`;
}

export async function POST(request: Request) {
  const guard = await requireRole(request, 'ai.command');
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const parsed = CommandRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation failed', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const currentTimeIso = currentTimeIsoIST();
    const intent = await parseCommand(parsed.data.text, currentTimeIso);

    return Response.json({
      ok: true,
      intent,
      raw_input: parsed.data.text,
      parsed_at: currentTimeIso,
    });
  } catch (err) {
    return Response.json(
      {
        error: 'command parsing failed',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
