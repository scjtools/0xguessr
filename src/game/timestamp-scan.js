import { sha256 } from '@noble/hashes/sha256';

// Timestamp-seeded key scanner
// Many naive early wallet scripts generated keys with sha256(Date.now()) or
// sha256(timestamp_string). We scan every second from Ethereum genesis onward.
// Range: 2015-07-30 (ETH genesis) → now  ≈ 315 million timestamps

export const ETH_GENESIS_TS = 1438300800; // 2015-07-30 00:00:00 UTC

let _ts    = ETH_GENESIS_TS;
let _tsEnd = Math.floor(Date.now() / 1000);

export function resetTimestamp(startTs = ETH_GENESIS_TS, endTs = null) {
  _ts    = startTs;
  _tsEnd = endTs ?? Math.floor(Date.now() / 1000);
}

export function getTimestampProgress() {
  return { current: _ts, start: ETH_GENESIS_TS, end: _tsEnd };
}

export function tsToDate(ts) {
  return new Date(ts * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

const enc = new TextEncoder();

export function nextTimestampKey() {
  if (_ts > _tsEnd) return { key: null, ts: _ts, exhausted: true };
  const ts = _ts++;
  // Most common naive pattern: sha256 of decimal timestamp string
  const key = sha256(enc.encode(String(ts)));
  return { key, ts, exhausted: false };
}
