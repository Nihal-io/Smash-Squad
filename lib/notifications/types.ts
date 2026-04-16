export type NotificationKind =
  | 'assignment'
  | 'dropout_reassignment'
  | 'volunteer_briefing'
  | 'approval'
  | 'rejection'
  | 'task_cancelled';

export interface Notification {
  kind: NotificationKind;
  recipient: { email: string; name: string };
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface Notifier {
  send(notifications: Notification[]): Promise<{ sent: number; failed: number }>;
}