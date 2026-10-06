// One-question-per-screen flow used by stage 1, stage 3 and the capsule retake.
// steps: [{ key, header, prompt, render(onChange) -> el, complete(value), save(value, pass) }]
import { h, mount, toast } from '../dom.js';
import { t } from '../i18n.js';

export function wizard({ steps, startAt = 0, finishLabel, onFinish, drafts, allowPass = true }) {
  const root = h('div', { class: 'wizard' });
  let i = Math.min(Math.max(startAt, 0), steps.length - 1);
  let busy = false;

  function render() {
    const step = steps[i];
    let value = drafts.get(step.key)?.value;
    const isLast = i === steps.length - 1;
    const next = h('button', { type: 'button', class: 'btn primary grow' }, isLast ? finishLabel : t('common.next'));
    const sync = () => { next.disabled = busy || !step.complete(value); };
    const input = step.render(value, v => {
      value = v;
      drafts.set(step.key, { value: v, pass: false });
      sync();
    });
    sync();

    next.addEventListener('click', () => go(step, value, false, isLast));
    const pass = allowPass ? h('button', { type: 'button', class: 'btn ghost', onclick: () => go(step, null, true, isLast) }, t('common.pass')) : null;
    const back = h('button', { type: 'button', class: 'btn ghost', disabled: i === 0, onclick: () => { i--; render(); } }, t('common.back'));

    const saved = drafts.get(step.key);
    mount(root,
      h('div', { class: 'card' },
        h('div', { class: 'row between' }, step.header, h('span', { class: 'tiny muted' }, `${i + 1} / ${steps.length}`)),
        h('div', { class: 'progress' }, h('div', { style: { width: `${((i + 1) / steps.length) * 100}%` } })),
        h('div', { class: 'question-prompt' }, step.prompt),
        saved?.pass ? h('p', { class: 'pill' }, t('wizard.passedHere')) : null,
        input,
        step.extra ? step.extra(() => value, sync) : null,
        h('div', { class: 'wizard-nav' }, back, pass, next)
      )
    );
    root.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  async function go(step, value, pass, isLast) {
    if (busy) return;
    busy = true;
    try {
      await step.save(value, pass);
      drafts.set(step.key, { value: pass ? null : value, pass, saved: true });
      if (isLast) await onFinish();
      else i++;
    } catch (e) {
      toast(t(`error.${e.code}`, {}, t('error.generic')));
      if (e.code === 'incomplete' && e.details?.length) {
        const j = steps.findIndex(s => s.key === e.details[0]);
        if (j >= 0) i = j;
      }
    }
    busy = false;
    if (root.isConnected) render();
  }

  render();
  return root;
}

// First step without a saved answer, or 0
export function firstOpen(steps, savedKeys) {
  const j = steps.findIndex(s => !savedKeys.has(s.key));
  return j < 0 ? steps.length - 1 : j;
}
