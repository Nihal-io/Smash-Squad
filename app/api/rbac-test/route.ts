import { requireRole } from '@/lib/rbac/guard';

export async function GET(request: Request) {
  const guard = await requireRole(request, 'tasks.create');
  if (guard) return guard;
  return Response.json({ status: 'ok', message: 'you can create tasks' });
}