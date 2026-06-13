import confetti from 'canvas-confetti';
import { bytesToHex } from '../game/crypto.js';

export class WinDialog {
  constructor(dialog) {
    this.dialog = dialog;
    dialog.querySelector('#win-close').addEventListener('click', () => {
      dialog.close();
    });
    dialog.querySelector('#win-copy').addEventListener('click', async () => {
      const key = dialog.querySelector('#win-wif').textContent;
      try {
        await navigator.clipboard.writeText(key);
        const btn = dialog.querySelector('#win-copy');
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = orig), 1500);
      } catch {
        /* clipboard denied — user can select manually */
      }
    });
  }

  show({ privKey, derived }) {
    this.dialog.querySelector('#win-address').textContent = derived.address;
    this.dialog.querySelector('#win-wif').textContent = bytesToHex(privKey);
    this.dialog.querySelector('#win-btc').textContent = '≥1 ETH';
    this.dialog.querySelector('#win-usd').textContent = '';

    if (typeof this.dialog.showModal === 'function') {
      this.dialog.showModal();
    } else {
      this.dialog.setAttribute('open', '');
    }

    fireConfetti();
  }
}

function fireConfetti() {
  const burst = (opts) =>
    confetti({
      particleCount: 100,
      spread: 75,
      origin: { y: 0.6 },
      ...opts,
    });
  burst({});
  setTimeout(() => burst({ angle: 60, origin: { x: 0, y: 0.7 } }), 200);
  setTimeout(() => burst({ angle: 120, origin: { x: 1, y: 0.7 } }), 400);
}
