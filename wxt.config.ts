import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig, type WxtViteConfig } from 'wxt';
import { defineLinguaLensManifest } from './manifest.config';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: ({ mode }) => {
    const isDev = mode === 'development' || process.env.WXT_MODE === 'dev';
    const env = loadEnv(mode, process.cwd(), ['VITE_', 'WXT_']);
    const manifest = defineLinguaLensManifest(isDev, env.VITE_CSP_CONNECT_ORIGINS);
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
