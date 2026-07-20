#!/usr/bin/env node
// Generate the dedicated attack-vector pages (<slug>.html at the repo root)
// from scripts/attacks.mjs. Run: node scripts/gen-pages.mjs

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATTACKS } from './attacks.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://0xguessr.sanjaycj.com';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function page(a) {
  const url = `${SITE}/${a.slug}`;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SITE}/learn` },
      { '@type': 'ListItem', position: 3, name: a.nav, item: url },
    ],
  };
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.h1,
    description: a.desc,
    author: { '@type': 'Organization', name: '0xguessr' },
    publisher: { '@type': 'Organization', name: '0xguessr' },
    mainEntityOfPage: url,
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>${esc(a.title)}</title>
    <meta name="description" content="${esc(a.desc)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#0d0e12" />

    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />

    <meta property="og:type" content="article" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="0xguessr" />
    <meta property="og:title" content="${esc(a.h1)}" />
    <meta property="og:description" content="${esc(a.desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(a.h1)}" />
    <meta name="twitter:description" content="${esc(a.desc)}" />
    <meta name="twitter:image" content="${SITE}/og.png" />

    <script type="application/ld+json">${JSON.stringify(article)}</script>
    <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>

    <link rel="stylesheet" href="/src/styles/learn.css" />
  </head>
  <body>
    <nav class="learn-nav">
      <a href="/" class="brand">0xguessr</a>
      <a href="/" class="play-btn">← Play the slot machine</a>
    </nav>

    <article>
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a> <span aria-hidden="true">›</span>
        <a href="/learn">Learn</a> <span aria-hidden="true">›</span>
        <span>${a.nav}</span>
      </nav>

      <h1 class="hero-title">${a.h1}</h1>
      <p class="hero-sub">${a.lede}</p>
${a.body}
      <div class="try-cta">
        <a href="/?mode=${a.mode}" class="try-btn">▶ Try the ${a.nav} mode in the game</a>
      </div>

      <p style="margin-top:1.75rem">
        <a href="/learn">← Back to all attack vectors</a>
      </p>
    </article>

    <footer>
      <p>
        0xguessr — an educational demonstration. Sources are linked inline;
        figures are approximate and reflect public reporting at the time of writing.
      </p>
      <p><a href="https://github.com/scjtools/0xguessr" target="_blank" rel="noopener">Source on GitHub</a></p>
    </footer>
  </body>
</html>
`;
}

for (const a of ATTACKS) {
  const out = resolve(ROOT, `${a.slug}.html`);
  writeFileSync(out, page(a));
  console.log(`wrote ${a.slug}.html`);
}
console.log(`\n${ATTACKS.length} attack pages generated.`);
