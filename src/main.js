import { spin } from './game/spin.js';
import { loadStats, loadBloom, checkAddress } from './game/wallets.js';
import {
  randomPrivKey,
  deriveAll,
  parsePrivKey,
} from './game/crypto.js';
import { Log } from './ui/log.js';
import { ClassicReels } from './ui/slot-classic.js';
import { RealisticReels } from './ui/slot-realistic.js';
import { WinDialog } from './ui/win-dialog.js';
import { sfx, setMuted, unlock } from './audio/audio.js';

const AUTOSPIN_DELAY_MS = 250;
const AUTOSPIN_DELAY_NO_DELAY_MS = 16;

function fmtNumber(n) {
  return n.toLocaleString('en-US');
}

function fmtUsdShort(usd) {
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9)  return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6)  return `$${(usd / 1e6).toFixed(2)}M`;
  return `$${fmtNumber(Math.round(usd))}`;
}

function fmtOdds(walletCount) {
  const log10Keyspace = 256 * Math.log10(2);
  const log10Denom = log10Keyspace - Math.log10(walletCount);
  const exponent = Math.floor(log10Denom);
  const mantissa = Math.pow(10, log10Denom - exponent);
  return `1 in ${mantissa.toFixed(2)} × 10^${exponent}`;
}

function fmtTagline(usd) {
  const billions = Math.floor(usd / 1e9);
  if (billions >= 1) return `Win more than ${fmtNumber(billions)} billion dollars!`;
  const millions = Math.floor(usd / 1e6);
  if (millions >= 1) return `Win more than ${fmtNumber(millions)} million dollars!`;
  return `Win more than ${fmtNumber(Math.floor(usd))} dollars!`;
}

function renderHeaderStats(stats) {
  const totalEth = stats.total_eth_approx;
  const totalUsd = totalEth * stats.eth_usd_approx;
  document.getElementById('tagline').textContent = fmtTagline(totalUsd);
  document.getElementById('stat-jackpot-btc').textContent =
    `≈${fmtNumber(Math.round(totalEth))} ETH`;
  document.getElementById('stat-jackpot-usd').textContent =
    `≈ ${fmtUsdShort(totalUsd)}`;
  document.getElementById('stat-odds').textContent = fmtOdds(stats.address_count);
  document.getElementById('stat-odds-flavor').textContent =
    'about 10⁷× harder than picking one specific atom in the universe';
  document.getElementById('stat-wallet-count').textContent = fmtNumber(stats.address_count);
  document.getElementById('stat-snapshot').textContent =
    `price snapshot: ${stats.price_snapshot_date}`;
}

