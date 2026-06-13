import { getTier } from './stats.js';

const GREEN  = '#2bd47d';
const BG     = '#0d0e12';
const INK    = '#e6e7eb';
const DIM    = '#8d92a3';
const BORDER = '#2a2e3d';

function readU32LE(b, o) { return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0; }

export function drawShareCard(canvas, totalSpins) {
  const W = 1200, H = 628, PAD = 88;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tier = getTier(totalSpins);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#111318');
  bg.addColorStop(1, BG);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.022)';
  for (let x = 24; x < W; x += 40)
    for (let y = 24; y < H; y += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

  // Faint "0x" watermark (right side)
  ctx.save();
  ctx.font = 'bold 280px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  ctx.fillStyle = 'rgba(43,212,125,0.038)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('0x', W + 30, H / 2);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // "0xguessr" top-left
  ctx.font = '300 20px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  ctx.fillStyle = GREEN;
  ctx.fillText('0xguessr', PAD, 88);

  // Top divider
  ctx.strokeStyle = 'rgba(43,212,125,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, 108); ctx.lineTo(W - PAD, 108); ctx.stroke();

  // Big spin count
  const spinStr = totalSpins.toLocaleString('en-US');
  const fz = spinStr.length > 9 ? 118 : spinStr.length > 6 ? 150 : 180;
  ctx.font = `bold ${fz}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;
  ctx.fillStyle = INK;
  ctx.fillText(spinStr, PAD, 330);

  // "spins · $0 won"
  ctx.font = '300 26px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  ctx.fillStyle = DIM;
  ctx.fillText('spins  ·  $0 won', PAD, 378);

  // Tier badge
  ctx.font = 'bold 13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const label = tier.name.toUpperCase();
  const tw = ctx.measureText(label).width;
  const bx = PAD, by = 408, bh = 32, bw = tw + 28;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = 'rgba(43,212,125,0.08)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = GREEN;
  ctx.fillText(label, bx + 14, by + 22);

  // Quote
  ctx.font = 'italic 20px Georgia,serif';
  ctx.fillStyle = 'rgba(230,231,235,0.3)';
  ctx.fillText(`"${tier.quote}"`, PAD, 488);

  // Bottom divider
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, 544); ctx.lineTo(W - PAD, 544); ctx.stroke();

  // URL bottom-right
  const host = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
    ? window.location.hostname
    : 'github.com/scjtools/0xguessr';
  ctx.font = '13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  ctx.fillStyle = 'rgba(141,146,163,0.55)';
  ctx.textAlign = 'right';
  ctx.fillText(host, W - PAD, 585);
}

export function downloadCard(canvas, totalSpins) {
  const a = document.createElement('a');
  a.download = `0xguessr-${totalSpins}-spins.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

export async function copyCardToClipboard(canvas) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
