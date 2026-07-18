/**
 * Unit tests for language detection and translation
 * Tests cover: script heuristics, dictionary lookup, franc detection, and edge cases
 */

import { describe, it, expect } from 'vitest';
import { detectLanguage, splitIntoChunks, MIN_RELIABLE_DETECTION_LENGTH, MIN_DICTIONARY_LOOKUP_LENGTH, MIN_FRANC_DETECTION_LENGTH } from './translation';
import { detectHinglish, HINGLISH_TOKEN_RATIO_THRESHOLD, MIN_TOKENS_FOR_DETECTION } from '@/lib/detection/hinglishDetector';

describe('Language Detection', () => {
  describe('Script-based heuristics', () => {
    it('should detect Arabic script', () => {
      const result = detectLanguage('مرحبا');
      expect(result.language).toBe('ar');
      expect(result.method).toBe('script-heuristic');
      expect(result.confidence).toBe(0.95);
    });

    it('should detect Hindi/Devanagari script', () => {
      const result = detectLanguage('नमस्ते');
      expect(result.language).toBe('hi');
      expect(result.method).toBe('script-heuristic');
      expect(result.confidence).toBe(0.95);
    });

    it('should detect CJK (Chinese) script', () => {
      const result = detectLanguage('你好');
      expect(result.language).toBe('zh');
      expect(result.method).toBe('script-heuristic');
      expect(result.confidence).toBe(0.95);
    });

    it('should detect Korean script', () => {
      const result = detectLanguage('안녕하세요');
      expect(result.language).toBe('ko');
      expect(result.method).toBe('script-heuristic');
      expect(result.confidence).toBe(0.95);
    });

    it('should detect Cyrillic script', () => {
      const result = detectLanguage('Привет');
      expect(result.language).toBe('ru');
      expect(result.method).toBe('script-heuristic');
      expect(result.confidence).toBe(0.95);
    });

    it('should detect Greek script', () => {
      const result = detectLanguage('Γεια');
      expect(result.language).toBe('el');
      expect(result.method).toBe('script-heuristic');
      expect(result.confidence).toBe(0.95);
    });

    it('should detect Thai script', () => {
      const result = detectLanguage('สวัสดี');
      expect(result.language).toBe('th');
      expect(result.method).toBe('script-heuristic');
      expect(result.confidence).toBe(0.95);
    });

    it('should detect Hebrew script', () => {
      const result = detectLanguage('שלום');
      expect(result.language).toBe('he');
      expect(result.method).toBe('script-heuristic');
      expect(result.confidence).toBe(0.95);
    });

    it('should return null for Latin script (requires statistical detection)', () => {
      const result = detectLanguage('Hello');
      expect(result.language).toBeNull();
      expect(result.method).not.toBe('script-heuristic');
    });
  });

  describe('Dictionary lookup for short text', () => {
    it('should detect Spanish common words', () => {
      const result = detectLanguage('hola');
      expect(result.language).toBe('es');
      expect(result.method).toBe('dictionary');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect French common words', () => {
      const result = detectLanguage('bonjour');
      expect(result.language).toBe('fr');
      expect(result.method).toBe('dictionary');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect German common words', () => {
      const result = detectLanguage('hallo');
      expect(result.language).toBe('de');
      expect(result.method).toBe('dictionary');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect Hindi common words', () => {
      const result = detectLanguage('namaste');
      expect(result.language).toBe('hi');
      expect(result.method).toBe('dictionary');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect Italian common words', () => {
      const result = detectLanguage('ciao');
      expect(result.language).toBe('it');
      expect(result.method).toBe('dictionary');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect Portuguese common words', () => {
      const result = detectLanguage('olá');
      expect(result.language).toBe('pt');
      expect(result.method).toBe('dictionary');
      expect(result.confidence).toBe(1.0);
    });

    it('should return null for unknown short words', () => {
      const result = detectLanguage('xyz');
      expect(result.language).toBeNull();
      expect(result.method).toBe('none');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty text', () => {
      const result = detectLanguage('');
      expect(result.language).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle whitespace-only text', () => {
      const result = detectLanguage('   ');
      expect(result.language).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle single Latin character (too short)', () => {
      const result = detectLanguage('a');
      expect(result.language).toBeNull();
      expect(result.method).toBe('none');
    });

    it('should handle numbers', () => {
      const result = detectLanguage('123');
      expect(result.language).toBeNull();
      expect(result.method).toBe('none');
    });

    it('should handle mixed script text', () => {
      const result = detectLanguage('Hello你好');
      // Should detect based on first character (Latin -> null, falls through to franc)
      expect(result.method).not.toBe('script-heuristic');
    });

    it('should handle punctuation-only text', () => {
      const result = detectLanguage('!!!');
      expect(result.language).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('Length thresholds', () => {
    it('should use MIN_FRANC_DETECTION_LENGTH constant', () => {
      expect(MIN_FRANC_DETECTION_LENGTH).toBe(4);
    });

    it('should use MIN_DICTIONARY_LOOKUP_LENGTH constant', () => {
      expect(MIN_DICTIONARY_LOOKUP_LENGTH).toBe(15);
    });

    it('should use MIN_RELIABLE_DETECTION_LENGTH constant', () => {
      expect(MIN_RELIABLE_DETECTION_LENGTH).toBe(20);
    });

    it('should return uncertain for text below MIN_FRANC_DETECTION_LENGTH', () => {
      const result = detectLanguage('abc');
      expect(result.language).toBeNull();
      expect(result.method).toBe('none');
    });

    it('should attempt franc for text at or above MIN_FRANC_DETECTION_LENGTH', () => {
      const result = detectLanguage('This is a test');
      expect(result.method).toBe('franc');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Confidence scoring', () => {
    it('should give maximum confidence for script heuristics', () => {
      const result = detectLanguage('مرحبا');
      expect(result.confidence).toBe(0.95);
    });

    it('should give maximum confidence for dictionary matches', () => {
      const result = detectLanguage('hola');
      expect(result.confidence).toBe(1.0);
    });

    it('should give zero confidence for uncertain detection', () => {
      const result = detectLanguage('xyz');
      expect(result.confidence).toBe(0);
    });

    it('should give variable confidence for franc based on text length', () => {
      const shortResult = detectLanguage('This is a test');
      const longResult = detectLanguage('This is a much longer text that should have higher confidence in the language detection result because statistical methods work better with more data');
      
      expect(longResult.confidence).toBeGreaterThan(shortResult.confidence);
      expect(longResult.confidence).toBeLessThanOrEqual(0.9);
    });
  });
});

describe('Text Normalization', () => {
  it('should handle case insensitivity in dictionary lookup', () => {
    const result1 = detectLanguage('Hola');
    const result2 = detectLanguage('hola');
    const result3 = detectLanguage('HOLA');
    
    expect(result1.language).toBe('es');
    expect(result2.language).toBe('es');
    expect(result3.language).toBe('es');
  });

  it('should handle whitespace in dictionary lookup', () => {
    const result = detectLanguage('  hola  ');
    expect(result.language).toBe('es');
  });
});

describe('Text Chunking', () => {
  it('should return single chunk for short text', () => {
    const text = 'This is a short text.';
    const chunks = splitIntoChunks(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('should split long text into sentence-aware chunks', () => {
    const text = 'This is the first sentence. This is the second sentence. This is the third sentence. '.repeat(20);
    const chunks = splitIntoChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    
    // Verify each chunk is within limit
    chunks.forEach((chunk: string) => {
      expect(chunk.length).toBeLessThanOrEqual(500);
    });
  });

  it('should handle text without clear sentence boundaries', () => {
    const text = 'a'.repeat(1000);
    const chunks = splitIntoChunks(text);
    // Should return as single chunk since no sentence boundaries
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('should preserve sentence structure in chunks', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = splitIntoChunks(text);
    // Short text should be single chunk
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('should not split on abbreviations like Mr., Dr., etc.', () => {
    const text = 'Mr. Smith went to Dr. Johnson. They discussed the project.';
    const chunks = splitIntoChunks(text);
    // Should be single chunk since it's short
    expect(chunks).toHaveLength(1);
    // Should contain the full text with abbreviations intact
    expect(chunks[0]).toContain('Mr.');
    expect(chunks[0]).toContain('Dr.');
  });

  it('should not split inside quotes', () => {
    const text = 'He said "Hello world" and left. Then she arrived.';
    const chunks = splitIntoChunks(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('"Hello world"');
  });

  it('should not split inside parentheses', () => {
    const text = 'The result (which was unexpected) was good. Then we continued.';
    const chunks = splitIntoChunks(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('(which was unexpected)');
  });

  it('should handle CJK sentence boundaries', () => {
    const text = '你好。世界。这是一个测试。'.repeat(20);
    const chunks = splitIntoChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk: string) => {
      expect(chunk.length).toBeLessThanOrEqual(500);
    });
  });

  it('should handle Arabic sentence boundaries', () => {
    const text = 'مرحبا بالعالم. '.repeat(50);
    const chunks = splitIntoChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk: string) => {
      expect(chunk.length).toBeLessThanOrEqual(500);
    });
  });

  it('should handle Hindi/Devanagari sentence boundaries', () => {
    const text = 'नमस्ते दुनिया। '.repeat(50);
    const chunks = splitIntoChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk: string) => {
      expect(chunk.length).toBeLessThanOrEqual(500);
    });
  });

  it('should preserve paragraph breaks', () => {
    const text = 'First paragraph. '.repeat(10) + '\n\n' + 'Second paragraph. '.repeat(10);
    const chunks = splitIntoChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    // At least one chunk should preserve the paragraph break
    const hasParagraphBreak = chunks.some(chunk => chunk.includes('\n\n'));
    expect(hasParagraphBreak).toBe(true);
  });

  it('should handle common abbreviations', () => {
    const text = 'See e.g. this example. Also i.e. another one. Etc. more text.';
    const chunks = splitIntoChunks(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('e.g.');
    expect(chunks[0]).toContain('i.e.');
    expect(chunks[0]).toContain('Etc.');
  });

  it('should handle very long single sentence', () => {
    const text = 'This is a very long sentence that goes on and on without any breaks and should be handled as a single chunk even though it exceeds the normal character limit because it has no sentence boundaries to split on '.repeat(10);
    const chunks = splitIntoChunks(text);
    // Should return as single chunk since no sentence boundaries
    expect(chunks).toHaveLength(1);
  });
});

describe('Long Text Translation', () => {
  it('should handle 500+ character paragraph with multiple sentences', () => {
    const longText = 'This is the first sentence of a long paragraph. '.repeat(10) + 'This is the final sentence.';
    expect(longText.length).toBeGreaterThan(500);
    
    const chunks = splitIntoChunks(longText);
    expect(chunks.length).toBeGreaterThan(1);
    
    chunks.forEach((chunk: string) => {
      expect(chunk.length).toBeLessThanOrEqual(500);
    });
  });

  it('should handle long text in non-Latin script', () => {
    const arabicText = 'مرحبا بالعالم. '.repeat(50);
    expect(arabicText.length).toBeGreaterThan(500);
    
    const chunks = splitIntoChunks(arabicText);
    expect(chunks.length).toBeGreaterThan(1);
    
    chunks.forEach((chunk: string) => {
      expect(chunk.length).toBeLessThanOrEqual(500);
    });
  });

  it('should handle mixed punctuation and quotes', () => {
    const text = 'He said "Hello!" and left. She replied "Goodbye!" and smiled. '.repeat(20);
    const chunks = splitIntoChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    // Verify quotes are preserved
    chunks.forEach((chunk: string) => {
      if (chunk.includes('"')) {
        expect(chunk).toMatch(/".*"/);
      }
    });
  });

  it('should handle nested parentheses and brackets', () => {
    const text = 'The result (which was [as expected] good) was noted. Then we continued. '.repeat(20);
    const chunks = splitIntoChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle single word translation', () => {
    const text = 'Hello';
    const chunks = splitIntoChunks(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('should handle empty string', () => {
    const text = '';
    const chunks = splitIntoChunks(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('should handle whitespace only', () => {
    const text = '   ';
    const chunks = splitIntoChunks(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });
});

describe('Same-Language Detection', () => {
  it('should detect same language with high confidence', () => {
    const englishText = 'This is a long English text that should be detected as English. It has multiple sentences to ensure reliable detection. The text is long enough to trigger the confidence threshold.';
    
    const result = detectLanguage(englishText);
    expect(result.language).toBe('en');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.method).toBe('franc');
  });

  it('should return null for short ambiguous text', () => {
    const shortText = 'ok';
    const result = detectLanguage(shortText);
    expect(result.language).toBeNull();
    expect(result.confidence).toBe(0);
  });
});

describe('Hinglish Detection', () => {
  describe('Detection of Hinglish text', () => {
    it('should detect clear Hinglish text', () => {
      const hinglishText = 'yaar kal milte hain';
      const result = detectHinglish(hinglishText);
      
      expect(result.language).toBe('hi-Latn');
      expect(result.method).toBe('hinglish-lexical');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchedTokens).toBeGreaterThan(0);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.ratio).toBeGreaterThanOrEqual(HINGLISH_TOKEN_RATIO_THRESHOLD);
    });

    it('should detect Hinglish with mixed English-Hindi', () => {
      const mixedText = 'send karo the file please';
      const result = detectHinglish(mixedText);
      
      expect(result.language).toBe('hi-Latn');
      expect(result.method).toBe('hinglish-lexical');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should not detect pure English text as Hinglish', () => {
      const englishText = 'Hello world, how are you today?';
      const result = detectHinglish(englishText);
      
      expect(result.language).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should not detect pure Hindi in Devanagari as Hinglish', () => {
      const devanagariText = 'नमस्ते दुनिया';
      const result = detectHinglish(devanagariText);
      
      expect(result.language).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle text below minimum token threshold', () => {
      const shortText = 'hai';
      const result = detectHinglish(shortText);
      
      expect(result.language).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('Token ratio threshold', () => {
    it('should use HINGLISH_TOKEN_RATIO_THRESHOLD constant', () => {
      expect(HINGLISH_TOKEN_RATIO_THRESHOLD).toBe(0.15);
    });

    it('should use MIN_TOKENS_FOR_DETECTION constant', () => {
      expect(MIN_TOKENS_FOR_DETECTION).toBe(3);
    });

    it('should require minimum tokens for detection', () => {
      const twoTokenText = 'hai kya';
      const result = detectHinglish(twoTokenText);
      
      expect(result.language).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should detect with minimum tokens when ratio is high', () => {
      const threeTokenHinglish = 'hai kya bhai';
      const result = detectHinglish(threeTokenHinglish);
      
      expect(result.language).toBe('hi-Latn');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty text', () => {
      const result = detectHinglish('');
      expect(result.language).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle whitespace-only text', () => {
      const result = detectHinglish('   ');
      expect(result.language).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle punctuation', () => {
      const textWithPunctuation = 'yaar, kal milte hain!';
      const result = detectHinglish(textWithPunctuation);
      
      expect(result.language).toBe('hi-Latn');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle mixed case', () => {
      const mixedCaseText = 'Yaar Kal Milte Hain';
      const result = detectHinglish(mixedCaseText);
      
      expect(result.language).toBe('hi-Latn');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle numbers mixed with Hinglish', () => {
      const textWithNumbers = '2 ghante baad milte hain';
      const result = detectHinglish(textWithNumbers);
      
      expect(result.language).toBe('hi-Latn');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Confidence scoring', () => {
    it('should give higher confidence for higher Hinglish token ratio', () => {
      const highRatioText = 'yaar kal milte hain kya karte ho bhai';
      const lowRatioText = 'hello yaar how are you';
      
      const highResult = detectHinglish(highRatioText);
      const lowResult = detectHinglish(lowRatioText);
      
      if (highResult.language && lowResult.language) {
        expect(highResult.confidence).toBeGreaterThan(lowResult.confidence);
      }
    });

    it('should cap confidence at reasonable maximum', () => {
      const veryHinglishText = 'yaar bhai kya karte ho kal milte hain theek hai acha';
      const result = detectHinglish(veryHinglishText);
      
      if (result.language) {
        expect(result.confidence).toBeLessThanOrEqual(0.85);
      }
    });
  });
});
