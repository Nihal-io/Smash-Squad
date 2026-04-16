import type { Role } from '@/lib/rbac/permissions';

const VALID_ROLES: readonly Role[] = ['admin', 'coordinator', 'volunteer', 'participant'];
const COOKIE_NAME = 'festflow_dev_role';

export async function getRoleServer(request: Request): Promise<Role | null> {
  if (process.env.NODE_ENV === 'production') {
    return null; // TODO(C20): read from session
  }

  // Priority 1: x-dev-role header (set by RoleHeaderInjector on client fetches)
  const headerRole = request.headers.get('x-dev-role');
  if (headerRole && VALID_ROLES.includes(headerRole as Role)) {
    return headerRole as Role;
  }

  // Priority 2: cookie (for server component page navigations)
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (match && VALID_ROLES.includes(match[1] as Role)) {
    return match[1] as Role;
  }

  return 'coordinator';
}