'use client';

import { useState } from 'react';
import { devFetch } from '@/lib/dev/dev-fetch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Loader2, Check, X, Send } from 'lucide-react';
import type { CommandIntent } from '@/lib/ai/schemas';

interface CommandBarProps {
  onTaskCreated?: () => void;
}

export function CommandBar({ onTaskCreated }: CommandBarProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [intent, setIntent] = useState<CommandIntent | null>(null);
  const [result, setResult] = useState<{ summary: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setIntent(null);
    setError(null);
    setResult(null);

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

  const handleExecute = async () => {
    if (!intent || intent.intent === 'unknown') return;
    setExecuting(true);

    try {
      const res = await devFetch('/api/ai/command/execute', {
        method: 'POST',
        body: JSON.stringify({
          intent: intent.intent,
          params: intent.params,
        }),
      });
      const data = await res.json();

      setResult({ summary: data.summary, ok: data.ok !== false });

      if (data.ok !== false) {
        toast.success(data.summary);
        onTaskCreated?.();
      } else {
        toast.error(data.summary);
      }

      setIntent(null);
      setInput('');
    } catch {
      toast.error('Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleCancel = () => {
    setIntent(null);
    setError(null);
    setResult(null);
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
            placeholder='e.g. "need 3 people for stage setup tomorrow 2-4pm" or "drop rahul, he is sick"'
            className="pl-9"
            disabled={loading || executing}
          />
        </div>
        <Button onClick={handleParse} disabled={loading || executing || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}

      {result && (
        <Card className={`mt-3 ${result.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="py-3 flex items-center justify-between">
            <p className="text-sm">{result.summary}</p>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              <X className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      )}

      {intent && (
        <Card className="mt-3 border-blue-200 bg-blue-50/50">
          <CardContent className="py-3">
            {intent.intent === 'unknown' ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Needs clarification</Badge>
                  <p className="text-sm">{intent.clarification_needed}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="capitalize">{intent.intent.replace(/_/g, ' ')}</Badge>
                    <span className="text-sm text-muted-foreground">Preview — confirm to execute</span>
                  </div>
                </div>

                <div className="text-sm space-y-0.5 mb-3">
                  {intent.intent === 'create_task' && (
                    <>
                      <p><span className="text-muted-foreground">Name:</span> {intent.params.name}</p>
                      <p><span className="text-muted-foreground">Time:</span> {new Date(intent.params.slot_start_iso).toLocaleString()} – {new Date(intent.params.slot_end_iso).toLocaleTimeString()}</p>
                      <p><span className="text-muted-foreground">Volunteers:</span> {intent.params.volunteers_needed}</p>
                      {intent.params.skills_required.length > 0 && (
                        <p><span className="text-muted-foreground">Skills:</span> {intent.params.skills_required.join(', ')}</p>
                      )}
                    </>
                  )}
                  {intent.intent === 'drop_assignment' && (
                    <>
                      <p><span className="text-muted-foreground">Volunteer:</span> {intent.params.volunteer_name_or_email}</p>
                      <p><span className="text-muted-foreground">Scope:</span> {intent.params.drop_all_tasks ? 'All tasks' : `Task: ${intent.params.task_hint}`}</p>
                      {intent.params.reason && (
                        <p><span className="text-muted-foreground">Reason:</span> {intent.params.reason}</p>
                      )}
                    </>
                  )}
                  {intent.intent === 'query_volunteers' && (
                    <>
                      {intent.params.required_skills.length > 0 && (
                        <p><span className="text-muted-foreground">Skills:</span> {intent.params.required_skills.join(', ')}</p>
                      )}
                      <p><span className="text-muted-foreground">Status:</span> {intent.params.status_filter}</p>
                    </>
                  )}
                  {intent.intent === 'edit_task' && (
                    <>
                      <p><span className="text-muted-foreground">Task:</span> {intent.params.task_hint}</p>
                      {intent.params.new_volunteers_needed && (
                        <p><span className="text-muted-foreground">New count:</span> {intent.params.new_volunteers_needed}</p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleExecute} disabled={executing}>
                    {executing ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    {executing ? 'Executing...' : 'Confirm'}
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
