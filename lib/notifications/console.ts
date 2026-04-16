import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Notifier, Notification } from './types';

const SEP = '═'.repeat(60);

async function persistNotifications(notifications: Notification[]): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const supabase = createServiceClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const n of notifications) {
    const { data: profile, error: lookupErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', n.recipient.email)
      .maybeSingle();

    if (lookupErr || !profile) {
      continue;
    }

    const { error: insertErr } = await supabase.from('notifications').insert({
      recipient_id: profile.id,
      kind: n.kind,
      subject: n.subject,
      body: n.body,
      read: false,
    });

    if (insertErr) {
      console.error('[notifications] failed to persist notification row:', insertErr.message);
    }
  }
}

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

    try {
      await persistNotifications(notifications);
    } catch (err) {
      console.error('[notifications] persist batch failed:', err);
    }

    return { sent, failed };
  }
}
