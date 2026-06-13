import { getPublicKey } from '@noble/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

export function randomPrivKey() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return buf;
}

export function deriveEthAddress(privKey) {
  const pub = getPublicKey(privKey, false); // 65-byte uncompressed (04 || x || y)
  const hash = keccak_256(pub.slice(1));    // keccak256 of 64-byte pubkey body
  return hash.slice(12);                    // last 20 bytes = address
}

export function deriveAll(privKey) {
  const addressBytes = deriveEthAddress(privKey);
  const address = '0x' + bytesToHex(addressBytes);
  return { privKey, addressBytes, address };
}

export function bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

export function hexToBytes(hex) {
  if (hex.length % 2) throw new Error('odd hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const HEX_RE = /^[0-9a-f]{64}$/i;

export function parsePrivKey(input) {
  const s = input.trim().replace(/^0x/i, '');
  if (HEX_RE.test(s)) {
    return { privKey: hexToBytes(s.toLowerCase()), format: 'hex' };
  }
  throw new Error('Unrecognised key format. Expected 64 hex characters.');
}
