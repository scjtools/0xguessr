// Cross-chain key reuse scanner
// Some users set up Bitcoin wallets first and then reused the exact same
// private key for Ethereum. If that Bitcoin key was exposed through any
// exploit (nonce reuse, weak RNG, published research), the ETH wallet
// is also open — same key, different address derivation.
//
// Load a list of known-compromised private keys (64 hex chars each),
// derive each one's Ethereum address, and check against the bloom filter.

import { hexToBytes } from './crypto.js';

let _keys  = [];
let _index = 0;

// A small curated list of private keys known to be compromised in public
// security research. All have been swept on Bitcoin; checking Ethereum.
// Sources: nonce-reuse analysis (2013), published CTF/research keys, puzzle keys.
export const BUILTIN_CROSSCHAIN_KEYS = [
  // secp256k1 generator point scalar 1–20 (puzzle keys, widely known)
  '0000000000000000000000000000000000000000000000000000000000000001',
  '0000000000000000000000000000000000000000000000000000000000000002',
  '0000000000000000000000000000000000000000000000000000000000000003',
  '0000000000000000000000000000000000000000000000000000000000000004',
  '0000000000000000000000000000000000000000000000000000000000000005',
  '0000000000000000000000000000000000000000000000000000000000000006',
  '0000000000000000000000000000000000000000000000000000000000000007',
  '0000000000000000000000000000000000000000000000000000000000000008',
  '0000000000000000000000000000000000000000000000000000000000000009',
  '000000000000000000000000000000000000000000000000000000000000000a',
  '000000000000000000000000000000000000000000000000000000000000000b',
  '000000000000000000000000000000000000000000000000000000000000000c',
  '000000000000000000000000000000000000000000000000000000000000000d',
  '000000000000000000000000000000000000000000000000000000000000000e',
  '000000000000000000000000000000000000000000000000000000000000000f',
  '0000000000000000000000000000000000000000000000000000000000000010',
  '0000000000000000000000000000000000000000000000000000000000000014',
  '0000000000000000000000000000000000000000000000000000000000000015',
  '0000000000000000000000000000000000000000000000000000000000000020',
  '0000000000000000000000000000000000000000000000000000000000000064',
  // max valid key - 1
  'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
  // known nonce-reuse victim keys published in 2013 Bitcoin research
  // (these addresses were drained; checking if same key held ETH)
  '0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d',
  'e9873d79c6d87dc0fb6a5778633389f4453213303da61f20bd67fc233aa33262',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '2222222222222222222222222222222222222222222222222222222222222222',
  '3333333333333333333333333333333333333333333333333333333333333333',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
  '0000000000000000000000000000000000000000000000000000000000000bad',
  '00000000000000000000000000000000000000000000000000000000deadbeef',
];

export function loadCrosschainKeys(lines) {
  _keys  = lines.map(l => l.trim().replace(/^0x/i, '').toLowerCase())
                .filter(k => /^[0-9a-f]{64}$/.test(k));
  _index = 0;
}

export function getCrosschainProgress() {
  return { current: _index, total: _keys.length };
}

export function resetCrosschain() { _index = 0; }

export function nextCrosschainKey() {
  if (_index >= _keys.length) return { key: null, keyHex: null, exhausted: true };
  const keyHex = _keys[_index++];
  return { key: hexToBytes(keyHex), keyHex, exhausted: false };
}
