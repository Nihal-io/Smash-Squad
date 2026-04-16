import type { Notifier, Notification } from './types';

const SEP = '═'.repeat(60);

export class ConsoleNotifier implements Notifier {
  async send(notifications: Notification[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const n of notifications) {
      try {
        console.log('\n' + SEP);
        console.log(`📧 [${n.kind.toUpperCase()}]`);
        console.log(`To:      ${n.recipient.name} <${n.recipient.email}>`);
        console.log(`Subject: ${n.subject}`);
        console.log('─'.repeat(60));
        console.log(n.body);
        if (n.metadata && Object.keys(n.metadata).length > 0) {
          console.log('─'.repeat(60));
          console.log('Metadata:', JSON.stringify(n.metadata, null, 2));
        }
        console.log(SEP + '\n');
        sent++;
      } catch (err) {
        console.error('Notification failed:', err);
        failed++;
      }
    }

    return { sent, failed };
  }
}
