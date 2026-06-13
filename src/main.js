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
import { resetProfanity, getProfanitySeed } from './game/profanity.js';
import { resetPuzzle, getPuzzleCounter } from './game/puzzle.js';
import {
  resetTimestamp, getTimestampProgress, tsToDate, ETH_GENESIS_TS,
} from './game/timestamp-scan.js';
import { resetRandstorm, getRandstormSeed } from './game/randstorm.js';
import { resetLibbitcoin, getLibbitcoinSeed } from './game/libbitcoin.js';
import {
  loadCrosschainKeys, getCrosschainProgress, resetCrosschain, BUILTIN_CROSSCHAIN_KEYS,
} from './game/crosschain.js';
import {
  findNonceReuse, recoverPrivKey, legacySigningHash, bytesToBigInt,
  verifyPrivKey, bigIntToBytes32,
} from './game/ecdsa-nonce.js';
import { latticeAttack } from './game/lattice.js';

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
  const panelRandom    = document.getElementById('panel-random');
  const panelBip       = document.getElementById('panel-bip39');
  const panelPuzzle    = document.getElementById('panel-puzzle');
  const panelTimestamp = document.getElementById('panel-timestamp');
  const panelProfanity = document.getElementById('panel-profanity');
  const panelRandstorm  = document.getElementById('panel-randstorm');
  const panelLibbitcoin = document.getElementById('panel-libbitcoin');
  const panelCrosschain = document.getElementById('panel-crosschain');
  const panelEcdsa      = document.getElementById('panel-ecdsa');
  const panelLattice    = document.getElementById('panel-lattice');

  const allPanels = {
    random:    panelRandom,
    bip39:     panelBip,
    puzzle:    panelPuzzle,
    timestamp: panelTimestamp,
    profanity: panelProfanity,
    randstorm: panelRandstorm,
    libbitcoin: panelLibbitcoin,
    crosschain: panelCrosschain,
    ecdsa:      panelEcdsa,
    lattice:    panelLattice,
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

  // Libbitcoin controls
  document.getElementById('libbitcoin-set').addEventListener('click', () => {
    const raw = parseInt(document.getElementById('libbitcoin-start').value, 10);
    const seed = isNaN(raw) ? 0 : Math.max(0, Math.min(raw, 0xFFFFFFFF));
    resetLibbitcoin(seed);
    document.getElementById('libbitcoin-status').textContent =
      `Seed ${seed.toLocaleString('en-US')} / 4,294,967,295`;
  });

  // Cross-chain controls
  function loadCCKeys(keys) {
    loadCrosschainKeys(keys);
    const { total } = getCrosschainProgress();
    document.getElementById('cc-status').textContent =
      `${total.toLocaleString('en-US')} key${total === 1 ? '' : 's'} loaded.`;
  }

  document.getElementById('cc-preset-builtin').addEventListener('click', () => {
    loadCCKeys(BUILTIN_CROSSCHAIN_KEYS);
  });

  document.getElementById('cc-paste').addEventListener('input', (e) => {
    const lines = e.target.value.split('\n').filter(l => l.trim());
    if (lines.length) loadCCKeys(lines);
  });

  document.getElementById('cc-load-url').addEventListener('click', async () => {
    const url = document.getElementById('cc-url').value.trim();
    if (!url) return;
    document.getElementById('cc-status').textContent = 'Fetching…';
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      loadCCKeys(text.split('\n'));
    } catch (err) {
      document.getElementById('cc-status').textContent = `Error: ${err.message}`;
    }
  });

  // ECDSA nonce-reuse analysis
  function analysisLog(containerEl, message, kind = '') {
    containerEl.hidden = false;
    const line = document.createElement('div');
    if (kind) line.className = `log-${kind}`;
    line.textContent = message;
    containerEl.appendChild(line);
    containerEl.scrollTop = containerEl.scrollHeight;
  }

  document.getElementById('ecdsa-analyze').addEventListener('click', async () => {
    const apiKey  = document.getElementById('ecdsa-apikey').value.trim();
    const address = document.getElementById('ecdsa-address').value.trim();
    const statusEl = document.getElementById('ecdsa-status');
    const logEl    = document.getElementById('ecdsa-log');

    if (!address) { statusEl.textContent = 'Enter an ETH address.'; return; }
    logEl.innerHTML = '';
    logEl.hidden = false;
    statusEl.textContent = 'Fetching transactions…';

    const key = apiKey || 'YourApiKeyToken';
    const url = `https://api.etherscan.io/api?module=account&action=txlist`
      + `&address=${address}&startblock=0&endblock=99999999`
      + `&page=1&offset=10000&sort=asc&apikey=${key}`;

    let txList;
    try {
      const resp = await fetch(url);
      const json = await resp.json();
      if (json.status !== '1') throw new Error(json.message || json.result);
      txList = json.result.filter(tx => tx.from.toLowerCase() === address.toLowerCase());
      analysisLog(logEl, `Fetched ${txList.length} outbound transactions.`);
    } catch (err) {
      statusEl.textContent = `Fetch error: ${err.message}`;
      analysisLog(logEl, `Error: ${err.message}`, 'err');
      return;
    }

    const collisions = findNonceReuse(txList);
    analysisLog(logEl, `Checked r values — ${collisions.length} collision group(s) found.`);

    if (collisions.length === 0) {
      statusEl.textContent = 'No nonce reuse detected in this address.';
      return;
    }

    for (const group of collisions) {
      for (let i = 0; i < group.length - 1; i++) {
        const tx1 = group[i], tx2 = group[i + 1];
        analysisLog(logEl, `r collision: ${tx1.hash.slice(0, 12)}… and ${tx2.hash.slice(0, 12)}…`);

        // Only handle legacy (type 0) txs — need RLP for signing hash
        const type1 = tx1.txreceipt_status !== undefined ? (parseInt(tx1.type || '0', 16)) : 0;
        const type2 = tx2.txreceipt_status !== undefined ? (parseInt(tx2.type || '0', 16)) : 0;
        if (type1 !== 0 || type2 !== 0) {
          analysisLog(logEl, 'Non-legacy transaction type — cannot compute signing hash via RLP.', 'err');
          continue;
        }

        let h1Bytes, h2Bytes;
        try {
          h1Bytes = legacySigningHash(tx1);
          h2Bytes = legacySigningHash(tx2);
        } catch (e) {
          analysisLog(logEl, `Signing hash error: ${e.message}`, 'err');
          continue;
        }

        const h1 = bytesToBigInt(h1Bytes);
        const h2 = bytesToBigInt(h2Bytes);
        const r  = BigInt(tx1.r);
        const s1 = BigInt(tx1.s);
        const s2 = BigInt(tx2.s);

        const privKeyBig = recoverPrivKey(r, s1, h1, s2, h2);
        if (!privKeyBig) {
          analysisLog(logEl, 'Key recovery returned null (identical signatures?).', 'err');
          continue;
        }

        const verified = verifyPrivKey(privKeyBig, address);
        if (verified) {
          const privBytes = bigIntToBytes32(privKeyBig);
          const privHex = Array.from(privBytes).map(b => b.toString(16).padStart(2, '0')).join('');
          analysisLog(logEl, `KEY RECOVERED: 0x${privHex}`, 'ok');
          statusEl.textContent = 'Private key recovered!';
          const derived = deriveAll(privBytes);
          winDialog.show({ privKey: privBytes, privKeyHex: privHex, derived, match: { addressBytes: derived.addressBytes } });
        } else {
          analysisLog(logEl, 'Recovery produced a candidate but address mismatch — try other sig pair.', 'err');
        }
      }
    }

    if (collisions.length > 0 && document.getElementById('ecdsa-log').children.length > 1) {
      statusEl.textContent = 'Analysis complete. See log above.';
    }
  });

  // Lattice attack
  document.getElementById('lattice-run').addEventListener('click', () => {
    const address  = document.getElementById('lattice-address').value.trim();
    const biasRaw  = document.getElementById('lattice-bias').value.trim();
    const sigsRaw  = document.getElementById('lattice-sigs').value.trim();
    const statusEl = document.getElementById('lattice-status');
    const logEl    = document.getElementById('lattice-log');

    logEl.innerHTML = '';
    logEl.hidden = false;

    if (!address) { statusEl.textContent = 'Enter the ETH address to verify the key against.'; return; }
    if (!sigsRaw) { statusEl.textContent = 'Paste a JSON array of signatures.'; return; }

    let rawSigs;
    try {
      rawSigs = JSON.parse(sigsRaw);
      if (!Array.isArray(rawSigs)) throw new Error('Expected a JSON array.');
    } catch (e) {
      statusEl.textContent = `JSON parse error: ${e.message}`;
      return;
    }

    const sigs = rawSigs.map((s, i) => {
      const hash = typeof s.hash === 'string' ? BigInt(s.hash) : BigInt(s.hash);
      const r    = typeof s.r   === 'string' ? BigInt(s.r)    : BigInt(s.r);
      const sv   = typeof s.s   === 'string' ? BigInt(s.s)    : BigInt(s.s);
      return { hash, r, s: sv };
    });

    const bias = biasRaw ? parseInt(biasRaw, 10) : null;
    analysisLog(logEl, `Running LLL on ${sigs.length} signature(s), bias=${bias ?? 'auto'}…`);
    statusEl.textContent = 'Running… (this may take several seconds)';

    // Run in a macrotask so the UI updates first
    setTimeout(() => {
      try {
        const result = latticeAttack(sigs, address, bias);
        if (result.error) {
          analysisLog(logEl, result.error, 'err');
          statusEl.textContent = 'No key found.';
        } else {
          const privHex = Array.from(result.privKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
          analysisLog(logEl, `KEY RECOVERED (bias=${result.biasBits}b, ${result.sigsUsed} sigs): 0x${privHex}`, 'ok');
          statusEl.textContent = 'Private key recovered!';
          const derived = deriveAll(result.privKeyBytes);
          winDialog.show({ privKey: result.privKeyBytes, privKeyHex: privHex, derived, match: { addressBytes: derived.addressBytes } });
        }
      } catch (e) {
        analysisLog(logEl, `Error: ${e.message}`, 'err');
        statusEl.textContent = 'Error during lattice reduction.';
      }
    }, 0);
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

    // Scan mode exhausted
    if (result.exhausted) {
      if (!noDelay) reels.stopSpin(false);
      const exhaustedLabels = {
        profanity:  'Profanity scan complete — all 4,294,967,296 seeds checked.',
        timestamp:  'Timestamp scan complete — range exhausted.',
        randstorm:  'Randstorm scan complete — all 4,294,967,296 seeds checked.',
        libbitcoin: 'Libbitcoin scan complete — all 4,294,967,296 seeds checked.',
        crosschain: 'Cross-chain scan complete — list exhausted.',
      };
      log.append(exhaustedLabels[currentMode] || 'Scan complete.');
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
    } else if (result.mode === 'libbitcoin') {
      const s = result.meta.seed;
      document.getElementById('libbitcoin-status').textContent =
        `Seed ${s.toLocaleString('en-US')} / 4,294,967,295`;
      logLine = `[libbitcoin s=${s}] addr=${shorten(result.derived.address, 6)}`;
    } else if (result.mode === 'crosschain') {
      const { current, total } = getCrosschainProgress();
      document.getElementById('cc-status').textContent =
        `${current.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} keys checked`;
      logLine = `[cross-chain ${result.meta.keyHex.slice(0, 8)}…] addr=${shorten(result.derived.address, 6)}`;
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
      const winLabel = result.mnemonic
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
