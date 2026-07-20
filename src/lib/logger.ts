/**
 * Logger utility with structured logging and debug flag gating.
 * 
 * In development: All logs are output to console
 * In production: Only error and warn logs are output unless debug mode is enabled
 * Safe for use even when extension context is invalidated
 */

const IS_DEV = import.meta.env.MODE === 'development';
const MAX_LOG_BUFFER_SIZE = 50;

interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  data: Record<string, unknown>;
}

// In-memory log buffer for debugging
const logBuffer: LogEntry[] = [];

/**
 * Check if debug mode is enabled via chrome.storage
 */
async function isDebugEnabled(): Promise<boolean> {
  if (IS_DEV) return true;
  
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get('debugMode');
      return result.debugMode === true;
    }
  } catch {
    // If storage is unavailable, default to false in production
  }
  return false;
}

/**
 * Add entry to in-memory log buffer
 */
function addToBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift(); // Remove oldest entry
  }
}

/**
 * Safe logging function that works even when extension context is invalidated
 * Falls back to console directly if chrome.runtime is not available
 */
function safeLog(level: 'log' | 'info' | 'warn' | 'error', ...args: unknown[]) {
  try {
    console[level](...args);
  } catch {
    // If logging fails, silently fail to avoid breaking the extension
  }
}

export const logger = {
  /**
   * Structured debug log with category and data
   */
  debug: (category: string, data: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: 'debug',
      category,
      data,
    };
    addToBuffer(entry);
    
    // Check debug mode asynchronously (non-blocking)
    void isDebugEnabled().then(enabled => {
      if (enabled || IS_DEV) {
        safeLog('log', `[DEBUG][${category}]`, data);
      }
    });
  },
  
  /**
   * Structured info log with category and data
   */
  info: (category: string, data: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: 'info',
      category,
      data,
    };
    addToBuffer(entry);
    
    void isDebugEnabled().then(enabled => {
      if (enabled || IS_DEV) {
        safeLog('info', `[INFO][${category}]`, data);
      }
    });
  },
  
  /**
   * Structured warn log with category and data (always logged)
   */
  warn: (category: string, data: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: 'warn',
      category,
      data,
    };
    addToBuffer(entry);
    safeLog('warn', `[WARN][${category}]`, data);
  },
  
  /**
   * Structured error log with category and data (always logged)
   */
  error: (category: string, data: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: 'error',
      category,
      data,
    };
    addToBuffer(entry);
    safeLog('error', `[ERROR][${category}]`, data);
  },
  
  apiDebug: (...args: unknown[]) => {
    logger.debug('api', {
      message: args.length > 0 ? String(args[0]) : '',
      details: args.slice(1),
    });
  },
  
  myMemoryApi: (...args: unknown[]) => {
    logger.debug('mymemory-api', {
      message: args.length > 0 ? String(args[0]) : '',
      details: args.slice(1),
    });
  },
  
  geminiApi: (...args: unknown[]) => {
    logger.debug('gemini-api', {
      message: args.length > 0 ? String(args[0]) : '',
      details: args.slice(1),
    });
  },

  freellmApi: (...args: unknown[]) => {
    logger.debug('freellm-api', {
      message: args.length > 0 ? String(args[0]) : '',
      details: args.slice(1),
    });
  },
};
