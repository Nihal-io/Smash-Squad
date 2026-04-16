'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { devFetch } from '@/lib/dev/dev-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Calendar, Clock, Zap, AlertTriangle, Inbox } from 'lucide-react';

interface MyAssignment {
  id: string;
  status: string;
  assigned_at: string;
  task: {
    id: string;
    name: string;
    slot_start: string;
    slot_end: string;
    skills_required: string[];
  } | null;
}

export default function VolunteerDashboard() {
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);
  const [volunteerName, setVolunteerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasVolunteerRow, setHasVolunteerRow] = useState<boolean | null>(null);
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const loadDataRef = useRef<() => Promise<void>>(async () => {});

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile) setVolunteerName(profile.full_name ?? '');

      const { data: vol } = await supabase
        .from('volunteers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!vol) {
        setHasVolunteerRow(false);
        setVolunteerId(null);
        return;
      }

      setHasVolunteerRow(true);
      setVolunteerId(vol.id);

      const { data: myAssignments } = await supabase
        .from('assignments')
        .select(
          'id, status, assigned_at, tasks:task_id(id, name, slot_start, slot_end, skills_required)'
        )
        .eq('volunteer_id', vol.id)
        .in('status', ['assigned', 'waitlist'])
        .order('assigned_at', { ascending: true });

      const formatted: MyAssignment[] = (myAssignments ?? []).map((a) => {
        const task = Array.isArray(a.tasks) ? a.tasks[0] : a.tasks;
        return {
          id: a.id,
          status: a.status ?? 'assigned',
          assigned_at: a.assigned_at ?? '',
          task: task
            ? {
                id: task.id,
                name: task.name,
                slot_start: task.slot_start,
                slot_end: task.slot_end,
                skills_required: task.skills_required ?? [],
              }
            : null,
        };
      });

      setAssignments(formatted);
    } catch {
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  loadDataRef.current = loadData;

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!volunteerId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`my-assignments-${volunteerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
          filter: `volunteer_id=eq.${volunteerId}`,
        },
        () => {
          void loadDataRef.current();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [volunteerId]);

  const handleDrop = async (assignmentId: string, taskName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to drop from "${taskName}"? A replacement will be assigned automatically.`
    );
    if (!confirmed) return;

    try {
      const res = await devFetch(`/api/assignments/${assignmentId}/drop`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Volunteer self-drop' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Drop failed');
        return;
      }
      toast.success('Dropped successfully. A replacement has been notified.');
      loadData();
    } catch {
      toast.error('Something went wrong');
    }
  };

  const activeAssignments = assignments.filter((a) => a.status === 'assigned');
  const waitlistedAssignments = assignments.filter((a) => a.status === 'waitlist');
  const hasAnyAssignment = assignments.length > 0;

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading your dashboard…</p>
    );
  }

  if (hasVolunteerRow === false) {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="border-muted/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              Volunteer profile
            </CardTitle>
            <CardDescription>
              We don&apos;t have a volunteer record linked to your account yet. Register or ask a coordinator to
              add you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href="/volunteer/register">Register as a volunteer</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Volunteer dashboard</h1>
        <p className="text-muted-foreground mt-2 leading-relaxed">
          Your shifts, briefings, and updates in one place.
        </p>
      </div>

      <Card className="rounded-xl border border-border/80 shadow-md overflow-hidden bg-card dark:bg-card">
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600" />
        <CardHeader className="space-y-1 pt-5 border-l-4 border-indigo-500 pl-5 -ml-px">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Your briefing
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">
            {volunteerName ? `Hey ${volunteerName.split(' ')[0]}!` : 'Hey!'} Here is your schedule overview.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {!hasAnyAssignment ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center">
              <p className="text-sm font-medium text-foreground">
                No assignments yet — your coordinator will assign you soon.
              </p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Check back here for shifts, waitlist spots, and drop options once you&apos;re placed on a task.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No active assignments right now. You will be notified when you are assigned to a task.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed">
                    You have{' '}
                    <strong>{activeAssignments.length} active assignment{activeAssignments.length !== 1 ? 's' : ''}</strong>
                    {waitlistedAssignments.length > 0 && (
                      <>
                        {' '}
                        and <strong>{waitlistedAssignments.length} waitlisted</strong>
                      </>
                    )}
                    .
                  </p>
                  <div className="text-sm space-y-1.5">
                    {activeAssignments.map(
                      (a) =>
                        a.task && (
                          <p key={a.id}>
                            • <strong>{a.task.name}</strong> — {format(parseISO(a.task.slot_start), 'MMM d, h:mm a')}{' '}
                            to {format(parseISO(a.task.slot_end), 'h:mm a')}
                          </p>
                        )
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Show up on time. If you cannot make it, use the Drop button below so a replacement can be found
                    automatically.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          Active assignments
        </h2>
        {activeAssignments.length === 0 ? (
          <Card className="border-dashed border-muted-foreground/25 shadow-none">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              None currently — you&apos;ll see task cards here when you&apos;re assigned.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeAssignments.map(
              (a) =>
                a.task && (
                  <Card
                    key={a.id}
                    className="rounded-lg border-l-4 border-l-emerald-500 shadow-sm transition-shadow duration-200 hover:shadow-md overflow-hidden"
                  >
                    <CardContent className="py-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium leading-snug">{a.task.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {format(parseISO(a.task.slot_start), 'EEEE, MMM d · h:mm a')} –{' '}
                            {format(parseISO(a.task.slot_end), 'h:mm a')}
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {a.task.skills_required.map((s) => (
                              <Badge key={s} variant="outline" className="text-xs font-normal">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
                          <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                            Assigned
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                            onClick={() => handleDrop(a.id, a.task!.name)}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                            Drop
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
            )}
          </div>
        )}
      </section>

      {waitlistedAssignments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Waitlisted</h2>
          <div className="space-y-3">
            {waitlistedAssignments.map(
              (a) =>
                a.task && (
                  <Card
                    key={a.id}
                    className="rounded-lg border-l-4 border-l-amber-400 shadow-sm transition-shadow duration-200 hover:shadow-md opacity-95"
                  >
                    <CardContent className="py-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{a.task.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(a.task.slot_start), 'EEEE, MMM d · h:mm a')} –{' '}
                            {format(parseISO(a.task.slot_end), 'h:mm a')}
                          </p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-950 w-fit dark:bg-amber-950 dark:text-amber-100">
                          Waitlisted
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
