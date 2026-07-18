import { logger } from '@/lib/logger';

/**
 * Quote style configuration for each language.
 * Maps language codes to their correct open/close quote characters.
 */
export const QUOTE_STYLES: Record<string, { open: string; close: string }> = {
  // French: guillemets with non-breaking spaces
  fr: { open: '«', close: '»' },
  // German: low-high quotes
  de: { open: '„', close: '"' },
  // Turkish: standard straight quotes (matching Turkish typographic conventions)
  tr: { open: '"', close: '"' },
  // English: standard straight quotes
  en: { open: '"', close: '"' },
  // Spanish: straight quotes (modern usage)
  es: { open: '"', close: '"' },
  // Italian: straight quotes (modern usage)
  it: { open: '"', close: '"' },
  // Russian: french-style guillemets
  ru: { open: '«', close: '»' },
  // Arabic: arabic quotation marks
  ar: { open: '«', close: '»' },
  // Korean: corner brackets
  ko: { open: '「', close: '」' },
  // Chinese: corner brackets
  zh: { open: '「', close: '」' },
  // Japanese: corner brackets
  ja: { open: '「', close: '」' },
  // Default fallback for other languages
  default: { open: '"', close: '"' },
};

/**
 * French idiom overrides for known problematic literal translations.
 * Maps incorrect literal translations to correct idiomatic meanings.
 */
export const frenchIdiomOverrides: Record<string, string> = {
  'point fort': 'force',
  'points forts': 'forces',
  'point faible': 'faiblesse',
  'points faibles': 'faiblesses',
  'au jour d\'aujourd\'hui': 'aujourd\'hui',
  'à tout à l\'heure': 'à tout à l\'heure',
  'd\'abord et avant tout': 'avant tout',
};

/**
 * Spanish idiom overrides for known problematic literal translations.
 */
export const spanishIdiomOverrides: Record<string, string> = {
  'nativas de la IA': 'nativas de la inteligencia artificial',
  'en el punto de mira': 'en el punto de mira',
  'a por ello': 'a por ello',
  'de golpe': 'de repente',
};

/**
 * Hindi loanword replacements for unnecessary English loanwords.
 * Maps transliterated English loanwords to proper Hindi equivalents.
 */
export const hindiLoanwordReplacements: Record<string, string> = {
  'हॉट टेक': 'मुख्य विचार',
  'तीखी राय': 'मुख्य विचार',
  'हॉट टेक्स': 'मुख्य विचार',
  'ब्रेकिंग न्यूज़': 'ताज़ा खबर',
  'ब्रेकिंग न्यूज': 'ताज़ा खबर',
  'ट्रेंडिंग': 'लोकप्रिय',
  'वायरल': 'वायरल',
  'फीडबैक': 'प्रतिक्रिया',
  'अपडेट': 'अद्यतन',
  'डाउनलोड': 'डाउनलोड',
  'अपलोड': 'अपलोड',
  'सॉफ्टवेयर': 'सॉफ्टवेयर',
  'हार्डवेयर': 'हार्डवेयर',
  'इंटरनेट': 'इंटरनेट',
  'वेबसाइट': 'वेबसाइट',
  'ऑनलाइन': 'ऑनलाइन',
  'ऑफलाइन': 'ऑफलाइन',
};

/**
 * Hindi vocabulary overrides for incorrect word choices.
 * Maps wrong Hindi words to correct alternatives.
 */
export const hindiVocabularyOverrides: Record<string, string> = {
  'जाना': 'जाना', // Movement verb - context-specific
  'आना': 'आना', // Movement verb - context-specific
};

/**
 * French verb corrections for auxiliary verb selection errors.
 * Maps incorrect past participles to correct ones for movement verbs.
 */
export const frenchVerbCorrections: Record<string, string> = {
  'est parti': 'est allé',
  'sont partis': 'sont allés',
  'est partie': 'est allée',
  'sont parties': 'sont allées',
};

/**
 * English vocabulary overrides for incorrect word choices.
 */
export const englishVocabularyOverrides: Record<string, string> = {
  // Add entries as needed
};

/**
 * Spanish vocabulary overrides for incorrect word choices.
 */
export const spanishVocabularyOverrides: Record<string, string> = {
  // Add entries as needed
};

/**
 * German vocabulary overrides for incorrect word choices.
 */
