// Stage 1 (about me), stage 2 (questions for my partner), stage 3 (answer + guess)
// and the waiting screens between them.
import { h, mount, toast, copyText } from '../dom.js';
import { t, loc } from '../i18n.js';
import { decksIn, deck as deckOf, poolText, C } from '../content.js';
import { questionInput, isComplete } from './inputs.js';
import { wizard, firstOpen } from './wizard.js';
import { voiceRecorder } from '../voice.js';

const LABELS = ['negotiable', 'important', 'fixed'];

function deckHeader(d) {
  return h('span', { class: 'eyebrow' }, d.icon, ' ', loc(d.title));
}

function seedDrafts(drafts, answers, toKey = k => k, wrap = rec => rec.v) {
  for (const [k, rec] of Object.entries(answers || {})) {
    const key = toKey(k);
    if (!drafts.has(key)) drafts.set(key, { value: rec.pass ? null : wrap(rec), pass: rec.pass, saved: true });
  }
}

function labelBar(cur, onPick) {
  const bar = h('div', { class: 'labels-bar' });
  const draw = () => mount(bar,
    h('div', { class: 'tiny muted', style: { marginBottom: '0.4rem' } }, t('label.howImportant')),
    h('div', { class: 'seg' }, LABELS.map(l => h('button', {
      type: 'button', 'aria-pressed': String(cur.label === l), onclick: () => { onPick(l); draw(); }
    }, t(`label.${l}`))))
  );
  draw();
  return bar;
}

// Own stage-1 answers. Also used for the capsule retake (kind = 'retake').
export function selfSteps({ deckIds, api, kind = 'self' }) {
  const steps = [];
  for (const d of decksIn(deckIds)) {
    d.stage1.forEach((q, idx) => {
      const key = `${d.id}:${q.id}`;
      steps.push({
        key,
        header: deckHeader(d),
        prompt: h('div', {},
          idx === 0 && kind === 'self' ? h('p', { class: 'small muted', style: { fontFamily: 'var(--sans)' } }, loc(d.tagline), ' ', loc(d.goal)) : null,
          q.lock ? h('span', { class: 'pill gold', style: { marginInlineEnd: '0.5rem' } }, '🔒 ', t('lock.short')) : null,
          loc(q.prompt)),
        render(val, onChange) {
          const cur = { v: val?.v, label: val?.label };
          return h('div', {},
            questionInput({
              q, deck: d, value: cur.v, mode: 'self', api,
              voiceContext: { kind: 'self', qkey: key },
              onChange: v => { cur.v = v; onChange({ ...cur }); }
            }),
            d.labels ? labelBar(cur, l => { cur.label = l; onChange({ ...cur }); }) : null
          );
        },
        complete: val => !!val && isComplete(q, d, val.v, 'self') && (!d.labels || !!val.label),
        save: (val, pass) => api.saveAnswer({ kind, qkey: key, pass, value: pass ? undefined : val.v, label: pass ? undefined : val.label })
      });
    });
  }
  return steps;
}

export function stage1View({ state, api, drafts, refresh, review, exitReview }) {
  seedDrafts(drafts, state.answers.self, k => k, rec => ({ v: rec.v, label: rec.label }));
  const steps = selfSteps({ deckIds: state.room.decks, api });
  const saved = new Set(Object.keys(state.answers.self));
  const el = h('div', {},
    review ? h('div', { class: 'banner row between' }, t('stage1.reviewing'),
      h('button', { class: 'link-btn', onclick: exitReview }, t('common.done'))) : stageIntro(1),
    wizard({
      steps,
      drafts,
      startAt: review ? 0 : firstOpen(steps, saved),
      finishLabel: review ? t('common.done') : t('stage1.finish'),
      onFinish: async () => {
        if (!state.me.stage1Done) await api.complete('1');
        if (review) exitReview();
        await refresh();
      }
    })
  );
  return { el };
}

function stageIntro(n) {
  return h('div', { class: 'card tight' },
    h('div', { class: 'eyebrow' }, t('stage.label', { n })),
    h('h2', {}, t(`stage${n}.title`)),
    h('p', { class: 'muted small', style: { margin: 0 } }, t(`stage${n}.intro`)));
}

// ---------- stage 2 ----------

