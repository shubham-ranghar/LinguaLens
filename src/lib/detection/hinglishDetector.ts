import { logger } from '@/lib/logger';

/**
 * Configuration constants for Hinglish detection
 */
export const HINGLISH_TOKEN_RATIO_THRESHOLD = 0.15; // 15% of tokens must be Hinglish
export const MIN_TOKENS_FOR_DETECTION = 3; // Minimum tokens to attempt detection

/**
 * Common romanized Hindi tokens for Hinglish detection
 * This wordlist covers ~150-200 common Hindi words written in Latin script
 */
const HINGLISH_TOKENS = new Set([
  // Common pronouns and particles
  'hai', 'nahi', 'nahin', 'na', 'kya', 'kaise', 'kab', 'kahan', 'kaun', 'kyun', 'kyunki',
  'mera', 'mere', 'meri', 'tera', 'tere', 'teri', 'uska', 'uske', 'uski', 'hamara', 'hamare', 'hamari',
  'aap', 'aapka', 'aapke', 'aapki', 'hum', 'tum', 'tumhara', 'tumhare', 'tumhari',
  'woh', 'wo', 'ye', 'yeh', 'voh', 'vo', 'isko', 'usko', 'isko', 'inhe', 'unhe',
  
  // Common verbs
  'karta', 'karti', 'karte', 'kar', 'karo', 'karunga', 'karogi', 'karega', 'karegi', 'karenge',
  'hai', 'hain', 'ho', 'hota', 'hoti', 'hote', 'hoga', 'hogi', 'honge', 'hona', 'hona',
  'raha', 'rahi', 'rahe', 'rahega', 'rahegi', 'rahenge', 'raha', 'rahi', 'rahe',
  'gaya', 'gayi', 'gaye', 'gayega', 'gayegi', 'gayenge', 'jana', 'jao', 'jaye', 'jayein',
  'aata', 'aati', 'aate', 'aana', 'aao', 'aaye', 'aayein', 'sakta', 'sakti', 'sakte',
  'chahiye', 'chata', 'chati', 'chate', 'chahta', 'chahti', 'chahte', 'chahta', 'chahti', 'chahte',
  'pata', 'patana', 'pataye', 'sakoon', 'de', 'dena', 'do', 'diya', 'diye', 'digayi', 'denge',
  'lega', 'legi', 'lenge', 'le', 'lena', 'lo', 'liya', 'liye', 'ligayi', 'lenge',
  'bola', 'boli', 'bole', 'kah', 'kaha', 'kahe', 'kahna', 'kaho', 'kahenge', 'kahunga',
  'socha', 'sochi', 'soche', 'sochna', 'samajh', 'samajha', 'samajhi', 'samajhe', 'samajhna',
  
  // Common adjectives and adverbs
  'acha', 'achha', 'accha', 'achhe', 'bada', 'badi', 'bade', 'chota', 'choti', 'chote',
  'theek', 'thik', 'sahi', 'galat', 'dusra', 'dusri', 'dusre', 'pehla', 'pehli', 'pehle',
  'bohot', 'bahut', 'zyada', 'kam', 'kuch', 'sab', 'sabhi', 'har', 'koi', 'kuchh',
  'alag', 'same', 'jaisa', 'jaise', 'jaisi', 'aisa', 'aise', 'aisi', 'waisa', 'waise', 'waisi',
  'kafi', 'thoda', 'thodi', 'thode', 'poora', 'puri', 'pure', 'akela', 'akeli', 'akele',
  'naya', 'nayi', 'naye', 'purana', 'purani', 'purane', 'masta', 'mast', 'behtar', 'behtareen',
  
  // Common nouns and connectors
  'matlab', 'ka', 'ki', 'ke', 'kaam', 'kaam', 'kaam', 'dost', 'dosti', 'yaar', 'bhai', 'behen',
  'baap', 'maa', 'mummy', 'papa', 'ghar', 'ghar', 'kaam', 'office', 'school', 'college',
  'time', 'waqt', 'din', 'raat', 'subah', 'shaam', 'sham', 'kal', 'aaj', 'parson',
  'log', 'people', 'cheez', 'cheeze', 'baat', 'baatein', 'kaam', 'kaam', 'dimaag', 'dil',
  'problem', 'solution', 'idea', 'plan', 'work', 'job', 'business', 'paisa', 'paise',
  'pyar', 'pyaar', 'love', 'dil', 'dil', 'jaan', 'zindagi', 'life', 'death', 'maut',
  
  // Common question words and connectors
  'kya', 'kaise', 'kab', 'kahan', 'kaun', 'kyun', 'kyunki', 'agar', 'to', 'ya', 'phir',
  'lekin', 'par', 'magar', 'ki', 'ke', 'ka', 'jo', 'jisko', 'jis', 'jise', 'jahan',
  'jab', 'jaise', 'jaisa', 'waise', 'waisa', 'tab', 'tak', 'tak', 'bhi', 'hi', 'sirf',
  'ke', 'liye', 'se', 'pe', 'mein', 'me', 'men', 'par', 'upar', 'neeche', 'andar',
  'bahar', 'saath', 'sath', 'bina', 'ke', 'bad', 'ke', 'beech', 'beech', 'samne',
  
  // Common expressions
  'ji', 'sahib', 'ji', 'haan', 'han', 'hmm', 'ok', 'theek', 'hai', 'acha', 'achha',
  'are', 'arre', 'oye', 'sun', 'sunna', 'dekh', 'dekho', 'ruko', 'ruk', 'chalo',
  'jao', 'jao', 'aao', 'aana', 'please', 'thanks', 'shukriya', 'dhanyawad', 'sorry',
  'maaf', 'kshama', 'namaste', 'namaskar', 'pranam', 'salaam', 'adaab',
  
  // Common colloquial terms
  'wala', 'wale', 'wali', 'vala', 'vale', 'vali', 'saala', 'kamina', 'bhenchod',
  'madarchod', 'behen', 'behan', 'bhai', 'bhaiya', 'didi', 'chacha', 'mama', 'tau',
  'bua', 'chachi', 'maami', 'daadi', 'daada', 'nani', 'nana', 'pota', 'poti',
  
  // Time and quantity
  'abhi', 'ab', 'filhaal', 'abhi', 'turant', 'jaldi', 'der', 'deri', 'waqt', 'samay',
  'ghanta', 'minute', 'second', 'din', 'mahina', 'saal', 'baar', 'dafa', 'ek', 'do',
  'teen', 'char', 'paanch', 'che', 'saath', 'saat', 'aath', 'nau', 'das', 'gaye',
  
  // Common fillers and interjections
  'haan', 'han', 'na', 'nahi', 'nahin', 'achha', 'acha', 'theek', 'are', 'arre',
  'oye', 'sun', 'bhai', 'yaar', 'dost', 'suno', 'sunna', 'samjho', 'samajh',
]);

