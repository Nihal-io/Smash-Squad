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
import { NotificationBell } from '@/components/dashboard/notification-bell';
import {
  ClipboardList,
  Users,
  LayoutDashboard,
  BarChart3,
  Ticket,
  LogOut,
  Zap,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Parameters<typeof can>[1];
};

const ALL_NAV: NavItem[] = [
  {
    href: '/coordinator',
    label: 'Dashboard',
    icon: LayoutDashboard,
    permission: 'tasks.view',
  },
  {
    href: '/coordinator/tasks',
    label: 'Tasks',
    icon: ClipboardList,
    permission: 'tasks.view',
  },
  {
    href: '/coordinator/volunteers',
    label: 'Volunteers',
    icon: Users,
    permission: 'volunteers.viewAll',
  },
  {
    href: '/admin',
    label: 'Admin',
    icon: LayoutDashboard,
    permission: 'scrutiny.access',
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    icon: BarChart3,
    permission: 'analytics.view',
  },
  {
    href: '/volunteer',
    label: 'Dashboard',
    icon: LayoutDashboard,
    permission: 'tasks.view',
  },
  {
    href: '/volunteer/passes',
    label: 'My Passes',
    icon: Ticket,
    permission: 'passes.viewOwn',
  },
];

const COORDINATOR_HREFS = new Set(['/coordinator', '/coordinator/tasks', '/coordinator/volunteers']);
const VOLUNTEER_HREFS = new Set(['/volunteer', '/volunteer/passes']);

function navForRole(role: Role): NavItem[] {
  if (role === 'admin') {
    return ALL_NAV.filter((item) => {
      if (item.href === '/volunteer/passes') return can(role, 'passes.viewAll');
      return can(role, item.permission);
    });
  }
  if (role === 'coordinator') {
    return ALL_NAV.filter(
      (item) => COORDINATOR_HREFS.has(item.href) && can(role, item.permission)
    );
  }
  if (role === 'volunteer' || role === 'participant') {
    return ALL_NAV.filter((item) => {
      if (!VOLUNTEER_HREFS.has(item.href)) return false;
      if (item.href === '/volunteer') return can(role, 'tasks.view');
      if (item.href === '/volunteer/passes') {
        if (role === 'volunteer') return true;
        return can(role, 'passes.viewOwn');
      }
      return false;
    });
  }
  return [];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<Role | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .single();
        if (profile?.role) {
          setRole(profile.role as Role);
          setUserName(profile.full_name ?? '');
        }
      }
      setRoleReady(true);
    };
    void loadUser();
  }, []);

  useEffect(() => {
    if (!roleReady || !role) return;

    const isVolunteerZone = pathname.startsWith('/volunteer') && pathname !== '/volunteer/register';
    const isCoordinatorZone = pathname.startsWith('/coordinator');
    const isAdminZone = pathname.startsWith('/admin');

    if (role === 'volunteer' || role === 'participant') {
      if (isCoordinatorZone || isAdminZone) {
        router.replace('/volunteer');
      }
    } else if (role === 'coordinator') {
      if (isVolunteerZone || isAdminZone) {
        router.replace('/coordinator');
      }
    }
  }, [roleReady, role, pathname, router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const visibleNav = role ? navForRole(role) : [];

  const headerLabel =
    visibleNav.find((n) => n.href === pathname)?.label ?? 'FestFlow';

  const showDevRoleSwitcher = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  return (
    <div className="flex h-screen bg-slate-50/80">
      <aside className="w-64 flex flex-col shrink-0 border-r border-slate-800/80 bg-slate-950 text-slate-100">
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
              <Zap className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white">FestFlow</h1>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">Operations</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {roleReady && role
            ? visibleNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                      active
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                        : 'text-slate-300 hover:bg-slate-800/90 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-90" />
                    {item.label}
                  </Link>
                );
              })
            : null}
        </nav>

        <div className="p-4 border-t border-slate-800/80 space-y-3">
          {role && userName ? (
            <div className="rounded-lg bg-slate-900/80 px-3 py-2.5 ring-1 ring-slate-800">
              <p className="text-sm font-medium text-white truncate" title={userName}>
                {userName}
              </p>
              <Badge
                variant="secondary"
                className="mt-1.5 capitalize text-[10px] font-normal bg-slate-800 text-slate-300 border-slate-700"
              >
                {role}
              </Badge>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => void handleLogout()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </Button>
          {showDevRoleSwitcher ? <RoleSwitcher /> : null}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-background">
        <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border/80 bg-card shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{headerLabel}</h2>
          <div className="flex items-center gap-1">
            <NotificationBell userId={userId} />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
