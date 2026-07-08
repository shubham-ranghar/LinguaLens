import { initContentScript } from '@/content/index';
import { logger } from '@/lib/logger';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    logger.debug('content-script', { action: 'initialized', context: ctx });
    initContentScript(ctx);
  },
});
