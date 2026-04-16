'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  subject: string;
  body: string;
  read: boolean;
  created_at: string | null;
  kind: string;
};

interface NotificationBellProps {
  userId: string | null;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [items, setItems] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('id, subject, body, read, created_at, kind')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[notifications]', error.message);
      return;
    }
    setItems((data as Row[]) ?? []);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const unread = items.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    const supabase = createClient();
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">Recent updates for your account</p>
        </div>
        <div className="max-h-[min(70vh,360px)] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={cn(
                  'flex w-full flex-col gap-1 border-b px-3 py-3 text-left text-sm transition-colors last:border-0 hover:bg-muted/60',
                  !n.read && 'bg-muted/30'
                )}
                onClick={() => void markRead(n.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn('font-medium leading-snug', !n.read && 'text-foreground')}>
                    {n.subject}
                  </span>
                  {!n.read ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-1" aria-hidden />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{n.body}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {n.created_at ? format(parseISO(n.created_at), 'MMM d · h:mm a') : ''}
                  <span className="ml-2 opacity-70">{n.kind}</span>
                </p>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
