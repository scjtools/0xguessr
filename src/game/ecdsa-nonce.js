// ECDSA nonce reuse key recovery for secp256k1 / Ethereum.
// If two transactions from the same address use the same ephemeral k,
// their signatures share the same r value.  Given (r, s1, h1) and (r, s2, h2):
//   k  = (h1 - h2) * inv(s1 - s2)  mod n
//   d  = (s1*k - h1) * inv(r)       mod n

import { keccak_256 } from '@noble/hashes/sha3';
import { getPublicKey } from '@noble/secp256k1';
import { bytesToHex } from './crypto.js';
import { rlpEncode, hexToBytes } from './rlp.js';

export const SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;

function modn(x) { return ((x % SECP256K1_N) + SECP256K1_N) % SECP256K1_N; }

function modPow(base, exp, mod) {
  let r = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp & 1n) r = r * base % mod;
    base = base * base % mod;
    exp >>= 1n;
  }
  return r;
}

// Fermat inverse (n is prime)
export function modInv(a, m = SECP256K1_N) {
  return modPow(((a % m) + m) % m, m - 2n, m);
}

export function recoverPrivKey(r, s1, h1, s2, h2) {
  const diffS = modn(s1 - s2);
  if (diffS === 0n) return null;
  const k = modn((h1 - h2) * modInv(diffS));
  if (k === 0n) return null;
  const d = modn((s1 * k - h1) * modInv(r));
  if (d === 0n) return null;
  return d;
}

export function bigIntToBytes32(n) {
  const hex = n.toString(16).padStart(64, '0');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function verifyPrivKey(privKeyBigInt, expectedAddress) {
  try {
    const privBytes = bigIntToBytes32(privKeyBigInt);
    const pub = getPublicKey(privBytes, false);
    const hash = keccak_256(pub.slice(1));
    const derived = '0x' + bytesToHex(hash.slice(12));
    return derived.toLowerCase() === expectedAddress.toLowerCase() ? derived : null;
  } catch {
    return null;
  }
}

// Compute signing hash for a legacy (type 0) transaction from Etherscan txlist fields.
// Etherscan returns: nonce, gasPrice, gas, to, value, input, v (all decimal or hex strings).
export function legacySigningHash(tx) {
  const nonce    = BigInt(tx.nonce);
  const gasPrice = BigInt(tx.gasPrice);
  const gas      = BigInt(tx.gas);
  const to       = tx.to ? hexToBytes(tx.to) : new Uint8Array(0);
  const value    = BigInt(tx.value);
  const data     = hexToBytes(tx.input || '0x');

  // Etherscan gives v as decimal or hex
  const rawV = typeof tx.v === 'string'
    ? (tx.v.startsWith('0x') ? parseInt(tx.v, 16) : parseInt(tx.v, 10))
    : Number(tx.v);

  let fields;
  if (rawV === 27 || rawV === 28) {
    // Pre-EIP-155: no chain ID
    fields = [nonce, gasPrice, gas, to, value, data];
  } else {
    // EIP-155: v = 2*chainId + 35 + parity  →  chainId = (v - 35) >> 1
    const chainId = BigInt(Math.floor((rawV - 35) / 2));
    fields = [nonce, gasPrice, gas, to, value, data, chainId, 0n, 0n];
  }

  return keccak_256(rlpEncode(fields));
}

export function bytesToBigInt(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
}

// Group Etherscan txlist entries by r value; return collisions (same r, different tx).
export function findNonceReuse(txList) {
  const byR = new Map();
  for (const tx of txList) {
    const r = tx.r?.toLowerCase();
    if (!r || r === '0x0' || r === '0x') continue;
    if (!byR.has(r)) byR.set(r, []);
    byR.get(r).push(tx);
  }
  return [...byR.values()].filter(group => group.length > 1);
}
