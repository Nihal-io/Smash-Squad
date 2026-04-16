'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { devFetch } from '@/lib/dev/dev-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Calendar, Clock, Zap, AlertTriangle } from 'lucide-react';

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

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile) setVolunteerName(profile.full_name ?? '');

      // Get volunteer id
      const { data: vol } = await supabase
        .from('volunteers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!vol) return;

      // Get assignments with task details
      const { data: myAssignments } = await supabase
        .from('assignments')
        .select('id, status, assigned_at, tasks:task_id(id, name, slot_start, slot_end, skills_required)')
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

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  if (loading) {
    return <p className="text-muted-foreground">Loading your dashboard...</p>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Personalized Briefing */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Your Briefing
          </CardTitle>
          <CardDescription>
            {volunteerName ? `Hey ${volunteerName.split(' ')[0]}!` : 'Hey!'} Here is your schedule overview.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active assignments yet. You will be notified when you are assigned to a task.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                You have <strong>{activeAssignments.length} active assignment{activeAssignments.length !== 1 ? 's' : ''}</strong>
                {waitlistedAssignments.length > 0 && (
                  <>
                    {' '}
                    and <strong>{waitlistedAssignments.length} waitlisted</strong>
                  </>
                )}
                .
              </p>
              <div className="text-sm space-y-1">
                {activeAssignments.map(
                  (a) =>
                    a.task && (
                      <p key={a.id}>
                        • <strong>{a.task.name}</strong> — {format(parseISO(a.task.slot_start), 'MMM d, h:mm a')} to{' '}
                        {format(parseISO(a.task.slot_end), 'h:mm a')}
                      </p>
                    )
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Show up on time. If you cannot make it, use the Drop button below so a replacement can be found automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Assignments */}
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        Active Assignments
      </h2>
      {activeAssignments.length === 0 ? (
        <p className="text-muted-foreground text-sm mb-6">None currently.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {activeAssignments.map(
            (a) =>
              a.task && (
                <Card key={a.id} className="border-l-4 border-l-green-500">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{a.task.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(a.task.slot_start), 'EEEE, MMM d · h:mm a')} –{' '}
                          {format(parseISO(a.task.slot_end), 'h:mm a')}
                        </p>
                        <div className="flex gap-1 mt-2">
                          {a.task.skills_required.map((s) => (
                            <Badge key={s} variant="outline" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className="bg-green-100 text-green-800">Assigned</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleDrop(a.id, a.task!.name)}
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
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

      {/* Waitlisted */}
      {waitlistedAssignments.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Waitlisted</h2>
          <div className="space-y-3">
            {waitlistedAssignments.map(
              (a) =>
                a.task && (
                  <Card key={a.id} className="border-l-4 border-l-yellow-500 opacity-75">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{a.task.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(a.task.slot_start), 'EEEE, MMM d · h:mm a')} –{' '}
                            {format(parseISO(a.task.slot_end), 'h:mm a')}
                          </p>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">Waitlisted</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
            )}
          </div>
        </>
      )}
    </div>
  );
}
