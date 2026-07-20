// Content for the dedicated attack-vector pages (/<slug>). Edit here, then run
// `node scripts/gen-pages.mjs` to regenerate the HTML. Keep prose accurate;
// sources are linked inline.

export const ATTACKS = [
  {
    slug: 'random',
    mode: 'random',
    nav: 'Random',
    title: 'Can You Guess a Random Ethereum Private Key? | 0xguessr',
    desc: 'A random Ethereum private key is a 256-bit number — one of 2^256 (~1.16×10^77) possibilities. Here is exactly why brute-forcing it is physically impossible.',
    h1: 'Guessing a random Ethereum private key',
    lede: 'The purest attack — and the one that can never work. Generate a random 256-bit number, derive its address, and hope it holds funds. Here is the math that makes it hopeless.',
    body: `
      <h2>How it works</h2>
      <p>An Ethereum private key is simply a random integer between 1 and roughly 1.16 × 10<sup>77</sup> (that is 2<sup>256</sup>). The "Random" mode generates one using your browser's <code>window.crypto.getRandomValues()</code> — the same cryptographically-secure generator that protects your bank's TLS connection — then derives the address: multiply against the secp256k1 curve to get a public key, hash it with Keccak-256, and take the last 20 bytes.</p>
      <p>That derived address is checked against a Bloom filter of ~1.5 million addresses that currently hold at least 1 ETH. A hit is confirmed with a live on-chain balance call before anything is declared a win.</p>

      <h2>Why it is physically impossible to brute-force</h2>
      <p>2<sup>256</sup> is not just a big number — it is a number that defeats brute force at the level of physics:</p>
      <ul>
        <li>There are an estimated 10<sup>78</sup>–10<sup>82</sup> atoms in the observable universe. The keyspace is on that same scale.</li>
        <li>If all 8 billion people each ran a billion GPUs checking a trillion keys per second since the Big Bang, they would have covered far less than a quadrillionth of a quadrillionth of the space.</li>
        <li>By Landauer's limit, merely <em>counting</em> to 2<sup>256</sup> on the most efficient computer physically possible would require more energy than boiling every ocean on Earth many times over.</li>
      </ul>
      <p>Crucially, there is no strategy that beats uniform randomness. Every key is equally likely, so no ordering, pattern, or heuristic improves your odds above the base rate.</p>

      <h2>The real lesson</h2>
      <p>Because pure guessing is hopeless, every real-world wallet theft has instead attacked <strong>how a key was generated or used</strong> — weak randomness, reused numbers, or human-chosen secrets. Those are the other modes in this game, and each is a genuine, documented failure.</p>
    `,
  },

  {
    slug: 'bip39',
    mode: 'bip39',
    nav: 'BIP39',
    title: 'How BIP39 Seed Phrases Work (and Where They Break) | 0xguessr',
    desc: 'BIP39 turns 12 or 24 words into an Ethereum key via PBKDF2, BIP32 and BIP44. Learn how seed phrases work — and why weak entropy, not the words, is the real risk.',
    h1: 'BIP39 seed phrases: how 12 or 24 words become a key',
    lede: 'Every hardware wallet — Ledger, Trezor, MetaMask — hands you a list of words. Those words are not the key; they are a human-readable encoding of the entropy behind it.',
    body: `
      <h2>How BIP39 works, step by step</h2>
      <ol>
        <li><strong>Entropy.</strong> The wallet generates 128 bits of randomness (for 12 words) or 256 bits (for 24 words).</li>
        <li><strong>Checksum + words.</strong> A few bits of SHA-256 checksum are appended, and the result is sliced into 11-bit chunks. Each chunk indexes into a fixed list of <strong>2,048 words</strong>. That is why a valid phrase must come from that exact list, and why a wrong word is usually detected.</li>
        <li><strong>Seed.</strong> The words are stretched through <strong>2,048 rounds of PBKDF2-HMAC-SHA512</strong> (with an optional passphrase) into a 512-bit seed. This is BIP39.</li>
        <li><strong>Derivation.</strong> BIP32 turns the seed into a hierarchical tree of keys, and BIP44 selects the standard Ethereum path <code>m/44'/60'/0'/0/0</code>.</li>
      </ol>

      <h2>Same odds as "Random"</h2>
      <p>A 12-word phrase encodes exactly 128 bits of entropy; a 24-word phrase encodes 256. Guessing a valid, funded phrase is therefore mathematically identical to guessing a random key — 1 in 2<sup>128</sup> or 2<sup>256</sup>. The words make the secret memorable, not weaker.</p>

      <h2>Where BIP39 actually breaks</h2>
      <p>The danger is never the standard — it is the <strong>entropy fed into step 1</strong>. If a wallet's random number generator is broken, a beautiful 24-word phrase can carry far less than 256 bits of real randomness. That is exactly what happened with <a href="/randstorm">Randstorm</a> and <a href="/libbitcoin">Milk Sad</a>, where seemingly-strong mnemonics were brute-forced because the underlying entropy had collapsed to 32 bits.</p>
      <p>Other real risks: writing a phrase into a networked device, using a weak custom passphrase, or trusting a wallet with an unaudited RNG.</p>
    `,
  },

  {
    slug: 'puzzle',
    mode: 'puzzle',
    nav: 'Puzzle',
    title: 'Sequential & Puzzle Keys: The Bitcoin Puzzle Transaction | 0xguessr',
    desc: 'Low-numbered private keys map to real, long-emptied addresses. Learn about sequential key scanning and the 2015 Bitcoin Puzzle Transaction still worth ~950+ BTC.',
    h1: 'Sequential and puzzle keys',
    lede: 'Private keys 1, 2, 3… correspond to real Ethereum and Bitcoin addresses. The lowest ones have been swept countless times — but a famous puzzle keeps the high end interesting.',
    body: `
      <h2>Scanning from key #1</h2>
      <p>Private key <code>0x0000…0001</code> is a valid key that controls a real address. So does #2, #3, and so on. These low keys have been discovered and emptied by researchers and bots many times over; anything sent to them is swept within seconds. The interesting question is how far up anyone has actually searched.</p>

      <h2>The Bitcoin Puzzle Transaction (2015)</h2>
      <p>In January 2015, an anonymous creator sent Bitcoin to 256 addresses whose private keys have deliberately increasing bit-length: puzzle #1 uses a 1-bit key, #2 a 2-bit key, up to #256. It was built as a public benchmark for how far key-search technology has progressed. In April 2023 the prizes were raised roughly tenfold; the outstanding bounty now totals on the order of <strong>~950–990 BTC</strong>.</p>
      <p>Keys up to about #70 have been solved, along with several higher ones. The active frontier is puzzle <strong>#71</strong> and above. For puzzles where the public key is exposed, solvers use <strong>Pollard's kangaroo</strong> and <strong>baby-step giant-step</strong> algorithms to search a known, bounded range far faster than blind brute force.</p>
      <p>A recurring twist: when a solver broadcasts their claim, the key is briefly visible in the mempool, and front-running bots have stolen prizes — as happened on puzzles #66 and #69.</p>
      <ul>
        <li><a href="https://privatekeys.pw/puzzles/bitcoin-puzzle-tx" target="_blank" rel="noopener">privatekeys.pw — puzzle tracker</a></li>
        <li><a href="https://btcpuzzle.info/" target="_blank" rel="noopener">btcpuzzle.info — live status</a></li>
      </ul>

      <h2>Why full sequential scanning fails</h2>
      <p>Bounded ranges with exposed public keys are tractable. Scanning the <em>entire</em> 2<sup>256</sup> space sequentially is not — you would exhaust the universe's energy budget long before reaching any funded modern wallet.</p>
    `,
  },

  {
    slug: 'timestamp',
    mode: 'timestamp',
    nav: 'Timestamp',
    title: 'Timestamp-Seeded Keys: When Time Is the Only Entropy | 0xguessr',
    desc: 'Naive wallet scripts sometimes seed keys with the current time, shrinking the keyspace to a few hundred million values. Here is how time-based key generation gets cracked.',
    h1: 'Timestamp-seeded keys',
    lede: 'Some early scripts generated keys from the clock — sha256(timestamp) or an RNG seeded with the time. That turns 2^256 possibilities into merely "how many seconds are there?"',
    body: `
      <h2>How it works</h2>
      <p>If a key is derived from the moment it was created — for example <code>sha256(Date.now())</code> or a generator seeded with <code>time()</code> — then the only unknown is <em>when</em> the wallet was made. Scan every second from Ethereum's genesis (30 July 2015) to today and you have covered every possibility: only a few hundred million values, checkable in minutes.</p>
      <p>This mode scans exactly that: one candidate key per second across the chain's lifetime, hashing the decimal timestamp string the way naive scripts did.</p>

      <h2>Why it is a real risk</h2>
      <p>Time is the classic "looks random but isn't" seed. It appears unpredictable to a human but is trivially enumerable for a machine, and an attacker who knows roughly when a wallet was created can narrow the range even further. The catastrophic <a href="/libbitcoin">Milk Sad</a> vulnerability was fundamentally this mistake — a Mersenne Twister seeded with the system time — dressed up behind a respectable-looking mnemonic.</p>

      <h2>The defense</h2>
      <p>Never seed key material from the clock, a counter, or any low-entropy source. Use a cryptographically-secure RNG that draws from the operating system's entropy pool (<code>getrandom</code>, <code>/dev/urandom</code>, <code>crypto.getRandomValues</code>).</p>
    `,
  },

  {
    slug: 'profanity',
    mode: 'profanity',
    nav: 'Profanity',
    title: 'Profanity Vanity-Address Flaw & the $160M Wintermute Hack | 0xguessr',
    desc: 'The Profanity vanity-address tool seeded its RNG with just 32 bits, making every key it produced brute-forceable. It caused the $160M Wintermute hack in 2022.',
    h1: 'Profanity: the vanity-address flaw behind the $160M Wintermute hack',
    lede: 'Profanity generated custom "vanity" addresses with chosen prefixes. Its fatal flaw: every key it ever produced came from only 2^32 possibilities — and the process was reversible.',
    body: `
      <div class="case">
        <div class="meta">
          <span><b>Disclosed:</b> Sep 2022, by 1inch</span>
          <span><b>Headline loss:</b> $160M (Wintermute)</span>
          <span><b>Effective keyspace:</b> 2<sup>32</sup></span>
        </div>
      </div>

      <h2>How the flaw worked</h2>
      <p>Profanity let users brute-force pretty addresses — say, one starting with seven zeros. To do that quickly it seeded a 256-bit <code>mt19937_64</code> generator with a single 32-bit value from <code>random_device</code>. That means every private key it ever produced traces back to one of only <strong>2<sup>32</sup> ≈ 4.3 billion</strong> seeds. Worse, the generator's steps are reversible, so an attacker can start from any Profanity-generated <em>public</em> address and walk backwards to the seed, then forwards to the private key.</p>

      <h2>The Wintermute hack</h2>
      <p>In September 2022, the market-maker <strong>Wintermute</strong> lost about $160 million. The attacker cracked a Profanity-generated admin wallet with a seven-zero vanity address. Wintermute had moved funds out of the hot wallet after 1inch published the flaw, but failed to revoke the wallet's admin permissions over their vault — so the recovered key was still enough to drain it.</p>
      <p><a href="https://medium.com/amber-group/exploiting-the-profanity-flaw-e986576de7ab" target="_blank" rel="noopener">Amber Group's technical breakdown →</a></p>

      <h2>The defense</h2>
      <p>Any address ever generated by Profanity should be considered compromised — move all funds and revoke every permission it holds. Vanity addresses are fine in principle, but only from a tool that draws full 256-bit entropy from a secure RNG.</p>
    `,
  },

  {
    slug: 'randstorm',
    mode: 'randstorm',
    nav: 'Randstorm',
    title: 'Randstorm: Millions of 2011–2015 Bitcoin Wallets at Risk | 0xguessr',
    desc: 'Randstorm is a flaw in the BitcoinJS library used by millions of 2011–2015 web wallets. Weak browser randomness collapsed key entropy to as little as 48 bits.',
    h1: 'Randstorm: the BitcoinJS wallets of 2011–2015',
    lede: 'A combination of a weak JavaScript RNG and a popular wallet library left millions of early web wallets — worth over a billion dollars — with dangerously guessable keys.',
    body: `
      <div class="case">
        <div class="meta">
          <span><b>Disclosed:</b> Nov 2023, by Unciphered</span>
          <span><b>Estimated exposure:</b> ~1.4M BTC</span>
          <span><b>Effective entropy:</b> as low as ~48 bits</span>
        </div>
      </div>

      <h2>How the entropy collapsed</h2>
      <p>Millions of wallets from 2011–2015 (including many created on blockchain.info) were built with the <strong>BitcoinJS</strong> library. It relied on JSBN's <code>SecureRandom()</code>, which in the browsers of that era fell back to <code>Math.random()</code>. Chrome/V8 then implemented <code>Math.random()</code> as <strong>MWC1616</strong>, seeded with only 32 bits, and the way the entropy pool was filled and RC4-scrambled reduced real randomness further — to as little as 48 bits. That is well within reach of a determined attacker.</p>
      <p>Unciphered demonstrated recovering live keys. Wallets generated before March 2012 are the easiest to attack; later ones added more entropy but remained weaker than intended. This mode replays the MWC1616 → pool → RC4 pipeline across all 2<sup>32</sup> seeds.</p>

      <h2>The defense</h2>
      <p>If you hold funds in a wallet created between 2011 and 2015 through a browser-based service, treat the keys as potentially exposed and migrate the funds to a freshly-generated wallet from modern, audited software.</p>
      <p><a href="https://www.unciphered.com/disclosure-of-vulnerable-bitcoin-wallet-library-2/" target="_blank" rel="noopener">Unciphered's Randstorm disclosure →</a></p>
    `,
  },

  {
    slug: 'libbitcoin',
    mode: 'libbitcoin',
    nav: 'Libbitcoin',
    title: 'Milk Sad (CVE-2023-39910): The Libbitcoin bx seed Flaw | 0xguessr',
    desc: 'Milk Sad (CVE-2023-39910) is a weak-entropy flaw in Libbitcoin Explorer\'s bx seed. It seeded a 32-bit Mersenne Twister with system time, collapsing the keyspace to 2^32.',
    h1: 'Milk Sad (CVE-2023-39910): the bx seed disaster',
    lede: 'A command-line tool featured in the book Mastering Bitcoin generated "random" seeds from the clock — reducing any wallet it created to 4.3 billion guessable possibilities.',
    body: `
      <div class="case">
        <div class="meta">
          <span><b>Exploited:</b> Jun–Jul 2023</span>
          <span><b>Wallets affected:</b> 2,600+</span>
          <span><b>Losses:</b> ~$900k</span>
        </div>
      </div>

      <h2>How it worked</h2>
      <p>The <code>bx seed</code> command in <strong>Libbitcoin Explorer 3.0.0–3.6.0</strong> generated seed entropy by seeding a standard 32-bit <strong>MT19937</strong> Mersenne Twister with the current system time. Regardless of how long the resulting mnemonic looked, its true entropy was only <strong>2<sup>32</sup> ≈ 4.3 billion</strong> possibilities — brute-forceable on a single laptop in days. The vulnerability's name comes from the first mnemonic the broken generator produces: "milk sad…".</p>

      <h2>The impact</h2>
      <p>Researchers confirmed the flaw affected 2,600+ wallets across multiple chains and tied it to real thefts totalling roughly $900k. Because <code>bx</code> was a respected, widely-cited tool, victims had no reason to suspect their carefully-backed-up seed phrases were worthless.</p>

      <h2>The defense</h2>
      <p>Any wallet created with a vulnerable <code>bx seed</code> must be abandoned and its funds moved. More broadly: never trust a seed generator that uses a non-cryptographic PRNG (like a plain Mersenne Twister) or seeds from the clock.</p>
      <p><a href="https://milksad.info/" target="_blank" rel="noopener">The Milk Sad disclosure →</a> · <a href="https://nvd.nist.gov/vuln/detail/CVE-2023-39910" target="_blank" rel="noopener">CVE-2023-39910</a></p>
    `,
  },

  {
    slug: 'cross-chain',
    mode: 'crosschain',
    nav: 'Cross-chain',
    title: 'Cross-Chain Key Reuse: One Key, Many Blockchains | 0xguessr',
    desc: 'The same private key controls a different address on Bitcoin and Ethereum. If a key leaks on one chain, funds on every other chain that reused it are exposed too.',
    h1: 'Cross-chain key reuse',
    lede: 'A private key is just a number. The same number produces a Bitcoin address and an Ethereum address. Expose it once, anywhere, and every chain that reused it is open.',
    body: `
      <h2>How it works</h2>
      <p>Bitcoin and Ethereum both use the secp256k1 curve; they only differ in how the public key is turned into an address. So a single 256-bit private key controls one address on Bitcoin and a different one on Ethereum — but it is the <em>same secret</em>. If that secret was ever exposed on Bitcoin — through nonce reuse, a weak RNG, or being published in security research — then the corresponding Ethereum address is equally open, even if no one has looked there yet.</p>
      <p>This mode takes a list of private keys known to be compromised on Bitcoin (puzzle keys, published research keys, nonce-reuse victims) and checks whether the same key ever held ETH.</p>

      <h2>Why it happens</h2>
      <p>People reuse keys for convenience, or import a Bitcoin wallet into a multi-chain tool without realising the key is shared. Thousands of keys have been published over the years in write-ups and datasets; any funds sent to their Ethereum addresses can be swept by anyone watching.</p>

      <h2>The defense</h2>
      <p>Never reuse a private key across chains, and never import a key that has ever been exposed anywhere. Generate fresh, independent keys per wallet, and treat any key that has appeared in public — even years ago on a different chain — as permanently burned.</p>
    `,
  },

  {
    slug: 'ecdsa-reuse',
    mode: 'ecdsa',
    nav: 'ECDSA Reuse',
    title: 'ECDSA Nonce Reuse: How One Repeated Number Leaks a Key | 0xguessr',
    desc: 'If two ECDSA signatures reuse the same nonce k, they share an r value and the private key falls out algebraically. It drained Android Bitcoin wallets and broke the PS3.',
    h1: 'ECDSA nonce reuse',
    lede: 'Every signature needs a fresh random number. Reuse it once — across two transactions — and anyone can recover your private key with grade-school algebra.',
    body: `
      <h2>The math</h2>
      <p>Each ECDSA signature uses a one-time random <strong>nonce</strong> <code>k</code>. The signature's <code>r</code> value is derived only from <code>k</code>, so if the same <code>k</code> signs two different messages, both signatures share the same <code>r</code>. Given two such signatures <code>(r, s₁, h₁)</code> and <code>(r, s₂, h₂)</code>:</p>
      <p style="font-family:var(--mono);font-size:0.9rem"><code>k = (h₁ − h₂) / (s₁ − s₂) mod n</code>, then <code>d = (s₁·k − h₁) / r mod n</code></p>
      <p>Two equations, one unknown — the private key <code>d</code> pops right out. No brute force required.</p>

      <h2>Real cases</h2>
      <div class="case">
        <h4>Android Bitcoin thefts (August 2013)</h4>
        <p>A flaw in Android's <code>SecureRandom</code> produced repeated nonces across signatures in several Bitcoin wallet apps. Attackers scanned the blockchain for duplicate <code>r</code> values and drained the exposed addresses, prompting an official Bitcoin.org advisory.</p>
      </div>
      <div class="case">
        <h4>Sony PlayStation 3 (2010)</h4>
        <p>The canonical example: Sony signed PS3 firmware with a <em>fixed</em> nonce instead of a random one. At the 2010 Chaos Communication Congress, the group fail0verflow recovered Sony's master ECDSA signing key from two signatures — the very same math.</p>
      </div>

      <h2>The defense</h2>
      <p>Use <strong>deterministic nonces</strong> per RFC 6979, which derive <code>k</code> from the message and private key so it is never accidentally repeated. Every reputable modern wallet library does this by default. This mode fetches an address's transaction history and checks for repeated <code>r</code> values.</p>
    `,
  },

  {
    slug: 'lattice',
    mode: 'lattice',
    nav: 'Lattice',
    title: 'Lattice Attacks: Recovering Keys from Biased Nonces | 0xguessr',
    desc: 'Nonces don\'t have to fully repeat. If a few bits are predictable, LLL lattice reduction can recover an ECDSA private key from as few as 2–4 signatures.',
    h1: 'Lattice attacks: recovering keys from biased nonces',
    lede: 'Nonce reuse is the obvious failure. The subtle one: nonces that are merely biased — a few predictable bits — still leak the key, via lattice reduction.',
    body: `
      <h2>The Hidden Number Problem</h2>
      <p>Suppose an implementation's nonces are not repeated, but are slightly predictable — say the top few bits are always zero because of a weak RNG, a timing side channel, or a buggy hardware wallet. Each signature then gives a noisy linear equation about the private key. Collect a handful of them and you have an instance of the <strong>Hidden Number Problem</strong>, which can be solved with <strong>LLL lattice basis reduction</strong>.</p>
      <p>With a 128-bit bias, two signatures can be enough; with a smaller ~64-bit bias, around four. That is a remarkably low bar — an attacker who can collect a few signatures from a leaky device can walk away with the key.</p>

      <h2>Real-world examples</h2>
      <p>Lattice attacks are the engine behind several disclosed bugs, including <strong>Minerva</strong> and <strong>TPM-Fail</strong> (timing side channels that leaked nonce bits from smartcards and TPMs) and various hardware-wallet nonce-generation flaws. They are a standard tool in cryptographic auditing.</p>

      <h2>The defense</h2>
      <p>Generate nonces with a secure, constant-time process — again, RFC 6979 deterministic nonces plus side-channel-resistant implementations. This mode runs LLL reduction over a set of signatures you provide and, if the nonces were biased, recovers and verifies the key.</p>
    `,
  },
];
