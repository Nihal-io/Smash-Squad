import { z } from 'zod';
import { OpenRouterClient } from './providers/openrouter';
import type { CandidateMove } from '@/lib/assignment/move-generator';

const ResolutionOption = z.object({
  selected_move_ids: z.array(z.number()),
  title: z.string(),
  tradeoff: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  recommended: z.boolean(),
});

const ResolutionsResponse = z.object({
  options: z.array(ResolutionOption).min(1).max(3),
  assessment: z.string(),
});

export type ResolutionResult = z.infer<typeof ResolutionsResponse>;

const SYSTEM_PROMPT = `You help resolve volunteer staffing shortages. You receive a task that needs more volunteers and a list of candidate moves. Pick 2-3 combinations of moves that solve or reduce the shortage. Each option selects moves by their ID.

Rules:
- Mark exactly one option as recommended (best trade-off)
- selected_move_ids are indices into the candidate array
- Don't invent moves not in the list
- Keep titles under 6 words
- Keep tradeoff descriptions under 25 words
- assessment is one sentence about the overall situation`;

export async function proposeResolutions(
  failingTask: { name: string; needs: number; has: number; skills: string[] },
  moves: CandidateMove[]
): Promise<ResolutionResult> {
  const llm = new OpenRouterClient(
    process.env.OPENROUTER_RESOLVE_API_KEY ?? process.env.OPENROUTER_API_KEY,
    process.env.OPENROUTER_RESOLVE_MODEL ?? process.env.OPENROUTER_MODEL
  );

  return llm.generateStructured({
    system: SYSTEM_PROMPT,
    user: JSON.stringify({ failing_task: failingTask, candidate_moves: moves }),
    schema: ResolutionsResponse,
    schemaName: 'ResolutionsResponse',
    temperature: 0.3,
  });
}
