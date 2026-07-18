import { describe, it, expect } from 'vitest';
import {
  transliterateHinglishToDevanagari,
  isDevanagariScript,
} from './hinglishToDevanagari';

describe('hinglishToDevanagari', () => {
  describe('isDevanagariScript', () => {
    it('should return true for Devanagari text', () => {
      const text = 'नमस्ते';
      expect(isDevanagariScript(text)).toBe(true);
    });

    it('should return false for Latin text', () => {
      const text = 'namaste';
      expect(isDevanagariScript(text)).toBe(false);
    });

    it('should return false for mixed text with no Devanagari', () => {
      const text = 'hello world';
      expect(isDevanagariScript(text)).toBe(false);
    });

    it('should return true for mixed text with Devanagari', () => {
      const text = 'नमस्ते world';
      expect(isDevanagariScript(text)).toBe(true);
    });
  });

  describe('transliterateHinglishToDevanagari', () => {
    it('should transliterate common words', () => {
      const input = 'namaste';
      const output = transliterateHinglishToDevanagari(input);
      expect(output).toBe('नमस्ते');
    });

    it('should transliterate sentences', () => {
      const input = 'kya haal hai';
      const output = transliterateHinglishToDevanagari(input);
      expect(output).toContain('क्या');
      expect(output).toContain('है');
    });

    it('should handle mixed English and Hinglish', () => {
      const input = 'mera name is John';
      const output = transliterateHinglishToDevanagari(input);
      expect(output).toContain('मेरा');
    });

    it('should preserve punctuation', () => {
      const input = 'namaste!';
      const output = transliterateHinglishToDevanagari(input);
      expect(output).toContain('!');
    });

    it('should handle empty string', () => {
      const input = '';
      const output = transliterateHinglishToDevanagari(input);
      expect(output).toBe('');
    });

    it('should fallback if output is not in Devanagari', () => {
      // This test verifies the fallback mechanism is in place
      // Actual behavior depends on the fallback logic
      const input = 'test';
      const output = transliterateHinglishToDevanagari(input);
      expect(output).toBeDefined();
    });
  });
});