export const germanVocabularyOverrides: Record<string, string> = {
  // Add entries as needed
};

/**
 * Vocabulary overrides dictionary organized by language.
 */
export const vocabularyOverrides: Record<string, Record<string, string>> = {
  hi: hindiVocabularyOverrides,
  fr: frenchVerbCorrections,
  en: englishVocabularyOverrides,
  es: spanishVocabularyOverrides,
  de: germanVocabularyOverrides,
};

/**
 * Number agreement patterns for Hindi.
 * Fixes singular/plural mismatches between nouns and adjectives/verbs.
 */
const HINDI_NUMBER_PATTERNS: [RegExp, string][] = [
  // Singular noun + plural adjective/verb -> correct to singular
  [/(लड़का.*?)(अच्छे)/g, '$1अच्छा'],
  [/(आदमी.*?)(अच्छे)/g, '$1अच्छा'],
  [/(लड़की.*?)(अच्छे)/g, '$1अच्छी'],
  
  // Plural noun + singular adjective/verb -> correct to plural
  [/(लड़के.*?)(अच्छा)/g, '$1अच्छे'],
  [/(लड़कियाँ.*?)(अच्छा)/g, '$1अच्छी'],
];

/**
 * Verb agreement patterns for Spanish.
 * Fixes subject-verb agreement errors.
 */
const SPANISH_VERB_PATTERNS: [RegExp, string][] = [
  // Singular subject + plural verb -> correct to singular
  [/(yo|tú|él|ella) (somos|son)/gi, '$1 es'],
  [/(nosotros) (es|eres)/gi, '$1 somos'],
  
  // Plural subject + singular verb -> correct to plural
  [/((?:ellos|ellas|nosotros|vosotros)) (es|eres)/gi, '$1 son'],
];

/**
 * Possessive pronoun patterns for French.
 * Fixes reflexive/non-reflexive possessive pronoun usage.
 */
const FRENCH_POSSESSIVE_PATTERNS: [RegExp, string][] = [
  // Common reflexive/non-reflexive corrections
  [/(je) (mon|ton|son) (?:même|propre)/gi, '$1 $2 propre'],
  [/(tu) (mon|ma|mes) (?:même|propre)/gi, '$1 ton propre'],
  [/(il|elle) (mon|ton|mes) (?:même|propre)/gi, '$1 son propre'],
];

/**
 * Passive voice detection patterns.
 * Identifies potentially problematic passive constructions that may indicate literal translation.
 */
const PASSIVE_VOICE_PATTERNS = [
  // English passive markers (was/were + past participle)
  /\b(?:was|were)\s+\w+ed\b/gi,
  /\b(?:was|were)\s+\w+en\b/gi,
  
  // French passive markers (être conjugated + past participle ending in é)
  /\b(?:a été|ont été|fut|est|sont|sera)\s+\w+[ée]/gi,
  
  // German passive markers (werden conjugated + ge- prefix or any word)
  /\b(?:wurde|wurden|wird|werden)\s+\w+/gi,
  
  // Spanish passive markers (ser/estar conjugated + past participle)
  /\b(?:fue|fueron|es|está|están|será)\s+\w+ado\b/gi,
  /\b(?:fue|fueron|es|está|están|será)\s+\w+ido\b/gi,
];

/**
 * Pronoun-antecedent agreement patterns for gendered languages.
 * Maps gendered nouns to their correct pronoun forms.
 */
const PRONOUN_ANTECEDENT_PATTERNS: Record<string, [RegExp, string][]> = {
  hi: [
    // Hindi: feminine noun -> feminine pronoun
    [/(लड़की|औरत|बेटी|माता|बहन).*?(उसने|वह)/g, '$1उसने'], // Simplified - would need context tracking
  ],
  fr: [
    // French: feminine noun -> feminine pronoun
    [/(\w+femme|\w+fille|\w*maison).*?(il|ils)/gi, '$1elle'],
  ],
  es: [
    // Spanish: feminine noun -> feminine pronoun
    [/(\w*mujer|\w*niña).*?(él|ellos)/gi, '$1ella'],
  ],
  de: [
    // German: feminine noun -> feminine pronoun
    [/(\w*frau|\w*tochter).*?(er|sie)/gi, '$1sie'],
  ],
};

