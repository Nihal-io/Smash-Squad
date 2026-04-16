import { z } from 'zod';

export type LLMProvider = 'claude' | 'gemini' | 'openai';

export interface LLMClient {
  provider: LLMProvider;

  generateStructured<T>(opts: {
    system: string;
    user: string;
    schema: z.ZodSchema<T>;
    schemaName: string;
    temperature?: number;
  }): Promise<T>;

  generateText(opts: {
    system: string;
    user: string;
    temperature?: number;
  }): Promise<string>;
}

export function getLLMClient(): LLMClient {
  // Implementations land in Commit C12.5. For now, throw clearly so anything
  // calling this before C12.5 gets a useful error.
  if (process.env.ANTHROPIC_API_KEY) {
    throw new Error('LLM provider not yet implemented — ClaudeClient lands in Commit C12.5');
  }
  if (process.env.GEMINI_API_KEY) {
    throw new Error('LLM provider not yet implemented — GeminiClient lands in Commit C12.5');
  }
  if (process.env.OPENAI_API_KEY) {
    throw new Error('LLM provider not yet implemented — OpenAIClient lands in Commit C12.5');
  }

  throw new Error(
    'No LLM API key set. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in .env.local'
  );
}
