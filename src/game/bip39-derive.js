import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';

export function randomMnemonic(wordCount = 12) {
  return generateMnemonic(wordlist, wordCount === 24 ? 256 : 128);
}

export function mnemonicToPrivKey(mnemonic) {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive("m/44'/60'/0'/0/0");
  if (!child.privateKey) throw new Error('BIP32 derivation failed');
  return child.privateKey;
}
