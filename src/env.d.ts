/// <reference types="wxt/vite-builder-env" />

interface ImportMetaEnv {
  readonly VITE_MYMEMORY_API_URL: string;
  readonly VITE_DICTIONARY_API_URL: string;
  readonly VITE_GEMINI_API_URL: string;
  readonly VITE_FREELLM_BASE_URL: string;
  readonly VITE_FREELLM_EXTENSION_SECRET: string;
  readonly VITE_CSP_CONNECT_ORIGINS: string;
}

declare module '*.css' {
  const css: string;
  export default css;
}
