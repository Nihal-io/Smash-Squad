'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ClipboardList, Users, UserCheck, CalendarClock, Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';

type Stats = {
  totalTasks: number;
  totalVolunteers: number;
  pendingApprovals: number;
  assignmentsToday: number;
};

type RecentRow = {
  id: string;
  assigned_at: string | null;
  status: string | null;
  tasks: { name: string } | { name: string }[] | null;
  volunteers: {
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  } | null;
};

export default function CoordinatorDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [
      tasksRes,
      volRes,
      pendingRes,
      todayRes,
      recentRes,
    ] = await Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true }),
      supabase.from('volunteers').select('*', { count: 'exact', head: true }),
      supabase
        .from('volunteers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .gte('assigned_at', start.toISOString())
        .lte('assigned_at', end.toISOString())
        .in('status', ['assigned', 'waitlist']),
      supabase
        .from('assignments')
        .select(
          'id, assigned_at, status, tasks:task_id(name), volunteers:volunteer_id(profiles:profile_id(full_name))'
        )
        .not('assigned_at', 'is', null)
        .order('assigned_at', { ascending: false })
        .limit(5),
    ]);

    setStats({
      totalTasks: tasksRes.count ?? 0,
      totalVolunteers: volRes.count ?? 0,
      pendingApprovals: pendingRes.count ?? 0,
      assignmentsToday: todayRes.count ?? 0,
    });

    setRecent((recentRes.data as RecentRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statCards = stats
    ? [
        {
          title: 'Total tasks',
          value: stats.totalTasks,
          icon: ClipboardList,
          description: 'Across all events',
        },
        {
          title: 'Volunteers',
          value: stats.totalVolunteers,
          icon: Users,
          description: 'Registered profiles',
        },
        {
          title: 'Pending approvals',
          value: stats.pendingApprovals,
          icon: UserCheck,
          description: 'Awaiting review',
        },
        {
          title: 'Assignments today',
          value: stats.assignmentsToday,
          icon: CalendarClock,
          description: 'New or updated today',
        },
      ]
    : [];

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading dashboard…</p>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coordinator overview</h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          Snapshot of tasks, volunteers, and latest assignments.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ title, value, icon: Icon, description }) => (
          <Card key={title} className="border-muted/80 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-muted/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-semibold">Recent activity</CardTitle>
              <CardDescription className="mt-1">
                Latest assignment updates (who was placed on which task).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-0 divide-y rounded-md border bg-muted/20">
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No assignment activity yet.</p>
          ) : (
            recent.map((row) => {
              const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
              const vol = row.volunteers;
              const profNested = vol && (Array.isArray(vol.profiles) ? vol.profiles[0] : vol.profiles);
              const name = profNested?.full_name ?? 'Volunteer';
              const taskName = task?.name ?? 'Task';
              const when = row.assigned_at
                ? format(parseISO(row.assigned_at), "MMM d, yyyy · h:mm a")
                : '—';
              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-0.5 py-3.5 px-1 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground"> assigned to </span>
                    <span className="font-medium">{taskName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums sm:text-right">{when}</p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
