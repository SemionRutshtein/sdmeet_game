// "Our map" share image, drawn locally on a canvas. Built only from the
// summary (no verbatim answers) and never from the 18+ deck.
import { t, loc, getLang } from './i18n.js';
import { deck as deckOf, weatherIcon } from './content.js';

const W = 1080;
const H = 1350;

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawShareImage({ summary, state, includeRules }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  const serif = 'Georgia, "Times New Roman", serif';
  const sans = 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
  c.direction = getLang() === 'he' ? 'rtl' : 'ltr';
  c.textAlign = 'center';

  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#15141A');
  g.addColorStop(1, '#0C0C0F');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(201,168,76,0.35)';
  c.lineWidth = 2;
  c.strokeRect(40, 40, W - 80, H - 80);

  let y = 130;
  c.fillStyle = '#C9A84C';
  c.font = `600 26px ${sans}`;
  c.fillText('S D M E E T', W / 2, y);
  y += 90;
  c.fillStyle = '#EDE9E4';
  c.font = `64px ${serif}`;
  c.fillText(t('map.title'), W / 2, y);
  y += 60;
  c.font = `34px ${serif}`;
  c.fillStyle = '#B5B0AA';
  c.fillText(`${summary.names[1]} & ${summary.names[2]}`, W / 2, y);
  y += 50;

  const section = title => {
    y += 40;
    c.fillStyle = '#C9A84C';
    c.font = `600 22px ${sans}`;
    c.fillText(title.toUpperCase(), W / 2, y);
    y += 20;
  };

  if (summary.climate) {
    section(t('map.climate'));
    c.font = `110px ${sans}`;
    c.fillText(weatherIcon(summary.climate[1]) || '·', W / 2 - 170, y + 110);
    c.fillText(weatherIcon(summary.climate[2]) || '·', W / 2 + 170, y + 110);
    c.font = `28px ${serif}`;
    c.fillStyle = '#EDE9E4';
    c.fillText(summary.names[1], W / 2 - 170, y + 160);
    c.fillText(summary.names[2], W / 2 + 170, y + 160);
    y += 180;
  }

  if (summary.relief) {
    section(t('map.relief'));
    const items = [['🌿', summary.relief.valley, t('terrain.valley')], ['⛰', summary.relief.hill, t('terrain.hill')], ['🏔️', summary.relief.mountain, t('terrain.mountain')]];
    items.forEach(([icon, n, label], i) => {
      const x = W / 2 + (i - 1) * 260;
      c.font = `54px ${sans}`;
      c.fillStyle = '#EDE9E4';
      c.fillText(`${icon} ${n}`, x, y + 70);
      c.font = `24px ${sans}`;
      c.fillStyle = '#B5B0AA';
      c.fillText(label, x, y + 108);
    });
    y += 130;
  }

  if (summary.accuracy.length) {
    section(t('map.accuracy'));
    c.font = `30px ${serif}`;
    for (const a of summary.accuracy) {
      const pct = s => (a.bySeat[s].total ? `${Math.round((a.bySeat[s].hits / a.bySeat[s].total) * 100)}%` : '—');
      c.fillStyle = '#EDE9E4';
      y += 50;
      c.fillText(`${loc(deckOf(a.deck).title)}: ${summary.names[1]} ${pct(1)} · ${summary.names[2]} ${pct(2)}`, W / 2, y);
    }
    y += 10;
  }

  if (includeRules && summary.rules.length) {
    section(t('map.rules'));
    c.font = `28px ${serif}`;
    c.fillStyle = '#EDE9E4';
    for (const r of summary.rules.slice(0, 4)) {
      for (const line of wrap(c, `★ ${r.rule}`, W - 260).slice(0, 2)) {
        y += 42;
        if (y > H - 120) break;
        c.fillText(line, W / 2, y);
      }
    }
  }

  c.fillStyle = '#7C7882';
  c.font = `22px ${sans}`;
  c.fillText(t('map.shareFooter'), W / 2, H - 80);
  return canvas;
}
