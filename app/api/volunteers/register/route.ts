import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const AvailabilityWindow = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
});

const RegisterSchema = z.object({
  full_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  skills: z.array(z.string().min(1)).default([]),
  availability: z.array(AvailabilityWindow).min(1, 'at least one availability window required'),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation failed', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { full_name, email, phone, skills, availability, notes } = parsed.data;

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return Response.json(
      { error: 'a profile with that email already exists' },
      { status: 409 }
    );
  }

  const profileId = crypto.randomUUID();

  const { error: profErr } = await supabase.from('profiles').insert({
    id: profileId,
    full_name,
    email,
    phone: phone ?? null,
    role: 'volunteer',
  });

  if (profErr) {
    return Response.json(
      { error: 'failed to create profile', detail: profErr.message },
      { status: 500 }
    );
  }

  const { data: volunteer, error: volErr } = await supabase
    .from('volunteers')
    .insert({
      profile_id: profileId,
      skills,
      availability,
      status: 'pending',
      notes: notes ?? null,
    })
    .select('id')
    .single();

  if (volErr || !volunteer) {
    await supabase.from('profiles').delete().eq('id', profileId);
    return Response.json(
      { error: 'failed to create volunteer record', detail: volErr?.message },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    volunteer_id: volunteer.id,
    profile_id: profileId,
    status: 'pending',
  });
}
