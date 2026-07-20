import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jackpotBillions } from './scripts/jackpot.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
      return html.replaceAll('__JACKPOT_B__', String(billions));
    },
  };
}

export default defineConfig({
  plugins: [jackpotHtmlPlugin()],
  base: '/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
  },
});
