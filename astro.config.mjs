import { defineConfig } from 'astro/config';
import glsl from 'vite-plugin-glsl';

// https://astro.build/config
export default defineConfig({
  site: 'https://abyjohny.github.io',
  base: '/confirmation-exhibition',
  vite: {
    plugins: [glsl()],
    build: {
      assetsInlineLimit: 0 // Do not inline assets to keep them clean
    }
  }
});
