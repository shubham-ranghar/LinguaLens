import { initContentScript } from '@/content/index';

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    console.log('[LinguaLens] Content script initialized', ctx);
    initContentScript(ctx);
  },
});
