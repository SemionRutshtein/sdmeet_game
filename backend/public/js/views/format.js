// Turning stored values back into readable text/elements for the reveal,
// the export and the capsule comparison.
import { h } from '../dom.js';
import { t, loc } from '../i18n.js';
import { optionLabel, deck as deckOf, poolText, C } from '../content.js';
import { voicePlayer } from '../voice.js';

export function formatValue(q, deck, value, { api } = {}) {
  if (!value) return h('span', { class: 'passed' }, '—');
  switch (q.type) {
    case 'choice': {
      const o = q.options.find(x => x.id === value.option);
      return h('div', {},
        h('div', {}, o?.custom && value.custom ? value.custom : optionLabel(q.options, value.option)),
        value.followup ? h('p', { class: 'small muted', style: { marginTop: '0.4rem' } }, loc(q.followup.prompt), ': ', value.followup) : null
      );
    }
    case 'multi':
      return h('div', {}, value.options.map(id => optionLabel(q.options, id)).join(', '));
    case 'rank':
      if (value.option) return h('div', {}, optionLabel(q.options, value.option));
      return h('ol', {}, value.order.map(id => h('li', {}, optionLabel(q.options, id))));
    case 'scale':
      return h('div', {}, h('strong', {}, String(value.value)), h('span', { class: 'muted' }, ` / ${q.max}`));
    case 'slider':
      return h('div', {},
        q.unit ? `${value.value}${q.unit} · ${loc(q.right)}` : sliderWords(q, value.value),
        sliderTrack(value.value));
    case 'text':
      return h('div', {},
        value.text ? h('div', { style: { whiteSpace: 'pre-wrap' } }, value.text) : null,
        value.voiceId && api ? h('div', { class: 'voice' }, voicePlayer(api, value.voiceId)) : null);
    case 'weather': {
      const o = q.options.find(x => x.id === value.icon);
      return h('div', {}, h('span', { style: { fontSize: '1.6rem' } }, o?.icon || ''), ' ', o ? loc(o.label) : '',
        value.phrase ? h('div', { class: 'small', style: { marginTop: '0.3rem' } }, `“${value.phrase}”`) : null);
    }
    case 'scene':
      return sceneStrip(deck, value);
    default:
      return h('span', {}, '…');
  }
}

// A scene answer as a small storyboard: how hard it hits, the story,
// the feelings (surface / underneath), the action, what would help.
function sceneStrip(deck, value) {
  const rows = [];
  for (const [key, f] of Object.entries(deck.sceneFields)) {
    const v = value[key];
    if (v == null || (Array.isArray(v) && !v.length)) continue;
    const row = (body, cls = '') => rows.push(h('div', { class: `strip-row ${cls}` }, h('span', { class: 'muted strip-label' }, loc(f.prompt)), body));
    if (f.type === 'scale') {
      row(h('span', { class: 'shake', 'aria-label': `${v} / ${f.max}` }, '●'.repeat(v - f.min + 1) + '○'.repeat(f.max - v)), 'strip-shake');
    } else if (f.type === 'choice') {
      row(h('span', {}, key === 'story' ? `💭 “${optionLabel(f.options, v)}”` : optionLabel(f.options, v)), `strip-${key}`);
    } else if (f.type === 'multi' && f.layers) {
      row(h('span', {}, Object.entries(f.layers).map(([layer, title]) => {
        const ids = v.filter(id => f.options.find(o => o.id === id)?.layer === layer);
        return ids.length ? h('span', { class: `feel-layer ${layer}` }, h('span', { class: 'tiny muted' }, loc(title), ': '), ids.map(id => optionLabel(f.options, id)).join(', ')) : null;
      })));
    } else if (f.type === 'multi') {
      row(h('span', {}, v.map(id => optionLabel(f.options, id)).join(', ')));
    } else {
      row(h('span', {}, `“${v}”`), 'strip-want');
    }
  }
  return h('div', { class: 'small strip' }, rows);
}

