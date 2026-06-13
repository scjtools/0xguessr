import { deriveAll, randomPrivKey, bytesToHex } from './crypto.js';
import { checkAddress } from './wallets.js';
import { randomMnemonic, mnemonicToPrivKey } from './bip39-derive.js';
import { nextPhrase, phraseToPrivKey } from './brain-wallet.js';

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
  let phrase = null;

  if (mode === 'bip39') {
    mnemonic = randomMnemonic(bipWords);
    privKey = mnemonicToPrivKey(mnemonic);
  } else if (mode === 'brain') {
    phrase = nextPhrase();
    if (phrase === null) return { win: false, exhausted: true };
    privKey = phraseToPrivKey(phrase);
  } else {
    privKey = randomPrivKey();
  }

  const derived = deriveAll(privKey);
  const hit = await checkAddress(derived.addressBytes);

  return {
    win: hit !== null,
    privKey,
    privKeyHex: bytesToHex(privKey),
    derived,
    match: hit,
    mnemonic,
    phrase,
  };
}
