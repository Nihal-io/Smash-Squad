'use client';

import { useEffect, useState, useCallback } from 'react';
import { devFetch } from '@/lib/dev/dev-fetch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface Volunteer {
  id: string;
  profile_id: string;
  status: string;
  skills: string[];
  availability: Array<{ start: string; end: string }>;
  profiles: { full_name: string; email: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const STATUS_BORDER: Record<string, string> = {
  pending: 'border-l-amber-400',
  approved: 'border-l-emerald-500',
  rejected: 'border-l-red-500',
};

export default function VolunteersPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchVolunteers = useCallback(async () => {
    try {
      const res = await devFetch('/api/volunteers/list');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setVolunteers(data.volunteers ?? []);
    } catch {
      toast.error('Failed to load volunteers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVolunteers();
  }, [fetchVolunteers]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActing(id);
    try {
      const res = await devFetch(`/api/volunteers/${id}/${action}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `${action} failed`);
        return;
      }
      toast.success(
        action === 'approve'
          ? `Approved - ${data.new_assignments ?? 0} auto-assigned`
          : 'Rejected'
      );
      fetchVolunteers();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading volunteers...</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Volunteers</h1>
        <p className="text-muted-foreground mt-2 max-w-xl leading-relaxed">
          Review and approve volunteer applications before they are assigned to tasks.
        </p>
      </div>
      {volunteers.length === 0 ? (
        <p className="text-muted-foreground">No volunteers registered yet.</p>
      ) : (
        <div className="space-y-3">
          {volunteers.map((v) => {
            const profile = Array.isArray(v.profiles)
              ? (v.profiles as unknown as { full_name: string; email: string }[])[0]
              : v.profiles;
            return (
              <Card
                key={v.id}
                className={`border-l-4 ${STATUS_BORDER[v.status] ?? 'border-l-slate-300'} shadow-sm transition-shadow duration-200 hover:shadow-md`}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="space-y-1">
                    <p className="font-medium">{profile?.full_name ?? 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {v.skills.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        STATUS_COLORS[v.status] ?? ''
                      }`}
                    >
                      {v.status}
                    </span>
                    {v.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAction(v.id, 'approve')}
                          disabled={acting === v.id}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(v.id, 'reject')}
                          disabled={acting === v.id}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
