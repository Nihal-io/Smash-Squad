// lib/rbac/guard.ts — role and permission guard helpers (Commit C6)
import { can, type Permission, type Role } from './permissions';
import { getRoleServer } from '@/lib/dev/get-role-server';

export async function requireRole(
  request: Request,
  action: Permission
): Promise<Response | null> {
  const role = await getRoleServer(request);

  if (!can(role, action)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden', required: action, role }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return null;
}

export async function getCurrentRole(request: Request): Promise<Role | null> {
  return getRoleServer(request);
}