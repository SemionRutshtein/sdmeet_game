// Turning stored values back into readable text/elements for the reveal,
// the export and the capsule comparison.
import { h } from '../dom.js';
import { t, loc } from '../i18n.js';
import { optionLabel, deck as deckOf, poolText } from '../content.js';
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
    case 'scene': {
      const f = deck.sceneFields;
      return h('div', { class: 'small' },
        h('div', {}, h('span', { class: 'muted' }, loc(f.feel.prompt), ': '), value.feel.map(id => optionLabel(f.feel.options, id)).join(', ')),
        h('div', {}, h('span', { class: 'muted' }, loc(f.do.prompt), ': '), optionLabel(f.do.options, value.do)),
        value.want ? h('div', {}, h('span', { class: 'muted' }, loc(f.want.prompt), ': '), value.want) : null);
    }
    default:
      return h('span', {}, '…');
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
