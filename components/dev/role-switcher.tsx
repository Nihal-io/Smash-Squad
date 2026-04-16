'use client';

import { useDevRole } from '@/lib/dev/use-dev-role';
import type { Role } from '@/lib/rbac/permissions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'participant', label: 'Participant' },
];

export function RoleSwitcher() {
  const [role, setRole] = useDevRole();

  if (process.env.NEXT_PUBLIC_DEV_MODE !== 'true') return null;

  return (
    <div className="p-3 border-t">
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
        Switch Role
      </label>
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
