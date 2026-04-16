'use client';

import { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, isSameDay, parseISO } from 'date-fns';
import { DayButton as DayButtonPrimitive } from 'react-day-picker';
import type { ComponentProps } from 'react';

type DayButtonProps = ComponentProps<typeof DayButtonPrimitive>;

type AssignmentRow = {
  id: string;
  status: string;
  volunteer_name: string;
  volunteer_skills: string[];
  explanation?: string | null;
  assigned_at?: string;
};

interface TaskForCalendar {
  id: string;
  name: string;
  slot_start: string;
  slot_end: string;
  volunteers_needed: number;
  skills_required: string[];
  counts: { assigned: number; waitlist: number; dropped: number };
  fill_status: 'full' | 'partial' | 'empty';
}

interface TaskCalendarProps {
  tasks: TaskForCalendar[];
  onSelectTask: (taskId: string) => void;
  expandedTask: string | null;
  assignments: AssignmentRow[];
  loadingAssignments: boolean;
  onDrop: (assignmentId: string) => void;
  promotedAssignmentIds?: Set<string>;
}

const FILL_COLORS = {
  full: 'bg-green-100 text-green-800 border-green-200',
  partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  empty: 'bg-red-100 text-red-800 border-red-200',
};

const DOT_COLORS = {
  full: 'bg-green-500',
  partial: 'bg-yellow-500',
  empty: 'bg-red-500',
};

export function TaskCalendar({
  tasks,
  onSelectTask,
  expandedTask,
  assignments,
  loadingAssignments,
  onDrop,
  promotedAssignmentIds = new Set(),
}: TaskCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Map dates to their worst fill status (for dot color)
  const dateStatusMap = useMemo(() => {
    const map = new Map<string, 'full' | 'partial' | 'empty'>();
    for (const t of tasks) {
      const dateKey = format(parseISO(t.slot_start), 'yyyy-MM-dd');
      const existing = map.get(dateKey);
      // Priority: empty > partial > full (show the worst status)
      if (!existing || t.fill_status === 'empty' || (t.fill_status === 'partial' && existing === 'full')) {
        map.set(dateKey, t.fill_status);
      }
    }
    return map;
  }, [tasks]);

  // Dates that have tasks
  const datesWithTasks = useMemo(
    () => tasks.map((t) => parseISO(t.slot_start)),
    [tasks]
  );

  // Tasks for the selected date
  const tasksForDay = useMemo(
    () =>
      tasks
        .filter((t) => isSameDay(parseISO(t.slot_start), selectedDate))
        .sort(
          (a, b) =>
            new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime()
        ),
    [tasks, selectedDate]
  );

  return (
    <div className="flex gap-6 mt-4 flex-col lg:flex-row">
      {/* Left: date picker */}
      <div className="shrink-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
          modifiers={{ hasTasks: datesWithTasks }}
          modifiersStyles={{
            hasTasks: { fontWeight: 700 },
          }}
          components={{
            DayButton: (props: DayButtonProps) => {
              const { day, modifiers, children, ...rest } = props;
              const dateKey = format(day.date, 'yyyy-MM-dd');
              const status = dateStatusMap.get(dateKey);
              return (
                <DayButtonPrimitive day={day} modifiers={modifiers} {...rest}>
                  <span className="relative flex w-full flex-col items-center justify-center">
                    {children}
                    {status && (
                      <span
                        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full ${DOT_COLORS[status]}`}
                      />
                    )}
                  </span>
                </DayButtonPrimitive>
              );
            },
          }}
        />
      </div>

      {/* Right: day's tasks */}
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold mb-3">
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h3>

        {tasksForDay.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tasks scheduled for this day.</p>
        ) : (
          <div className="space-y-3">
            {tasksForDay.map((t) => (
              <Card
                key={t.id}
                className={`border-l-4 cursor-pointer transition-shadow hover:shadow-md ${
                  FILL_COLORS[t.fill_status]
                }`}
                onClick={() => onSelectTask(t.id)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{t.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(t.slot_start), 'h:mm a')} -{' '}
                        {format(parseISO(t.slot_end), 'h:mm a')}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {t.skills_required.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-medium">
                        {t.counts.assigned}/{t.volunteers_needed}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {t.counts.waitlist} waitlisted
                      </p>
                    </div>
                  </div>

                  {/* Inline assignment detail */}
                  {expandedTask === t.id && (
                    <div className="mt-3 pt-3 border-t border-border">
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
                                <span className="text-foreground">{a.volunteer_name}</span>
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
                                    onDrop(a.id);
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
      </div>
    </div>
  );
}
