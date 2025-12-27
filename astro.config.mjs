import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.rongogeva.com',
  integrations: [
    tailwind(),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'he',
        locales: {
          en: 'en',
          he: 'he',
        },
      },
    }),
  ],
  i18n: {
    defaultLocale: 'he',
    locales: ['en', 'he'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
