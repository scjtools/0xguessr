import { BloomFilter } from './bloom.js';

let _bloomPromise = null;
let _stats = null;

// Served from jsDelivr (free CDN backed by GitHub) so the 5 MB bloom never
// touches Vercel bandwidth. Falls back to the locally-hosted copy if jsDelivr
// is unreachable (e.g. blocked regions).
const BLOOM_CDN = 'https://cdn.jsdelivr.net/gh/scjtools/0xguessr@main/public/data/eth_bloom.bin';
const BLOOM_LOCAL = '/data/eth_bloom.bin';

export function loadBloom() {
  if (!_bloomPromise) {
    _bloomPromise = fetch(BLOOM_CDN)
      .catch(() => fetch(BLOOM_LOCAL))
      .then((r) => {
        if (!r.ok) throw new Error(`bloom fetch failed: ${r.status}`);
        return r.arrayBuffer();
      })
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
