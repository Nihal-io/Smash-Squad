import { ConsoleNotifier } from './console';
import type { Notifier } from './types';

let instance: Notifier | null = null;

export function getNotifier(): Notifier {
  if (!instance) {
    // To swap in Resend later, change this line:
    // instance = process.env.RESEND_API_KEY
    //   ? new ResendNotifier(process.env.RESEND_API_KEY)
    //   : new ConsoleNotifier();
    instance = new ConsoleNotifier();
  }
  return instance;
}
