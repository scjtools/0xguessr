import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveAll,
  deriveEthAddress,
  parsePrivKey,
  hexToBytes,
  bytesToHex,
} from '../src/game/crypto.js';

// privkey 0x00...01 → well-known ETH address (test vector used across tooling)
test('known privkey derives to known ETH address', () => {
  const priv = hexToBytes(
    '0000000000000000000000000000000000000000000000000000000000000001'
  );
  const d = deriveAll(priv);
  assert.equal(
    d.address.toLowerCase(),
    '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf'
  );
});

test('deriveEthAddress returns 20 bytes', () => {
  const priv = hexToBytes(
    '0000000000000000000000000000000000000000000000000000000000000001'
  );
  const addrBytes = deriveEthAddress(priv);
  assert.equal(addrBytes.length, 20);
});

test('deriveAll address matches deriveEthAddress hex', () => {
  const priv = hexToBytes(
    '0000000000000000000000000000000000000000000000000000000000000001'
  );
  const d = deriveAll(priv);
  assert.equal(d.address, '0x' + bytesToHex(d.addressBytes));
});

test('hex round-trip', () => {
  const bytes = new Uint8Array([0, 1, 0xab, 0xff]);
  assert.equal(bytesToHex(bytes), '0001abff');
  assert.deepEqual(hexToBytes('0001abff'), bytes);
});

test('parsePrivKey accepts 64-char hex', () => {
  const hex =
    '0000000000000000000000000000000000000000000000000000000000000001';
  const result = parsePrivKey(hex);
  assert.equal(result.format, 'hex');
  assert.equal(bytesToHex(result.privKey), hex);
});

test('parsePrivKey strips 0x prefix', () => {
  const hex =
    '0000000000000000000000000000000000000000000000000000000000000001';
  const result = parsePrivKey('0x' + hex);
  assert.equal(result.format, 'hex');
  assert.equal(bytesToHex(result.privKey), hex);
});

test('parsePrivKey rejects bad input', () => {
  assert.throws(() => parsePrivKey('hello world'));
  assert.throws(() => parsePrivKey('deadbeef')); // too short
});
