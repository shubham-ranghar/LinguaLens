import type { TranslationRequest, TranslationResult } from '@/types';
import { isSingleWord, normalizeLanguageCode, resolveSourceLanguage } from '@/lib/utils';
import { franc } from 'franc';
import { logger } from '@/lib/logger';
import { detectHinglish } from '@/lib/detection/hinglishDetector';
import { translateHinglish } from '@/lib/api/ai-features';
import { transliterateHinglishToDevanagari } from '@/lib/transliteration/hinglishToDevanagari';

// Configuration constants for language detection
export const MIN_RELIABLE_DETECTION_LENGTH = 20;
export const MIN_DICTIONARY_LOOKUP_LENGTH = 15;
export const MIN_FRANC_DETECTION_LENGTH = 4;

// Configuration constants for translation
export const MYMEMORY_MAX_CHARS_PER_REQUEST = 500; // MyMemory free tier limit
export const CHUNK_MIN_SENTENCES = 2; // Minimum sentences per chunk to avoid fragmentation

/**
 * Normalize text for comparison by removing punctuation, extra whitespace, and case-folding.
 * This helps avoid false negatives in same-language detection.
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\p{P}\p{S}]/gu, '') // Remove punctuation and symbols
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Common abbreviations that should not be treated as sentence endings.
 * These patterns are used to avoid splitting mid-abbreviation.
 */
const ABBREVIATION_PATTERNS = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'Gen', 'Rep', 'Sen', 'St',
  'e.g', 'i.e', 'etc', 'vs', 'al', 'ca', 'approx', 'dept', 'univ', 'assn',
  'Ave', 'Blvd', 'Rd', 'St', 'Mt', 'Ft', 'Pt', 'Co', 'Corp', 'Inc', 'Ltd',
  'no', 'pp', 'vol', 'ch', 'sec', 'fig', 'eq', 'ex'
];

/**
 * Check if a period is part of an abbreviation.
 */
function isAbbreviation(text: string, periodIndex: number): boolean {
  const beforePeriod = text.slice(Math.max(0, periodIndex - 4), periodIndex).toLowerCase();
  return ABBREVIATION_PATTERNS.some(abbr => beforePeriod.endsWith(abbr));
}

/**
 * Split text into sentence-aware chunks for translation.
 * Splits ONLY on sentence boundaries while preserving paragraph structure.
 * Handles abbreviations, CJK/Arabic/Devanagari punctuation, and avoids splitting inside quotes/parentheses.
 * Ensures no chunk exceeds MYMEMORY_MAX_CHARS_PER_REQUEST.
 */
export function splitIntoChunks(text: string): string[] {
  // If text is short enough, return as single chunk
  if (text.length <= MYMEMORY_MAX_CHARS_PER_REQUEST) {
    return [text];
  }

  const chunks: string[] = [];
  const sentences: string[] = [];
  
  // Track nesting level for quotes and parentheses to avoid splitting inside them
  let quoteDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  
  let sentenceStart = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Track nesting
    if (char === '"' || char === '\'') quoteDepth++;
    if (char === '(' || char === '[' || char === '{') {
      if (char === '(') parenDepth++;
      if (char === '[') bracketDepth++;
      if (char === '{') bracketDepth++;
    }
    if (char === ')' || char === ']' || char === '}') {
      if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
      if (char === '}') bracketDepth = Math.max(0, bracketDepth - 1);
    }
    
    // Check for sentence-ending punctuation (only when not nested)
    const isSentenceEnd = 
      (char === '.' || char === '!' || char === '?' || char === '。' || char === '！' || char === '？' ||
       char === '။' || char === '۔' || char === '؟') &&
      quoteDepth === 0 && parenDepth === 0 && bracketDepth === 0;
    
    if (isSentenceEnd) {
      // For periods, check if it's an abbreviation
      if (char === '.' && isAbbreviation(text, i)) {
        continue;
      }
      
      // Extract the sentence (from start to current position + 1)
      let sentenceEnd = i + 1;
      
      // Include trailing whitespace if present
      while (sentenceEnd < text.length && /\s/.test(text[sentenceEnd])) {
        sentenceEnd++;
      }
      
      const sentence = text.slice(sentenceStart, sentenceEnd).trim();
      if (sentence) {
        sentences.push(sentence);
      }
      
      sentenceStart = sentenceEnd;
    }
  }
  
  // Add any remaining text as final sentence
  const remaining = text.slice(sentenceStart).trim();
  if (remaining) {
    sentences.push(remaining);
  }
  
  // If no sentences were found (text without punctuation), treat as single chunk
  if (sentences.length === 0) {
    logger.debug('chunking', { method: 'no-sentences', length: text.length });
    return [text];
  }
  
  // Build chunks from sentences, preserving paragraph structure
  let currentChunk = '';
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    // If adding this sentence would exceed limit, start new chunk
    if (currentChunk.length + trimmedSentence.length > MYMEMORY_MAX_CHARS_PER_REQUEST && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      // Preserve paragraph breaks (double newlines)
      if (trimmedSentence === '' && currentChunk.endsWith('\n')) {
        currentChunk += '\n';
      } else {
        currentChunk += (currentChunk && !currentChunk.endsWith('\n') ? ' ' : '') + trimmedSentence;
      }
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  logger.debug('chunking', { 
    method: 'sentence-split', 
    originalLength: text.length, 
    chunkCount: chunks.length, 
    avgChunkSize: Math.round(text.length / chunks.length) 
  });
  
  return chunks;
}

/**
 * Interface for translated chunk with metadata.
 */
interface TranslatedChunk {
  index: number;
  originalText: string;
  translatedText: string;
  contextText?: string; // Context that was prepended (to be stripped)
  contextLength?: number; // Length of context in original text (for precise stripping)
}

/**
 * Get the last sentence from a chunk to use as context for the next chunk.
 * This helps maintain translation coherence across chunk boundaries.
 */
function getTrailingContext(chunk: string): { text: string; length: number } {
  const sentences = chunk.match(/[^.!?。！？။۔؟]+[.!?。！？။۔؟]+/g);
  if (sentences && sentences.length > 0) {
    const lastSentence = sentences[sentences.length - 1].trim();
    return { text: lastSentence, length: lastSentence.length };
  }
  return { text: '', length: 0 };
}

/**
 * Strip the context text from the beginning of a translated chunk.
 * Uses character offset-based stripping rather than string matching,
 * since the translated context may differ from the original context text.
 * We estimate the context portion based on the original context length ratio.
 */
