import { sha256 } from '@noble/hashes/sha256';
import { wordlist as en } from '@scure/bip39/wordlists/english.js';
import { wordlist as es } from '@scure/bip39/wordlists/spanish.js';
import { wordlist as fr } from '@scure/bip39/wordlists/french.js';
import { wordlist as it } from '@scure/bip39/wordlists/italian.js';
import { wordlist as ko } from '@scure/bip39/wordlists/korean.js';
import { wordlist as cs } from '@scure/bip39/wordlists/czech.js';
import { wordlist as pt } from '@scure/bip39/wordlists/portuguese.js';
import { wordlist as ja } from '@scure/bip39/wordlists/japanese.js';
import { wordlist as zhS } from '@scure/bip39/wordlists/simplified-chinese.js';
import { wordlist as zhT } from '@scure/bip39/wordlists/traditional-chinese.js';

let _phrases = [];
let _index = 0;

export function phraseToPrivKey(phrase) {
  return sha256(new TextEncoder().encode(phrase));
}

export function loadWordlist(phrases) {
  _phrases = phrases.filter(p => p.trim().length > 0);
  _index = 0;
}

export function nextPhrase() {
  if (_index >= _phrases.length) return null;
  return _phrases[_index++];
}

export function getProgress() {
  return { current: _index, total: _phrases.length };
}

export function resetScan() {
  _index = 0;
}

export function getBip39AllWords() {
  return [...new Set([...en, ...es, ...fr, ...it, ...ko, ...cs, ...pt, ...ja, ...zhS, ...zhT])];
}

// Curated list of phrases known to have been used as brain wallets.
// Most prominent ones are long swept — this is educational.
export const BUILTIN_PHRASES = [
  'correct horse battery staple',
  'to be or not to be that is the question',
  'satoshi nakamoto',
  'bitcoin',  'ethereum', 'blockchain', 'crypto', 'hodl', 'moon', 'lambo',
  'wallet', 'private key', 'seed phrase', 'mnemonic', 'passphrase',
  'defi', 'nft', 'web3', 'decentralized', 'trustless', 'permissionless',
  'password', 'password1', 'password123', 'passw0rd',
  '123456', '12345678', '123456789', '1234567890',
  'qwerty', 'abc123', 'letmein', 'monkey', 'dragon', 'master', 'iloveyou',
  'hello', 'hello world', 'test', 'testing', '1', '0', 'admin',
  'my wallet', 'my bitcoin wallet', 'my ethereum wallet', 'my eth wallet',
  'in the beginning god created the heavens and the earth',
  'the quick brown fox jumps over the lazy dog',
  'all your base are belong to us',
  'may the force be with you',
  'to infinity and beyond',
  'i am satoshi nakamoto',
  'this is sparta',
  'do not go gentle into that good night',
  'two roads diverged in a yellow wood',
  'it was the best of times it was the worst of times',
  'call me ishmael',
  'it is a truth universally acknowledged',
  'alice', 'bob', 'charlie', 'david', 'michael', 'robert', 'james',
  'bitcoin is the future', 'ethereum is the future', 'crypto is the future',
  'number go up', 'buy the dip', 'diamond hands', 'wen lambo', 'wen moon',
  'not your keys not your coins', 'be your own bank',
  'nakamoto', 'vitalik', 'buterin', 'hal finney', 'nick szabo', 'adam back',
  '21000000', '21million', '1bitcoin', '1btc', '1eth', '1ether',
  'genesis block', 'block zero', 'block 0',
  'pizza', 'two pizzas', 'bitcoin pizza',
  'ngmi', 'gm', 'wagmi', 'ser', 'fren', 'anon',
  'alpha', 'beta', 'gamma', 'delta', 'omega',
  'money', 'freedom', 'trust', 'truth', 'power',
  'time', 'love', 'life', 'death', 'god', 'world', 'earth', 'sky', 'sun', 'moon', 'star',
  '00000000', '11111111', '99999999', 'ffffffff',
  '0000000000000000000000000000000000000000000000000000000000000001',
];
