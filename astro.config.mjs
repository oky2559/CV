import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  site: process.env.SITE_URL ?? 'http://localhost:8080',
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
