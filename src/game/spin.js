import { deriveAll, randomPrivKey, bytesToHex } from './crypto.js';
import { checkAddress } from './wallets.js';

export async function spin({ devWin = null } = {}) {
  if (devWin) {
    return {
      win: true,
      privKey: devWin.privKey,
      privKeyHex: bytesToHex(devWin.privKey),
      derived: deriveAll(devWin.privKey),
      match: devWin.match,
    };
  }

  const privKey = randomPrivKey();
  const derived = deriveAll(privKey);
  const hit = await checkAddress(derived.addressBytes);

  return {
    win: hit !== null,
    privKey,
    privKeyHex: bytesToHex(privKey),
    derived,
    match: hit,
  };
}
