import type { Role } from '@/lib/rbac/permissions';
import { createClient } from '@/lib/supabase/server';

const VALID_ROLES: readonly Role[] = ['admin', 'coordinator', 'volunteer', 'participant'];

export async function getRoleServer(request: Request): Promise<Role | null> {
  // Try real Supabase session first
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role && VALID_ROLES.includes(profile.role as Role)) {
        return profile.role as Role;
      }
    }
  } catch {
    // Session read failed — fall through to dev mode
  }

  // Dev mode fallback: x-dev-role header or cookie
  if (process.env.NODE_ENV !== 'production') {
    const headerRole = request.headers.get('x-dev-role');
    if (headerRole && VALID_ROLES.includes(headerRole as Role)) {
      return headerRole as Role;
    }

    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/festflow_dev_role=([^;]+)/);
    if (match && VALID_ROLES.includes(match[1] as Role)) {
      return match[1] as Role;
    }

    return 'coordinator';
  }

  return null;
}
