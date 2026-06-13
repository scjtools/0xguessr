const KEY = '0xguessr:v1:stats';

export const MILESTONES = [10, 100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 1_000_000];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); }
  catch { return {}; }
}

function save(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
}

export function recordSpin() {
  const d = load();
  d.total = (d.total ?? 0) + 1;
  d.firstSpin ??= Date.now();
  d.lastSpin = Date.now();
  const milestone = MILESTONES.includes(d.total) ? d.total : null;
  save(d);
  return { total: d.total, milestone };
}

export function getStats() {
  return load();
}

export function getTier(spins) {
  if (spins >= 1_000_000) return { name: 'Touch Grass',     quote: 'please go outside ser' };
  if (spins >= 100_000)   return { name: 'Few Understand',  quote: '1 in 10⁷⁰ is basically 50/50' };
  if (spins >= 10_000)    return { name: 'Probably Ngmi',   quote: 'ngmi but at least you tried' };
  if (spins >= 1_000)     return { name: 'Certified Degen', quote: 'probably nothing' };
  if (spins >= 100)       return { name: 'Degen',           quote: 'aping in with my keyboard' };
  if (spins >= 10)        return { name: 'Curious',         quote: 'ser this might be the one' };
  return                          { name: 'Anon',           quote: 'just discovered something dangerous' };
}

export function milestoneMessage(n) {
  const msgs = {
    10:        '👀 10 spins. ok you\'re curious.',
    100:       '🤡 100 spins. degen unlocked.',
    500:       '500 spins. ser are you ok?',
    1_000:     '🎰 1,000 spins. certified degen.',
    5_000:     '5,000 spins. please eat something.',
    10_000:    '💀 10,000 spins. probably ngmi.',
    50_000:    '50,000 spins. few understand.',
    100_000:   '🧠 100,000 spins. a true believer.',
    1_000_000: '🌱 1,000,000 spins. please touch grass.',
  };
  return msgs[n] ?? `${n.toLocaleString()} spins.`;
}
