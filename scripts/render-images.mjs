#!/usr/bin/env node
// Rasterize the SVG source assets in public/ to the PNGs that social scrapers
// and older browsers need. Run after editing favicon.svg / og.svg:
//   node scripts/render-images.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { jackpotBillions } from './jackpot.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = resolve(ROOT, 'public');

let jackpot = '192';
try {
  jackpot = jackpotBillions(
    JSON.parse(readFileSync(resolve(PUB, 'data/eth_meta.json'), 'utf8'))
  ).toLocaleString('en-US');
} catch { /* keep fallback */ }

function render(svgName, outName, width) {
  const svg = readFileSync(resolve(PUB, svgName), 'utf8').replaceAll('__JACKPOT_B__', jackpot);
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: true },
  }).render().asPng();
  writeFileSync(resolve(PUB, outName), png);
  console.log(`rendered ${outName} (${png.length} bytes, w=${width})`);
}

render('og.svg', 'og.png', 1200);              // 1200x630 social card
render('favicon.svg', 'apple-touch-icon.png', 180);
render('favicon.svg', 'favicon-32.png', 32);   // fallback for old browsers
render('favicon.svg', 'icon-192.png', 192);    // PWA manifest
render('favicon.svg', 'icon-512.png', 512);    // PWA manifest
