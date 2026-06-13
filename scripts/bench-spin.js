#!/usr/bin/env node
// Microbenchmark: how long does one spin actually take?
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { BloomFilter } from '../src/game/bloom.js';
import { deriveAll, randomPrivKey } from '../src/game/crypto.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bloom = BloomFilter.deserialize(
  readFileSync(resolve(ROOT, 'public/data/eth_bloom.bin'))
);

const N = 5000;

// Warmup so JIT settles.
for (let i = 0; i < 200; i++) {
  const d = deriveAll(randomPrivKey());
  bloom.has(d.addressBytes);
}

let tDerive = 0,
  tBloom = 0,
  hits = 0;

const overall = performance.now();
for (let i = 0; i < N; i++) {
  const priv = randomPrivKey();
  const t1 = performance.now();
  const d = deriveAll(priv);
  const t2 = performance.now();
  const hit = bloom.has(d.addressBytes);
  const t3 = performance.now();
  tDerive += t2 - t1;
  tBloom += t3 - t2;
  if (hit) hits++;
}
const overallMs = performance.now() - overall;

console.log(`spins:                 ${N}`);
console.log(`address set size:      ${bloom.m / 8} bytes (${bloom.m} bits, k=${bloom.k})`);
console.log(`bloom hits (FPs):      ${hits}`);
console.log('');
console.log(`derive (secp+keccak):  avg ${(tDerive / N).toFixed(3)} ms/spin`);
console.log(`bloom check:           avg ${(tBloom / N).toFixed(3)} ms/spin`);
console.log(`total per spin:        avg ${((tDerive + tBloom) / N).toFixed(3)} ms/spin`);
console.log(`throughput:            ~${Math.round(N / (overallMs / 1000))} spins/sec`);
