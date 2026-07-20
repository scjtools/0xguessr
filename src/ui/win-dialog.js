import confetti from 'canvas-confetti';
import { bytesToHex } from '../game/crypto.js';

export class WinDialog {
  constructor(dialog) {
    this.dialog = dialog;
    dialog.querySelector('#win-close').addEventListener('click', () => {
      dialog.close();
    });
    dialog.querySelector('#win-copy').addEventListener('click', async () => {
      const key = dialog.querySelector('#win-privkey').textContent;
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

  show({ privKey, derived, balanceWei = null }) {
    this.dialog.querySelector('#win-address').textContent = derived.address;
    this.dialog.querySelector('#win-privkey').textContent = bytesToHex(privKey);
    this.dialog.querySelector('#win-amount').textContent = fmtEth(balanceWei);
    this.dialog.querySelector('#win-usd').textContent = '';

    if (typeof this.dialog.showModal === 'function') {
      this.dialog.showModal();
    } else {
      this.dialog.setAttribute('open', '');
    }

    fireConfetti();
  }
}

// Confirmed on-chain balance (bigint wei) → "3.42 ETH". Null → generic label.
function fmtEth(wei) {
  if (wei == null) return '≥1 ETH';
  const eth = Number(wei) / 1e18;
  const dp = eth >= 1000 ? 0 : eth >= 1 ? 2 : 4;
  return `${eth.toLocaleString('en-US', { maximumFractionDigits: dp })} ETH`;
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
