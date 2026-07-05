import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type WxtViteConfig } from 'wxt';
import { defineLinguaLensManifest } from './manifest.config';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: () => {
    const manifest = defineLinguaLensManifest();
    return {
      ...manifest,
      options_ui: {
        page: 'options.html',
        open_in_tab: true,
      },
    };
  },
  alias: {
    '@': './src',
  },
  vite: () =>
    ({
      plugins: [tailwindcss()],
    }) as WxtViteConfig,
});
