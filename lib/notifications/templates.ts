// lib/notifications/templates.ts — notification template builders (Commit C8)
import type { Notification } from './types';

// Minimal shapes — just what templates need, not full DB rows
export interface TemplateVolunteer {
  full_name: string;
  email: string;
}

export interface TemplateTask {
  name: string;
  slot_start: string; // ISO 8601
  slot_end: string;
  skills_required?: string[];
}

function formatSlot(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateStr = start.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeStr = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr}, ${timeStr(start)} – ${timeStr(end)}`;
}

export function assignmentNotification(
  volunteer: TemplateVolunteer,
  task: TemplateTask
): Notification {
  const slot = formatSlot(task.slot_start, task.slot_end);
  const skillLine = task.skills_required?.length
    ? `\nSkills needed: ${task.skills_required.join(', ')}`
    : '';

  return {
    kind: 'assignment',
    recipient: { email: volunteer.email, name: volunteer.full_name },
    subject: `You're assigned: ${task.name}`,
    body:
      `Hi ${volunteer.full_name.split(' ')[0]},\n\n` +
      `You've been assigned to "${task.name}".\n` +
      `When: ${slot}${skillLine}\n\n` +
      `See you there!`,
    metadata: { task_name: task.name, slot_start: task.slot_start },
  };
}

export function dropoutReassignmentNotification(
  volunteer: TemplateVolunteer,
  task: TemplateTask
): Notification {
  const slot = formatSlot(task.slot_start, task.slot_end);
  return {
    kind: 'dropout_reassignment',
    recipient: { email: volunteer.email, name: volunteer.full_name },
    subject: `You're now assigned: ${task.name}`,
    body:
      `Hi ${volunteer.full_name.split(' ')[0]},\n\n` +
      `A spot opened up and you've been promoted from the waitlist to "${task.name}".\n` +
      `When: ${slot}\n\n` +
      `Please confirm you can make it.`,
    metadata: { task_name: task.name, promoted_from: 'waitlist' },
  };
}

export function approvalNotification(volunteer: TemplateVolunteer): Notification {
  return {
    kind: 'approval',
    recipient: { email: volunteer.email, name: volunteer.full_name },
    subject: 'Your volunteer application is approved',
    body:
      `Hi ${volunteer.full_name.split(' ')[0]},\n\n` +
      `Your volunteer application has been approved. You'll start receiving task assignments matching your skills and availability.\n\n` +
      `Welcome aboard!`,
  };
}

export function rejectionNotification(
  volunteer: TemplateVolunteer,
  reason?: string
): Notification {
  const reasonLine = reason ? `\nReason: ${reason}\n` : '';
  return {
    kind: 'rejection',
    recipient: { email: volunteer.email, name: volunteer.full_name },
    subject: 'Update on your volunteer application',
    body:
      `Hi ${volunteer.full_name.split(' ')[0]},\n\n` +
      `Thank you for applying. Unfortunately, we're unable to bring you on as a volunteer at this time.${reasonLine}\n` +
      `If you'd like to discuss, reach out to the coordinators directly.`,
    metadata: reason ? { reason } : undefined,
  };
}

export function taskCancelledNotification(
  volunteer: TemplateVolunteer,
  task: TemplateTask
): Notification {
  return {
    kind: 'task_cancelled',
    recipient: { email: volunteer.email, name: volunteer.full_name },
    subject: `Cancelled: ${task.name}`,
    body:
      `Hi ${volunteer.full_name.split(' ')[0]},\n\n` +
      `"${task.name}" has been cancelled. You're no longer expected for this slot.\n\n` +
      `You'll be considered for future tasks matching your skills.`,
    metadata: { task_name: task.name },
  };
}

export function volunteerBriefingNotification(
  volunteer: TemplateVolunteer,
  tasks: TemplateTask[]
): Notification {
  const taskLines = tasks
    .map((t) => `• ${t.name} — ${formatSlot(t.slot_start, t.slot_end)}`)
    .join('\n');

  return {
    kind: 'volunteer_briefing',
    recipient: { email: volunteer.email, name: volunteer.full_name },
    subject: `Your schedule for the upcoming event`,
    body:
      `Hi ${volunteer.full_name.split(' ')[0]},\n\n` +
      `Here's your confirmed schedule:\n\n${taskLines}\n\n` +
      `Show up on time. Reach out to your coordinator if anything comes up.`,
    metadata: { task_count: tasks.length },
  };
}