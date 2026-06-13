// End-to-end: exercises the crypto derivation pipeline the same way spin.js does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveAll, hexToBytes, bytesToHex } from '../src/game/crypto.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLOOM_PATH = resolve(ROOT, 'public/data/eth-bloom.bin');

test('derive pipeline produces valid ETH address from known privkey', () => {
  const priv = hexToBytes(
    '0000000000000000000000000000000000000000000000000000000000000001'
  );
  const d = deriveAll(priv);
  assert.equal(d.addressBytes.length, 20);
  assert.match(d.address, /^0x[0-9a-f]{40}$/i);
  assert.equal(d.address, '0x' + bytesToHex(d.addressBytes));
});

test('miss: random key does not match eth-bloom (skipped if file absent)', async (t) => {
  if (!existsSync(BLOOM_PATH)) {
    t.skip('eth-bloom.bin not yet placed in public/data/');
    return;
  }
  // Dynamically import to avoid top-level fetch usage in Node.
  const { BloomFilter } = await import('../src/game/bloom.js');
  const { readFileSync } = await import('node:fs');
  const bloom = BloomFilter.deserialize(readFileSync(BLOOM_PATH));

  const priv = new Uint8Array(32);
  crypto.getRandomValues(priv);
  const d = deriveAll(priv);
  // Bloom hit on a random address is astronomically unlikely (~1e-9).
  assert.equal(bloom.has(d.addressBytes), false);
});
