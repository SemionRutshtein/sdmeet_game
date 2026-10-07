// Printable export of opened cards (only once both agreed). The browser's
// "Save as PDF" turns it into a file.
import { h, mount } from '../dom.js';
import { t, loc, APP_NAME } from '../i18n.js';
import { roomApi, sessions } from '../api.js';
import { deck as deckOf, poolText, wishlistLabel } from '../content.js';
import { answerOrPass, labelPill, terrainPill } from './format.js';

export async function exportView(root, roomId) {
  const session = sessions.get(roomId);
  document.body.classList.add('print-page');
  if (!session) {
    mount(root, h('p', {}, t('room.noAccess')));
    return () => document.body.classList.remove('print-page');
  }
  const api = roomApi(session.token);
  let data;
  let state;
  try {
    [data, state] = await Promise.all([api.exportData(), api.state()]);
  } catch (e) {
    mount(root, h('div', { class: 'card' }, h('p', {}, t(`error.${e.code}`, {}, t('error.generic')))));
    return () => document.body.classList.remove('print-page');
  }
  const nm = data.names;
  const seats = [1, 2];
  const asked = [...state.asked, ...state.askedToMe];

  const cardBlock = card => {
    const d = card.deck ? deckOf(card.deck) : null;
    let title;
    let body;
    if (card.kind === 'asked') {
      const a = asked.find(x => x.id === card.askedId);
      title = a ? a.custom || poolText(a.deckId, a.poolId) : '';
      const r = card.asked.reply;
      body = h('div', { class: 'answer-box' }, h('div', { class: 'who' }, nm[card.asked.toSeat]),
        !r ? '—' : r.pass ? t('reveal.passed') : (r.value.text || t('export.voiceOnly')));
    } else if (card.kind === 'wishlist') {
      title = loc(d.stage1.find(q => q.id === 'wishlist').prompt);
      body = h('ul', {}, card.questions[0].matches.map(m => h('li', {}, wishlistLabel(m.id))));
    } else {
      title = card.kind === 'group' ? loc(d.reveal.groups.find(g => g.id === card.group).title) : loc(d.stage1.find(q => q.id === card.qids[0]).prompt);
      body = card.questions.map(qv => {
        const q = d.stage1.find(x => x.id === qv.qid);
        return h('div', { class: 'q-block' },
          card.kind === 'group' ? h('div', { class: 'q-title' }, loc(q.prompt)) : null,
          h('div', { class: 'answers' }, seats.map(s => h('div', { class: 'answer-box' },
            h('div', { class: 'who' }, nm[s]),
            answerOrPass(q, d, qv.answers[s], {}),
            qv.answers[s]?.label ? labelPill(qv.answers[s].label) : null))));
      });
    }
    return h('div', { class: 'card' },
      h('div', { class: 'eyebrow' }, d ? `${loc(d.title)} · ${loc(d.reveal.name)}` : t('reveal.ownQuestions')),
      h('h3', {}, title),
      card.terrain ? terrainPill(card.terrain) : null,
      body,
      card.rule ? h('p', {}, '★ ', card.rule) : null);
  };

  mount(root,
    h('div', { class: 'row between no-print', style: { margin: '1rem 0' } },
      h('a', { href: `/room/${roomId}` }, '← ', t('common.back')),
      h('button', { class: 'btn primary', onclick: () => window.print() }, '🖨 ', t('export.print'))),
    h('h1', {}, `${APP_NAME} — ${nm[1]} & ${nm[2]}`),
    h('p', { class: 'muted' }, new Date(data.generatedAt).toLocaleString()),
    data.cards.map(cardBlock)
  );
  return () => document.body.classList.remove('print-page');
}
