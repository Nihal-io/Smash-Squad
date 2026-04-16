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
import { ClipboardList, Users, Clock, Zap, Calendar } from 'lucide-react';
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
  assigned: number;
  fill_status: 'full' | 'partial' | 'empty';
};

const FILL_BADGE: Record<UpcomingTask['fill_status'], string> = {
  full: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  partial: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100',
  empty: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
};

export default function CoordinatorDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();

    const [tasksRes, volRes, pendingRes, assignedRes, upcomingRes] = await Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true }),
      supabase.from('volunteers').select('*', { count: 'exact', head: true }),
      supabase.from('volunteers').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('assignments').select('*', { count: 'exact', head: true }).eq('status', 'assigned'),
      supabase
        .from('tasks')
        .select('id, name, slot_start, slot_end, volunteers_needed')
        .order('slot_start', { ascending: true })
        .limit(40),
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
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statDefs = stats
    ? [
        {
          title: 'Total tasks',
          value: stats.totalTasks,
          icon: ClipboardList,
          description: 'Scheduled shifts',
          warn: false,
        },
        {
          title: 'Total volunteers',
          value: stats.totalVolunteers,
          icon: Users,
          description: 'Registered in FestFlow',
          warn: false,
        },
        {
          title: 'Pending approvals',
          value: stats.pendingApprovals,
          icon: Clock,
          description: 'Applications awaiting review',
          warn: stats.pendingApprovals > 0,
        },
        {
          title: 'Active assignments',
          value: stats.activeAssignments,
          icon: Zap,
          description: 'Volunteers currently assigned',
          warn: false,
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statDefs.map(({ title, value, icon: Icon, description, warn }) => (
          <Card
            key={title}
            className={cn(
              'border-border/80 shadow-sm hover:shadow-md transition-shadow duration-200',
              warn && 'ring-1 ring-amber-300/80 border-amber-200/60'
            )}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  warn && value > 0 ? 'text-amber-600' : 'text-muted-foreground'
                )}
                aria-hidden
              />
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{description}</p>
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
                Next shifts on the calendar — with live fill status.
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
                className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(t.slot_start), 'EEE, MMM d · h:mm a')} –{' '}
                    {format(parseISO(t.slot_end), 'h:mm a')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
    </div>
  );
}