function shorten(s, n = 8) {
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

async function main() {
  const stats = await loadStats();
  loadBloom();

  renderHeaderStats(stats);

  const log = new Log(document.getElementById('log'));
  log.append(
    `Loaded ${fmtNumber(stats.address_count)} wallets · jackpot ≈${fmtNumber(Math.round(stats.total_eth_approx))} ETH.`
  );
  log.append(`Odds per spin: ${fmtOdds(stats.address_count)}.`);
  log.append('Pull the lever.');

  const classic = new ClassicReels(document.getElementById('reels-classic'));
  const realistic = new RealisticReels(
    document.getElementById('reels-realistic')
  );
  classic.show();
  realistic.hide();

  const winDialog = new WinDialog(document.getElementById('win-dialog'));

  const pullBtn = document.getElementById('pull-btn');
  const realisticToggle = document.getElementById('toggle-realistic');
  const noDelayToggle = document.getElementById('toggle-no-delay');
  const autospinToggle = document.getElementById('toggle-autospin');
  const soundToggle = document.getElementById('toggle-sound');

  let realisticMode = false;
  realisticToggle.addEventListener('change', (e) => {
    realisticMode = e.target.checked;
    if (realisticMode) {
      classic.hide();
      realistic.show();
    } else {
      realistic.hide();
      classic.show();
    }
  });

  setMuted(!soundToggle.checked);
  soundToggle.addEventListener('change', (e) => {
    setMuted(!e.target.checked);
  });

  autospinToggle.addEventListener('change', (e) => {
    if (e.target.checked && !busy) onPull();
  });

  // Settings dialog ----------------------------------------------------------
  const settingsBtn = document.getElementById('settings-btn');
  const settingsDialog = document.getElementById('settings-dialog');
  const settingsClose = document.getElementById('settings-close');
  const manualInput = document.getElementById('manual-key-input');
  const manualBtn = document.getElementById('manual-check-btn');
  const manualResult = document.getElementById('manual-result');

  settingsBtn.addEventListener('click', () => {
    if (typeof settingsDialog.showModal === 'function') {
      settingsDialog.showModal();
    } else {
      settingsDialog.setAttribute('open', '');
    }
  });
  settingsClose.addEventListener('click', () => settingsDialog.close());

  function setManualResult(text, kind) {
    manualResult.textContent = text;
    manualResult.classList.remove('ok', 'fail', 'err');
    if (kind) manualResult.classList.add(kind);
  }

  async function onManualCheck() {
    setManualResult('', null);
    const raw = manualInput.value.trim();
    if (!raw) {
      setManualResult('Enter a private key first.', 'err');
      return;
    }
    let parsed;
    try {
      parsed = parsePrivKey(raw);
    } catch (err) {
      setManualResult(err.message, 'err');
      return;
    }
    setManualResult('Checking…', null);
    try {
      const derived = deriveAll(parsed.privKey);
      const hit = await checkAddress(derived.addressBytes);
      log.append(
        `manual: addr=${shorten(derived.address, 6)} → ${hit ? 'MATCH' : 'no match'}`
      );
      if (hit) {
        setManualResult('🎉 Match! Opening prize dialog…', 'ok');
        settingsDialog.close();
        winDialog.show({ privKey: parsed.privKey, derived, match: hit });
      } else {
        setManualResult(`No match. Address: ${derived.address}`, 'fail');
      }
    } catch (err) {
      setManualResult(`Error: ${err.message}`, 'err');
    }
  }

  manualBtn.addEventListener('click', onManualCheck);
  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onManualCheck();
    }
  });

  const devWin = new URLSearchParams(location.search).get('devwin') === '1';

  let busy = false;
  async function onPull() {
    if (busy) return;
    busy = true;
    pullBtn.disabled = true;
    unlock();
    sfx.lever();
    try {
      await _onPull();
    } catch (err) {
      console.error('spin error:', err);
      log.append(`Error: ${err.message}`);
    } finally {
      busy = false;
      pullBtn.disabled = false;
    }
  }
  async function _onPull() {

    let forced = null;
    if (devWin) {
      const priv = randomPrivKey();
      const derived = deriveAll(priv);
      const fakeMatch = { addressBytes: derived.addressBytes };
      forced = { privKey: priv, match: fakeMatch };
    }

    const reels = realisticMode ? realistic : classic;
    const noDelay = noDelayToggle.checked;

    if (!noDelay) reels.startSpin();

    let result;
    if (noDelay) {
      result = await spin({ devWin: forced });
    } else {
      const spinAnim = new Promise((r) => setTimeout(r, 1100));
      [, result] = await Promise.all([spinAnim, spin({ devWin: forced })]);
    }

    log.append(
      `key=${shorten(result.privKeyHex, 6)} ` +
        `addr=${shorten(result.derived.address, 6)}`
    );

    if (noDelay) {
      if (realisticMode) realistic.flashResult(result.privKeyHex, result.win);
      else classic.flashResult(result.win);
    } else if (realisticMode) {
      await realistic.stopSpin(result.privKeyHex, result.win);
    } else {
      await classic.stopSpin(result.win);
    }

    if (result.win) {
      log.append(`🎉 MATCH: ${result.derived.address} (≥1 ETH)`);
      sfx.win();
      if (autospinToggle.checked) autospinToggle.checked = false;
      winDialog.show(result);
    } else {
      log.append('→ no match');
      sfx.lose();
    }

    if (autospinToggle.checked) {
      const delay = noDelayToggle.checked
        ? AUTOSPIN_DELAY_NO_DELAY_MS
        : AUTOSPIN_DELAY_MS;
      setTimeout(onPull, delay);
    }
  }

  pullBtn.addEventListener('click', onPull);
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (settingsDialog.open || document.getElementById('win-dialog').open) return;
    e.preventDefault();
    onPull();
  });
}

main().catch((err) => {
  console.error(err);
  const log = document.getElementById('log');
  if (log) log.value = `Error: ${err.message}`;
});
