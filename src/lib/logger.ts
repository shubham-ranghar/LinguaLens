/**
 * Logger utility that strips debug logs in production builds.
 * 
 * In development: All logs are output to console
 * In production: Only error and warn logs are output
 */

const IS_DEV = import.meta.env.MODE === 'development';

export const logger = {
  debug: (...args: unknown[]) => {
    if (IS_DEV) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (IS_DEV) {
      console.info('[INFO]', ...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args);
  },
  
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
  },
  
  // Convenience method for language detection debugging
  languageDetection: (...args: unknown[]) => {
    if (IS_DEV) {
      console.log('[Language Detection]', ...args);
    }
  },
  
  // Convenience method for API debugging
  apiDebug: (...args: unknown[]) => {
    if (IS_DEV) {
      console.log('[API Debug]', ...args);
    }
  },
  
  // Convenience method for MyMemory API debugging
  myMemoryApi: (...args: unknown[]) => {
    if (IS_DEV) {
      console.log('[MyMemory API]', ...args);
    }
  },
  
  // Convenience method for Gemini API debugging
  geminiApi: (...args: unknown[]) => {
    if (IS_DEV) {
      console.log('[Gemini API]', ...args);
    }
  },
};
