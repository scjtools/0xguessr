// Sequential private key scanner
// Tests private keys 1, 2, 3, ... in ascending order.
// Very low keys are long gone; use a custom start to jump to an interesting range.

let _counter = 1n;

export function resetPuzzle(start = 1n) {
  _counter = typeof start === 'bigint' ? start : BigInt(start);
}

export function getPuzzleCounter() { return _counter; }

export function nextPuzzleKey() {
  const index = _counter;
  const key = new Uint8Array(32);
  let v = _counter++;
  for (let b = 31; b >= 0; b--) {
    key[b] = Number(v & 0xFFn);
    v >>= 8n;
  }
  return { key, index };
}
