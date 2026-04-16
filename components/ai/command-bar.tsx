'use client';

import { useState } from 'react';
import { devFetch } from '@/lib/dev/dev-fetch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Loader2, Check, X } from 'lucide-react';
import type { CommandIntent } from '@/lib/ai/schemas';

interface CommandBarProps {
  onTaskCreated?: () => void;
}

export function CommandBar({ onTaskCreated }: CommandBarProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<CommandIntent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setIntent(null);
    setError(null);

    try {
      const res = await devFetch('/api/ai/command', {
        method: 'POST',
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Parse failed');
        return;
      }

      setIntent(data.intent);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!intent || intent.intent === 'unknown') return;

    try {
      if (intent.intent === 'create_task') {
        const res = await devFetch('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            name: intent.params.name,
            slot_start: intent.params.slot_start_iso,
            slot_end: intent.params.slot_end_iso,
            volunteers_needed: intent.params.volunteers_needed,
            skills_required: intent.params.skills_required,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Failed to create task');
          return;
        }
        toast.success(
          `Task "${intent.params.name}" created - ${data.reconcile.filled} assigned`
        );
        onTaskCreated?.();
      } else if (intent.intent === 'query_volunteers') {
        toast.info('Volunteer query - check the volunteers tab for results');
      } else if (intent.intent === 'drop_assignment') {
        toast.info(
          `To drop ${intent.params.volunteer_name_or_email}: find them in the task list and click Drop`
        );
      } else if (intent.intent === 'edit_task') {
        toast.info(
          `To edit "${intent.params.task_hint}": find it in the task list and use the edit flow`
        );
      }

      setIntent(null);
      setInput('');
    } catch {
      toast.error('Action failed');
    }
  };

  const handleCancel = () => {
    setIntent(null);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading && !intent) {
      e.preventDefault();
      handleParse();
    }
  };

  return (
    <div className="mb-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Try: "need 3 people for stage setup tomorrow 2-4pm, must know electrical"'
            className="pl-9"
            disabled={loading}
          />
        </div>
        <Button onClick={handleParse} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Parse'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

      {intent && (
        <Card className="mt-3">
          <CardContent className="py-3">
            {intent.intent === 'unknown' ? (
              <div>
                <Badge variant="secondary">Clarification needed</Badge>
                <p className="text-sm mt-2">{intent.clarification_needed}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={handleCancel}
                >
                  Dismiss
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge>{intent.intent.replace('_', ' ')}</Badge>
                  {intent.intent === 'create_task' && (
                    <span className="text-sm text-muted-foreground">
                      Ready to create
                    </span>
                  )}
                </div>

                <div className="text-sm space-y-1">
                  {intent.intent === 'create_task' && (
                    <>
                      <p>
                        <strong>Name:</strong> {intent.params.name}
                      </p>
                      <p>
                        <strong>Time:</strong>{' '}
                        {new Date(intent.params.slot_start_iso).toLocaleString()} -{' '}
                        {new Date(intent.params.slot_end_iso).toLocaleTimeString()}
                      </p>
                      <p>
                        <strong>Volunteers:</strong> {intent.params.volunteers_needed}
                      </p>
                      <p>
                        <strong>Skills:</strong>{' '}
                        {intent.params.skills_required.join(', ') || 'any'}
                      </p>
                    </>
                  )}
                  {intent.intent === 'drop_assignment' && (
                    <>
                      <p>
                        <strong>Volunteer:</strong>{' '}
                        {intent.params.volunteer_name_or_email}
                      </p>
                      <p>
                        <strong>Task:</strong> {intent.params.task_hint || 'not specified'}
                      </p>
                      <p>
                        <strong>Reason:</strong> {intent.params.reason || 'none given'}
                      </p>
                    </>
                  )}
                  {intent.intent === 'query_volunteers' && (
                    <>
                      <p>
                        <strong>Skills:</strong>{' '}
                        {intent.params.required_skills.join(', ') || 'any'}
                      </p>
                      <p>
                        <strong>Status:</strong> {intent.params.status_filter}
                      </p>
                    </>
                  )}
                  {intent.intent === 'edit_task' && (
                    <>
                      <p>
                        <strong>Task:</strong> {intent.params.task_hint}
                      </p>
                      {intent.params.new_volunteers_needed && (
                        <p>
                          <strong>New count:</strong> {intent.params.new_volunteers_needed}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={handleConfirm}>
                    <Check className="h-3 w-3 mr-1" />
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
