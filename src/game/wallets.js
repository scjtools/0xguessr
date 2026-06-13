import { BloomFilter } from './bloom.js';

let _bloomPromise = null;
let _stats = null;

export function loadBloom() {
  if (!_bloomPromise) {
    _bloomPromise = fetch('/data/eth_bloom.bin')
      .then((r) => r.arrayBuffer())
      .then((buf) => BloomFilter.deserialize(new Uint8Array(buf)));
  }
  return _bloomPromise;
}

export async function loadStats() {
  if (_stats) return _stats;
  _stats = await fetch('/data/eth_meta.json').then((r) => r.json());
  return _stats;
}

export async function checkAddress(addressBytes) {
  const bloom = await loadBloom();
  if (bloom.has(addressBytes)) {
    return { addressBytes };
  }
  return null;
}
