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
import { recordSpin, getStats, getTier, milestoneMessage } from './ui/stats.js';
import { drawShareCard, downloadCard, copyCardToClipboard } from './ui/share-card.js';
import {
  loadWordlist, getProgress, resetScan, getBip39AllWords, BUILTIN_PHRASES,
} from './game/brain-wallet.js';
import { resetProfanity, getProfanitySeed } from './game/profanity.js';
import { resetPuzzle, getPuzzleCounter } from './game/puzzle.js';
import {
  resetTimestamp, getTimestampProgress, tsToDate, ETH_GENESIS_TS,
} from './game/timestamp-scan.js';
import { resetRandstorm, getRandstormSeed } from './game/randstorm.js';

const AUTOSPIN_DELAY_MS = 250;
const AUTOSPIN_DELAY_NO_DELAY_MS = 16;

// Rolling window for spins/sec calculation
const spinTimes = [];
const RATE_WINDOW_MS = 3000;

function recordSpinTime() {
  const now = Date.now();
  spinTimes.push(now);
  while (spinTimes.length > 0 && spinTimes[0] < now - RATE_WINDOW_MS) spinTimes.shift();
}

function getSpinsPerSec() {
  if (spinTimes.length < 2) return 0;
  const elapsed = spinTimes[spinTimes.length - 1] - spinTimes[0];
  return elapsed > 0 ? ((spinTimes.length - 1) / elapsed) * 1000 : 0;
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast--visible')));
  setTimeout(() => {
    el.classList.remove('toast--visible');
    setTimeout(() => el.remove(), 300);
  }, 4500);
}

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

function updateLiveBar(isAutospinning) {
  const { total = 0 } = getStats();
  document.getElementById('live-spins').textContent =
    `${total.toLocaleString('en-US')} spin${total === 1 ? '' : 's'}`;
  const rateEl  = document.getElementById('live-rate');
  const rateVal = document.getElementById('live-rate-val');
  const rate = getSpinsPerSec();
  if (isAutospinning && rate >= 1) {
    rateVal.textContent = Math.round(rate);
    rateEl.classList.remove('hidden');
  } else {
    rateEl.classList.add('hidden');
  }
}

