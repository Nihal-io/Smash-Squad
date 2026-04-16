// lib/dev/use-dev-role.ts — development role switcher hook (Commit C7)
'use client';

import { useEffect, useState } from 'react';
import type { Role } from '@/lib/rbac/permissions';

const STORAGE_KEY = 'festflow_dev_role';
const DEFAULT_ROLE: Role = 'coordinator';
const VALID_ROLES: Role[] = ['admin', 'coordinator', 'volunteer', 'participant'];

export function useDevRole(): [Role, (role: Role) => void] {
  const [role, setRoleState] = useState<Role>(DEFAULT_ROLE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_ROLES.includes(stored as Role)) {
      setRoleState(stored as Role);
    }
  }, []);

  const setRole = (newRole: Role) => {
    localStorage.setItem(STORAGE_KEY, newRole);
    // Also set a cookie so server components can read it on navigation
    document.cookie = `${STORAGE_KEY}=${newRole}; path=/; max-age=604800; SameSite=Lax`;
    setRoleState(newRole);
    window.location.reload();
  };

  return [role, setRole];
}

export function getDevRoleFromStorage(): Role {
  if (typeof window === 'undefined') return DEFAULT_ROLE;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_ROLES.includes(stored as Role)) {
    return stored as Role;
  }
  return DEFAULT_ROLE;
}