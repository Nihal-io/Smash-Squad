// lib/dev/get-role-server.ts — server helper for x-dev-role resolution (Commit C7)
import type { Role } from '@/lib/rbac/permissions';

const VALID_ROLES: readonly Role[] = ['admin', 'coordinator', 'volunteer', 'participant'];

export async function getRoleServer(request: Request): Promise<Role | null> {
  // Pre-auth dev mode: role comes from x-dev-role header or defaults to coordinator.
  // After C20, this is replaced with session-based role reading from Supabase.
  if (process.env.NODE_ENV === 'production') {
    return null; // TODO(C20): read from session
  }

  const headerRole = request.headers.get('x-dev-role');
  if (headerRole && VALID_ROLES.includes(headerRole as Role)) {
    return headerRole as Role;
  }

  return 'coordinator';
}