async function main() {
  // Mode state
  let currentMode = 'random';
  let bipWords = 12;

  const stats = await loadStats();
  loadBloom();

  renderHeaderStats(stats);
  updateLiveBar(false);

  // Mode tabs
  const modeTabs   = document.querySelectorAll('.mode-tab');
  const panelBip       = document.getElementById('panel-bip39');
  const panelBrain     = document.getElementById('panel-brain');
  const panelPuzzle    = document.getElementById('panel-puzzle');
  const panelTimestamp = document.getElementById('panel-timestamp');
  const panelProfanity = document.getElementById('panel-profanity');
  const panelRandstorm = document.getElementById('panel-randstorm');

  const allPanels = {
    bip39:     panelBip,
    brain:     panelBrain,
    puzzle:    panelPuzzle,
    timestamp: panelTimestamp,
    profanity: panelProfanity,
    randstorm: panelRandstorm,
  };

  function setMode(mode) {
    currentMode = mode;
    modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    Object.entries(allPanels).forEach(([k, el]) => { el.hidden = k !== mode; });
  }
  modeTabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));

  // BIP39 word count
  document.querySelectorAll('[name="bip-words"]').forEach(r =>
    r.addEventListener('change', e => { bipWords = parseInt(e.target.value); }));

  // Brain wallet wordlist helpers
  function setWordlistStatus(msg, cls = '') {
    const el = document.getElementById('wordlist-status');
    el.textContent = msg;
    el.className = 'wordlist-status' + (cls ? ' ' + cls : '');
  }

  function applyWordlist(phrases, label) {
    loadWordlist(phrases);
    const { total } = getProgress();
    setWordlistStatus(`Loaded ${total.toLocaleString('en-US')} phrases — ${label}. Ready.`, 'loaded');
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  }

  document.getElementById('preset-bip39-words').addEventListener('click', () => {
    const words = getBip39AllWords();
    applyWordlist(words, 'BIP39 all languages');
    document.getElementById('preset-bip39-words').classList.add('active');
  });

  document.getElementById('preset-common').addEventListener('click', () => {
    applyWordlist(BUILTIN_PHRASES, 'common phrases');
    document.getElementById('preset-common').classList.add('active');
  });

  document.getElementById('wordlist-paste').addEventListener('input', e => {
    const lines = e.target.value.split('\n');
    applyWordlist(lines, 'custom paste');
  });

  // Puzzle controls
  document.getElementById('puzzle-set').addEventListener('click', () => {
    const raw = document.getElementById('puzzle-start').value.trim();
    if (!raw) return;
    try {
      const start = raw.startsWith('0x') || raw.startsWith('0X')
        ? BigInt(raw)
        : /^[0-9]+$/.test(raw) ? BigInt(raw) : BigInt('0x' + raw);
      resetPuzzle(start);
      document.getElementById('puzzle-status').textContent = `Key #${start.toLocaleString ? start : start}`;
    } catch { /* invalid input */ }
  });

  // Timestamp controls
  document.getElementById('ts-set').addEventListener('click', () => {
    const val = document.getElementById('ts-start').value;
    if (!val) return;
    const ts = Math.floor(new Date(val).getTime() / 1000);
    if (isNaN(ts)) return;
    resetTimestamp(ts);
    document.getElementById('ts-status').textContent = tsToDate(ts);
  });

  // Profanity controls
  document.getElementById('profanity-set').addEventListener('click', () => {
    const raw = parseInt(document.getElementById('profanity-start').value, 10);
    const seed = isNaN(raw) ? 0 : Math.max(0, Math.min(raw, 0xFFFFFFFF));
    resetProfanity(seed);
    document.getElementById('profanity-status').textContent =
      `Seed ${seed.toLocaleString('en-US')} / 4,294,967,295`;
  });

  // Randstorm controls
  document.getElementById('randstorm-set').addEventListener('click', () => {
    const raw = parseInt(document.getElementById('randstorm-start').value, 10);
    const seed = isNaN(raw) ? 0 : Math.max(0, Math.min(raw, 0xFFFFFFFF));
    resetRandstorm(seed);
    document.getElementById('randstorm-status').textContent =
      `Seed ${seed.toLocaleString('en-US')} / 4,294,967,295`;
  });

  document.getElementById('wordlist-load-url').addEventListener('click', async () => {
    const url = document.getElementById('wordlist-url').value.trim();
    if (!url) return;
    setWordlistStatus('Fetching…');
    try {
      const text = await fetch(url).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      });
      applyWordlist(text.split('\n'), url.split('/').pop());
    } catch (err) {
      setWordlistStatus(`Failed: ${err.message}`, 'error');
    }
  });

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

  // Share dialog
  const shareBtn      = document.getElementById('share-btn');
  const shareDialog   = document.getElementById('share-dialog');
  const shareCanvas   = document.getElementById('share-canvas');
  const shareDownload = document.getElementById('share-download');
  const shareCopy     = document.getElementById('share-copy');
  const shareClose    = document.getElementById('share-close');

  shareBtn.addEventListener('click', () => {
    const { total = 0 } = getStats();
    drawShareCard(shareCanvas, total);
    shareDialog.showModal();
  });
  shareDownload.addEventListener('click', () => {
    const { total = 0 } = getStats();
    downloadCard(shareCanvas, total);
  });
  shareCopy.addEventListener('click', async () => {
    try {
      await copyCardToClipboard(shareCanvas);
      shareCopy.textContent = '✓ Copied!';
      setTimeout(() => { shareCopy.textContent = '⧉ Copy image'; }, 2000);
    } catch {
      shareCopy.textContent = 'Copy failed';
      setTimeout(() => { shareCopy.textContent = '⧉ Copy image'; }, 2000);
    }
  });
  shareClose.addEventListener('click', () => shareDialog.close());

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

    const spinOpts = { devWin: forced, mode: currentMode, bipWords };
    let result;
    if (noDelay) {
      result = await spin(spinOpts);
    } else {
      const spinAnim = new Promise((r) => setTimeout(r, 1100));
      [, result] = await Promise.all([spinAnim, spin(spinOpts)]);
    }

    // Brain wallet list exhausted
    if (result.exhausted) {
      if (!noDelay) await classic.stopSpin(false);
      log.append('Brain wallet scan complete — list exhausted.');
      if (autospinToggle.checked) autospinToggle.checked = false;
      return;
    }

    recordSpinTime();
    const { total, milestone } = recordSpin();
    updateLiveBar(autospinToggle.checked);
    if (milestone) showToast(milestoneMessage(milestone));

    // Mode-specific log line
    let logLine;
    if (result.mnemonic) {
      logLine = `[${result.mnemonic}] addr=${shorten(result.derived.address, 6)}`;
    } else if (result.phrase != null) {
      logLine = `"${result.phrase}" → ${shorten(result.derived.address, 6)}`;
    } else if (result.mode === 'profanity') {
      const s = result.meta.seed;
      document.getElementById('profanity-status').textContent =
        `Seed ${s.toLocaleString('en-US')} / 4,294,967,295`;
      logLine = `[profanity s=${s}] addr=${shorten(result.derived.address, 6)}`;
    } else if (result.mode === 'puzzle') {
      const idx = result.meta.index;
      document.getElementById('puzzle-status').textContent = `Key #${idx}`;
      logLine = `[key #${idx}] addr=${shorten(result.derived.address, 6)}`;
    } else if (result.mode === 'timestamp') {
      const d = tsToDate(result.meta.ts);
      document.getElementById('ts-status').textContent = d;
      logLine = `[${d}] addr=${shorten(result.derived.address, 6)}`;
    } else if (result.mode === 'randstorm') {
      const s = result.meta.seed;
      document.getElementById('randstorm-status').textContent =
        `Seed ${s.toLocaleString('en-US')} / 4,294,967,295`;
      logLine = `[randstorm s=${s}] addr=${shorten(result.derived.address, 6)}`;
    } else {
      logLine = `key=${shorten(result.privKeyHex, 6)} addr=${shorten(result.derived.address, 6)}`;
    }
    log.append(logLine);

    if (noDelay) {
      if (realisticMode) realistic.flashResult(result.privKeyHex, result.win);
      else classic.flashResult(result.win);
    } else if (realisticMode) {
      await realistic.stopSpin(result.privKeyHex, result.win);
    } else {
      await classic.stopSpin(result.win);
    }

    if (result.win) {
      const winLabel = result.phrase
        ? `brain wallet phrase: "${result.phrase}"`
        : result.mnemonic
          ? `BIP39: [${result.mnemonic}]`
          : `key: ${result.privKeyHex}`;
      log.append(`🎉 MATCH: ${result.derived.address} (≥1 ETH) — ${winLabel}`);
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