export function stage2View({ state, api, drafts, refresh, partnerName, enterReview }) {
  const C0 = C();
  const key = '__stage2';
  if (!drafts.has(key)) drafts.set(key, { items: state.asked.map(a => (a.poolId ? { deckId: a.deckId, poolId: a.poolId } : { custom: a.custom, lock: a.lock })) });
  const sel = drafts.get(key);
  const adult = state.room.decks.some(id => deckOf(id)?.adult);
  const root = h('div');

  const isSel = (deckId, poolId) => sel.items.some(i => i.deckId === deckId && i.poolId === poolId);
  const toggle = (deckId, poolId) => {
    if (isSel(deckId, poolId)) sel.items = sel.items.filter(i => !(i.deckId === deckId && i.poolId === poolId));
    else if (sel.items.length < C0.askMax) sel.items.push({ deckId, poolId });
    render();
  };

  function render() {
    const n = sel.items.length;
    const okCount = n >= C0.askMin && n <= C0.askMax;
    const customInput = h('input', { type: 'text', maxlength: 300, placeholder: t('stage2.customPlaceholder') });
    const lockBox = h('input', { type: 'checkbox' });
    const send = h('button', { class: 'btn primary block', disabled: !okCount }, t('stage2.send', { name: partnerName }));
    send.addEventListener('click', async () => {
      send.disabled = true;
      try {
        await api.submitAsked(sel.items);
        await refresh();
      } catch (e) {
        toast(t(`error.${e.code}`, {}, t('error.generic')));
        send.disabled = false;
      }
    });

    mount(root,
      stageIntro(2),
      !state.frozen ? h('p', { class: 'small' }, h('button', { class: 'link-btn', onclick: enterReview }, t('stage1.review'))) : null,
      decksIn(state.room.decks).map(d => h('div', { class: 'card' },
        h('div', { class: 'eyebrow' }, d.icon, ' ', loc(d.title)),
        d.pool.map(p => {
          const on = isSel(d.id, p.id);
          return h('label', { class: `check${on ? ' on' : ''}` },
            h('input', { type: 'checkbox', checked: on, disabled: !on && n >= C0.askMax, onchange: () => toggle(d.id, p.id) }),
            h('span', {}, p.lock ? '🔒 ' : '', loc(p.text)));
        })
      )),
      h('div', { class: 'card' },
        h('div', { class: 'eyebrow' }, t('stage2.ownQuestion')),
        customInput,
        adult ? h('label', { class: 'row small', style: { marginTop: '0.5rem' } }, lockBox, '🔒 ', t('stage2.customLock')) : null,
        h('div', { class: 'row end', style: { marginTop: '0.5rem' } },
          h('button', {
            class: 'btn ghost small',
            onclick: () => {
              const text = customInput.value.trim();
              if (!text || sel.items.length >= C0.askMax) return;
              sel.items.push({ custom: text, lock: adult && lockBox.checked });
              render();
            }
          }, t('stage2.add'))),
        sel.items.filter(i => i.custom).map(i => h('div', { class: 'rule-item row between' },
          h('span', {}, i.lock ? '🔒 ' : '', i.custom),
          h('button', { class: 'link-btn', onclick: () => { sel.items = sel.items.filter(x => x !== i); render(); } }, t('common.remove'))))
      ),
      h('div', { class: 'card tight', style: { position: 'sticky', bottom: '0.5rem' } },
        h('p', { class: 'small', style: { marginBottom: '0.5rem' } },
          t('stage2.count', { n, min: C0.askMin, max: C0.askMax }), ' · ',
          h('span', { class: 'muted' }, t('stage2.hidden', { name: partnerName }))),
        send)
    );
  }
  render();
  return { el: root };
}

// ---------- stage 3 ----------

