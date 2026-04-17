import type { LLMClient } from '../client';
import { z } from 'zod';

const BASE_URL = 'https://openrouter.ai/api/v1';
const llmResponseCache = new Map<string, string>();

function buildCacheKey(system: string, user: string) {
  return `${system.slice(0, 100)}::${user}`;
}

export class OpenRouterClient implements LLMClient {
  provider = 'openrouter' as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not set. Get one at https://openrouter.ai/keys');
    }
    this.model = model ?? process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-exp:free';
  }

  async generateStructured<T>(opts: {
    system: string;
    user: string;
    schema: z.ZodSchema<T>;
    schemaName: string;
    temperature?: number;
  }): Promise<T> {
    const cacheKey = buildCacheKey(opts.system, opts.user);
    const cached = llmResponseCache.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return opts.schema.parse(parsed);
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://festflow.dev',
        'X-Title': 'FestFlow',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: opts.temperature ?? 0,
        messages: [
          {
            role: 'system',
            content: `${opts.system}\n\nYou must respond with valid JSON only. No markdown fences, no preamble, no explanation. Just the JSON object.`,
          },
          { role: 'user', content: opts.user },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      llmResponseCache.set(cacheKey, cleaned);
      return opts.schema.parse(parsed);
    } catch (e) {
      throw new Error(
        `Failed to parse LLM response as ${opts.schemaName}: ${
          e instanceof Error ? e.message : 'unknown'
        }. Raw: ${cleaned.slice(0, 200)}`
      );
    }
  }

  async generateText(opts: {
    system: string;
    user: string;
    temperature?: number;
  }): Promise<string> {
    const cacheKey = buildCacheKey(opts.system, opts.user);
    const cached = llmResponseCache.get(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://festflow.dev',
        'X-Title': 'FestFlow',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: opts.temperature ?? 0.3,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    llmResponseCache.set(cacheKey, text);
    return text;
  }
}
