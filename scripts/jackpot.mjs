// Single source of truth for the headline "$N billion" figure, derived from
// public/data/eth_meta.json (refreshed weekly). Used by the Vite build (to
// bake it into <title>/OG tags) and by render-images.mjs (the OG card).

export function jackpotBillions(meta) {
  const totalEth = Number(meta?.total_eth_approx) || 0;
  const usd = Number(meta?.eth_usd_approx) || 0;
  return Math.max(0, Math.round((totalEth * usd) / 1e9));
}
