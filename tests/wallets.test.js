import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BloomFilter } from '../src/game/bloom.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLOOM_PATH = resolve(ROOT, 'public/data/eth-bloom.bin');

function skipIfNoBloom(t) {
  if (!existsSync(BLOOM_PATH)) {
    t.skip('eth-bloom.bin not yet placed in public/data/');
    return true;
  }
  return false;
}

test('bloom filter rejects random 20-byte address', (t) => {
  if (skipIfNoBloom(t)) return;
  const bloom = BloomFilter.deserialize(readFileSync(BLOOM_PATH));
  const random = new Uint8Array(20);
  crypto.getRandomValues(random);
  // With p=1e-9, a single random check collides ~1e-9 of the time.
  assert.equal(bloom.has(random), false);
});

test('bloom filter loads and has correct structure', (t) => {
  if (skipIfNoBloom(t)) return;
  const bloom = BloomFilter.deserialize(readFileSync(BLOOM_PATH));
  assert.ok(bloom.m > 0);
  assert.ok(bloom.k > 0);
  assert.ok(bloom.bits.length > 0);
});
