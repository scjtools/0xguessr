#!/usr/bin/env node
// Build public/data/eth_bloom.bin + eth_meta.json from a list of ETH addresses.
//
// Input : newline-delimited `0x`-prefixed addresses (40 hex chars each) on
//         stdin, or a file path as the first CLI arg. Blank lines and lines
//         starting with `#` are ignored. Case-insensitive; deduplicated.
// Output: public/data/eth_bloom.bin  (format must stay byte-compatible with
//         src/game/bloom.js — external "BLM\x01" / MurmurHash3_x86_32)
//         public/data/eth_meta.json
//
// The bloom format + hashing here MUST match src/game/bloom.js exactly:
//   header : magic(4)="BLM\x01" | m(4 LE) | k(4 LE) | n(4 LE) | bits
//   hash   : k independent MurmurHash3_x86_32(item, seed=0..k-1) % m
//   item   : the raw 20 address bytes (NOT the hex string)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_BLOOM = resolve(ROOT, 'public/data/eth_bloom.bin');
const OUT_META = resolve(ROOT, 'public/data/eth_meta.json');

const TARGET_FP = 1e-6;
const THRESHOLD_WEI = 1000000000000000000n; // 1 ETH, for the meta note

// --- MurmurHash3_x86_32 — identical to src/game/bloom.js ---------------------
function readU32LE(data, off) {
  return (
    (data[off] | (data[off + 1] << 8) | (data[off + 2] << 16) | (data[off + 3] << 24)) >>> 0
  );
}
function murmur3_x86_32(data, seed) {
  const c1 = 0xcc9e2d51, c2 = 0x1b873593;
  let h = seed >>> 0;
  const nblocks = Math.floor(data.length / 4);
  for (let i = 0; i < nblocks; i++) {
    let k = readU32LE(data, i * 4);
    k = Math.imul(k, c1) >>> 0;
    k = ((k << 15) | (k >>> 17)) >>> 0;
    k = Math.imul(k, c2) >>> 0;
    h ^= k;
    h = ((h << 13) | (h >>> 19)) >>> 0;
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
  }
  let tail = 0;
  const t = nblocks * 4;
  switch (data.length & 3) {
    case 3: tail ^= data[t + 2] << 16; // falls through
    case 2: tail ^= data[t + 1] << 8;  // falls through
    case 1:
      tail ^= data[t];
      tail = Math.imul(tail, c1) >>> 0;
      tail = ((tail << 15) | (tail >>> 17)) >>> 0;
      tail = Math.imul(tail, c2) >>> 0;
      h ^= tail;
  }
  h ^= data.length;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

// --- optimalParams — identical to src/game/bloom.js -------------------------
function optimalParams(n, p) {
  const m = Math.ceil(-(n * Math.log(p)) / (Math.LN2 * Math.LN2));
  const mPadded = (m + 7) & ~7; // byte-align
  const k = Math.max(1, Math.round((mPadded / n) * Math.LN2));
  return { m: mPadded, k };
}

function writeU32LE(bytes, off, v) {
  bytes[off] = v & 0xff;
  bytes[off + 1] = (v >>> 8) & 0xff;
  bytes[off + 2] = (v >>> 16) & 0xff;
  bytes[off + 3] = (v >>> 24) & 0xff;
}

const ADDR_RE = /^(0x)?[0-9a-fA-F]{40}$/;

function hexToBytes20(addr) {
  const s = addr.startsWith('0x') || addr.startsWith('0X') ? addr.slice(2) : addr;
  const out = new Uint8Array(20);
  for (let i = 0; i < 20; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function readInput() {
  const arg = process.argv[2];
  const raw = arg ? readFileSync(arg, 'utf8') : readFileSync(0, 'utf8');
  const seen = new Set();
  let skipped = 0;
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    // tolerate CSV: take the first field
    const first = s.split(/[,\t;]/)[0].trim();
    if (!ADDR_RE.test(first)) { skipped++; continue; }
    seen.add(first.toLowerCase().replace(/^0x/, ''));
  }
  if (skipped) console.error(`build-bloom: skipped ${skipped} non-address line(s)`);
  return seen;
}

function main() {
  const addrs = readInput();
  const n = addrs.size;
  if (n === 0) {
    console.error('build-bloom: no valid addresses on input — refusing to write an empty bloom');
    process.exit(1);
  }
  const { m, k } = optimalParams(n, TARGET_FP);
  const bits = new Uint8Array(m / 8);

  for (const hex of addrs) {
    const item = hexToBytes20(hex);
    for (let i = 0; i < k; i++) {
      const bit = murmur3_x86_32(item, i) % m;
      bits[bit >>> 3] |= 1 << (bit & 7);
    }
  }

  // Serialize: magic "BLM\x01" | m(LE) | k(LE) | n(LE) | bits
  const HEADER = 16;
  const out = new Uint8Array(HEADER + bits.length);
  out[0] = 0x42; out[1] = 0x4c; out[2] = 0x4d; out[3] = 0x01;
  writeU32LE(out, 4, m);
  writeU32LE(out, 8, k);
  writeU32LE(out, 12, n);
  out.set(bits, HEADER);

  mkdirSync(dirname(OUT_BLOOM), { recursive: true });
  writeFileSync(OUT_BLOOM, out);

  // Preserve display-only fields (total_eth_approx, eth_usd_approx,
  // price_snapshot_date) that the UI reads but this script doesn't compute.
  // Env vars override them when the caller has fresher values.
  let prev = {};
  try { prev = JSON.parse(readFileSync(OUT_META, 'utf8')); } catch { /* first run */ }
  const numEnv = (k) => (process.env[k] != null && process.env[k] !== '' ? Number(process.env[k]) : undefined);

  const meta = {
    ...prev,
    snapshot_date: new Date().toISOString(),
    source: process.env.BLOOM_SOURCE || 'unknown',
    query: `eth_balance >= ${THRESHOLD_WEI} (>= 1 ETH)`,
    address_count: n,
    bloom_m_bits: m,
    bloom_k_hashes: k,
    fp_rate: TARGET_FP,
    file_size_bytes: out.length,
    total_eth_approx: numEnv('TOTAL_ETH_APPROX') ?? prev.total_eth_approx ?? null,
    eth_usd_approx: numEnv('ETH_USD_APPROX') ?? prev.eth_usd_approx ?? null,
    price_snapshot_date: process.env.PRICE_SNAPSHOT_DATE || prev.price_snapshot_date || null,
  };
  writeFileSync(OUT_META, JSON.stringify(meta, null, 2) + '\n');

  console.error(
    `build-bloom: wrote ${OUT_BLOOM} (${out.length} bytes) — n=${n}, m=${m}, k=${k}`
  );
}

main();
