import { initContentScript } from '@/content/index';
import { logger } from '@/lib/logger';

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    logger.debug('Content script initialized', ctx);
    initContentScript(ctx);
  },
});
