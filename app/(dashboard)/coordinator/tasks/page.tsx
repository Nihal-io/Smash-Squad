'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { devFetch } from '@/lib/dev/dev-fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Table, CalendarDays } from 'lucide-react';
import { CommandBar } from '@/components/ai/command-bar';
import { TaskCalendar } from '@/components/tasks/task-calendar';

interface Task {
  id: string;
  name: string;
  slot_start: string;
  slot_end: string;
  volunteers_needed: number;
  skills_required: string[];
  counts: { assigned: number; waitlist: number; dropped: number };
  fill_status: 'full' | 'partial' | 'empty';
}

type AssignmentRow = {
  id: string;
  status: string;
  volunteer_name: string;
  volunteer_skills: string[];
  explanation?: string | null;
  assigned_at?: string;
};

const FILL_COLORS = {
  full: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  empty: 'bg-red-100 text-red-800',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slot_start: '',
    slot_end: '',
    volunteers_needed: 2,
    skills_required: '',
  });

  const fetchTasks = useCallback(async () => {
    try {
      const res = await devFetch('/api/tasks');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreate = async () => {
    if (!form.name || !form.slot_start || !form.slot_end) {
      toast.error('Fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      const res = await devFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          slot_start: new Date(form.slot_start).toISOString(),
          slot_end: new Date(form.slot_end).toISOString(),
          volunteers_needed: form.volunteers_needed,
          skills_required: form.skills_required
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create task');
        return;
      }

      toast.success(
        `Task created - ${data.reconcile.filled} assigned, ${data.reconcile.still_short} still needed`
      );
      setDialogOpen(false);
      setForm({ name: '', slot_start: '', slot_end: '', volunteers_needed: 2, skills_required: '' });
      fetchTasks();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  // Assignment detail state - shared between table and calendar
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [promotedAssignmentIds, setPromotedAssignmentIds] = useState<Set<string>>(new Set());
  const promotionSnapshotRef = useRef<Pick<AssignmentRow, 'id' | 'status'>[] | null>(null);

  const loadAssignments = async (taskId: string, mode: 'toggle' | 'refresh' = 'toggle') => {
    if (mode === 'toggle') {
      if (expandedTask === taskId) {
        setExpandedTask(null);
        return;
      }
      setExpandedTask(taskId);
    } else if (expandedTask !== taskId) {
      return;
    }

    setLoadingAssignments(true);
    try {
      const res = await devFetch(`/api/tasks/${taskId}/assignments`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const next: AssignmentRow[] = data.assignments ?? [];
      setAssignments(next);

      if (mode === 'refresh' && promotionSnapshotRef.current) {
        const prev = promotionSnapshotRef.current;
        promotionSnapshotRef.current = null;
        const promoted = next
          .filter((n) => {
            const p = prev.find((x) => x.id === n.id);
            return p?.status === 'waitlist' && n.status === 'assigned';
          })
          .map((n) => n.id);
        if (promoted.length > 0) {
          setPromotedAssignmentIds(new Set(promoted));
          window.setTimeout(() => setPromotedAssignmentIds(new Set()), 5000);
        }
      }
    } catch {
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleDrop = async (assignmentId: string) => {
    try {
      promotionSnapshotRef.current = assignments.map((a) => ({ id: a.id, status: a.status }));
      const res = await devFetch(`/api/assignments/${assignmentId}/drop`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Manually dropped by coordinator' }),
      });
      const data = await res.json();
      if (!res.ok) {
        promotionSnapshotRef.current = null;
        toast.error(data.error || 'Drop failed');
        return;
      }
      toast.success(`Dropped - ${data.refilled} refilled from waitlist`);
      fetchTasks();
      // Brief delay so the engine's reassignment completes before we refetch
      if (expandedTask) {
        window.setTimeout(() => {
          void loadAssignments(expandedTask, 'refresh');
        }, 300);
      }
    } catch {
      promotionSnapshotRef.current = null;
      toast.error('Something went wrong');
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading tasks...</p>;
  }

  return (
    <div>
      <CommandBar onTaskCreated={fetchTasks} />
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label>Task Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Stage Setup"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Start</Label>
                  <Input
                    type="datetime-local"
                    value={form.slot_start}
                    onChange={(e) => setForm({ ...form, slot_start: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End</Label>
                  <Input
                    type="datetime-local"
                    value={form.slot_end}
                    onChange={(e) => setForm({ ...form, slot_end: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Volunteers Needed</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.volunteers_needed}
                  onChange={(e) =>
                    setForm({ ...form, volunteers_needed: parseInt(e.target.value, 10) || 1 })
                  }
                />
              </div>
              <div>
                <Label>Required Skills (comma separated)</Label>
                <Input
                  value={form.skills_required}
                  onChange={(e) => setForm({ ...form, skills_required: e.target.value })}
                  placeholder="electrical, logistics"
                />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? 'Creating...' : 'Create & Auto-Assign'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table" className="gap-2">
            <Table className="h-4 w-4" />
            Table
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground mt-4">No tasks yet.</p>
          ) : (
            <div className="space-y-3 mt-4">
              {tasks.map((t) => (
                <Card key={t.id}>
                  <CardContent className="py-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => loadAssignments(t.id)}
                    >
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(t.slot_start), 'MMM d, h:mm a')} -{' '}
                          {format(new Date(t.slot_end), 'h:mm a')}
                        </p>
                        <div className="flex gap-1 mt-1">
                          {t.skills_required.map((s) => (
                            <Badge key={s} variant="outline" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            FILL_COLORS[t.fill_status]
                          }`}
                        >
                          {t.counts.assigned}/{t.volunteers_needed}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.counts.waitlist} waitlisted
                        </p>
                      </div>
                    </div>

                    {expandedTask === t.id && (
                      <div className="mt-3 pt-3 border-t">
                        {loadingAssignments ? (
                          <p className="text-sm text-muted-foreground">Loading...</p>
                        ) : assignments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No assignments</p>
                        ) : (
                          <div className="space-y-2">
                            {assignments.map((a) => (
                              <div
                                key={a.id}
                                className={`flex items-center justify-between text-sm rounded-md px-1 py-0.5 -mx-1 ${
                                  promotedAssignmentIds.has(a.id)
                                    ? 'bg-amber-100/80 ring-1 ring-amber-300/80'
                                    : ''
                                }`}
                              >
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                                  <span>{a.volunteer_name}</span>
                                  {promotedAssignmentIds.has(a.id) && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      Just promoted
                                    </Badge>
                                  )}
                                  <span
                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                      a.status === 'assigned'
                                        ? 'bg-green-100 text-green-700'
                                        : a.status === 'waitlist'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {a.status}
                                  </span>
                                  {a.explanation && (
                                    <span className="text-xs text-muted-foreground italic">
                                      — {a.explanation}
                                    </span>
                                  )}
                                </div>
                                {a.status === 'assigned' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 h-7 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDrop(a.id);
                                    }}
                                  >
                                    Drop
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <TaskCalendar
            tasks={tasks}
            onSelectTask={loadAssignments}
            expandedTask={expandedTask}
            assignments={assignments}
            loadingAssignments={loadingAssignments}
            onDrop={handleDrop}
            promotedAssignmentIds={promotedAssignmentIds}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
