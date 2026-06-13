# 0xguessr

A slot-machine web game that "guesses" Ethereum private keys. The odds are
astronomically remote (~1 in 7.87 × 10⁷⁰ per spin), but the cryptography is
real: every pull rolls a random 256-bit number, derives the Ethereum address
via secp256k1 → keccak256 → last 20 bytes, and checks it against a set of
1.47 million funded ETH addresses (≥1 ETH each). If the derived address ever
matches, the random number you rolled **is** the working private key for that
wallet — no server, no API, no catch.

Live at **[github.com/scjtools/0xguessr](https://github.com/scjtools/0xguessr)**

---

## How it works

1. Click **PULL** (or press Space).
2. A cryptographically random 256-bit integer is generated in your browser.
3. The secp256k1 uncompressed public key is derived, then keccak256-hashed,
   and the last 20 bytes become the Ethereum address.
4. That address is checked against a Bloom filter of ~1.47 M funded ETH
   addresses (balance ≥ 1 ETH, sourced from Google BigQuery).
5. A Bloom hit means you found a funded wallet. The hex private key is
   displayed so you can sweep it immediately.

Everything runs 100% client-side. No keys leave your browser.

---

## Data files

| File | Description |
|------|-------------|
| `public/data/eth_bloom.bin` | Bloom filter — 1,471,278 ETH addresses, m=42,306,856 bits, k=20, p≈10⁻⁶ |
| `public/data/eth_meta.json` | Snapshot metadata (address count, ETH price, date) |

The bloom filter was built from `crypto_ethereum.balances` on Google BigQuery
(`eth_balance >= 1000000000000000000`, i.e. ≥ 1 ETH). The binary format is
`BLM\x01`: 4-byte magic + uint32 m + uint32 k + uint32 n + bit array.

---

## Development

```bash
git clone https://github.com/scjtools/0xguessr.git
cd 0xguessr
npm install
npm run dev        # http://localhost:5173
```

Add `?devwin=1` to the URL to force a win and test the win dialog UI.

### Scripts

```bash
npm run build      # production build → dist/
npm test           # unit tests (crypto derivation, bloom)
node scripts/bench-spin.js  # spin throughput benchmark
```

---

## Deployment (Vercel)

`vercel.json` is already configured:

```json
{ "buildCommand": "npm run build", "outputDirectory": "dist" }
```

Import `scjtools/0xguessr` in the Vercel dashboard — no extra config needed.

---

## Project structure

```
0xguessr/
├── index.html
├── src/
│   ├── main.js               # app entry point
│   ├── game/
│   │   ├── crypto.js         # ETH key derivation (secp256k1 + keccak256)
│   │   ├── spin.js           # one spin: derive → check
│   │   ├── wallets.js        # bloom loader + address checker
│   │   └── bloom.js          # bloom filter (deserialize + has)
│   ├── ui/
│   │   ├── slot-classic.js   # classic 3-reel animation
│   │   ├── slot-realistic.js # hex reel animation
│   │   ├── win-dialog.js     # win dialog + confetti
│   │   └── log.js            # log textarea
│   ├── audio/
│   │   └── audio.js          # lever / tick / win sounds
│   └── styles/
│       ├── main.css
│       └── slot.css
├── public/data/
│   ├── eth_bloom.bin         # pre-built bloom filter (5 MB)
│   └── eth_meta.json         # snapshot metadata
├── scripts/
│   └── bench-spin.js         # throughput benchmark
├── tests/
│   ├── crypto.test.js
│   ├── spin.test.js
│   └── wallets.test.js
└── vercel.json
```

---

Inspired by [SatoshiGuesser](https://github.com/Pathos0925/SatoshiGuesser).
