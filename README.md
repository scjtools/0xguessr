# 0xguessr

> **Forked from [SatoshiGuesser](https://github.com/Pathos0925/SatoshiGuesser) by [@Pathos0925](https://github.com/Pathos0925).**
> All slot machine mechanics, animations, audio, UI design, CSS, and architecture are the original work of SatoshiGuesser. This fork ports the concept from Bitcoin to Ethereum — the crypto derivation, wallet database, and copy have been changed; everything else is theirs.

---

A slot-machine web game that "guesses" Ethereum private keys. Every pull
generates a cryptographically random 256-bit number, derives the Ethereum
address, and checks it against a bloom filter of **1,471,278 funded ETH
addresses** (≥ 1 ETH each, sourced from Google BigQuery). If the derived
address ever matches, the number you rolled *is* the working private key — no
server, no API, no catch. The odds are ~1 in 7.87 × 10⁷⁰ per spin.

Everything runs 100% client-side. No keys leave your browser.

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
- Wallet database: Patoshi Bitcoin addresses → 1.47 M funded ETH addresses from BigQuery
- Bloom-only check (no sorted balance table — ETH bloom stores existence, not amount)
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

Sourced from `bigquery-public-data.crypto_ethereum.balances` with filter
`eth_balance >= 1000000000000000000` (≥ 1 ETH). Snapshot: 2026-06-13.

Bloom binary format — `BLM\x01`: 4-byte magic + uint32 m + uint32 k + uint32 n + bit array.

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

Import `scjtools/0xguessr` in the Vercel dashboard — no further config needed.

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