/**
 * Tokenize text by splitting on whitespace and punctuation
 * Returns lowercase tokens for matching
 */
function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(token => token.length > 0); // Remove empty tokens
}

/**
 * Detect Hinglish (romanized Hindi-English code-mixed text)
 * 
 * This detector runs as a sub-step in the detection pipeline after dictionary lookup
 * and before statistical detection. It only activates for Latin-script text.
 * 
 * @param text - Input text to analyze
 * @returns Detection result with language code 'hi-Latn' if Hinglish detected, null otherwise
 */
export function detectHinglish(text: string): { 
  language: string | null; 
  method: string; 
  confidence: number;
  matchedTokens?: number;
  totalTokens?: number;
  ratio?: number;
} {
  const tokens = tokenizeText(text);
  const totalTokens = tokens.length;
  
  // Need minimum tokens for reliable detection
  if (totalTokens < MIN_TOKENS_FOR_DETECTION) {
    logger.debug('hinglish-detection', { 
      status: 'too-few-tokens', 
      tokenCount: totalTokens,
      minRequired: MIN_TOKENS_FOR_DETECTION 
    });
    return { language: null, method: 'hinglish-lexical', confidence: 0 };
  }
  
  // Count matched Hinglish tokens
  let matchedTokens = 0;
  for (const token of tokens) {
    if (HINGLISH_TOKENS.has(token)) {
      matchedTokens++;
    }
  }
  
  const ratio = matchedTokens / totalTokens;
  
  logger.debug('hinglish-detection', { 
    totalTokens, 
    matchedTokens, 
    ratio: ratio.toFixed(3),
    threshold: HINGLISH_TOKEN_RATIO_THRESHOLD 
  });
  
  // If ratio meets threshold, classify as Hinglish
  if (ratio >= HINGLISH_TOKEN_RATIO_THRESHOLD) {
    const confidence = Math.min(0.85, 0.6 + ratio * 0.5); // Confidence between 0.6-0.85 based on ratio
    
    logger.debug('hinglish-detection', { 
      status: 'detected',
      detectionSource: 'hinglish-lexical',
      language: 'hi-Latn',
      confidence: confidence.toFixed(3),
      matchedTokens,
      totalTokens,
      ratio: ratio.toFixed(3)
    });
    
    return { 
      language: 'hi-Latn', 
      method: 'hinglish-lexical', 
      confidence,
      matchedTokens,
      totalTokens,
      ratio
    };
  }
  
  logger.debug('hinglish-detection', { 
    status: 'not-detected',
    reason: 'ratio-below-threshold',
    ratio: ratio.toFixed(3),
    threshold: HINGLISH_TOKEN_RATIO_THRESHOLD
  });
  
  return { language: null, method: 'hinglish-lexical', confidence: 0 };
}