// Plain-text version of any answer, for the "my answers" export.
export function valueText(q, deck, value) {
  if (!value) return '';
  switch (q.type) {
    case 'choice': {
      const o = q.options.find(x => x.id === value.option);
      const main = o?.custom && value.custom ? value.custom : optionLabel(q.options, value.option);
      return value.followup ? `${main}\n${loc(q.followup.prompt)}: ${value.followup}` : main;
    }
    case 'multi':
      return value.options.map(id => optionLabel(q.options, id)).join(', ');
    case 'rank':
      if (value.option) return optionLabel(q.options, value.option);
      return value.order.map((id, i) => `${i + 1}. ${optionLabel(q.options, id)}`).join('\n');
    case 'scale':
      return `${value.value} / ${q.max}`;
    case 'slider':
      return q.unit ? `${value.value}${q.unit} · ${loc(q.right)}` : `${value.value}/100 (${loc(q.left)} ↔ ${loc(q.right)})`;
    case 'text':
      return [value.text, value.voiceId ? t('export.voiceOnly') : null].filter(Boolean).join(' ');
    case 'weather': {
      const o = q.options.find(x => x.id === value.icon);
      return [o ? `${o.icon} ${loc(o.label)}` : '', value.phrase ? `“${value.phrase}”` : ''].filter(Boolean).join(' · ');
    }
    case 'scene': {
      const lines = [];
      for (const [key, f] of Object.entries(deck.sceneFields)) {
        const v = value[key];
        if (v == null || (Array.isArray(v) && !v.length)) continue;
        let text;
        if (f.type === 'scale') text = `${v} / ${f.max} (${loc(f.low)} → ${loc(f.high)})`;
        else if (f.type === 'choice') text = optionLabel(f.options, v);
        else if (f.type === 'multi' && f.layers) {
          text = Object.entries(f.layers).map(([layer, title]) => {
            const ids = v.filter(id => f.options.find(o => o.id === id)?.layer === layer);
            return ids.length ? `${loc(title)}: ${ids.map(id => optionLabel(f.options, id)).join(', ')}` : null;
          }).filter(Boolean).join('; ');
        } else if (f.type === 'multi') text = v.map(id => optionLabel(f.options, id)).join(', ');
        else text = v;
        lines.push(`${loc(f.prompt)}: ${text}`);
      }
      return lines.join('\n');
    }
    case 'wishlist': {
      const by = level => C().wishlist.filter(w => value.items?.[w.id] === level).map(w => loc(w.label));
      return ['yes', 'maybe', 'no'].map(level => `${t(`wish.${level}`)}: ${by(level).join(', ') || '—'}`).join('\n');
    }
    default:
      return '';
  }
}

function sliderWords(q, n) {
  if (n <= 35) return loc(q.left);
  if (n >= 65) return loc(q.right);
  return t('format.middle');
}

function sliderTrack(n) {
  return h('div', { class: 'track' }, h('span', { class: 'pt real', style: { insetInlineStart: `${n}%` } }));
}

export function answerOrPass(q, deck, ans, opts) {
  if (!ans) return h('span', { class: 'passed' }, '—');
  if (ans.pass) return h('span', { class: 'passed' }, t('reveal.passed'));
  return formatValue(q, deck, ans.value, opts);
}

export function labelPill(label) {
  if (!label) return null;
  return h('span', { class: 'pill gold' }, t(`label.${label}`));
}

export function terrainPill(terrain) {
  if (!terrain) return null;
  const icon = { valley: '🌿', hill: '⛰', mountain: '🏔️' }[terrain];
  return h('span', { class: `pill ${terrain}` }, icon, ' ', t(`terrain.${terrain}`));
}

// Title of a card in the current language
export function cardTitle(card, state) {
  if (card.kind === 'asked') {
    const asked = [...(state.asked || []), ...(state.askedToMe || [])].find(a => a.id === card.askedId);
    if (!asked) return t('reveal.question');
    return asked.custom || poolText(asked.deckId, asked.poolId);
  }
  const d = deckOf(card.deck);
  if (card.kind === 'group') return loc(d.reveal.groups.find(g => g.id === card.group).title);
  return loc(d.stage1.find(q => q.id === card.qids[0]).prompt);
}

export function names(state) {
  const n = { [state.me.seat]: state.me.name };
  if (state.partner) n[state.partner.seat] = state.partner.name;
  return n;
}

// "Ana guessed right" etc. Conclusion codes come from game/board.js on the server.
export function conclusionText(c, state) {
  const nm = names(state);
  const p = { ...(c.params || {}) };
  if (p.seat) p.name = p.seat === state.me.seat ? t('common.you') : nm[p.seat];
  if (c.code === 'guess_one') {
    const loser = p.seat === 1 ? 2 : 1;
    p.other = loser === state.me.seat ? t('common.you') : nm[loser];
  }
  return t(`concl.${c.code}`, p);
}
