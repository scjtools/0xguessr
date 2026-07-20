// Bloom filter reader for 0xguessr's ETH address set.
//
// On-disk format ("BLM\x01", produced by scripts/build-bloom.mjs):
//   magic(4) = 0x42 0x4c 0x4d 0x01 | m(4 LE) | k(4 LE) | n(4 LE) | bit array
// Membership uses k independent MurmurHash3_x86_32(item, seed=0..k-1) % m.
// The item is the raw 20-byte address (last 20 bytes of keccak256(pubkey)).
//
// The bloom is a *pre-filter only*: it can return false positives, so a hit is
// confirmed with a live on-chain balance check before the game claims a win
// (see src/game/wallets.js confirmFunded).

const HEADER_BYTES = 16;

function readU32LE(bytes, off) {
  return (
    (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0
  );
}

// MurmurHash3_x86_32.
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

export class BloomFilter {
  constructor(m, k, bits) {
    this.m = m;
    this.k = k;
    this.bits = bits ?? new Uint8Array(m / 8);
  }

  _indices(item) {
    const out = new Uint32Array(this.k);
    for (let i = 0; i < this.k; i++) out[i] = murmur3_x86_32(item, i) % this.m;
    return out;
  }

  has(item) {
    for (const bit of this._indices(item)) {
      if ((this.bits[bit >>> 3] & (1 << (bit & 7))) === 0) return false;
    }
    return true;
  }

  static deserialize(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (bytes[0] !== 0x42 || bytes[1] !== 0x4c || bytes[2] !== 0x4d || bytes[3] !== 0x01) {
      throw new Error('bad bloom magic (expected BLM\\x01)');
    }
    const m = readU32LE(bytes, 4);
    const k = readU32LE(bytes, 8);
    const bits = bytes.slice(HEADER_BYTES, HEADER_BYTES + m / 8);
    return new BloomFilter(m, k, bits);
  }
}
