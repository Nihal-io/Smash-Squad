'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
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
import { Plus, Table, CalendarDays, Trash2, Pencil } from 'lucide-react';
import { CommandBar } from '@/components/ai/command-bar';
import { ResolutionPanel } from '@/components/ai/resolution-panel';
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
  full: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  partial: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100',
  empty: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
};

const TASK_BORDER: Record<Task['fill_status'], string> = {
  full: 'border-l-emerald-500',
  partial: 'border-l-amber-500',
  empty: 'border-l-red-500',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState<{
    name: string;
    slot_start: string;
    slot_end: string;
    volunteers_needed: number | '';
    skills_required: string;
  }>({
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

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('coordinator-tasks-assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
        },
        () => {
          void fetchTasks();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  const handleCreate = async () => {
    if (!form.name || !form.slot_start || !form.slot_end) {
      toast.error('Fill in all required fields');
      return;
    }

    const volunteersNeeded =
      form.volunteers_needed === '' ? NaN : form.volunteers_needed;
    if (!Number.isFinite(volunteersNeeded) || volunteersNeeded < 1) {
      toast.error('Volunteers needed must be at least 1');
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
          volunteers_needed: volunteersNeeded,
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
  const [resolveTaskId, setResolveTaskId] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    volunteers_needed: number | '';
    skills_required: string;
  }>({
    volunteers_needed: '',
    skills_required: '',
  });
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

  const handleDeleteTask = async (taskId: string, taskName: string) => {
    if (!window.confirm(`Delete task "${taskName}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await devFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete task');
        return;
      }
      toast.success('Task deleted');
      if (expandedTask === taskId) {
        setExpandedTask(null);
        setAssignments([]);
      }
      if (resolveTaskId === taskId) {
        setResolveTaskId(null);
      }
      fetchTasks();
    } catch {
      toast.error('Something went wrong');
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

  const parseSkills = (skillsText: string) =>
    skillsText
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

  const beginEdit = (task: Task) => {
    setEditTaskId(task.id);
    setEditForm({
      volunteers_needed: task.volunteers_needed,
      skills_required: task.skills_required.join(', '),
    });
  };

  const cancelEdit = () => {
    setEditTaskId(null);
    setEditForm({ volunteers_needed: '', skills_required: '' });
  };

  const saveEdit = async (task: Task) => {
    const volunteersNeeded =
      editForm.volunteers_needed === '' ? NaN : editForm.volunteers_needed;
    if (!Number.isFinite(volunteersNeeded) || volunteersNeeded < 1) {
      toast.error('Volunteers needed must be at least 1');
      return;
    }

    const nextSkills = parseSkills(editForm.skills_required);
    const prevSkills = task.skills_required.map((s) => s.toLowerCase());
    const payload: {
      volunteers_needed?: number;
      skills_required?: string[];
    } = {};

    if (volunteersNeeded !== task.volunteers_needed) {
      payload.volunteers_needed = volunteersNeeded;
    }
    if (nextSkills.join('|') !== prevSkills.join('|')) {
      payload.skills_required = nextSkills;
    }

    if (Object.keys(payload).length === 0) {
      toast.message('No changes to save');
      cancelEdit();
      return;
    }

    setSavingEdit(true);
    try {
      const res = await devFetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update task');
        return;
      }
      toast.success('Task updated');
      cancelEdit();
      void fetchTasks();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading tasks...</p>;
  }

  return (
    <div>
      <CommandBar onTaskCreated={fetchTasks} />
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-2 max-w-xl leading-relaxed">
            Manage event tasks and volunteer assignments.
          </p>
        </div>
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
                  value={form.volunteers_needed === '' ? '' : form.volunteers_needed}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') {
                      setForm({ ...form, volunteers_needed: '' });
                      return;
                    }
                    const n = parseInt(v, 10);
                    if (!Number.isNaN(n)) {
                      setForm({ ...form, volunteers_needed: n });
                    }
                  }}
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
                <Card
                  key={t.id}
                  className={`border-l-4 ${TASK_BORDER[t.fill_status]} shadow-sm transition-shadow duration-200 hover:shadow-md cursor-pointer`}
                >
                  <CardContent className="py-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => loadAssignments(t.id)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{t.name}</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            aria-label={`Edit ${t.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (editTaskId === t.id) {
                                cancelEdit();
                              } else {
                                beginEdit(t);
                              }
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
                        {editTaskId === t.id && (
                          <div
                            className="mt-3 rounded-md border bg-background p-3 space-y-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <Label className="text-xs">Volunteers Needed</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={editForm.volunteers_needed === '' ? '' : editForm.volunteers_needed}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '') {
                                      setEditForm((prev) => ({ ...prev, volunteers_needed: '' }));
                                      return;
                                    }
                                    const n = parseInt(v, 10);
                                    if (!Number.isNaN(n)) {
                                      setEditForm((prev) => ({ ...prev, volunteers_needed: n }));
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Skills Required</Label>
                                <Input
                                  value={editForm.skills_required}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      skills_required: e.target.value,
                                    }))
                                  }
                                  placeholder="electrical, logistics"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => void saveEdit(t)}
                                disabled={savingEdit}
                              >
                                {savingEdit ? 'Saving...' : 'Save'}
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={savingEdit}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div
                        className="text-right flex flex-col items-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              FILL_COLORS[t.fill_status]
                            }`}
                          >
                            {t.counts.assigned}/{t.volunteers_needed}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            aria-label={`Delete ${t.name}`}
                            onClick={() => void handleDeleteTask(t.id, t.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {t.fill_status !== 'full' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                setResolveTaskId((prev) => (prev === t.id ? null : t.id))
                              }
                            >
                              {resolveTaskId === t.id ? 'Close' : 'Resolve'}
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
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

                    {resolveTaskId === t.id && t.fill_status !== 'full' && (
                      <ResolutionPanel
                        taskId={t.id}
                        onResolved={() => {
                          fetchTasks();
                          if (expandedTask === t.id) {
                            window.setTimeout(() => {
                              void loadAssignments(t.id, 'refresh');
                            }, 300);
                          }
                          setResolveTaskId(null);
                        }}
                      />
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
