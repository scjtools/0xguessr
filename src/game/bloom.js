import { sha256 } from '@noble/hashes/sha256';

const HEADER_BYTES = 16;
const MAGIC = new Uint8Array([0x42, 0x4c, 0x4d, 0x31]); // "BLM1"

function readU32LE(bytes, off) {
  return (
    bytes[off] |
    (bytes[off + 1] << 8) |
    (bytes[off + 2] << 16) |
    (bytes[off + 3] << 24) >>> 0
  ) >>> 0;
}

// MurmurHash3_x86_32 — used by external BLM\x01 bloom files.
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

function writeU32LE(bytes, off, v) {
  bytes[off] = v & 0xff;
  bytes[off + 1] = (v >>> 8) & 0xff;
  bytes[off + 2] = (v >>> 16) & 0xff;
  bytes[off + 3] = (v >>> 24) & 0xff;
}

export function optimalParams(n, p) {
  const m = Math.ceil(-(n * Math.log(p)) / (Math.LN2 * Math.LN2));
  const mPadded = (m + 7) & ~7;
  const k = Math.max(1, Math.round((mPadded / n) * Math.LN2));
  return { m: mPadded, k };
}

function hashIndices(item, m, k) {
  // Double-hashing: g_i(x) = h1(x) + i * h2(x) mod m.
  // Take two 32-bit halves from a SHA-256 of the input.
  const h = sha256(item);
  const h1 =
    (h[0] | (h[1] << 8) | (h[2] << 16) | (h[3] << 24)) >>> 0;
  const h2 =
    (h[4] | (h[5] << 8) | (h[6] << 16) | (h[7] << 24)) >>> 0;
  const out = new Uint32Array(k);
  for (let i = 0; i < k; i++) {
    out[i] = (h1 + Math.imul(i, h2)) >>> 0;
    out[i] = out[i] % m;
  }
  return out;
}

export class BloomFilter {
  // hashAlgo: 'sha256' (BLM1 original) | 'murmur3' (BLM\x01 external)
  constructor(m, k, bits, hashAlgo = 'sha256') {
    this.m = m;
    this.k = k;
    this.bits = bits ?? new Uint8Array(m / 8);
    this.hashAlgo = hashAlgo;
  }

  static create(n, p) {
    const { m, k } = optimalParams(n, p);
    return new BloomFilter(m, k);
  }

  _indices(item) {
    if (this.hashAlgo === 'murmur3') {
      // k independent MurmurHash3_x86_32 calls with seed = 0..k-1
      const out = new Uint32Array(this.k);
      for (let i = 0; i < this.k; i++) {
        out[i] = murmur3_x86_32(item, i) % this.m;
      }
      return out;
    }
    return hashIndices(item, this.m, this.k);
  }

  add(item) {
    for (const bit of this._indices(item)) {
      this.bits[bit >>> 3] |= 1 << (bit & 7);
    }
  }

  has(item) {
    for (const bit of this._indices(item)) {
      if ((this.bits[bit >>> 3] & (1 << (bit & 7))) === 0) return false;
    }
    return true;
  }

  serialize(n) {
    const out = new Uint8Array(HEADER_BYTES + this.bits.length);
    out.set(MAGIC, 0);
    writeU32LE(out, 4, n);
    writeU32LE(out, 8, this.m);
    out[12] = this.k;
    out.set(this.bits, HEADER_BYTES);
    return out;
  }

  static deserialize(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (bytes[0] !== 0x42 || bytes[1] !== 0x4c || bytes[2] !== 0x4d) {
      throw new Error('bad bloom magic');
    }
    let m, k, hashAlgo;
    if (bytes[3] === 0x31) {
      // Original BLM1: magic(4) | n(4) | m(4) | k(1) | pad(3) | bits
      m = readU32LE(bytes, 8);
      k = bytes[12];
      hashAlgo = 'sha256';
    } else if (bytes[3] === 0x01) {
      // External BLM\x01: magic(4) | m(4) | k(4) | n(4) | bits
      m = readU32LE(bytes, 4);
      k = readU32LE(bytes, 8);
      hashAlgo = 'murmur3';
    } else {
      throw new Error('bad bloom magic');
    }
    const bits = bytes.slice(HEADER_BYTES, HEADER_BYTES + m / 8);
    return new BloomFilter(m, k, bits, hashAlgo);
  }
}
