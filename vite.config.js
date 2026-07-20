import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jackpotBillions } from './scripts/jackpot.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://0xguessr.sanjaycj.com';

// Bake the current "$N billion" jackpot (from the weekly-refreshed
// eth_meta.json) into <title> and the OG/Twitter tags at build time, so
// social scrapers — which don't run JS — see the up-to-date figure.
function jackpotHtmlPlugin() {
  return {
    name: 'jackpot-html',
    transformIndexHtml(html) {
      let billions = 192;
      try {
        const meta = JSON.parse(
          readFileSync(resolve(__dirname, 'public/data/eth_meta.json'), 'utf8')
        );
        billions = jackpotBillions(meta) || billions;
      } catch { /* keep fallback */ }
      return html.replaceAll('__JACKPOT_B__', billions.toLocaleString('en-US'));
    },
  };
}

// Write dist/sitemap.xml at build time so the homepage lastmod tracks the
// weekly data refresh (eth_meta snapshot) and /learn tracks the build date.
function sitemapPlugin() {
  return {
    name: 'sitemap',
    closeBundle() {
      const today = new Date().toISOString().slice(0, 10);
      let homeDate = today;
      try {
        const meta = JSON.parse(
          readFileSync(resolve(__dirname, 'public/data/eth_meta.json'), 'utf8')
        );
        if (meta.price_snapshot_date) homeDate = meta.price_snapshot_date;
      } catch { /* keep today */ }
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${homeDate}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE}/learn</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
</urlset>
`;
      try { writeFileSync(resolve(__dirname, 'dist/sitemap.xml'), xml); } catch { /* dist may not exist in dev */ }
    },
  };
}

export default defineConfig({
  plugins: [jackpotHtmlPlugin(), sitemapPlugin()],
  base: '/',
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        learn: resolve(__dirname, 'learn.html'),
      },
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
  },
});
