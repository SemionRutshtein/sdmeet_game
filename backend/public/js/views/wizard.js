// One-question-per-screen flow used by stage 1, stage 3 and the capsule retake.
// steps: [{ key, header, prompt, render(onChange) -> el, complete(value), save(value, pass) }]
import { h, mount, toast } from '../dom.js';
import { t } from '../i18n.js';
import { transition } from '../motion.js';

export function wizard({ steps, startAt = 0, finishLabel, onFinish, drafts, allowPass = true }) {
  const root = h('div', { class: 'wizard' });
  let i = Math.min(Math.max(startAt, 0), steps.length - 1);
  let busy = false;

  function render() {
    const step = steps[i];
    let value = drafts.get(step.key)?.value;
    const isLast = i === steps.length - 1;
    const next = h('button', { type: 'button', class: 'btn primary grow' }, isLast ? finishLabel : step.nextLabel || t('common.next'));
    const why = h('p', { class: 'why tiny', 'aria-live': 'polite' });
    const sync = () => {
      next.disabled = busy || (!step.intro && !step.complete(value));
      const reason = !busy && next.disabled && step.why ? step.why(value) : null;
      why.textContent = reason ? t(reason.key, reason.params || {}) : '';
    };
    const input = step.render(value, v => {
      value = v;
      drafts.set(step.key, { value: v, pass: false });
      sync();
    });
    sync();

    next.addEventListener('click', () => go(step, value, false, isLast));
    const pass = allowPass && !step.intro ? h('button', { type: 'button', class: 'btn ghost', onclick: () => go(step, null, true, isLast) }, t('common.pass')) : null;
    const back = h('button', { type: 'button', class: 'btn ghost', disabled: i === 0, onclick: () => { i--; transition(render); } }, t('common.back'));

    const saved = drafts.get(step.key);
    // Counter and progress count questions only, not intro cards.
    const qTotal = steps.filter(x => !x.intro).length;
    const qNum = steps.slice(0, i + 1).filter(x => !x.intro).length;
    if (step.intro) {
      mount(root,
        h('div', { class: 'card intro-card' },
          input,
          h('div', { class: 'wizard-nav' }, back, next)));
      return;
    }
    mount(root,
      h('div', { class: 'card question-card' },
        h('div', { class: 'row between' }, step.header, h('span', { class: 'tiny muted counter-q' }, `${qNum} / ${qTotal}`)),
        h('div', { class: 'progress' }, h('div', { style: { width: `${(qNum / qTotal) * 100}%` } })),
        h('div', { class: 'question-prompt' }, step.prompt),
        saved?.pass ? h('p', { class: 'pill' }, t('wizard.passedHere')) : null,
        input,
        step.extra ? step.extra(() => value, sync) : null,
        h('div', { class: 'wizard-nav' }, back, pass, next),
        why
      )
    );
  }

  async function go(step, value, pass, isLast) {
    if (busy) return;
    busy = true;
    const from = i;
    try {
      if (!step.intro) {
        await step.save(value, pass);
        drafts.set(step.key, { value: pass ? null : value, pass, saved: true });
      }
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
    if (!root.isConnected) return;
    await transition(render);
    if (i !== from) {
      const top = root.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.4) root.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    }
  }

  render();
  return root;
}

// First question without a saved answer (or its deck intro), else the last step.
export function firstOpen(steps, savedKeys) {
  const j = steps.findIndex(s => !s.intro && !savedKeys.has(s.key));
  if (j < 0) return steps.length - 1;
  return j > 0 && steps[j - 1].intro ? j - 1 : j;
}
