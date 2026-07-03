/**
 * Logger utility that strips debug logs in production builds.
 * 
 * In development: All logs are output to console
 * In production: Only error and warn logs are output
 * Safe for use even when extension context is invalidated
 */

const IS_DEV = import.meta.env.MODE === 'development';

/**
 * Safe logging function that works even when extension context is invalidated
 * Falls back to console directly if chrome.runtime is not available
 */
function safeLog(level: 'log' | 'info' | 'warn' | 'error', ...args: unknown[]) {
  try {
    // Check if we're in a valid extension context
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      // Extension context is valid, use console normally
      console[level](...args);
    } else {
      // Extension context might be invalidated, still try to log to console
      console[level](...args);
    }
  } catch (e) {
    // If logging fails, silently fail to avoid breaking the extension
    // This can happen if the console is not available or context is completely broken
  }
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (IS_DEV) {
      safeLog('log', '[DEBUG]', ...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (IS_DEV) {
      safeLog('info', '[INFO]', ...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    safeLog('warn', '[WARN]', ...args);
  },
  
  error: (...args: unknown[]) => {
    safeLog('error', '[ERROR]', ...args);
  },
  
  // Convenience method for language detection debugging
  languageDetection: (...args: unknown[]) => {
    if (IS_DEV) {
      safeLog('log', '[Language Detection]', ...args);
    }
  },
  
  // Convenience method for API debugging
  apiDebug: (...args: unknown[]) => {
    if (IS_DEV) {
      safeLog('log', '[API Debug]', ...args);
    }
  },
  
  // Convenience method for MyMemory API debugging
  myMemoryApi: (...args: unknown[]) => {
    if (IS_DEV) {
      safeLog('log', '[MyMemory API]', ...args);
    }
  },
  
  // Convenience method for Gemini API debugging
  geminiApi: (...args: unknown[]) => {
    if (IS_DEV) {
      safeLog('log', '[Gemini API]', ...args);
    }
  },
};

/**
 * Check if extension context is valid
 * Returns true if chrome.runtime is available and has an ID
 */
export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && 
           chrome.runtime !== null && 
           chrome.runtime.id !== undefined;
  } catch {
    return false;
  }
}

/**
 * Safe wrapper for chrome.runtime.sendMessage that handles context invalidation
 */
export function safeSendMessage<T>(message: T): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isExtensionContextValid()) {
      reject(new Error('Extension context invalidated'));
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}
