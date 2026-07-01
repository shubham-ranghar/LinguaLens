import { initContentScript } from '@/content/index';

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    initContentScript(ctx);
  },
});
