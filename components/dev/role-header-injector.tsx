'use client';

import { useEffect } from 'react';
import { getDevRoleFromStorage } from '@/lib/dev/use-dev-role';

export function RoleHeaderInjector() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const originalFetch = window.fetch;

    window.fetch = function (input, init = {}) {
      const role = getDevRoleFromStorage();
      const headers = new Headers(init.headers || {});
      if (!headers.has('x-dev-role')) {
        headers.set('x-dev-role', role);
      }
      return originalFetch(input, { ...init, headers });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}