/**
 * German filler words that MyMemory tends to add unnecessarily.
 * These words are removed when they appear without clear semantic purpose.
 */
const GERMAN_FILLER_WORDS = [
  'eigentlich',
  'sozusagen',
  'gewissermaßen',
  'irgendwie',
  'halt',
  'mal',
  'doch',
  'ja',
  'eben',
  'nun',
];

/**
 * Languages that require naturalness check for word-for-word translation detection.
 */
const NATURALNESS_CHECK_LANGUAGES = ['ru', 'ar', 'ko'];

/**
 * Threshold for detecting word-for-word translation (ratio of translated to source length).
 * If the ratio is too close to 1.0, it may indicate literal translation.
 */
const WORD_FOR_WORD_THRESHOLD = 0.85;

/**
 * Fix Hindi number agreement errors using regex patterns.
 * Detects and corrects singular/plural mismatches between nouns and adjectives/verbs.
 */
export function fixHindiNumberAgreement(text: string): string {
  let corrected = text;
  
  for (const [pattern, replacement] of HINDI_NUMBER_PATTERNS) {
    corrected = corrected.replace(pattern, replacement);
  }
  
  if (corrected !== text) {
    logger.debug('hindi-number-fixed', { original: text, corrected });
  }
  
  return corrected;
}

/**
 * Fix Spanish verb agreement errors using regex patterns.
 * Detects and corrects subject-verb agreement mismatches.
 */
export function fixSpanishVerbAgreement(text: string): string {
  let corrected = text;
  
  for (const [pattern, replacement] of SPANISH_VERB_PATTERNS) {
    corrected = corrected.replace(pattern, replacement);
  }
  
  if (corrected !== text) {
    logger.debug('spanish-verb-fixed', { original: text, corrected });
  }
  
  return corrected;
}

/**
 * Fix French possessive pronoun usage using regex patterns.
 * Detects and corrects reflexive/non-reflexive possessive pronoun mismatches.
 */
export function fixFrenchPossessivePronouns(text: string): string {
  let corrected = text;
  
  for (const [pattern, replacement] of FRENCH_POSSESSIVE_PATTERNS) {
    corrected = corrected.replace(pattern, replacement);
  }
  
  if (corrected !== text) {
    logger.debug('french-possessive-fixed', { original: text, corrected });
  }
  
  return corrected;
}

/**
 * Detect passive voice constructions that may indicate literal translation.
 * Returns true if passive voice patterns are detected.
 */
export function detectPassiveVoice(text: string): boolean {
  for (const pattern of PASSIVE_VOICE_PATTERNS) {
    if (pattern.test(text)) {
      logger.debug('passive-voice-detected', { text: text.substring(0, 50) });
      return true;
    }
  }
  return false;
}

/**
 * Fix pronoun-antecedent agreement for gendered languages.
 * Corrects mismatched pronouns based on preceding noun gender.
 */
export function fixPronounAntecedentAgreement(text: string, targetLang: string): string {
  const patterns = PRONOUN_ANTECEDENT_PATTERNS[targetLang];
  if (!patterns) return text;
  
  let corrected = text;
  for (const [pattern, replacement] of patterns) {
    corrected = corrected.replace(pattern, replacement);
  }
  
  if (corrected !== text) {
    logger.debug('pronoun-antecedent-fixed', { targetLang, original: text, corrected });
  }
  
  return corrected;
}

/**
 * Apply vocabulary overrides for incorrect word choices.
 * Uses language-specific dictionaries to replace wrong words.
 */
export function applyVocabularyOverrides(text: string, targetLang: string): string {
  const overrides = vocabularyOverrides[targetLang];
  if (!overrides) return text;
  
  let corrected = text;
  for (const [incorrect, correct] of Object.entries(overrides)) {
    const regex = new RegExp(incorrect, 'gi');
    if (regex.test(corrected)) {
      corrected = corrected.replace(regex, correct);
    }
  }
  
  if (corrected !== text) {
    logger.debug('vocabulary-corrected', { targetLang, original: text, corrected });
  }
  
  return corrected;
}

/**
 * Fix English subject-verb agreement errors.
 * Corrects common mismatches between subjects and verbs.
 */