function stripContextFromTranslation(
  translated: string,
  contextOriginal: string,
  fullOriginalWithContext: string
): string {
  if (!contextOriginal) return translated;
  
  // Calculate the ratio of context to the full text sent to API
  const contextRatio = contextOriginal.length / fullOriginalWithContext.length;
  
  // Estimate how many characters of the translation correspond to the context
  const estimatedContextLength = Math.round(translated.length * contextRatio);
  
  // Look for the first sentence boundary after the estimated context position
  // This gives us a clean break point to strip the context
  const searchStart = Math.max(0, estimatedContextLength - 20);
  const searchEnd = Math.min(translated.length, estimatedContextLength + 100);
  
  for (let i = searchStart; i < searchEnd; i++) {
    const char = translated[i];
    // Check for sentence-ending punctuation
    if (char === '.' || char === '!' || char === '?' || char === '。' || char === '！' || char === '？') {
      // Check if followed by space or end of string
      const nextChar = translated[i + 1];
      if (!nextChar || /\s/.test(nextChar)) {
        // Found a sentence boundary - strip everything before and including it
        const stripped = translated.slice(i + 1).trim();
        logger.debug('context-stripped', {
          estimatedContextLength,
          actualStripPosition: i + 1,
          strippedLength: stripped.length
        });
        return stripped;
      }
    }
  }
  
  // If we couldn't find a clean boundary, log a warning and return as-is
  // This may cause some duplication but is safer than losing content
  logger.warn('context-strip-failed', {
    contextOriginal,
    translatedLength: translated.length,
    estimatedContextLength,
    reason: 'no-sentence-boundary-found'
  });
  return translated;
}

/**
 * Check if text is mostly proper nouns, numbers, or loanwords that wouldn't change much in translation.
 * This prevents false positives on legitimate translations of technical terms.
 */
function isMostlyUntranslatableContent(text: string): boolean {
  // Check if text is mostly numbers
  const numberRatio = (text.match(/\d/g) || []).length / text.length;
  if (numberRatio > 0.5) return true;
  
  // Check if text is mostly uppercase (likely acronyms/proper nouns)
  const upperRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (upperRatio > 0.6) return true;
  
  // Check for common loanwords that often stay the same in Hindi
  const loanwords = ['computer', 'internet', 'software', 'hardware', 'data', 'system', 'network', 'digital', 'online', 'website'];
  const lowerText = text.toLowerCase();
  const hasLoanword = loanwords.some(word => lowerText.includes(word));
  if (hasLoanword) return true;
  
  return false;
}

/**
 * Check if a text contains suspicious patterns indicating a failed translation.
 * Returns true if the text appears to be untranslated or malformed.
 * Excludes proper nouns, numbers, and loanwords from similarity checks.
 */
