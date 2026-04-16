'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { can } from '@/lib/rbac/permissions';
import type { Role } from '@/lib/rbac/permissions';
import { RoleSwitcher } from '@/components/dev/role-switcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import {
  ClipboardList,
  Users,
  LayoutDashboard,
  BarChart3,
  Ticket,
  LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    href: '/coordinator',
    label: 'Dashboard',
    icon: LayoutDashboard,
    permission: 'tasks.view' as const,
  },
  {
    href: '/coordinator/tasks',
    label: 'Tasks',
    icon: ClipboardList,
    permission: 'tasks.view' as const,
  },
  {
    href: '/coordinator/volunteers',
    label: 'Volunteers',
    icon: Users,
    permission: 'volunteers.viewAll' as const,
  },
  {
    href: '/admin',
    label: 'Admin',
    icon: LayoutDashboard,
    permission: 'scrutiny.access' as const,
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    icon: BarChart3,
    permission: 'analytics.view' as const,
  },
  {
    href: '/volunteer/passes',
    label: 'My Passes',
    icon: Ticket,
    permission: 'passes.viewOwn' as const,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<Role>('coordinator');
  const [userName, setUserName] = useState<string>('');
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .single();
        if (profile) {
          setRole(profile.role as Role);
          setUserName(profile.full_name ?? '');
        }
      }
    };
    void loadUser();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('festflow_dev_role') as Role | null;
    if (stored) setRole(stored);

    const handleStorage = () => {
      const nextRole = localStorage.getItem('festflow_dev_role') as Role | null;
      if (nextRole) setRole(nextRole);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const visibleNav = NAV_ITEMS.filter((item) => can(role, item.permission));

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-muted/40 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">FestFlow</h1>
          <Badge variant="outline" className="mt-1 capitalize">
            {role}
          </Badge>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <RoleSwitcher />
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold">
            {visibleNav.find((n) => n.href === pathname)?.label ?? 'FestFlow'}
          </h2>
          <div className="flex items-center gap-3">
            {userName && (
              <span className="text-sm text-muted-foreground">{userName}</span>
            )}
            <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