export function fixEnglishSubjectVerbAgreement(text: string): string {
  let corrected = text;
  
  // Singular subject + plural verb -> correct to singular
  const patterns: [RegExp, string][] = [
    [/(he|she|it) (are|were)/gi, '$1 is'],
    [/(he|she|it) (have)/gi, '$1 has'],
    [/(\w+s) (are)/gi, '$1 is'], // Words ending in 's' (plural nouns) - simplified
  ];
  
  for (const [pattern, replacement] of patterns) {
    corrected = corrected.replace(pattern, replacement);
  }
  
  if (corrected !== text) {
    logger.debug('english-subject-verb-fixed', { original: text, corrected });
  }
  
  return corrected;
}

/**
 * Check for missing articles or prepositions in translation.
 * Compares source structure against target to flag potential omissions.
 * Returns warning message if issues detected, null otherwise.
 */
export function checkMissingArticlesPrepositions(
  text: string,
  sourceText: string,
  targetLang: string
): string | null {
  // Simple heuristic: if source has "a/an/the" but target is significantly shorter
  const sourceArticles = (sourceText.match(/\b(a|an|the)\b/gi) || []).length;
  const targetLength = text.replace(/\s/g, '').length;
  const sourceLength = sourceText.replace(/\s/g, '').length;
  
  // If source has articles but target is much shorter, flag potential omission
  if (sourceArticles > 0 && targetLength < sourceLength * 0.7) {
    const warning = 'Possible missing articles/prepositions - translation appears incomplete';
    logger.warn('missing-articles-prepositions', { targetLang, sourceText, text });
    return warning;
  }
  
  return null;
}

/**
 * Check for missing relative clauses (that/which/who equivalents).
 * Flags when source has relative clause pattern but target appears to have dropped it.
 */
export function checkMissingRelativeClause(
  text: string,
  sourceText: string,
  targetLang: string
): string | null {
  // Check if source has relative pronouns
  const hasRelativePronoun = /\b(that|which|who|whom|whose)\b/i.test(sourceText);
  
  if (hasRelativePronoun) {
    // Simple heuristic: if source has relative clause but target is much shorter
    const targetLength = text.replace(/\s/g, '').length;
    const sourceLength = sourceText.replace(/\s/g, '').length;
    
    if (targetLength < sourceLength * 0.6) {
      const warning = 'Possible missing relative clause - translation may be incomplete';
      logger.warn('missing-relative-clause', { targetLang, sourceText, text });
      return warning;
    }
  }
  
  return null;
}

/**
 * Check for missing object in translation.
 * Compares verb+object structure between source and target.
 */
export function checkMissingObject(
  sourceText: string,
  translatedText: string,
  targetLang: string
): string | null {
  // Simple heuristic: if source has transitive verb pattern but target is very short
  const sourceWords = sourceText.split(/\s+/).length;
  const targetWords = translatedText.split(/\s+/).length;
  
  // If source has 3+ words but target has only 1-2, potential object drop
  if (sourceWords >= 3 && targetWords <= 2) {
    const warning = 'Possible missing object - translation may be incomplete';
    logger.warn('missing-object', { targetLang, sourceText, translatedText });
    return warning;
  }
  
  return null;
}

/**
 * Check Hindi respect pronoun usage (aap/tum/tu).
 * Flags when formality level may not match intended tone.
 */
export function checkRespectPronounUsage(
  sourceText: string,
  translatedText: string
): string | null {
  // Check for presence of Hindi pronouns (without word boundaries for Devanagari)
  const hasTum = /तुम/.test(translatedText);
  const hasTu = /तू/.test(translatedText);
  
  if (hasTum || hasTu) {
    const warning = 'Formality level (आप/तुम/तू) may not match intended tone - verify';
    logger.warn('respect-pronoun-usage', { sourceText, translatedText });
    return warning;
  }
  
  return null;
}

/**
 * Fix Hindi gender agreement errors using regex patterns.
 * Detects and corrects common masculine/feminine mismatches in verb endings and adjectives.
 */
