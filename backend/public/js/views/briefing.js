// Briefing: what this is, the goal, the four stages with timings, house rules,
// and (for the creator) inviting the partner. Shown once per player per room
// before stage 1, and any time from the room menu.
import { h, mount } from '../dom.js';
import { t, loc } from '../i18n.js';
import { decksIn, minutesFor } from '../content.js';
import { inviteBox } from './stages.js';
import { explainer } from './explainer.js';

export function briefingView({ state, onStart }) {
  const decks = decksIn(state.room.decks);
  const qCount = decks.reduce((n, d) => n + d.stage1.length, 0);
  const guessCount = decks.reduce((n, d) => n + d.stage1.filter(q => q.predictable).length, 0);
  const m1 = minutesFor(decks);
  const m3 = Math.max(10, Math.round((guessCount * 15 + 6 * 60) / 60 / 5) * 5);
  const joined = state.me.seat === 2;
  const demo = h('div', { class: 'brief-demo', hidden: true });

  const step = (n, icon, text, minutes, mode) => h('li', { class: 'journey-step', style: { '--i': n } },
    h('span', { class: 'journey-icon', 'aria-hidden': 'true' }, icon),
    h('div', {},
      h('div', { class: 'journey-title' }, t(`stage${n}.title`)),
      h('div', { class: 'small muted' }, text),
      h('div', { class: 'journey-meta' },
        h('span', { class: `chip ${mode}` }, mode === 'together' ? '👥 ' : '👤 ', t(`brief.${mode}`)),
        minutes ? h('span', { class: 'chip' }, '⏱ ', t('brief.min', { n: minutes })) : null)));

  const el = h('div', { class: 'briefing' },
    h('section', { class: 'card hero-card reveal-in' },
      h('div', { class: 'eyebrow' }, joined ? t('brief.eyebrowJoin') : t('brief.eyebrowNew')),
      h('h1', {}, t('brief.title', { name: state.me.name })),
      h('p', { class: 'lead' }, t('brief.what')),
      h('div', { class: 'deck-chips' }, decks.map(d => h('span', { class: 'chip deck' }, d.icon, ' ', loc(d.title)))),
      h('button', {
        type: 'button', class: 'link-btn', style: { marginTop: '0.75rem' },
        onclick: e => {
          demo.hidden = !demo.hidden;
          if (!demo.hidden && !demo.firstChild) demo.append(explainer());
          e.currentTarget.setAttribute('aria-expanded', String(!demo.hidden));
        }
      }, '▶ ', t('demo.watch')),
      demo),
    h('section', { class: 'card goal-card reveal-in' },
      h('div', { class: 'goal-icon', 'aria-hidden': 'true' }, '🧭'),
      h('div', {}, h('div', { class: 'eyebrow' }, t('brief.goalTitle')), h('p', { class: 'goal-text' }, t('brief.goal')))),
    h('section', { class: 'card reveal-in' },
      h('h2', {}, t('brief.journey')),
      h('ol', { class: 'journey' },
        step(1, '✍️', t('brief.s1', { q: qCount }), m1, 'solo'),
        step(2, '✉️', t('brief.s2'), 5, 'solo'),
        step(3, '🔮', t('brief.s3'), m3, 'solo'),
        step(4, '🃏', t('brief.s4'), 45, 'together'))),
    h('section', { class: 'card reveal-in' },
      h('h2', {}, t('brief.rulesTitle')),
      h('ul', { class: 'rules' }, ['🫶', '🙅', '🔒', '🎯', '🌙'].map((icon, n) =>
        h('li', {}, h('span', { 'aria-hidden': 'true' }, icon), h('span', {}, t(`brief.r${n + 1}`))))),
      h('p', { class: 'tiny muted', style: { marginTop: '0.75rem' } }, '🔐 ', t('home.privacy'))),
    !joined ? h('section', { class: 'card reveal-in' },
      h('h2', {}, t('brief.inviteTitle')),
      state.partner
        ? h('p', { class: 'banner' }, '✓ ', t('brief.partnerJoined', { name: state.partner.name }))
        : [h('p', { class: 'small muted' }, t('brief.inviteText')), inviteBox(state.room.id, { compact: true })]) : null,
    h('div', { class: 'sticky-cta' },
      h('button', { type: 'button', class: 'btn primary block big', onclick: onStart }, t('brief.start'), ' →'))
  );
  return { el };
}

// Before the first card: spoken agreements, the way a facilitator would open.
export function agreementsView({ onAgree }) {
  const el = h('div', { class: 'briefing' },
    h('section', { class: 'card hero-card reveal-in' },
      h('div', { class: 'eyebrow' }, t('agree.eyebrow')),
      h('h1', {}, t('agree.title')),
      h('p', { class: 'lead' }, t('agree.text')),
      h('ol', { class: 'agreements' }, [1, 2, 3, 4, 5].map(n => h('li', { style: { '--i': n } }, t(`agree.a${n}`))))),
    h('div', { class: 'sticky-cta' },
      h('button', { type: 'button', class: 'btn primary block big', onclick: onAgree }, t('agree.cta'), ' →')));
  return { el };
}
