import { getLLMClient } from './client';

export interface AssignmentExplanationInput {
  volunteer: { name: string; skills: string[]; activeAssignmentCount: number };
  task: { name: string; skillsRequired: string[]; slotStart: string; slotEnd: string };
  scoringBreakdown: { skillOverlap: number; loadPenalty: number; totalScore: number };
  alternativesConsidered: number;
}

const SYSTEM_PROMPT = `You explain volunteer assignment decisions in one short, natural sentence (max 20 words). Focus on the strongest reason. Plain English, no jargon, no numbers unless essential. Do not start with "I" or "The system". Start with the volunteer's first name.`;

export async function explainAssignment(
  input: AssignmentExplanationInput
): Promise<string> {
  try {
    const llm = getLLMClient();
    return await llm.generateText({
      system: SYSTEM_PROMPT,
      user: JSON.stringify(input),
      temperature: 0.4,
    });
  } catch {
    // Deterministic fallback — never let AI failure break the flow
    const matchedSkills = input.volunteer.skills.filter((s) =>
      input.task.skillsRequired.map((r) => r.toLowerCase()).includes(s.toLowerCase())
    );
    if (matchedSkills.length > 0) {
      return `${input.volunteer.name.split(' ')[0]} matches on ${matchedSkills.join(', ')}.`;
    }
    return `${input.volunteer.name.split(' ')[0]} is available for this slot.`;
  }
}

export async function explainAssignments(
  inputs: AssignmentExplanationInput[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  // Run in parallel for speed
  const promises = inputs.map(async (input) => {
    const explanation = await explainAssignment(input);
    results.set(input.volunteer.name, explanation);
  });
  await Promise.allSettled(promises);
  return results;
}
