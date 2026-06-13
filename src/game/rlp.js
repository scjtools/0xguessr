// Minimal RLP encoder — only what's needed for ETH transaction signing hashes.
// Handles: Uint8Array (raw bytes), BigInt (encoded as minimal big-endian bytes), arrays (lists).

function bigIntToMinBytes(n) {
  if (n === 0n) return new Uint8Array(0);
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function encodeBytes(b) {
  if (b.length === 1 && b[0] < 0x80) return b;
  if (b.length <= 55) return concat(new Uint8Array([0x80 + b.length]), b);
  const lenB = bigIntToMinBytes(BigInt(b.length));
  return concat(new Uint8Array([0xb7 + lenB.length]), lenB, b);
}

function encodeItem(item) {
  if (item instanceof Uint8Array) return encodeBytes(item);
  if (typeof item === 'bigint') return encodeBytes(bigIntToMinBytes(item));
  if (Array.isArray(item)) {
    const body = concat(...item.map(encodeItem));
    if (body.length <= 55) return concat(new Uint8Array([0xc0 + body.length]), body);
    const lenB = bigIntToMinBytes(BigInt(body.length));
    return concat(new Uint8Array([0xf7 + lenB.length]), lenB, body);
  }
  throw new Error('Unknown RLP item type');
}

export function rlpEncode(items) {
  const body = concat(...items.map(encodeItem));
  if (body.length <= 55) return concat(new Uint8Array([0xc0 + body.length]), body);
  const lenB = bigIntToMinBytes(BigInt(body.length));
  return concat(new Uint8Array([0xf7 + lenB.length]), lenB, body);
}

export function hexToBytes(hex) {
  if (!hex || hex === '0x' || hex === '0X') return new Uint8Array(0);
  const h = hex.replace(/^0x/i, '');
  const b = new Uint8Array(Math.ceil(h.length / 2));
  const padded = h.length % 2 ? '0' + h : h;
  for (let i = 0; i < b.length; i++) b[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  return b;
}
