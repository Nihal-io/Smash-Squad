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
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Users, Clock, Zap, Calendar, Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

type Stats = {
  totalTasks: number;
  totalVolunteers: number;
  pendingApprovals: number;
  activeAssignments: number;
};

type UpcomingTask = {
  id: string;
  name: string;
  slot_start: string;
  slot_end: string;
  volunteers_needed: number;
  skills_required: string[];
  assigned: number;
  fill_status: 'full' | 'partial' | 'empty';
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

const FILL_BADGE: Record<UpcomingTask['fill_status'], string> = {
  full: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  partial: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100',
  empty: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
};

export default function CoordinatorDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingTask[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();

    const [tasksRes, volRes, pendingRes, assignedRes, upcomingRes, recentRes] = await Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true }),
      supabase.from('volunteers').select('*', { count: 'exact', head: true }),
      supabase.from('volunteers').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('assignments').select('*', { count: 'exact', head: true }).eq('status', 'assigned'),
      supabase
        .from('tasks')
        .select('id, name, slot_start, slot_end, volunteers_needed, skills_required')
        .order('slot_start', { ascending: true })
        .limit(40),
      supabase
        .from('assignments')
        .select(
          'id, assigned_at, status, tasks:task_id(name), volunteers:volunteer_id(profiles:profile_id(full_name))'
        )
        .not('assigned_at', 'is', null)
        .order('assigned_at', { ascending: false })
        .limit(5),
    ]);

    const ordered = upcomingRes.data ?? [];
    const nowMs = Date.now();
    const picked: typeof ordered = [];
    for (const t of ordered) {
      if (picked.length >= 3) break;
      if (new Date(t.slot_start).getTime() >= nowMs) picked.push(t);
    }
    for (const t of ordered) {
      if (picked.length >= 3) break;
      if (!picked.some((p) => p.id === t.id)) picked.push(t);
    }
    const rows = picked.slice(0, 3);

    const upcomingBuilt: UpcomingTask[] = [];
    for (const t of rows) {
      const { count } = await supabase
        .from('assignments')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', t.id)
        .eq('status', 'assigned');
      const assigned = count ?? 0;
      const need = t.volunteers_needed;
      let fill_status: UpcomingTask['fill_status'] = 'empty';
      if (assigned >= need) fill_status = 'full';
      else if (assigned > 0) fill_status = 'partial';
      upcomingBuilt.push({
        id: t.id,
        name: t.name,
        slot_start: t.slot_start,
        slot_end: t.slot_end,
        volunteers_needed: need,
        skills_required: t.skills_required ?? [],
        assigned,
        fill_status,
      });
    }

    setStats({
      totalTasks: tasksRes.count ?? 0,
      totalVolunteers: volRes.count ?? 0,
      pendingApprovals: pendingRes.count ?? 0,
      activeAssignments: assignedRes.count ?? 0,
    });
    setUpcoming(upcomingBuilt);
    setRecent((recentRes.data as RecentRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statDefs = stats
    ? [
        {
          title: 'Total Tasks',
          value: stats.totalTasks,
          icon: ClipboardList,
          iconWrap: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300',
        },
        {
          title: 'Volunteers',
          value: stats.totalVolunteers,
          icon: Users,
          iconWrap: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
        },
        {
          title: 'Pending Approvals',
          value: stats.pendingApprovals,
          icon: Clock,
          iconWrap: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
        },
        {
          title: 'Active Assignments',
          value: stats.activeAssignments,
          icon: Zap,
          iconWrap: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300',
        },
      ]
    : [];

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading dashboard…</p>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Coordinator overview</h1>
        <p className="text-muted-foreground text-base mt-2 max-w-2xl leading-relaxed">
          Manage staffing, track approvals, and keep TechFest running smoothly.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statDefs.map(({ title, value, icon: Icon, iconWrap }) => (
          <Card
            key={title}
            className="border-border/80 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <CardContent className="flex gap-4 pt-6 pb-6">
              <div
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
                  iconWrap
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {title}
                </p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight mt-1">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg font-semibold">Upcoming tasks</CardTitle>
              <CardDescription className="mt-1">
                Next shifts on the calendar — fill status and required skills.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No tasks scheduled yet. Create one from Tasks.</p>
          ) : (
            upcoming.map((t) => (
              <div
                key={t.id}
                className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-2 min-w-0">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(t.slot_start), 'EEE, MMM d · h:mm a')} –{' '}
                    {format(parseISO(t.slot_end), 'h:mm a')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(t.skills_required ?? []).length === 0 ? (
                      <Badge variant="outline" className="text-xs font-normal">
                        Open to all skills
                      </Badge>
                    ) : (
                      t.skills_required.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs font-normal">
                          {s}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t.assigned}/{t.volunteers_needed} filled
                  </span>
                  <Badge className={cn('font-medium capitalize', FILL_BADGE[t.fill_status])}>
                    {t.fill_status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg font-semibold">Recent activity</CardTitle>
              <CardDescription className="mt-1">Latest assignment updates across tasks.</CardDescription>
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
                ? format(parseISO(row.assigned_at), 'MMM d, yyyy · h:mm a')
                : '—';
              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-0.5 py-3.5 px-1 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium">{taskName}</span>
                    {row.status ? (
                      <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                        {row.status}
                      </Badge>
                    ) : null}
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
