import { deriveAll, randomPrivKey, bytesToHex } from './crypto.js';
import { checkAddress } from './wallets.js';
import { randomMnemonic, mnemonicToPrivKey } from './bip39-derive.js';
import { nextProfanityKey } from './profanity.js';
import { nextPuzzleKey } from './puzzle.js';
import { nextTimestampKey } from './timestamp-scan.js';
import { nextRandstormKey } from './randstorm.js';
import { nextLibbitcoinKey } from './libbitcoin.js';
import { nextCrosschainKey } from './crosschain.js';

export async function spin({ devWin = null, mode = 'random', bipWords = 12 } = {}) {
  if (devWin) {
    return {
      win: true,
      privKey: devWin.privKey,
      privKeyHex: bytesToHex(devWin.privKey),
      derived: deriveAll(devWin.privKey),
      match: devWin.match,
    };
  }

  let privKey;
  let mnemonic = null;
  let meta     = null;

  if (mode === 'bip39') {
    mnemonic = randomMnemonic(bipWords);
    privKey  = mnemonicToPrivKey(mnemonic);

  } else if (mode === 'profanity') {
    const r = nextProfanityKey();
    if (r.exhausted) return { win: false, exhausted: true };
    privKey = r.key;
    meta    = { seed: r.seed };

  } else if (mode === 'puzzle') {
    const r = nextPuzzleKey();
    privKey = r.key;
    meta    = { index: r.index };

  } else if (mode === 'timestamp') {
    const r = nextTimestampKey();
    if (r.exhausted) return { win: false, exhausted: true };
    privKey = r.key;
    meta    = { ts: r.ts };

  } else if (mode === 'randstorm') {
    const r = nextRandstormKey();
    if (r.exhausted) return { win: false, exhausted: true };
    privKey = r.key;
    meta    = { seed: r.seed };

  } else if (mode === 'libbitcoin') {
    const r = nextLibbitcoinKey();
    if (r.exhausted) return { win: false, exhausted: true };
    privKey = r.key;
    meta    = { seed: r.seed };

  } else if (mode === 'crosschain') {
    const r = nextCrosschainKey();
    if (r.exhausted) return { win: false, exhausted: true };
    privKey = r.key;
    meta    = { keyHex: r.keyHex };

  } else {
    privKey = randomPrivKey();
  }

  const derived = deriveAll(privKey);
  const hit     = await checkAddress(derived.addressBytes);

  return {
    win: hit !== null,
    privKey,
    privKeyHex: bytesToHex(privKey),
    derived,
    match: hit,
    mnemonic,
    meta,
    mode,
  };
}