export function fixHindiGenderAgreement(text: string): string {
  // Common patterns for gender agreement fixes
  // This is a simplified rule-based approach - full gender agreement requires NLP
  
  // Pattern: verb endings ता (masculine) / ती (feminine) / ते (plural)
  // Context-dependent corrections would require more sophisticated analysis
  
  // Fix common adjective agreement patterns
  // Example: "अच्छा लड़का" (good boy - masculine) vs "अच्छी लड़की" (good girl - feminine)
  let corrected = text;
  
  // Pattern: fix ता/ती agreement with common gendered nouns
  // This is a heuristic - full solution requires grammatical analysis
  const genderPatterns: [RegExp, string][] = [
    // Masculine noun + feminine verb ending -> correct to masculine
    [/(लड़का.*?)(ती)/g, '$1ता'],
    [/(आदमी.*?)(ती)/g, '$1ता'],
    [/(बेटा.*?)(ती)/g, '$1ता'],
    [/(पिता.*?)(ती)/g, '$1ता'],
    [/(भाई.*?)(ती)/g, '$1ता'],
    
    // Feminine noun + masculine verb ending -> correct to feminine
    [/(लड़की.*?)(ता)/g, '$1ती'],
    [/(औरत.*?)(ता)/g, '$1ती'],
    [/(बेटी.*?)(ता)/g, '$1ती'],
    [/(माता.*?)(ता)/g, '$1ती'],
    [/(बहन.*?)(ता)/g, '$1ती'],
  ];
  
  for (const [pattern, replacement] of genderPatterns) {
    corrected = corrected.replace(pattern, replacement);
  }
  
  if (corrected !== text) {
    logger.debug('hindi-gender-fixed', { original: text, corrected });
  }
  
  return corrected;
}

/**
 * Apply French idiom overrides to correct literal translations.
 */
export function applyFrenchIdiomOverrides(text: string): string {
  let corrected = text;
  let hasChanges = false;
  
  for (const [incorrect, correct] of Object.entries(frenchIdiomOverrides)) {
    const regex = new RegExp(incorrect, 'gi');
    if (regex.test(corrected)) {
      corrected = corrected.replace(regex, correct);
      hasChanges = true;
    }
  }
  
  if (hasChanges) {
    logger.debug('french-idiom-fixed', { original: text, corrected });
  }
  
  return corrected;
}

/**
 * Fix French quotation spacing by adding non-breaking spaces around « and ».
 * French requires spaces before/after guillemets.
 */
export function fixFrenchQuotationSpacing(text: string): string {
  // Add space before » if not already present
  let corrected = text.replace(/([^\s])»/g, '$1 »');
  // Add space after « if not already present
  corrected = corrected.replace(/«([^\s])/g, '« $1');
  // Fix double spaces that may have been created
  corrected = corrected.replace(/  +/g, ' ').trim();
  
  if (corrected !== text) {
    logger.debug('french-quote-spacing-fixed', { original: text, corrected });
  }
  
  return corrected;
}

/**
 * Normalize quotation marks according to target language conventions.
 * Replaces incorrect quote styles with language-appropriate ones.
 */
