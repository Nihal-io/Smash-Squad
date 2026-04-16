import { z } from 'zod';
import { createClient as createServiceClient } from '@supabase/supabase-js';

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

function generatedPasswordFromName(fullName: string): string {
  return fullName.toLowerCase().replace(/\s+/g, '') + '123';
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json(
      { error: 'server misconfigured: missing Supabase URL or service role key' },
      { status: 500 }
    );
  }

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

  const { full_name, email, phone, skills, availability, notes } = parsed.data;
  const password = generatedPasswordFromName(full_name);

  const service = createServiceClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await service
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

  const { data: authData, error: authErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    return Response.json(
      {
        error: 'failed to create auth user',
        detail: authErr?.message ?? 'unknown',
      },
      { status: 400 }
    );
  }

  const userId = authData.user.id;

  const { error: profErr } = await service.from('profiles').insert({
    id: userId,
    full_name,
    email,
    phone: phone ?? null,
    role: 'volunteer',
  });

  if (profErr) {
    await service.auth.admin.deleteUser(userId);
    return Response.json(
      { error: 'failed to create profile', detail: profErr.message },
      { status: 500 }
    );
  }

  const { data: volunteer, error: volErr } = await service
    .from('volunteers')
    .insert({
      profile_id: userId,
      skills,
      availability,
      status: 'pending',
      notes: notes ?? null,
    })
    .select('id')
    .single();

  if (volErr || !volunteer) {
    await service.from('profiles').delete().eq('id', userId);
    await service.auth.admin.deleteUser(userId);
    return Response.json(
      { error: 'failed to create volunteer record', detail: volErr?.message },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    volunteer_id: volunteer.id,
    profile_id: userId,
    email,
    password,
    status: 'pending',
  });
}
