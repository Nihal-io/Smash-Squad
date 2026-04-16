import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Notifier, Notification } from './types';

export class DatabaseNotifier implements Notifier {
  async send(notifications: Notification[]): Promise<{ sent: number; failed: number }> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return { sent: 0, failed: notifications.length };
    }

    const supabase = createServiceClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let sent = 0;
    let failed = 0;

    for (const n of notifications) {
      const { data: profile, error: lookupErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', n.recipient.email)
        .maybeSingle();

      if (lookupErr || !profile) {
        failed++;
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
        console.error('[DatabaseNotifier] insert failed:', insertErr.message);
        failed++;
      } else {
        sent++;
      }
    }

    return { sent, failed };
  }
}
