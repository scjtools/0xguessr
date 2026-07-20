# 0xguessr

> **Forked from [SatoshiGuesser](https://github.com/Pathos0925/SatoshiGuesser) by [@Pathos0925](https://github.com/Pathos0925).**
> All slot machine mechanics, animations, audio, UI design, CSS, and architecture are the original work of SatoshiGuesser. This fork ports the concept from Bitcoin to Ethereum — the crypto derivation, wallet database, and copy have been changed; everything else is theirs.

---

A slot-machine web game that "guesses" Ethereum private keys. Every pull
generates a cryptographically random 256-bit number, derives the Ethereum
address, and checks it against a bloom filter of **~1.47 M funded ETH
addresses** (≥ 1 ETH each, refreshed weekly from Google BigQuery). The bloom is
only a pre-filter: on a hit, the game confirms the address's **live on-chain
balance** via a public RPC before ever showing a win — so a win is always real,
never a false positive. If it confirms, the number you rolled *is* the working
private key. The odds are ~1 in 7.87 × 10⁷⁰ per spin.

Key generation and derivation run 100% client-side; no keys leave your browser.
The only network calls are fetching the bloom and, on a hit, a read-only
`eth_getBalance`.

---

## Attribution

This project is a direct fork of **[SatoshiGuesser](https://github.com/Pathos0925/SatoshiGuesser)** by [@Pathos0925](https://github.com/Pathos0925), which does the same thing for Bitcoin / Satoshi Nakamoto's wallets.

The following components are **entirely the work of SatoshiGuesser** and are used here unchanged (or nearly unchanged):

| Component | Files |
|-----------|-------|
| Slot machine animations (classic + hex reel) | `src/ui/slot-classic.js`, `src/ui/slot-realistic.js` |
| Audio engine (lever click, tick, win arpeggio) | `src/audio/audio.js` |
| Bloom filter implementation | `src/game/bloom.js` |
| Win dialog + confetti | `src/ui/win-dialog.js` (structure) |
| Log panel | `src/ui/log.js` |
| All CSS | `src/styles/main.css`, `src/styles/slot.css` |
| Settings panel | `index.html` (settings dialog) |
| Overall app architecture | `src/main.js` (structure), `src/game/spin.js` |

**What this fork changed:**

- Crypto derivation: Bitcoin (secp256k1 → HASH160 → P2PKH → Base58) → Ethereum (secp256k1 uncompressed → keccak256 → last 20 bytes → 0x hex)
- Wallet database: Patoshi Bitcoin addresses → ~1.47 M funded ETH addresses, refreshed weekly from Google BigQuery
- Bloom pre-filter + live on-chain `eth_getBalance` confirmation (a shown win is always real, never a bloom false positive)
- UI copy: title, tagline, stat labels, win dialog text, footer
- Deployment target: Vercel instead of Cloudflare Workers

---

## How it works

1. Click **PULL** (or press Space).
2. A cryptographically random 256-bit integer is generated in your browser.
3. The secp256k1 uncompressed public key is derived, keccak256-hashed, and the last 20 bytes become the Ethereum address.
4. That address is checked against a Bloom filter of 1,471,278 ETH addresses with balance ≥ 1 ETH.
5. A hit means you found a funded wallet — the hex private key is shown so you can sweep it.

---

## Data files

| File | Description |
|------|-------------|
| `public/data/eth_bloom.bin` | Bloom filter — 1,471,278 ETH addresses, m=42,306,856 bits, k=20, p≈10⁻⁶ |
| `public/data/eth_meta.json` | Snapshot metadata (address count, ETH/USD price, snapshot date) |

Sourced from all addresses holding `>= 1 ETH`. Bloom binary format — `BLM\x01`:
4-byte magic + uint32 m + uint32 k + uint32 n + bit array.

### Weekly auto-refresh

`.github/workflows/refresh-bloom.yml` rebuilds these two files every Monday
(06:00 UTC) from a fresh BigQuery pull of every address holding `>= 1 ETH`. It
can also be run manually from the **Actions** tab.

Pipeline: `bq query` on `bigquery-public-data.crypto_ethereum.balances`
([scripts/bq-query.sql](scripts/bq-query.sql)) → `scripts/build-bloom.mjs`
(builds the `BLM\x01` bloom, byte-compatible with `src/game/bloom.js`) → commit
to `main` → purge jsDelivr. A safety floor (`MIN_ADDRESSES`) blocks publishing a
suspiciously small set.

**One-time setup** — a GCP service account with the *BigQuery Job User* role:

| Where | Name | Value |
|-------|------|-------|
| Secrets → Actions | `GCP_SA_KEY` | the service account's JSON key (whole file) |
| Variables → Actions | `GCP_PROJECT_ID` | GCP project id used to bill the query |
| Settings → Actions → General | Workflow permissions | **Read and write** |

To rebuild locally: run [scripts/bq-query.sql](scripts/bq-query.sql) in the
BigQuery console, export the results as CSV, then
`node scripts/build-bloom.mjs results.csv`.

> Note: the client loads the bloom via jsDelivr (`@main`), which caches for a
> while — expect up to ~12 h before a refreshed filter is live for all users.

---

## Development

```bash
git clone https://github.com/scjtools/0xguessr.git
cd 0xguessr
npm install
npm run dev        # http://localhost:5173
```

Add `?devwin=1` to the URL to force a win and verify the win dialog UI.

```bash
npm run build               # production build → dist/
npm test                    # unit tests
node scripts/bench-spin.js  # spin throughput benchmark
```

---

## Deployment (Vercel)

`vercel.json` is preconfigured:

```json
{ "buildCommand": "npm run build", "outputDirectory": "dist" }
```

Import `scjtools/0xguessr` in the Vercel dashboard. Custom domain `0xguessr.sanjaycj.com` is configured via DNS CNAME to Vercel.

---

## Project structure

```
0xguessr/
├── index.html
├── src/
│   ├── main.js                 # app entry point
│   ├── game/
│   │   ├── crypto.js           # ETH derivation: secp256k1 + keccak256  ← changed
│   │   ├── spin.js             # one spin: derive → bloom check          ← changed
│   │   ├── wallets.js          # bloom loader + address checker          ← changed
│   │   └── bloom.js            # bloom filter deserialize + has          (SatoshiGuesser)
│   ├── ui/
│   │   ├── slot-classic.js     # classic 3-reel animation                (SatoshiGuesser)
│   │   ├── slot-realistic.js   # hex reel animation                      (SatoshiGuesser)
│   │   ├── win-dialog.js       # win dialog + confetti                   (SatoshiGuesser)
│   │   └── log.js              # log textarea                            (SatoshiGuesser)
│   ├── audio/
│   │   └── audio.js            # lever / tick / win sounds               (SatoshiGuesser)
│   └── styles/
│       ├── main.css            #                                          (SatoshiGuesser)
│       └── slot.css            #                                          (SatoshiGuesser)
├── public/data/
│   ├── eth_bloom.bin           # pre-built bloom filter (5 MB)           ← new
│   └── eth_meta.json           # snapshot metadata                       ← new
├── scripts/
│   └── bench-spin.js           # throughput benchmark
├── tests/
│   ├── crypto.test.js          # ETH derivation tests                    ← changed
│   ├── spin.test.js            #                                          ← changed
│   └── wallets.test.js         #                                          ← changed
└── vercel.json                 # Vercel deployment config                 ← new
```

---

## License

MIT. See [LICENSE](LICENSE).

Original work © [SatoshiGuesser contributors](https://github.com/Pathos0925/SatoshiGuesser).
Ethereum port by [scjtools](https://github.com/scjtools).