function isSuspiciousTranslation(translated: string, original: string): boolean {
  // Empty translation is definitely suspicious
  if (!translated || translated.trim().length === 0) {
    return true;
  }
  
  // If translation is identical to original for non-trivial text, likely failed
  // But skip this check if content is mostly untranslatable (proper nouns, numbers)
  if (original.length > 10 && translated === original) {
    if (!isMostlyUntranslatableContent(original)) {
      return true;
    }
  }
  
  // If translation is 90%+ identical to original, likely failed
  // But only apply this check for longer text and skip for untranslatable content
  if (original.length > 50) {
    if (!isMostlyUntranslatableContent(original)) {
      const similarity = calculateSimilarity(translated, original);
      if (similarity > 0.9) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calculate similarity between two strings (0 to 1).
 * Uses simple character overlap for efficiency.
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Check for English words in non-Latin script output (integrity check).
 * Returns true if 3+ consecutive English words are found.
 */
function hasEnglishInNonLatinOutput(text: string, targetLang: string): boolean {
  // Skip check for Latin-script target languages
  const latinScriptTargets = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'tr', 'vi'];
  if (latinScriptTargets.includes(targetLang)) {
    return false;
  }
  
  // Look for 3+ consecutive English words
  const englishWordPattern = /\b[a-zA-Z]{3,}\b/g;
  const matches = text.match(englishWordPattern);
  
  if (!matches || matches.length < 3) return false;
  
  // Check if they appear consecutively
  const words = text.split(/\s+/);
  let consecutiveEnglish = 0;
  
  for (const word of words) {
    if (/^[a-zA-Z]{3,}$/.test(word)) {
      consecutiveEnglish++;
      if (consecutiveEnglish >= 3) {
        return true;
      }
    } else {
      consecutiveEnglish = 0;
    }
  }
  
  return false;
}

/**
 * Extract significant terms (3+ words) from text for terminology consistency.
 * Returns a map of term to its first occurrence position.
 */
function extractSignificantTerms(text: string): Map<string, number> {
  const terms = new Map<string, number>();
  const words = text.split(/\s+/);
  
  // Extract 2-4 word phrases
  for (let length = 2; length <= 4; length++) {
    for (let i = 0; i <= words.length - length; i++) {
      const phrase = words.slice(i, i + length).join(' ');
      // Only include phrases that start with a capital letter (likely proper nouns/technical terms)
      if (/^[A-Z]/.test(phrase) && phrase.length > 5) {
        if (!terms.has(phrase)) {
          terms.set(phrase, i);
        }
      }
    }
  }
  
  return terms;
}

/**
 * Apply terminology consistency to translated chunks.
 * If the same term appears in multiple chunks, use the first chunk's translation.
 * This is a lightweight pass to improve consistency across chunk boundaries.
 */
function applyTerminologyConsistency(chunks: TranslatedChunk[]): void {
  const termTranslations = new Map<string, string>();
  
  for (const chunk of chunks) {
    const originalTerms = extractSignificantTerms(chunk.originalText);
    
    for (const [term, position] of originalTerms) {
      if (!termTranslations.has(term)) {
        // Try to find the corresponding translation in the translated text
        // This is heuristic-based since translation may change word order
        const translatedWords = chunk.translatedText.split(/\s+/);
        const originalWords = chunk.originalText.split(/\s+/);
        
        // Find the corresponding position in translation
        const ratio = position / originalWords.length;
        const translatedPos = Math.round(ratio * translatedWords.length);
        
        if (translatedPos < translatedWords.length) {
          // Extract a phrase of similar length from translation
          const phraseLength = term.split(/\s+/).length;
          if (translatedPos + phraseLength <= translatedWords.length) {
            const translatedPhrase = translatedWords.slice(translatedPos, translatedPos + phraseLength).join(' ');
            if (translatedPhrase.length > 3) {
              termTranslations.set(term, translatedPhrase);
              logger.debug('term-cached', {
                term: term.substring(0, 30),
                translation: translatedPhrase.substring(0, 30)
              });
            }
          }
        }
      }
    }
  }
  
  // Note: This is a lightweight consistency pass.
  // Full terminology consistency would require more sophisticated NLP.
  // This is logged as a known limitation of the current approach.
  if (termTranslations.size > 0) {
    logger.debug('terminology-consistency', {
      termsCached: termTranslations.size,
      note: 'Lightweight terminology consistency applied. For full consistency, consider a dedicated terminology management system.'
    });
  }
}

/**
 * Merge translated chunks into a single coherent text.
 * This is the ONLY place where chunk merging should happen.
 * Preserves original order, strips context using offsets, and normalizes whitespace.
 */
function mergeTranslatedChunks(chunks: TranslatedChunk[], targetLang: string): string {
  // Apply lightweight terminology consistency
  applyTerminologyConsistency(chunks);
  
  // Sort by index to ensure original order
  const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);
  
  let merged = '';
  for (let i = 0; i < sortedChunks.length; i++) {
    const chunk = sortedChunks[i];
    let textToMerge = chunk.translatedText;
    
    // Strip context if this isn't the first chunk
    if (i > 0 && chunk.contextText && chunk.contextLength) {
      const fullOriginalWithContext = chunk.contextText + ' ' + chunk.originalText;
      textToMerge = stripContextFromTranslation(textToMerge, chunk.contextText, fullOriginalWithContext);
    }
    
    // Check for duplicate text with adjacent chunks (context stripping failure)
    if (i > 0) {
      const prevChunk = sortedChunks[i - 1];
      const prevText = prevChunk.translatedText.toLowerCase();
      const currText = textToMerge.toLowerCase();
      
      // Look for 8+ word overlap
      const words = currText.split(/\s+/);
      for (let j = 8; j < words.length; j++) {
        const phrase = words.slice(0, j).join(' ');
        if (prevText.includes(phrase)) {
          logger.warn('duplicate-text-detected', {
            chunkIndex: i,
            overlapLength: j,
            phrase: phrase.substring(0, 50)
          });
          break;
        }
      }
    }
    
    // Add to merged result with proper spacing
    if (merged === '') {
      merged = textToMerge;
    } else {
      // Ensure exactly one space between chunks unless there's a paragraph break
      if (textToMerge.startsWith('\n\n') || merged.endsWith('\n\n')) {
        merged += textToMerge;
      } else {
        merged += ' ' + textToMerge;
      }
    }
  }
  
  // Normalize whitespace: collapse multiple spaces, ensure single space after punctuation
  merged = merged
    .replace(/ +/g, ' ') // Collapse multiple spaces
    .replace(/\n +/g, '\n') // Remove spaces after newlines
    .replace(/ +\n/g, '\n') // Remove spaces before newlines
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines to double
    .trim();
  
  // Integrity check for English words in non-Latin output
  if (hasEnglishInNonLatinOutput(merged, targetLang)) {
    logger.warn('integrity-check-failed', {
      targetLang,
      reason: 'english-words-detected-in-non-latin-output',
      sample: merged.substring(0, 100)
    });
  }
  
  return merged;
}

/**
 * Translate a single chunk with retry logic and backoff.
 * Retries up to 2 times on failure with exponential backoff.
 * Throws if all retries fail.
 */
async function translateChunkWithRetry(
  chunk: string,
  index: number,
  source: string,
  target: string,
  myMemoryEmail?: string,
  contextText?: string,
  contextLength?: number
): Promise<{ chunk: TranslatedChunk; detectedSource?: string }> {
  const maxRetries = 2;
  let lastError: Error | undefined;
  
  // TESTING NOTE: To test the retry/failure path:
  // 1. Open browser DevTools Console
  // 2. Temporarily modify MYMEMORY_ENDPOINT in this file to point to a bad URL
  // 3. Or use DevTools Network tab to throttle/block the API request
  // 4. Check console logs for 'chunk-translation-attempt' with retry attempts
  // 5. Verify UI shows error state, not blank/stuck popup
  // 6. Revert changes after testing
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const textToTranslate = contextText ? contextText + ' ' + chunk : chunk;
      const result = await fetchMyMemoryTranslation(textToTranslate, source, target, myMemoryEmail);
      
      // Check for suspicious translation (may indicate quota exceeded or API degradation)
      if (isSuspiciousTranslation(result.translatedText, textToTranslate)) {
        logger.warn('suspicious-translation', {
          chunkIndex: index,
          attempt: attempt + 1,
          translatedLength: result.translatedText.length,
          originalLength: textToTranslate.length,
          reason: 'translation-appears-untranslated-or-malformed'
        });
        
        // If this is the last attempt, throw as error
        if (attempt === maxRetries) {
          throw new Error('Translation returned suspicious result (possible quota exceeded or API degradation)');
        }
        
        // Otherwise retry with backoff
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        logger.debug('retrying-chunk', {
          chunkIndex: index,
          attempt: attempt + 1,
          delay,
          reason: 'suspicious-translation'
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      const translatedChunk: TranslatedChunk = {
        index,
        originalText: chunk,
        translatedText: result.translatedText,
        contextText,
        contextLength
      };
      
      logger.debug('chunk-translation-success', {
        chunkIndex: index,
        attempt: attempt + 1,
        originalText: chunk,
        textSent: textToTranslate,
        translatedText: result.translatedText,
        hadContext: !!contextText,
        success: true
      });
      
      return { chunk: translatedChunk, detectedSource: result.detectedSource };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      logger.error('chunk-translation-attempt', {
        chunkIndex: index,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        error: lastError.message,
        success: false
      });
      
      // If not the last attempt, retry with backoff
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        logger.debug('retrying-chunk', {
          chunkIndex: index,
          attempt: attempt + 1,
          delay,
          reason: 'api-error'
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed - throw error to fail loud
  throw translationError(
    'API_FAILURE',
    `Chunk ${index} failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Translate text with automatic chunking for long text.
 * Splits text into chunks, translates each with context and retry logic,
 * and reassembles results. Uses Promise.allSettled to ensure ALL chunks succeed.
 * Fails loud if any chunk fails after retries.
 */
async function translateWithChunking(
  text: string,
  source: string,
  target: string,
  myMemoryEmail?: string,
): Promise<{ translatedText: string; detectedSource?: string; chunkCount: number }> {
  const chunks = splitIntoChunks(text);
  
  if (chunks.length === 1) {
    // Single chunk, use normal translation
    const result = await fetchMyMemoryTranslation(text, source, target, myMemoryEmail);
    
    // Check for suspicious translation even for single chunk
    if (isSuspiciousTranslation(result.translatedText, text)) {
      logger.error('suspicious-single-chunk', {
        translatedLength: result.translatedText.length,
        originalLength: text.length
      });
      throw translationError(
        'API_FAILURE',
        'Translation returned suspicious result (possible quota exceeded or API degradation)'
      );
    }
    
    logger.debug('chunk-translation', {
      chunkIndex: 0,
      originalText: text,
      translatedText: result.translatedText,
      chunkCount: 1
    });
    return { ...result, chunkCount: 1 };
  }
  
  // Multiple chunks - translate each with context and retry logic
  const translationPromises = chunks.map(async (chunk, index) => {
    let contextText: string | undefined;
    let contextLength: number | undefined;
    
    // Add trailing context from previous chunk for coherence (except for first chunk)
    if (index > 0) {
      const previousChunk = chunks[index - 1];
      const context = getTrailingContext(previousChunk);
      contextText = context.text;
      contextLength = context.length;
    }
    
    return translateChunkWithRetry(chunk, index, source, target, myMemoryEmail, contextText, contextLength);
  });
  
  // Use Promise.allSettled to handle all chunks independently
  const settledResults = await Promise.allSettled(translationPromises);
  
  // Check if any chunks failed
  const failedChunks: { index: number; error: string }[] = [];
  const successfulChunks: { chunk: TranslatedChunk; detectedSource?: string }[] = [];
  
  for (let i = 0; i < settledResults.length; i++) {
    const result = settledResults[i];
    if (result.status === 'rejected') {
      failedChunks.push({
        index: i,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      });
    } else {
      successfulChunks.push(result.value);
    }
  }
  
  // If any chunks failed, throw error to fail loud
  if (failedChunks.length > 0) {
    logger.error('chunk-translation-failed', {
      totalChunks: chunks.length,
      failedChunks: failedChunks.length,
      failures: failedChunks
    });
    
    throw translationError(
      'API_FAILURE',
      `${failedChunks.length} of ${chunks.length} chunks failed to translate. Please try again later.`
    );
  }
  
  // All chunks succeeded - extract translated chunks and detected source
  const translatedChunks = successfulChunks.map(r => r.chunk);
  const detectedSource = successfulChunks[0]?.detectedSource; // Use detection from first chunk
  
  // Merge chunks using the dedicated merge function
  const translatedText = mergeTranslatedChunks(translatedChunks, target);
  
  logger.debug('chunk-merge-success', {
    chunkCount: chunks.length,
    finalLength: translatedText.length,
    originalLength: text.length
  });
  
  return { translatedText, detectedSource, chunkCount: chunks.length };
}

/**
 * Common short words dictionary for language detection.
 * Used when text is too short for reliable franc detection.
 * Covers the most frequent greetings and common words across major languages.
 */
const COMMON_WORDS: Record<string, string> = {
  // Spanish
  'hola': 'es',
  'gracias': 'es',
  'adios': 'es',
  'adiós': 'es',
  'por favor': 'es',
  'si': 'es',
  'sí': 'es',
  'no': 'es',
  'buenos dias': 'es',
  'buenos días': 'es',
  'buenas noches': 'es',
  'buenas tardes': 'es',
  'amigo': 'es',
  'amiga': 'es',
  'amor': 'es',
  'bien': 'es',
  'mal': 'es',
  'perdon': 'es',
  'perdón': 'es',
  'disculpe': 'es',
  'hasta luego': 'es',
  'hasta la vista': 'es',
  // French
  'bonjour': 'fr',
  'merci': 'fr',
  'oui': 'fr',
  'non': 'fr',
  'au revoir': 'fr',
  'salut': 'fr',
  'bonsoir': 'fr',
  'bonne nuit': 'fr',
  's il vous plait': 'fr',
  's il vous plaît': 'fr',
  'excusez-moi': 'fr',
  'pardon': 'fr',
  'monsieur': 'fr',
  'madame': 'fr',
  'mademoiselle': 'fr',
  'ami': 'fr',
  'amie': 'fr',
  'amour': 'fr',
  'a bientôt': 'fr',
  'à bientôt': 'fr',
  // German
  'hallo': 'de',
  'danke': 'de',
  'ja': 'de',
  'nein': 'de',
  'bitte': 'de',
  'tschüss': 'de',
  'guten tag': 'de',
  'guten morgen': 'de',
  'guten abend': 'de',
  'gute nacht': 'de',
  'entschuldigung': 'de',
  'verzeihung': 'de',
  'herr': 'de',
  'frau': 'de',
  'freund': 'de',
  'freundin': 'de',
  'liebe': 'de',
  'gut': 'de',
  'schlecht': 'de',
  'auf wiedersehen': 'de',
  // Hindi
  'namaste': 'hi',
  'dhanyawad': 'hi',
  'dhanyavaad': 'hi',
  'shukriya': 'hi',
  'namaskar': 'hi',
  'pranam': 'hi',
  'kaise ho': 'hi',
  'kaise hain': 'hi',
  'theek hai': 'hi',
  'achha': 'hi',
  'haan': 'hi',
  'han': 'hi',
  'nahi': 'hi',
  'na': 'hi',
  'swagat': 'hi',
  'alvida': 'hi',
  'pyar': 'hi',
  'prem': 'hi',
  'dost': 'hi',
  'saheli': 'hi',
  'achcha': 'hi',
  'theek': 'hi',
  // Italian
  'ciao': 'it',
  'grazie': 'it',
  'prego': 'it',
  'buongiorno': 'it',
  'buonasera': 'it',
  'buonanotte': 'it',
  'per favore': 'it',
  'scusi': 'it',
  'scusa': 'it',
  'perdonami': 'it',
  'signore': 'it',
  'signora': 'it',
  'signorina': 'it',
  'amico': 'it',
  'amica': 'it',
  'amore': 'it',
  'bene': 'it',
  'male': 'it',
  'arrivederci': 'it',
  'addio': 'it',
  // Portuguese
  'ola': 'pt',
  'olá': 'pt',
  'obrigado': 'pt',
  'obrigada': 'pt',
  'sim': 'pt',
  'nao': 'pt',
  'não': 'pt',
  'bom dia': 'pt',
  'boa tarde': 'pt',
  'boa noite': 'pt',
  'desculpe': 'pt',
  'com licença': 'pt',
  'senhor': 'pt',
  'senhora': 'pt',
  'senhorita': 'pt',
  'ate logo': 'pt',
  'até logo': 'pt',
  'adeus': 'pt',
};

/**
 * Detect script family from Unicode ranges for first-pass filtering.
 * This is more reliable than franc for single characters or very short text.
 */
function detectScriptFamily(text: string): string | null {
  const firstChar = text.trim().charAt(0);
  if (!firstChar) return null;
  
  const code = firstChar.charCodeAt(0);
  
  // Arabic script range (U+0600–U+06FF)
  if (code >= 0x0600 && code <= 0x06FF) {
    logger.debug('script-heuristic', { script: 'Arabic', code });
    return 'ar';
  }
  
  // Devanagari script range (Hindi, Sanskrit, etc.) (U+0900–U+097F)
  if (code >= 0x0900 && code <= 0x097F) {
    logger.debug('script-heuristic', { script: 'Hindi/Devanagari', code });
    return 'hi';
  }
  
  // CJK Unified Ideographs (Chinese, Japanese, Korean) (U+4E00–U+9FFF)
  if (code >= 0x4E00 && code <= 0x9FFF) {
    // Further distinguish between Chinese/Japanese/Korean based on context
    // For now, default to Chinese as it's the most common in this range
    logger.debug('script-heuristic', { script: 'CJK', default: 'zh', code });
    return 'zh';
  }
  
  // Hangul syllables (Korean) (U+AC00–U+D7AF)
  if (code >= 0xAC00 && code <= 0xD7AF) {
    logger.debug('script-heuristic', { script: 'Korean', code });
    return 'ko';
  }
  
  // Cyrillic script (Russian, Ukrainian, etc.) (U+0400–U+04FF)
  if (code >= 0x0400 && code <= 0x04FF) {
    logger.debug('script-heuristic', { script: 'Cyrillic', default: 'ru', code });
    return 'ru';
  }
  
  // Greek script (U+0370–U+03FF)
  if (code >= 0x0370 && code <= 0x03FF) {
    logger.debug('script-heuristic', { script: 'Greek', code });
    return 'el';
  }
  
  // Thai script (U+0E00–U+0E7F)
  if (code >= 0x0E00 && code <= 0x0E7F) {
    logger.debug('script-heuristic', { script: 'Thai', code });
    return 'th';
  }
  
  // Hebrew script (U+0590–U+05FF)
  if (code >= 0x0590 && code <= 0x05FF) {
    logger.debug('script-heuristic', { script: 'Hebrew', code });
    return 'he';
  }
  
  // Latin script - need statistical detection to distinguish languages
  if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) {
    logger.debug('script-heuristic', { script: 'Latin', action: 'statistical-detection' });
    return null; // Let franc handle Latin scripts
  }
  
  logger.debug('script-heuristic', { script: 'Unknown', code });
  return null;
}

export function detectLanguage(text: string): { language: string | null; method: string; confidence: number } {
  const normalizedText = text.trim().toLowerCase();
  const textLength = normalizedText.length;
  
  // Step 1: Script-based heuristic for non-Latin scripts (works even for single characters)
  const scriptDetection = detectScriptFamily(text);
  if (scriptDetection) {
    return { language: scriptDetection, method: 'script-heuristic', confidence: 0.95 };
  }
  
  // Step 2: Dictionary lookup for short text (exact match, high confidence)
  if (textLength < MIN_DICTIONARY_LOOKUP_LENGTH) {
    const commonWordMatch = COMMON_WORDS[normalizedText];
    if (commonWordMatch) {
      logger.debug('dictionary-lookup', { word: normalizedText, language: commonWordMatch });
      return { language: commonWordMatch, method: 'dictionary', confidence: 1.0 };
    }
  }
  
  // Step 2.5: Hinglish detection for Latin-script text (code-mixed Hindi-English)
  // Only runs if script is Latin (script heuristic returned null)
  const hinglishDetection = detectHinglish(text);
  if (hinglishDetection.language) {
    return { 
      language: hinglishDetection.language, 
      method: hinglishDetection.method, 
      confidence: hinglishDetection.confidence 
    };
  }
  
  // Step 3: Text too short for statistical detection - return uncertain
  if (textLength < MIN_FRANC_DETECTION_LENGTH) {
    logger.debug('detection', { status: 'too-short', length: textLength });
    return { language: null, method: 'none', confidence: 0 };
  }
  
  // Step 4: Use franc for statistical detection (reliable for longer text)
  const detected = franc(text);
  logger.debug('franc', { result: detected, textLength });
  
  const isoCode = ISO_639_3_TO_639_1[detected];
  if (isoCode) {
    // Confidence based on text length - longer text = higher confidence
    const confidence = Math.min(0.9, 0.5 + (textLength / MIN_RELIABLE_DETECTION_LENGTH) * 0.4);
    logger.debug('detection', { method: 'franc', language: isoCode, confidence });
    return { language: isoCode, method: 'franc', confidence };
  }
  
  logger.debug('detection', { status: 'no-match', francResult: detected });
  return { language: null, method: 'franc-no-match', confidence: 0 };
}

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
const DICTIONARY_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en';

/**
 * Generic translation provider interface.
 * Swap implementations without changing callers.
 */
export interface TranslationProvider {
  readonly name: string;
  translate(request: TranslationRequest, myMemoryEmail?: string, settings?: import('@/types').UserSettings): Promise<TranslationResult>;
}

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string;
    match?: number;
  };
  responseStatus?: number;
  responseDetails?: string;
  matches?: Array<{
    source?: string;
  }>;
}

interface DictionaryDefinition {
  definition?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface DictionaryMeaning {
  partOfSpeech?: string;
  definitions?: DictionaryDefinition[];
}

interface DictionaryEntry {
  meanings?: DictionaryMeaning[];
}

interface DictionaryEnrichment {
  partOfSpeech: string | null;
  definition: string | null;
  synonyms: string[];
  antonyms: string[];
  exampleSentences: string[];
}

/** Maps app language codes to MyMemory-compatible codes. */
const MYMEMORY_LANG_MAP: Record<string, string> = {
  zh: 'zh-CN',
};

/**
 * Maps ISO 639-3 codes (from franc) to ISO 639-1 codes (for MyMemory).
 * franc returns 3-letter codes, MyMemory expects 2-letter codes.
 * This mapping covers the most commonly used languages supported by MyMemory.
 */
export const ISO_639_3_TO_639_1: Record<string, string> = {
  'eng': 'en', // English
  'spa': 'es', // Spanish
  'deu': 'de', // German
  'fra': 'fr', // French
  'ita': 'it', // Italian
  'por': 'pt', // Portuguese
  'rus': 'ru', // Russian
  'zho': 'zh', // Chinese (macrolanguage)
  'cmn': 'zh', // Mandarin Chinese
  'yue': 'zh', // Cantonese
  'jpn': 'ja', // Japanese
  'kor': 'ko', // Korean
  'ara': 'ar', // Arabic
  'hin': 'hi', // Hindi
  'ben': 'bn', // Bengali
  'tur': 'tr', // Turkish
  'pol': 'pl', // Polish
  'nld': 'nl', // Dutch
  'swe': 'sv', // Swedish
  'nor': 'no', // Norwegian
  'dan': 'da', // Danish
  'fin': 'fi', // Finnish
  'ell': 'el', // Greek
  'ces': 'cs', // Czech
  'ron': 'ro', // Romanian
  'hun': 'hu', // Hungarian
  'ukr': 'uk', // Ukrainian
  'bul': 'bg', // Bulgarian
  'srp': 'sr', // Serbian
  'hrv': 'hr', // Croatian
  'slv': 'sl', // Slovenian
  'lit': 'lt', // Lithuanian
  'lav': 'lv', // Latvian
  'est': 'et', // Estonian
  'vie': 'vi', // Vietnamese
  'tha': 'th', // Thai
  'ind': 'id', // Indonesian
  'msa': 'ms', // Malay
  'fil': 'tl', // Filipino
  'heb': 'he', // Hebrew
  'fas': 'fa', // Persian
  'urd': 'ur', // Urdu
  'pus': 'ps', // Pashto
  'tam': 'ta', // Tamil
  'tel': 'te', // Telugu
  'kan': 'kn', // Kannada
  'mal': 'ml', // Malayalam
  'mar': 'mr', // Marathi
  'guj': 'gu', // Gujarati
  'pan': 'pa', // Punjabi
  'nep': 'ne', // Nepali
  'sin': 'si', // Sinhala
  'bur': 'my', // Burmese
  'khm': 'km', // Khmer
  'lao': 'lo', // Lao
  'amh': 'am', // Amharic
  'som': 'so', // Somali
  'swa': 'sw', // Swahili
  'zul': 'zu', // Zulu
  'xho': 'xh', // Xhosa
  'afr': 'af', // Afrikaans
  'gle': 'ga', // Irish
  'cym': 'cy', // Welsh
  'bre': 'br', // Breton
  'cor': 'kw', // Cornish
  'gla': 'gd', // Scottish Gaelic
  'eus': 'eu', // Basque
  'cat': 'ca', // Catalan
  'glg': 'gl', // Galician
  'oci': 'oc', // Occitan
  'kur': 'ku', // Kurdish
  'aze': 'az', // Azerbaijani
  'kaz': 'kk', // Kazakh
  'uzb': 'uz', // Uzbek
  'uig': 'ug', // Uyghur
  'tib': 'bo', // Tibetan
  'dzo': 'dz', // Dzongkha
  'mon': 'mn', // Mongolian
  'hye': 'hy', // Armenian
  'geo': 'ka', // Georgian
  'che': 'ce', // Chechen
  'abk': 'ab', // Abkhaz
  'oss': 'os', // Ossetic
  'tat': 'tt', // Tatar
  'bak': 'ba', // Bashkir
  'chv': 'cv', // Chuvash
};

function toMyMemoryLang(code: string): string {
  // Never return 'auto' - MyMemory rejects it with 403 error
  if (code === 'auto' || code === 'autodetect') {
    throw new Error('toMyMemoryLang should never be called with auto/autodetect');
  }
  const normalized = normalizeLanguageCode(code);
  return MYMEMORY_LANG_MAP[normalized] ?? normalized;
}

export class MyMemoryTranslationProvider implements TranslationProvider {
  readonly name = 'mymemory';

  async translate(request: TranslationRequest, myMemoryEmail?: string, settings?: import('@/types').UserSettings): Promise<TranslationResult> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw translationError('OFFLINE', 'You appear to be offline.');
    }

    const text = request.text.trim();
    if (!text) {
      throw translationError('INVALID_REQUEST', 'No text provided for translation.');
    }

    // Note: The 5000 character limit has been removed since chunking handles longer text
    // Chunking splits text into 500-character chunks for MyMemory API compatibility

    const requestedSource = normalizeLanguageCode(request.sourceLanguage ?? 'auto');
    const target = normalizeLanguageCode(request.targetLanguage);

    if (requestedSource !== 'auto' && requestedSource === target) {
      throw translationError('INVALID_REQUEST', 'Source and target language must differ.');
    }

    // Use client-side language detection when source is 'auto'
    let sourceParam: string;
    let detectedSource: string | null | undefined;
    let detectionConfidence = 0;

    if (requestedSource === 'auto') {
      const detectionResult = detectLanguage(text);
      detectedSource = detectionResult.language;
      detectionConfidence = detectionResult.confidence;
      
      logger.debug('detection-result', {
        method: detectionResult.method,
        language: detectedSource,
        confidence: detectionResult.confidence,
        textLength: text.length,
      });

      // Handle Hinglish (hi-Latn) detection with dual-path routing
      if (detectedSource === 'hi-Latn') {
        logger.debug('hinglish-detected', { 
          text: text.substring(0, 50),
          target,
          mode: settings?.hinglishTranslationMode || 'auto',
          hasGeminiKey: !!settings?.geminiApiKey
        });

        const mode = settings?.hinglishTranslationMode || 'auto';
        const hasGeminiKey = !!settings?.geminiApiKey?.trim();

        // Route based on mode and API key availability
        if (mode === 'gemini' || (mode === 'auto' && hasGeminiKey)) {
          // Use Gemini for direct Hinglish translation
          try {
            logger.debug('hinglish-route', { route: 'gemini', reason: 'gemini-preferred-or-available' });
            const apiKey = settings?.geminiApiKey || '';
            if (!apiKey) {
              throw new Error('MISSING_API_KEY');
            }
            const translatedText = await translateHinglish(text, target, apiKey);
            
            return {
              translatedText,
              detectedSourceLanguage: 'hi-Latn',
              targetLanguage: target,
              provider: 'gemini',
              cached: false,
            };
          } catch (error) {
            logger.error('hinglish-gemini-failed', { 
              error: error instanceof Error ? error.message : String(error) 
            });
            // Fall through to transliteration path if Gemini fails
          }
        }

        // Transliteration path (either forced or Gemini unavailable)
        if (mode === 'transliteration' || mode === 'auto') {
          logger.debug('hinglish-route', { route: 'transliteration', reason: 'transliteration-preferred-or-gemini-failed' });
          
          try {
            const devanagariText = transliterateHinglishToDevanagari(text);
            logger.debug('hinglish-transliteration', { 
              original: text.substring(0, 50),
              transliterated: devanagariText.substring(0, 50)
            });

            // Use Devanagari text for normal MyMemory translation
            const devanagariRequest = { ...request, text: devanagariText };
            const result = await this.translate(devanagariRequest, myMemoryEmail, settings);
            
            return {
              ...result,
              detectedSourceLanguage: 'hi-Latn', // Keep original detection
            };
          } catch (error) {
            logger.error('hinglish-transliteration-failed', { 
              error: error instanceof Error ? error.message : String(error) 
            });
            // Fall through to normal detection handling
          }
        }
      }

      // When detection is uncertain (null or low confidence), surface this to the user
      // instead of silently falling back to a hardcoded language
      if (detectedSource === null || detectionConfidence < 0.5) {
        // Try page language hint as a last resort, but only if it's valid and differs from target
        const pageLang = request.pageLanguage?.trim();
        const isValidPageLang = pageLang && /^[a-z]{2}$/i.test(pageLang);
        
        if (isValidPageLang && pageLang !== target) {
          logger.debug('fallback', { type: 'page-language', pageLang });
          sourceParam = toMyMemoryLang(pageLang);
          detectedSource = pageLang; // Track that we used page language
        } else {
          // No reliable detection available - throw error instead of guessing
          // This is required by the spec: no hardcoded fallbacks
          logger.debug('detection-failed', { 
            reason: 'low-confidence', 
            confidence: detectionConfidence,
            detectedSource 
          });
          throw translationError(
            'INVALID_REQUEST',
            'Could not detect language automatically — please select the source language manually.'
          );
        }
      } else {
        sourceParam = toMyMemoryLang(detectedSource);
      }
      logger.debug('client-detection', { detectedSource, sourceParam });
    } else {
      sourceParam = toMyMemoryLang(requestedSource);
    }
    const targetParam = toMyMemoryLang(target);

    // Pre-API safeguard: Skip API call if source equals target (avoids MyMemory 403 error)
    // Only apply this check when detection is CONFIDENT (detectedSource !== null for auto-detect)
    // When detection is uncertain, let the API handle it and rely on post-API check
    const isDetectionConfident = requestedSource === 'auto' ? detectedSource !== null : true;
    
    logger.debug('pre-api-check', {
      sourceParam,
      targetParam,
      isDetectionConfident,
      willSkip: sourceParam === targetParam && isDetectionConfident,
    });
    
    if (sourceParam === targetParam && isDetectionConfident) {
      logger.info('same-language', { 
        trigger: 'pre-api', 
        reason: 'confident-detection',
        detectedSource,
        target,
        confidence: detectionConfidence
      });
      // Return special result to indicate same-language warning
      return {
        translatedText: '', // Empty to trigger warning UI
        detectedSourceLanguage: requestedSource === 'auto' ? detectedSource ?? sourceParam : sourceParam,
        targetLanguage: target,
        provider: this.name,
        cached: false,
        partOfSpeech: null,
        definition: null,
        synonyms: [],
        antonyms: [],
        exampleSentences: [],
        sameLanguage: true,
      };
    }
    
    logger.debug('api-call', { sourceParam, targetParam, textLength: text.length });

    // Use chunking for long text to handle MyMemory's character limit
    const { translatedText, detectedSource: apiDetectedSource, chunkCount } = await translateWithChunking(
      text,
      sourceParam,
      targetParam,
      myMemoryEmail,
    );
    
    logger.debug('api-response', { 
      apiDetectedSource, 
      requestedSource, 
      target, 
      chunkCount,
      translatedLength: translatedText.length 
    });
    const resolvedSource =
      requestedSource === 'auto'
        ? (detectedSource ?? null)
        : requestedSource;
    logger.debug('resolved-source', { resolvedSource });

    // Log detected language for debugging auto-detect issues
    if (requestedSource === 'auto') {
      logger.debug('auto-detect-info', {
        rawDetected: detectedSource,
        normalizedDetected: detectedSource ? normalizeLanguageCode(detectedSource) : 'N/A',
        targetLanguage: target,
        normalizedTarget: normalizeLanguageCode(target),
        isSameLanguage: detectedSource ? normalizeLanguageCode(detectedSource) === normalizeLanguageCode(target) : 'N/A',
      });
    }

    // Post-API same-language detection: Check if translation returned original text
    // This is more reliable than pre-API detection since it uses actual API response
    const normalizedOriginal = normalizeForComparison(text);
    const normalizedTranslated = normalizeForComparison(translatedText);
    const isUnchanged = normalizedOriginal === normalizedTranslated;
    
    logger.debug('post-api-check', {
      isUnchanged,
      textLength: text.length,
      normalizedOriginal: normalizedOriginal.slice(0, 50),
      normalizedTranslated: normalizedTranslated.slice(0, 50),
    });
    
    // Only set sameLanguage flag if:
    // 1. Text is long enough to be confident (avoid false positives on short text like "ok", "hi")
    // 2. Translation is identical to original (normalized comparison)
    // 3. Either auto-detect was used OR explicit source matches target
    const isLongEnough = text.length >= MIN_RELIABLE_DETECTION_LENGTH;
    const isExplicitSameLanguage = requestedSource !== 'auto' && requestedSource === target;
    const shouldSetSameLanguage = isUnchanged && (isLongEnough || isExplicitSameLanguage);
    
    if (shouldSetSameLanguage) {
      logger.debug('same-language', { trigger: 'post-api', reason: 'unchanged-translation' });
    }

    const enrichment =
      requestedSource === 'auto'
        ? null
        : await fetchDictionaryEnrichment(text, requestedSource, target, translatedText);

    const result = {
      translatedText,
      detectedSourceLanguage: resolvedSource,
      targetLanguage: target,
      provider: this.name,
      cached: false,
      partOfSpeech: enrichment?.partOfSpeech ?? null,
      definition: enrichment?.definition ?? null,
      synonyms: enrichment?.synonyms ?? [],
      antonyms: enrichment?.antonyms ?? [],
      exampleSentences: enrichment?.exampleSentences ?? [],
      sameLanguage: shouldSetSameLanguage,
    };
    logger.debug('final-result', {
      detectedSourceLanguage: result.detectedSourceLanguage,
      targetLanguage: result.targetLanguage,
      sameLanguage: result.sameLanguage,
    });
    return result;
  }
}

/**
 * Fetch with retry logic and exponential backoff.
 * Retries up to 3 times on 5xx or 429 status codes.
 * Uses exponential backoff: 1s, 2s, 4s delays.
 * Includes 10-second timeout via AbortController.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
): Promise<Response> {
  const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
  const TIMEOUT_MS = 10000; // 10 seconds
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Check response size before processing
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
        throw new Error('Response size exceeds limit (5MB)');
      }
      
      // Retry on 5xx or 429 status codes
      if (response.status >= 500 || response.status === 429) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          logger.warn('retry', { attempt: attempt + 1, maxRetries, delay, status: response.status });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Don't retry on abort (timeout) or network errors that won't resolve
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout after 10 seconds');
      }
      
      // Retry on network errors
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn('retry', { attempt: attempt + 1, maxRetries, delay, error: 'network error' });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

async function fetchMyMemoryTranslation(
  text: string,
  source: string,
  target: string,
  myMemoryEmail?: string,
): Promise<{ translatedText: string; detectedSource?: string }> {
  // Never send 'autodetect' or 'auto' to MyMemory - it rejects it with 403 error
  // This is a defensive check - toMyMemoryLang should already prevent this
  if (source === 'auto' || source === 'autodetect') {
    throw new Error('fetchMyMemoryTranslation should never be called with auto/autodetect source');
  }
  
  const sourceParam = source;
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceParam}|${target}`,
  });

  const email = myMemoryEmail?.trim();
  if (email) {
    params.set('de', email);
  }

  let response: Response;
  try {
    response = await fetchWithRetry(`${MYMEMORY_ENDPOINT}?${params.toString()}`);
  } catch {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  if (!response.ok) {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  let data: MyMemoryResponse;
  try {
    data = (await response.json()) as MyMemoryResponse;
  } catch {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  // Log full raw API response to see actual structure
  logger.debug('mymemory-raw-response', { response: data });

  if (data.responseStatus === 403) {
    // Check if this is the specific "PLEASE SELECT TWO DISTINCT LANGUAGES" error
    if (data.responseDetails?.includes('PLEASE SELECT TWO DISTINCT LANGUAGES')) {
      throw translationError(
        'INVALID_REQUEST',
        'Could not detect language automatically — please select the source language manually.',
      );
    }
    throw translationError(
      'RATE_LIMITED',
      'Daily free translation limit reached — resets at midnight. Add your email in Settings for a higher limit.',
    );
  }

  if (data.responseStatus !== 200) {
    const detail = data.responseDetails ?? 'Translation failed. Please try again.';
    throw translationError('API_FAILURE', detail);
  }

  const translatedText = data.responseData?.translatedText?.trim();
  if (!translatedText) {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  const detectedSource =
    source === 'auto' && data.matches?.[0]?.source
      ? normalizeLanguageCode(data.matches[0].source)
      : undefined;

  return { translatedText, detectedSource };
}

function getEnglishLookupWord(
  text: string,
  source: string,
  target: string,
  translatedText: string,
): string | null {
  if (!isSingleWord(text)) return null;
  if (source === 'en') return text;
  if (target === 'en' && isSingleWord(translatedText)) return translatedText;
  return null;
}

async function fetchDictionaryEnrichment(
  text: string,
  source: string,
  target: string,
  translatedText: string,
): Promise<DictionaryEnrichment | null> {
  const word = getEnglishLookupWord(text, source, target, translatedText);
  if (!word) return null;

  try {
    const response = await fetch(`${DICTIONARY_ENDPOINT}/${encodeURIComponent(word.toLowerCase())}`);
    if (response.status === 404) return null;
    if (!response.ok) return null;

    const entries = (await response.json()) as DictionaryEntry[];
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const definitions: string[] = [];
    const synonyms = new Set<string>();
    const antonyms = new Set<string>();
    const examples: string[] = [];
    let partOfSpeech: string | null = null;

    for (const entry of entries) {
      for (const meaning of entry.meanings ?? []) {
        if (!partOfSpeech && meaning.partOfSpeech) {
          partOfSpeech = meaning.partOfSpeech;
        }

        for (const def of meaning.definitions ?? []) {
          if (def.definition && definitions.length < 3) {
            definitions.push(def.definition);
          }
          if (def.example && examples.length < 3) {
            examples.push(def.example);
          }
          for (const syn of def.synonyms ?? []) {
            if (synonyms.size < 8) synonyms.add(syn);
          }
          for (const ant of def.antonyms ?? []) {
            if (antonyms.size < 8) antonyms.add(ant);
          }
        }
      }
    }

    if (definitions.length === 0 && synonyms.size === 0 && antonyms.size === 0 && examples.length === 0) {
      return null;
    }

    return {
      partOfSpeech,
      definition: definitions.length > 0 ? definitions.join(' · ') : null,
      synonyms: [...synonyms],
      antonyms: [...antonyms],
      exampleSentences: examples,
    };
  } catch {
    return null;
  }
}

/** Mock provider for development and tests. */
export class MockTranslationProvider implements TranslationProvider {
  readonly name = 'mock';

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    await delay(300 + Math.random() * 400);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw translationError('OFFLINE', 'You appear to be offline.');
    }

    const text = request.text.trim();
    if (!text) {
      throw translationError('INVALID_REQUEST', 'No text provided for translation.');
    }

    if (text.length > 5000) {
      throw translationError('RATE_LIMITED', 'Text exceeds maximum length (5000 characters).');
    }

    const detected = resolveSourceLanguage(
      request.sourceLanguage ?? 'auto',
      request.pageLanguage,
    );

    return {
      translatedText: `[${request.targetLanguage}] ${text}`,
      detectedSourceLanguage: detected,
      targetLanguage: request.targetLanguage,
      provider: this.name,
      cached: false,
      partOfSpeech: null,
      definition: null,
      synonyms: [],
      antonyms: [],
      exampleSentences: [],
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function translationError(
  code: import('@/types').TranslationErrorCode,
  message: string,
): Error & { code: import('@/types').TranslationErrorCode } {
  const err = new Error(message) as Error & { code: import('@/types').TranslationErrorCode };
  err.code = code;
  return err;
}

export function isTranslationError(
  error: unknown,
): error is Error & { code: import('@/types').TranslationErrorCode } {
  return error instanceof Error && 'code' in error && typeof (error as { code: unknown }).code === 'string';
}

export const defaultTranslationProvider: TranslationProvider = new MyMemoryTranslationProvider();

/**
 * Google Translate provider (requires API key).
 * Note: This is a placeholder - Google Translate API requires proper authentication.
 */
export class GoogleTranslateProvider implements TranslationProvider {
  readonly name = 'google';

  async translate(_request: TranslationRequest, _myMemoryEmail?: string): Promise<TranslationResult> {
    // Placeholder implementation - requires Google Cloud Translation API key
    throw translationError('MISSING_API_KEY', 'Google Translate provider requires API key configuration.');
  }
}

/**
 * Fallback chain provider that tries multiple providers in sequence.
 * If the primary provider fails, it falls back to secondary providers.
 */
export class FallbackTranslationProvider implements TranslationProvider {
  readonly name = 'fallback';
  private providers: TranslationProvider[];

  constructor(providers: TranslationProvider[]) {
    if (providers.length === 0) {
      throw new Error('Fallback provider requires at least one provider');
    }
    this.providers = providers;
  }

  async translate(request: TranslationRequest, myMemoryEmail?: string): Promise<TranslationResult> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        const result = await provider.translate(request, myMemoryEmail);
        // Mark which provider succeeded
        return { ...result, provider: `${provider.name} (via fallback)` };
      } catch (error) {
        if (isTranslationError(error)) {
          errors.push(error);
          // Retry with next provider on rate limit or API failure
          if (error.code === 'RATE_LIMITED' || error.code === 'API_FAILURE') {
            continue;
          }
          // Don't retry on client errors
          throw error;
        }
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // All providers failed
    throw translationError(
      'API_FAILURE',
      `All translation providers failed: ${errors.map(e => e.message).join(', ')}`,
    );
  }
}

/**
 * Create a fallback chain with MyMemory as primary and Mock as fallback.
 * To use real providers, replace MockTranslationProvider with configured providers.
 */
export function createFallbackProvider(): TranslationProvider {
  return new FallbackTranslationProvider([
    new MyMemoryTranslationProvider(),
    new MockTranslationProvider(), // Fallback for development/testing
  ]);
}
