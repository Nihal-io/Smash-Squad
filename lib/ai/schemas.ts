import { z } from 'zod';

export const CreateTaskIntent = z.object({
  intent: z.literal('create_task'),
  params: z.object({
    name: z.string(),
    slot_start_iso: z.string(),
    slot_end_iso: z.string(),
    volunteers_needed: z.number().int().positive(),
    skills_required: z.array(z.string()).default([]),
  }),
});

export const DropAssignmentIntent = z.object({
  intent: z.literal('drop_assignment'),
  params: z.object({
    volunteer_name_or_email: z.string(),
    task_hint: z.string(),
    reason: z.string(),
  }),
});

export const QueryVolunteersIntent = z.object({
  intent: z.literal('query_volunteers'),
  params: z.object({
    availability_window_start_iso: z.string().nullable(),
    availability_window_end_iso: z.string().nullable(),
    required_skills: z.array(z.string()),
    status_filter: z.enum(['approved', 'pending', 'any']).default('approved'),
  }),
});

export const EditTaskIntent = z.object({
  intent: z.literal('edit_task'),
  params: z.object({
    task_hint: z.string(),
    new_slot_start_iso: z.string().nullable(),
    new_slot_end_iso: z.string().nullable(),
    new_volunteers_needed: z.number().int().nullable(),
    skills_to_add: z.array(z.string()),
    skills_to_remove: z.array(z.string()),
  }),
});

export const UnknownIntent = z.object({
  intent: z.literal('unknown'),
  clarification_needed: z.string(),
});

export const CommandIntent = z.discriminatedUnion('intent', [
  CreateTaskIntent,
  DropAssignmentIntent,
  QueryVolunteersIntent,
  EditTaskIntent,
  UnknownIntent,
]);

export type CommandIntent = z.infer<typeof CommandIntent>;