export function stage3View({ state, api, drafts, refresh, partnerName }) {
  seedDrafts(drafts, state.answers.reply, k => `reply:${k}`);
  seedDrafts(drafts, state.answers.guess, k => `guess:${k}`);
  const steps = [];
  for (const a of state.askedToMe) {
    const key = `reply:${a.id}`;
    const text = a.custom || poolText(a.deckId, a.poolId);
    steps.push({
      key,
      header: h('span', { class: 'eyebrow' }, '✉️ ', t('stage3.fromPartner', { name: partnerName })),
      prompt: h('div', {}, a.lock ? h('span', { class: 'pill gold', style: { marginInlineEnd: '0.5rem' } }, '🔒 ', t('lock.short')) : null, text),
      render(val, onChange) {
        const cur = { ...(val || {}) };
        const ta = h('textarea', { maxlength: 2000, placeholder: t('input.typeHere'), rows: 5 }, cur.text || '');
        ta.addEventListener('input', () => { cur.text = ta.value; onChange({ ...cur }); });
        return h('div', {}, ta, voiceRecorder({
          api, context: { kind: 'reply', askedId: a.id }, voiceId: cur.voiceId,
          onChange: id => { if (id) cur.voiceId = id; else delete cur.voiceId; onChange({ ...cur }); }
        }));
      },
      complete: val => !!(val?.text?.trim() || val?.voiceId),
      save: (val, pass) => api.saveAnswer({ kind: 'reply', qkey: a.id, pass, value: pass ? undefined : val })
    });
  }
  for (const d of decksIn(state.room.decks)) {
    for (const q of d.stage1.filter(x => x.predictable)) {
      const qkey = `${d.id}:${q.id}`;
      steps.push({
        key: `guess:${qkey}`,
        header: h('span', { class: 'eyebrow' }, '🔮 ', t('stage3.guessHeader', { name: partnerName }), ' · ', loc(d.title)),
        prompt: h('div', {}, h('div', { class: 'small muted', style: { fontFamily: 'var(--sans)' } }, t('stage3.guessIntro', { name: partnerName })), loc(q.prompt)),
        render: (val, onChange) => questionInput({ q, deck: d, value: val, mode: 'guess', onChange }),
        complete: val => isComplete(q, d, val, 'guess'),
        save: (val, pass) => api.saveAnswer({ kind: 'guess', qkey, pass, value: pass ? undefined : val })
      });
    }
  }
  const saved = new Set([
    ...Object.keys(state.answers.reply).map(k => `reply:${k}`),
    ...Object.keys(state.answers.guess).map(k => `guess:${k}`)
  ]);
  const el = h('div', {},
    stageIntro(3),
    !state.me.guessStarted ? h('p', { class: 'banner small' }, t('stage3.freezeNote', { name: partnerName })) : null,
    wizard({
      steps,
      drafts,
      startAt: firstOpen(steps, saved),
      finishLabel: t('stage3.finish'),
      onFinish: async () => { await api.complete('3'); await refresh(); }
    })
  );
  return { el };
}

// ---------- waiting ----------

export function inviteBox(roomId) {
  const url = `${location.origin}/join/${roomId}`;
  return h('div', { class: 'banner' },
    h('div', {}, t('invite.text')),
    h('div', { class: 'copy-box' }, h('code', {}, url),
      h('button', { class: 'btn ghost small', onclick: async () => { if (await copyText(url)) toast(t('common.copied')); } }, t('common.copy')),
      navigator.share ? h('button', { class: 'btn ghost small', onclick: () => navigator.share({ title: 'SDMeet', text: t('invite.shareText'), url }).catch(() => {}) }, t('common.share')) : null));
}

export function waitingView({ state, partnerName, enterReview, reason }) {
  const me = state.me;
  const p = state.partner;
  const row = (label, mine, theirs) => h('li', {}, h('span', {}, label),
    h('span', { class: `state${mine ? ' done' : ''}` }, mine ? '✓' : '…', ' ', t('common.you')),
    h('span', { class: `state${theirs ? ' done' : ''}` }, theirs ? '✓' : '…', ' ', p ? p.name : '—'));
  const el = h('div', {},
    !p ? inviteBox(state.room.id) : null,
    h('div', { class: 'card' },
      h('div', { class: 'row' }, h('span', { class: 'dot pulse' }), h('h2', { style: { margin: 0 } }, t(`wait.${reason}.title`, { name: partnerName }))),
      h('p', { class: 'muted', style: { marginTop: '0.5rem' } }, t(`wait.${reason}.text`, { name: partnerName })),
      h('ul', { class: 'steps' },
        row(t('stage1.title'), me.stage1Done, p?.stage1Done),
        row(t('stage2.title'), me.stage2Done, p?.stage2Done),
        row(t('stage3.title'), me.stage3Done, p?.stage3Done)),
      !state.frozen && reason !== 'reveal' ? h('p', { class: 'small', style: { marginTop: '1rem' } },
        h('button', { class: 'link-btn', onclick: enterReview }, t('stage1.review'))) : null,
      state.frozen ? h('p', { class: 'small muted', style: { marginTop: '1rem' } }, t('stage1.frozen', { name: partnerName })) : null
    )
  );
  return { el };
}
