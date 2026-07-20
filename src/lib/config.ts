/**
 * Build-time config from Vite/WXT env (`VITE_*` in `.env`).
 * Secrets are baked into the extension bundle — keep `.env` out of git.
 */

function requireEnv(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required environment variable: ${key}. Copy .env.example to .env and fill in values.`);
  }
  return value.trim();
}

export const MYMEMORY_API_URL = requireEnv('VITE_MYMEMORY_API_URL');
export const DICTIONARY_API_URL = requireEnv('VITE_DICTIONARY_API_URL');
export const GEMINI_API_URL = requireEnv('VITE_GEMINI_API_URL');
export const FREELLM_BASE_URL = requireEnv('VITE_FREELLM_BASE_URL');
export const FREELLM_EXTENSION_SECRET = requireEnv('VITE_FREELLM_EXTENSION_SECRET');
