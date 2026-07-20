import { BloomFilter } from './bloom.js';

let _bloomPromise = null;
let _stats = null;

// The bloom is a *pre-filter* only: it can produce false positives, so a hit is
// never trusted on its own. A real win is confirmed with a live on-chain
// balance check (confirmFunded) before the game ever shows "WIN".

// Served from jsDelivr (free CDN backed by GitHub) so the 5 MB bloom never
// touches Vercel bandwidth. Falls back to the locally-hosted copy if jsDelivr
// is unreachable (e.g. blocked regions).
const BLOOM_CDN = 'https://cdn.jsdelivr.net/gh/scjtools/0xguessr@main/public/data/eth_bloom.bin';
const BLOOM_LOCAL = '/data/eth_bloom.bin';

// Public, keyless Ethereum JSON-RPC endpoints for the on-hit balance check.
// Tried in order; the check only ever runs on a (astronomically rare) bloom hit.
const RPC_ENDPOINTS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://cloudflare-eth.com',
];

const ONE_ETH_WEI = 1000000000000000000n; // 1 ETH threshold

export async function loadStats() {
  if (_stats) return _stats;
  _stats = await fetch('/data/eth_meta.json').then((r) => r.json());
  return _stats;
}

export function loadBloom() {
  if (!_bloomPromise) {
    // Version the URL with the snapshot date so browsers *and* jsDelivr refetch
    // when the weekly job publishes a new file, but still cache within a week.
    _bloomPromise = loadStats()
      .catch(() => null)
      .then((stats) => {
        const v = stats?.snapshot_date
          ? `?v=${encodeURIComponent(stats.snapshot_date)}`
          : '';
        return fetch(BLOOM_CDN + v).catch(() => fetch(BLOOM_LOCAL + v));
      })
      .then((r) => {
        if (!r.ok) throw new Error(`bloom fetch failed: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => BloomFilter.deserialize(new Uint8Array(buf)));
  }
  return _bloomPromise;
}

/**
 * Bloom pre-filter. Returns a candidate object on a (possible) hit, or null.
 * A non-null result is NOT a win — it must be confirmed with confirmFunded().
 */
export async function checkAddress(addressBytes) {
  const bloom = await loadBloom();
  return bloom.has(addressBytes) ? { addressBytes } : null;
}

async function rpcGetBalanceWei(address) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getBalance',
    params: [address, 'latest'],
  });
  let lastErr;
  for (const url of RPC_ENDPOINTS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      if (!r.ok) { lastErr = new Error(`${url} -> ${r.status}`); continue; }
      const j = await r.json();
      if (j.error) { lastErr = new Error(j.error.message); continue; }
      if (typeof j.result === 'string') return BigInt(j.result);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('all RPC endpoints failed');
}

/**
 * Live, authoritative confirmation of a bloom hit. Returns
 * { funded, balanceWei } where `funded` is true only if the address currently
 * holds >= 1 ETH on-chain. Never trust the bloom without this.
 */
export async function confirmFunded(address, minWei = ONE_ETH_WEI) {
  const balanceWei = await rpcGetBalanceWei(address);
  return { funded: balanceWei >= minWei, balanceWei };
}
