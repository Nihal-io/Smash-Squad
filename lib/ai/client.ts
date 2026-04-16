import { z } from 'zod';

export type LLMProvider = 'openrouter';

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

let instance: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (instance) return instance;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY not set. Get one at https://openrouter.ai/keys'
    );
  }

  // Dynamic import to avoid bundling in client
  const { OpenRouterClient } = require('./providers/openrouter');
  instance = new OpenRouterClient(apiKey);
  return instance;
}
