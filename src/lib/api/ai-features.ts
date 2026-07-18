const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

import { logger } from '@/lib/logger';
import { getSettings } from '@/lib/storage';

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

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

async function callFreeLLMAPI(systemPrompt: string, userPrompt: string): Promise<string> {
  const settings = await getSettings();
  const apiKey = settings.freeLLMApiKey?.trim();
  const baseUrl = settings.freeLLMBaseUrl?.trim() || 'https://api.freellm.ai';

  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const maskedKey = `${apiKey.substring(0, 6)}...${apiKey.slice(-4)}`;
  logger.freellmApi('Using API key:', maskedKey);
  logger.freellmApi('Base URL:', baseUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

  try {
    // Handle baseUrl that may or may not already include /v1
    const endpoint = baseUrl.endsWith('/v1/chat/completions') 
      ? baseUrl 
      : baseUrl.endsWith('/v1') 
        ? `${baseUrl}/chat/completions`
        : `${baseUrl}/v1/chat/completions`;
    
    console.log('[FreeLLMAPI] Final URL:', endpoint);
    logger.freellmApi('Calling URL:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    logger.freellmApi('Response status:', response.status);

    if (!response.ok) {
      const responseText = await response.text();
      logger.freellmApi('Error response:', responseText);
      
      if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      if (response.status === 401) {
        throw new Error('INVALID_API_KEY');
      }
      throw new Error('API_FAILURE');
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('API_FAILURE');
    }

    return content.trim();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw error;
  }
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey?.trim()) {
    throw new Error('MISSING_API_KEY');
  }

  const maskedKey = `${apiKey.substring(0, 6)}...${apiKey.slice(-4)}`;
  logger.geminiApi('Using API key:', maskedKey);
  logger.geminiApi('API key length:', apiKey.length);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;
    const maskedUrl = `${GEMINI_ENDPOINT}?key=${maskedKey}`;
    logger.geminiApi('Calling URL:', maskedUrl);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    logger.geminiApi('Response status:', response.status);
    logger.geminiApi('Response ok:', response.ok);

    // Log the full response body for ALL non-200 responses
    if (!response.ok) {
      const responseText = await response.text();
      logger.geminiApi('Full response body:', responseText);
      logger.geminiApi('Response status code:', response.status);
    }

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

export async function simplify(text: string): Promise<string> {
  const systemPrompt = 'You are a helpful assistant that simplifies text to make it easier to understand. Use plain language and shorter sentences. IMPORTANT: Respond in the SAME LANGUAGE as the input text. If the input is in Spanish, respond in Spanish. If in French, respond in French, etc. Return only the simplified text, no explanation.';
  const userPrompt = text;
  return callFreeLLMAPI(systemPrompt, userPrompt);
}

export async function correctGrammar(text: string): Promise<GrammarResult> {
  const systemPrompt = 'You are a helpful assistant that identifies and corrects grammar mistakes. IMPORTANT: Keep the corrected text in the SAME LANGUAGE as the input text. If the input is in Spanish, correct it in Spanish. If in French, correct it in French, etc. Return a JSON object with "corrected" (the full corrected text) and "changes" (array of objects with "original", "fixed", and "reason"). Return only valid JSON.';
  const userPrompt = text;
  const response = await callFreeLLMAPI(systemPrompt, userPrompt);
  
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

export async function summarize(text: string): Promise<string> {
  const systemPrompt = 'You are a helpful assistant that summarizes text. Condense the text into a brief summary capturing the main points in 2-3 sentences. IMPORTANT: Respond in the SAME LANGUAGE as the input text. If the input is in Spanish, summarize in Spanish. If in French, summarize in French, etc. Return only the summary, no explanation.';
  const userPrompt = text;
  return callFreeLLMAPI(systemPrompt, userPrompt);
}

export async function rewrite(text: string, tone: RewriteTone): Promise<string> {
  const toneInstructions: Record<RewriteTone, string> = {
    formal: 'Rewrite in a formal, professional tone suitable for business or academic contexts.',
    casual: 'Rewrite in a casual, conversational tone suitable for everyday communication.',
    concise: 'Rewrite to be as concise as possible while preserving meaning. Remove unnecessary words.',
  };
  
  const systemPrompt = `You are a helpful assistant that rephrases text. ${toneInstructions[tone]} IMPORTANT: Respond in the SAME LANGUAGE as the input text. If the input is in Spanish, rewrite in Spanish. If in French, rewrite in French, etc. Return only the rewritten text, no explanation.`;
  const userPrompt = text;
  return callFreeLLMAPI(systemPrompt, userPrompt);
}

export async function translateHinglish(text: string, targetLanguage: string, apiKey: string): Promise<string> {
  const targetLanguageName = getLanguageName(targetLanguage);
  const prompt = `Translate this Hinglish (romanized, code-mixed Hindi-English) text to ${targetLanguageName}. Preserve meaning, tone, and any English words the user intentionally kept in English. Return only the translation, no explanation:\n\n${text}`;
  return callGemini(prompt, apiKey);
}

export async function polishTranslation(translatedText: string, targetLang: string): Promise<string> {
  const targetLanguageName = getLanguageName(targetLang);
  const systemPrompt = `You are a native speaker proofreader. Fix only grammar errors, unnatural phrasing, and incorrect word choices in the following ${targetLanguageName} text. Do not change the meaning. Do not add explanations. Return only the corrected text.`;
  const userPrompt = translatedText;
  return callFreeLLMAPI(systemPrompt, userPrompt);
}

export async function translateWithAI(text: string, targetLang: string): Promise<string> {
  const targetLanguageName = getLanguageName(targetLang);
  const systemPrompt = `You are a professional translator. Translate the following text to ${targetLanguageName}. Preserve the tone and meaning accurately, including complex sentence structures with multiple clauses. Return only the translation, no explanations.`;
  const userPrompt = text;
  return callFreeLLMAPI(systemPrompt, userPrompt);
}

function getLanguageName(code: string): string {
  const languageNames: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'bn': 'Bengali',
    'tr': 'Turkish',
    'nl': 'Dutch',
    'pl': 'Polish',
    'vi': 'Vietnamese',
    'th': 'Thai',
    'id': 'Indonesian',
    'ms': 'Malay',
    'tl': 'Filipino',
    'he': 'Hebrew',
    'fa': 'Persian',
    'ur': 'Urdu',
    'ta': 'Tamil',
    'te': 'Telugu',
    'kn': 'Kannada',
    'ml': 'Malayalam',
    'mr': 'Marathi',
    'gu': 'Gujarati',
    'pa': 'Punjabi',
    'ne': 'Nepali',
    'si': 'Sinhala',
    'my': 'Burmese',
    'km': 'Khmer',
    'lo': 'Lao',
    'am': 'Amharic',
    'so': 'Somali',
    'sw': 'Swahili',
    'zu': 'Zulu',
    'xh': 'Xhosa',
    'af': 'Afrikaans',
    'ga': 'Irish',
    'cy': 'Welsh',
    'br': 'Breton',
    'kw': 'Cornish',
    'gd': 'Scottish Gaelic',
    'eu': 'Basque',
    'ca': 'Catalan',
    'gl': 'Galician',
    'oc': 'Occitan',
    'ku': 'Kurdish',
    'az': 'Azerbaijani',
    'kk': 'Kazakh',
    'uz': 'Uzbek',
    'ug': 'Uyghur',
    'bo': 'Tibetan',
    'dz': 'Dzongkha',
    'mn': 'Mongolian',
    'hy': 'Armenian',
    'ka': 'Georgian',
    'ce': 'Chechen',
    'ab': 'Abkhaz',
    'os': 'Ossetic',
    'tt': 'Tatar',
    'ba': 'Bashkir',
    'cv': 'Chuvash',
  };
  return languageNames[code] || code;
}
