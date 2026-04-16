export type Role = 'admin' | 'coordinator' | 'volunteer' | 'participant';

export const permissions = {
  'events.create':       ['admin'],
  'events.edit':         ['admin'],
  'events.delete':       ['admin'],
  'events.view':         ['admin', 'coordinator', 'volunteer', 'participant'],
  'events.register':     ['participant'],
  'tasks.create':        ['admin', 'coordinator'],
  'tasks.edit':          ['admin', 'coordinator'],
  'tasks.delete':        ['admin', 'coordinator'],
  'tasks.view':          ['admin', 'coordinator', 'volunteer'],
  'volunteers.viewAll':  ['admin', 'coordinator'],
  'volunteers.approve':  ['admin', 'coordinator'],
  'volunteers.reject':   ['admin', 'coordinator'],
  'registrations.viewAll': ['admin', 'coordinator'],
  'scrutiny.access':     ['admin'],
  'bulk.approve':        ['admin'],
  'attendance.scan':     ['admin', 'coordinator'],
  'attendance.manual':   ['admin', 'coordinator'],
  'passes.viewAll':      ['admin'],
  'passes.viewOwn':      ['participant'],
  'certificates.generate': ['admin'],
  'analytics.view':      ['admin'],
  'notifications.view':  ['admin', 'coordinator', 'volunteer', 'participant'],
  'ai.command':          ['admin', 'coordinator'],
  'ai.resolveConflict':  ['admin', 'coordinator'],
} as const;

export type Permission = keyof typeof permissions;

export function can(role: Role | null | undefined, action: Permission): boolean {
  if (!role) return false;
  return (permissions[action] as readonly Role[]).includes(role);
}