export function normalizeQuotationMarks(text: string, targetLang: string): string {
  const quoteStyle = QUOTE_STYLES[targetLang] || QUOTE_STYLES.default;
  
  // Replace various quote styles with the correct one for target language
  let corrected = text;
  
  // Replace straight quotes with language-specific quotes
  if (quoteStyle.open !== '"' || quoteStyle.close !== '"') {
    // Replace "..." with language-specific quotes
    corrected = corrected.replace(/"([^"]*)"/g, `${quoteStyle.open}$1${quoteStyle.close}`);
  }
  
  // Normalize other quote styles to the target language style
  corrected = corrected
    .replace(/['']([^']*)['']/g, `${quoteStyle.open}$1${quoteStyle.close}`)
    .replace(/「([^」]*)」/g, `${quoteStyle.open}$1${quoteStyle.close}`)
    .replace(/『([^』]*)』/g, `${quoteStyle.open}$1${quoteStyle.close}`);
  
  if (corrected !== text) {
    logger.debug('quote-marks-normalized', { targetLang, original: text, corrected });
  }
  
  return corrected;
}

/**
 * Check for naturalness by comparing translated text length to source text length.
 * Returns true if the translation appears to be word-for-word (low confidence).
 */
export function checkNaturalness(translated: string, original: string, targetLang: string): boolean {
  // Only check for languages known to have literal translation issues
  if (!NATURALNESS_CHECK_LANGUAGES.includes(targetLang)) {
    return true; // Pass naturalness check for other languages
  }
  
  const translatedLength = translated.replace(/\s/g, '').length;
  const originalLength = original.replace(/\s/g, '').length;
  
  // Calculate ratio (avoid division by zero)
  const ratio = originalLength > 0 ? translatedLength / originalLength : 1;
  
  // If ratio is too close to 1.0, it may indicate word-for-word translation
  const isNatural = ratio < WORD_FOR_WORD_THRESHOLD || ratio > (1 / WORD_FOR_WORD_THRESHOLD);
  
  if (!isNatural) {
    logger.warn('low-naturalness-detected', {
      targetLang,
      ratio,
      originalLength,
      translatedLength,
      original: original.substring(0, 50),
      translated: translated.substring(0, 50),
    });
  }
  
  return isNatural;
}

/**
 * Remove unnecessary German filler words that MyMemory tends to add.
 */
export function removeGermanFillerWords(text: string): string {
  // Simple approach: replace filler words with empty string, then clean up spaces
  let corrected = text;
  
  for (const filler of GERMAN_FILLER_WORDS) {
    // Match filler word with optional surrounding whitespace
    const regex = new RegExp(`\\s*\\b${filler}\\b\\s*`, 'gi');
    corrected = corrected.replace(regex, ' ');
  }
  
  // Collapse multiple spaces and trim
  corrected = corrected.replace(/ +/g, ' ').trim();
  
  if (corrected !== text) {
    logger.debug('german-filler-removed', { original: text, corrected });
  }
  
  return corrected;
}

/**
 * Apply Hindi loanword replacements to use native Hindi words instead of transliterated English.
 */
export function applyHindiLoanwordReplacements(text: string, preferNative: boolean = true): string {
  if (!preferNative) {
    return text; // Skip if user prefers to keep loanwords
  }
  
  let corrected = text;
  
  for (const [loanword, replacement] of Object.entries(hindiLoanwordReplacements)) {
    corrected = corrected.replace(new RegExp(loanword, 'gi'), replacement);
  }
  
  if (corrected !== text) {
    logger.debug('hindi-loanword-replaced', { original: text, corrected });
  }
  
  return corrected;
}

/**
 * Apply Spanish idiom overrides to correct literal translations.
 */
export function applySpanishIdiomOverrides(text: string): string {
  let corrected = text;
  let hasChanges = false;
  
  for (const [incorrect, correct] of Object.entries(spanishIdiomOverrides)) {
    const regex = new RegExp(incorrect, 'gi');
    if (regex.test(corrected)) {
      corrected = corrected.replace(regex, correct);
      hasChanges = true;
    }
  }
  
  if (hasChanges) {
    logger.debug('spanish-idiom-fixed', { original: text, corrected });
  }
  
  return corrected;
}

/**
 * Post-process translation text based on target language.
 * Applies language-specific fixes to improve translation quality.
 * 
 * @param text - The translated text from MyMemory API
 * @param targetLang - The target language code
 * @param settings - Optional user settings (e.g., preferNativeWords for Hindi)
 * @returns The post-processed translation text
 */
export function postProcessTranslation(
  text: string,
  targetLang: string,
  settings?: { preferNativeWords?: boolean; defaultHindiFormality?: 'aap' | 'tum' | 'tu' }
): string {
  let processed = text;
  
  // Apply language-specific fixes based on target language
  switch (targetLang) {
    case 'hi':
      // Hindi: fix gender agreement
      processed = fixHindiGenderAgreement(processed);
      // Hindi: fix number agreement
      processed = fixHindiNumberAgreement(processed);
      // Hindi: fix pronoun-antecedent agreement
      processed = fixPronounAntecedentAgreement(processed, targetLang);
      // Hindi: replace loanwords with native words (if setting enabled)
      processed = applyHindiLoanwordReplacements(processed, settings?.preferNativeWords ?? true);
      // Hindi: apply vocabulary overrides
      processed = applyVocabularyOverrides(processed, targetLang);
      break;
      
    case 'fr':
      // French: apply idiom overrides
      processed = applyFrenchIdiomOverrides(processed);
      // French: apply verb corrections
      processed = applyVocabularyOverrides(processed, targetLang);
      // French: fix possessive pronouns
      processed = fixFrenchPossessivePronouns(processed);
      // French: fix pronoun-antecedent agreement
      processed = fixPronounAntecedentAgreement(processed, targetLang);
      // French: fix quotation spacing
      processed = fixFrenchQuotationSpacing(processed);
      // French: normalize quotation marks
      processed = normalizeQuotationMarks(processed, targetLang);
      break;
      
    case 'es':
      // Spanish: apply idiom overrides
      processed = applySpanishIdiomOverrides(processed);
      // Spanish: apply vocabulary overrides
      processed = applyVocabularyOverrides(processed, targetLang);
      // Spanish: fix verb agreement
      processed = fixSpanishVerbAgreement(processed);
      // Spanish: fix pronoun-antecedent agreement
      processed = fixPronounAntecedentAgreement(processed, targetLang);
      break;
      
    case 'de':
      // German: remove filler words
      processed = removeGermanFillerWords(processed);
      // German: apply vocabulary overrides
      processed = applyVocabularyOverrides(processed, targetLang);
      // German: fix pronoun-antecedent agreement
      processed = fixPronounAntecedentAgreement(processed, targetLang);
      // German: normalize quotation marks
      processed = normalizeQuotationMarks(processed, targetLang);
      break;
      
    case 'en':
      // English: fix subject-verb agreement
      processed = fixEnglishSubjectVerbAgreement(processed);
      // English: apply vocabulary overrides
      processed = applyVocabularyOverrides(processed, targetLang);
      // English: normalize quotation marks
      processed = normalizeQuotationMarks(processed, targetLang);
      break;
      
    case 'tr':
      // Turkish: normalize quotation marks
      processed = normalizeQuotationMarks(processed, targetLang);
      break;
      
    case 'ru':
    case 'ar':
    case 'ko':
      // These languages: normalize quotation marks
      processed = normalizeQuotationMarks(processed, targetLang);
      // Naturalness check is handled separately (returns confidence flag)
      break;
      
    case 'zh':
    case 'ja':
      // Chinese/Japanese: normalize quotation marks
      processed = normalizeQuotationMarks(processed, targetLang);
      break;
      
    case 'it':
    case 'pt':
    case 'nl':
    case 'pl':
    case 'vi':
      // Other languages: normalize quotation marks
      processed = normalizeQuotationMarks(processed, targetLang);
      break;
      
    default:
      // Default: normalize quotation marks
      processed = normalizeQuotationMarks(processed, targetLang);
      break;
  }
  
  logger.debug('post-process-complete', {
    targetLang,
    originalLength: text.length,
    processedLength: processed.length,
    hasChanges: text !== processed,
  });
  
  return processed;
}

/**
 * Check if translation quality is low confidence for specific language pairs.
 * Returns an object with lowConfidence flag and optional warning message.
 */
export function checkTranslationQuality(
  translated: string,
  original: string,
  targetLang: string
): { lowConfidence: boolean; warning?: string } {
  const warnings: string[] = [];
  
  // Check naturalness for languages prone to literal translation
  const isNatural = checkNaturalness(translated, original, targetLang);
  if (!isNatural) {
    warnings.push('Translation may be literal - please verify');
  }
  
  // Check for passive voice which may indicate literal translation
  const hasPassiveVoice = detectPassiveVoice(translated);
  if (hasPassiveVoice) {
    warnings.push('Passive voice detected - may indicate literal translation');
  }
  
  // Check for missing articles/prepositions
  const missingArticlesWarning = checkMissingArticlesPrepositions(translated, original, targetLang);
  if (missingArticlesWarning) {
    warnings.push(missingArticlesWarning);
  }
  
  // Check for missing relative clauses
  const missingRelativeClauseWarning = checkMissingRelativeClause(translated, original, targetLang);
  if (missingRelativeClauseWarning) {
    warnings.push(missingRelativeClauseWarning);
  }
  
  // Check for missing object
  const missingObjectWarning = checkMissingObject(original, translated, targetLang);
  if (missingObjectWarning) {
    warnings.push(missingObjectWarning);
  }
  
  // Check Hindi respect pronoun usage
  if (targetLang === 'hi') {
    const respectPronounWarning = checkRespectPronounUsage(original, translated);
    if (respectPronounWarning) {
      warnings.push(respectPronounWarning);
    }
  }
  
  if (warnings.length > 0) {
    return {
      lowConfidence: true,
      warning: warnings.join(' · '),
    };
  }
  
  return { lowConfidence: false };
}
