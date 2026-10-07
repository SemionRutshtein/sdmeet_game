// Time capsule: write, agree on a date, seal; later open it and retake a deck.
import { h, mount, toast, copyText } from '../dom.js';
import { t, loc, formatDate } from '../i18n.js';
import { C, deck as deckOf, decksIn } from '../content.js';
import { wizard, firstOpen } from './wizard.js';
import { selfSteps } from './stages.js';
import { questionInput, isComplete, whyIncomplete } from './inputs.js';
import { answerOrPass, formatValue } from './format.js';

export function capsuleSection(ctx) {
  const root = h('div', { class: 'card' });
  const draft = {};
  const retakeDrafts = new Map();
  let compare = null;
  let lastKey = null;

  function nameOf(state, seat) {
    return seat === state.me.seat ? t('common.you') : state.partner?.name;
  }

  function render(state) {
    const cap = state.capsule;
    const prompts = C().capsule.prompts;
    // Redraw only when *this* player's screen changes, so a partner's
    // progress never resets a wizard or a half-written form.
    const key = screenKey(state, cap);
    if (key === lastKey) return;
    lastKey = key;

    if (!cap.sealed) return mount(root, writeForm(state, cap, prompts));
    if (!cap.open) {
      const link = `${location.origin}/capsule#${state.room.id}.${ctx.api.token}`;
      return mount(root,
        h('h3', {}, '⏳ ', t('capsule.title')),
        h('p', {}, t('capsule.sealedOn', { date: formatDate(cap.sealedAt), open: formatDate(cap.openAt) })),
        h('p', { class: 'small muted' }, t('capsule.linkNote')),
        h('div', { class: 'copy-box' }, h('code', {}, link),
          h('button', { class: 'btn ghost small', onclick: async () => { if (await copyText(link)) toast(t('common.copied')); } }, t('common.copy'))));
    }
    mount(root, openView(state, cap, prompts));
  }

  function screenKey(state, cap) {
    if (!cap.sealed) return JSON.stringify(['write', cap.months, cap.partnerWrote, !!cap.mine]);
    if (!cap.open) return 'sealed';
    const me = state.me;
    const p = state.partner;
    if (!cap.retakeDeck) return 'pick';
    if (!me.retakeDone) return 'retake';
    if (!p.retakeDone) return 'wait-retake';
    if (!me.retakeGuessDone) return 'guess';
    if (!p.retakeGuessDone) return 'wait-guess';
    return 'compare';
  }

  function writeForm(state, cap, prompts) {
    for (const p of prompts) if (draft[p.id] == null) draft[p.id] = cap.mine?.[p.id] || '';
    const save = h('button', { class: 'btn primary' }, cap.mine ? t('capsule.update') : t('capsule.save'));
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        await ctx.api.capsuleEntry(draft);
        toast(t('common.saved'));
        lastKey = null;
        await ctx.refresh();
      } catch (e) {
        toast(t(`error.${e.code}`, {}, t('error.generic')));
      }
      save.disabled = false;
    });
    const months = C().capsule.durations;
    const mine = cap.months[state.me.seat];
    const theirs = state.partner ? cap.months[state.partner.seat] : null;
    return h('div', {},
      h('h3', {}, '⏳ ', t('capsule.title')),
      h('p', { class: 'small muted' }, t('capsule.intro')),
      prompts.map(p => {
        const ta = h('textarea', { rows: 2, maxlength: 1000 }, draft[p.id]);
        ta.addEventListener('input', () => { draft[p.id] = ta.value; });
        return h('label', { class: 'field' }, h('span', {}, loc(p.text)), ta);
      }),
      h('div', { class: 'row' }, save, cap.mine ? h('span', { class: 'small muted' }, '✓ ', t('capsule.youWrote')) : null),
      h('div', { class: 'sub-q' },
        h('div', { class: 'label' }, t('capsule.when')),
        h('div', { class: 'seg' }, months.map(m => h('button', {
          type: 'button', 'aria-pressed': String(mine === m),
          onclick: async () => { await ctx.api.capsuleMonths(m); lastKey = null; ctx.refresh(); }
        }, t('capsule.months', { n: m })))),
        theirs ? h('p', { class: 'small', style: { marginTop: '0.5rem' } }, t('capsule.theyPicked', { name: state.partner.name, n: theirs })) : null),
      h('p', { class: 'small muted', style: { marginTop: '0.75rem' } },
        cap.partnerWrote ? t('capsule.theyWrote', { name: state.partner.name }) : t('capsule.theyNotWrote', { name: state.partner?.name || '—' }),
        ' ', t('capsule.sealRule')));
  }

  function openView(state, cap, prompts) {
    const seats = [state.me.seat, state.partner.seat];
    const parts = [
      h('h3', {}, '📬 ', t('capsule.openTitle')),
      h('p', { class: 'small muted' }, t('capsule.openedNote', { date: formatDate(cap.sealedAt) })),
      prompts.map(p => h('div', { class: 'q-block' },
        h('div', { class: 'q-title' }, loc(p.text)),
        h('div', { class: 'answers' }, seats.map(seat => h('div', { class: 'answer-box' },
          h('div', { class: 'who' }, nameOf(state, seat)),
          h('div', { class: 'val', style: { whiteSpace: 'pre-wrap' } }, cap.entries[seat]?.[p.id] || '—'))))))
    ];
    parts.push(h('div', { class: 'sub-q' }, retake(state, cap)));
    return parts;
  }

  function retake(state, cap) {
    const me = state.me;
    const p = state.partner;
    if (!cap.retakeDeck) {
      return h('div', {},
        h('h3', {}, t('retake.title')),
        h('p', { class: 'small muted' }, t('retake.intro')),
        h('div', { class: 'row' }, decksIn(cap.decks).map(d => h('button', {
          class: 'btn ghost', onclick: async () => {
            try { await ctx.api.retake(d.id); lastKey = null; ctx.refresh(); } catch (e) { toast(t(`error.${e.code}`, {}, t('error.generic'))); }
          }
        }, d.icon, ' ', loc(d.title)))));
    }
    const d = deckOf(cap.retakeDeck);
    const done = async () => { lastKey = null; await ctx.refresh(); };
    if (!me.retakeDone) {
      const steps = selfSteps({ deckIds: [d.id], api: ctx.api, kind: 'retake' });
      const saved = new Set(Object.keys(state.answers.retake || {}));
      for (const [k, rec] of Object.entries(state.answers.retake || {})) {
        if (!retakeDrafts.has(k)) retakeDrafts.set(k, { value: rec.pass ? null : { v: rec.v, label: rec.label }, pass: rec.pass, saved: true });
      }
      return h('div', {}, h('h3', {}, t('retake.now', { deck: loc(d.title) })),
        wizard({ steps, drafts: retakeDrafts, startAt: firstOpen(steps, saved), finishLabel: t('common.done'),
          onFinish: async () => { await ctx.api.complete('retake'); await done(); } }));
    }
    if (!p.retakeDone) return h('p', { class: 'banner' }, t('retake.waiting', { name: p.name }));
    if (!me.retakeGuessDone) {
      const steps = d.stage1.filter(q => q.predictable).map(q => {
        const qkey = `${d.id}:${q.id}`;
        return {
          key: `rg:${qkey}`,
          header: h('span', { class: 'eyebrow' }, '🔮 ', t('stage3.guessHeader', { name: p.name })),
          prompt: loc(q.prompt),
          render: (val, onChange) => questionInput({ q, deck: d, value: val, mode: 'guess', onChange }),
          complete: val => isComplete(q, d, val, 'guess'),
          why: val => whyIncomplete(q, d, val, 'guess'),
          save: (val, pass) => ctx.api.saveAnswer({ kind: 'retake_guess', qkey, pass, value: pass ? undefined : val })
        };
      });
      const guessed = new Set(Object.keys(state.answers.retake_guess || {}).map(k => `rg:${k}`));
      return h('div', {}, h('h3', {}, t('retake.guess', { name: p.name })),
        wizard({ steps, drafts: retakeDrafts, startAt: firstOpen(steps, guessed), finishLabel: t('common.done'),
          onFinish: async () => { await ctx.api.complete('retake_guess'); await done(); } }));
    }
    if (!p.retakeGuessDone) return h('p', { class: 'banner' }, t('retake.waiting', { name: p.name }));

    const box = h('div', {}, h('p', { class: 'muted small' }, t('common.loading')));
    ctx.api.compare().then(res => { compare = res; mount(box, compareView(state, compare)); })
      .catch(e => mount(box, h('p', { class: 'err' }, t(`error.${e.code}`, {}, t('error.generic')))));
    return box;
  }

  function compareView(state, cmp) {
    const d = deckOf(cmp.deck);
    const seats = [state.me.seat, state.partner.seat];
    const acc = (a, seat) => (a && a.bySeat[seat].total ? `${a.bySeat[seat].hits}/${a.bySeat[seat].total}` : '—');
    return h('div', {},
      h('h3', {}, t('retake.compareTitle', { deck: loc(d.title) })),
      cmp.accuracyThen || cmp.accuracyNow ? h('div', { class: 'card tight' },
        h('div', { class: 'eyebrow' }, t('map.accuracy')),
        seats.map(seat => h('p', { class: 'small', style: { margin: '0.2rem 0' } },
          seat === state.me.seat ? t('map.youRead', { name: state.partner.name }) : t('map.theyRead', { name: state.partner.name }),
          ': ', acc(cmp.accuracyThen, seat), ' → ', h('strong', {}, acc(cmp.accuracyNow, seat))))) : null,
      cmp.questions.map(qc => {
        const q = d.stage1.find(x => x.id === qc.qid);
        if (q.type === 'wishlist') {
          return h('div', { class: 'q-block' }, h('div', { class: 'q-title' }, loc(q.prompt)),
            h('p', { class: 'small' }, t('retake.wishMatches', { then: qc.matchesThen ?? '—', now: qc.matchesNow ?? '—' })));
        }
        return h('div', { class: 'q-block' },
          h('div', { class: 'q-title' }, loc(q.prompt)),
          h('div', { class: 'then-now' },
            h('span'), h('span', { class: 'h' }, t('retake.then')), h('span', { class: 'h' }, t('retake.nowCol')),
            seats.map(seat => [
              h('span', { class: 'small muted' }, nameOf(state, seat)),
              h('div', {}, answerOrPass(q, d, qc.then[seat], { api: null })),
              h('div', {}, answerOrPass(q, d, qc.now[seat], { api: null }))
            ])));
      }));
  }

  return { el: root, render };
}

export { formatValue };
