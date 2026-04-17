'use client';

import { useState, useCallback } from 'react';
import { devFetch } from '@/lib/dev/dev-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import type { CandidateMove } from '@/lib/assignment/move-generator';
import type { ResolutionResult } from '@/lib/ai/propose-resolutions';

interface GenerateResponse {
  ok: boolean;
  reason?: string;
  task?: unknown;
  moves?: CandidateMove[];
  resolutions?: ResolutionResult;
}

interface ResolutionPanelProps {
  taskId: string;
  onResolved: () => void;
}

const confidenceStyles: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  medium: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100',
  low: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
};

export function ResolutionPanel({ taskId, onResolved }: ResolutionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [data, setData] = useState<GenerateResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      const res = await devFetch('/api/ai/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId }),
      });
      const json = (await res.json()) as GenerateResponse;
      if (!res.ok) {
        toast.error((json as { reason?: string }).reason || 'Could not load resolutions');
        return;
      }
      if (!json.ok) {
        toast.error(json.reason || 'No resolutions available');
        return;
      }
      setData(json);
    } catch {
      toast.error('Failed to load resolutions');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const apply = async (moveIds: number[], optionIdx: number) => {
    setApplyingIdx(optionIdx);
    try {
      const res = await devFetch('/api/ai/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId, apply_move_ids: moveIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.reason || json.error || 'Apply failed');
        return;
      }
      toast.success(json.summary || 'Resolution applied');
      setData(null);
      onResolved();
    } catch {
      toast.error('Apply failed');
    } finally {
      setApplying(null);
    }
  };

  return (
    <Card className="mt-3 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
      <CardContent className="py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <p className="text-sm font-medium text-foreground">Resolve staffing shortage</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Analyzing…
              </>
            ) : (
              'Generate options'
            )}
          </Button>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Building move pool and ranking options…
          </p>
        )}

        {data?.resolutions && (
          <div className="space-y-3">
            {data.resolutions.assessment && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-indigo-300 pl-3 dark:border-indigo-700">
                {data.resolutions.assessment}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
              {data.resolutions.options.map((opt, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-foreground leading-snug">{opt.title}</p>
                    <div className="flex flex-wrap gap-1">
                      {opt.recommended && (
                        <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">Recommended</Badge>
                      )}
                      <Badge className={confidenceStyles[opt.confidence]}>{opt.confidence}</Badge>
                    </div>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    {opt.selected_move_ids.map((mid) => {
                      const m = data.moves?.find((x) => x.id === mid);
                      return m ? <li key={mid}>{m.description}</li> : null;
                    })}
                  </ul>
                  <p className="text-xs italic text-muted-foreground">{opt.tradeoff}</p>
                  <Button
                    size="sm"
                    className="mt-auto w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={applyingIdx !== null || opt.selected_move_ids.length === 0}
                    onClick={() => void apply(opt.selected_move_ids, idx)}
                  >
                    {applyingIdx === idx ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      'Apply'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
