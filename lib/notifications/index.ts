import { ConsoleNotifier } from './console';
import { DatabaseNotifier } from './db';
import type { Notifier, Notification } from './types';

class CompositeNotifier implements Notifier {
  constructor(private readonly notifiers: Notifier[]) {}

  async send(notifications: Notification[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const n of this.notifiers) {
      const r = await n.send(notifications);
      sent += r.sent;
      failed += r.failed;
    }
    return { sent, failed };
  }
}

let instance: Notifier | null = null;

export function getNotifier(): Notifier {
  if (!instance) {
    instance = new CompositeNotifier([new ConsoleNotifier(), new DatabaseNotifier()]);
  }
  return instance;
}
