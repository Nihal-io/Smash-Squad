// components/dev/role-switcher.tsx — floating dev role switcher UI (Commit C7)
'use client';

import { useDevRole } from '@/lib/dev/use-dev-role';
import type { Role } from '@/lib/rbac/permissions';

const ROLES: Role[] = ['admin', 'coordinator', 'volunteer', 'participant'];

const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-red-500',
  coordinator: 'bg-blue-500',
  volunteer: 'bg-green-500',
  participant: 'bg-yellow-500',
};

export function RoleSwitcher() {
  if (process.env.NODE_ENV === 'production') return null;

  const [role, setRole] = useDevRole();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Dev Role
      </div>
      <div className="flex gap-1">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              role === r
                ? `${ROLE_COLORS[r]} text-white`
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-neutral-400">
        Current: <span className="font-mono">{role}</span>
      </div>
    </div>
  );
}