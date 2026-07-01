const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export type RewriteTone = 'formal' | 'casual' | 'concise';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export interface GrammarChange {
  original: string;
  fixed: string;
  reason: string;
}

export interface GrammarResult {
  corrected: string;
  changes: GrammarChange[];
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey?.trim()) {
    throw new Error('MISSING_API_KEY');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      throw new Error('RATE_LIMITED');
    }

    if (!response.ok) {
      throw new Error('API_FAILURE');
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('API_FAILURE');
    }

    return text.trim();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw error;
  }
}

export async function simplify(text: string, apiKey: string): Promise<string> {
  const prompt = `Simplify the following text to make it easier to understand. Use plain language and shorter sentences. Return only the simplified text, no explanation:\n\n${text}`;
  return callGemini(prompt, apiKey);
}

export async function correctGrammar(text: string, apiKey: string): Promise<GrammarResult> {
  const prompt = `Correct the grammar in the following text. Return a JSON object with "corrected" (the full corrected text) and "changes" (array of objects with "original", "fixed", and "reason"). Return only valid JSON:\n\n${text}`;
  const response = await callGemini(prompt, apiKey);
  
  try {
    const jsonStart = response.indexOf('{');
    const jsonEnd = response.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('API_FAILURE');
    }
    const jsonStr = response.slice(jsonStart, jsonEnd + 1);
    const result = JSON.parse(jsonStr) as GrammarResult;
    
    if (!result.corrected || !Array.isArray(result.changes)) {
      throw new Error('API_FAILURE');
    }
    
    return result;
  } catch {
    throw new Error('API_FAILURE');
  }
}

export async function summarize(text: string, apiKey: string): Promise<string> {
  const prompt = `Summarize the following text in a concise way. Capture the main points in 2-3 sentences. Return only the summary, no explanation:\n\n${text}`;
  return callGemini(prompt, apiKey);
}

export async function rewrite(text: string, tone: RewriteTone, apiKey: string): Promise<string> {
  const toneInstructions: Record<RewriteTone, string> = {
    formal: 'Rewrite in a formal, professional tone suitable for business or academic contexts.',
    casual: 'Rewrite in a casual, conversational tone suitable for everyday communication.',
    concise: 'Rewrite to be as concise as possible while preserving meaning. Remove unnecessary words.',
  };
  
  const prompt = `${toneInstructions[tone]}\n\nOriginal text:\n${text}\n\nReturn only the rewritten text, no explanation.`;
  return callGemini(prompt, apiKey);
}
