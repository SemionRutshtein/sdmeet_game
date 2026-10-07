// Answer widgets for every question type, in two modes:
//   self  - your own stage-1 answer (also the capsule retake)
//   guess - how you think your partner answered
import { h, mount } from '../dom.js';
import { t, loc } from '../i18n.js';
import { voiceRecorder } from '../voice.js';
import { C } from '../content.js';

const clone = v => (v ? JSON.parse(JSON.stringify(v)) : {});

function optionButton({ label, pressed, onClick, prefix }) {
  return h('button', { type: 'button', class: 'opt', 'aria-pressed': String(!!pressed), onclick: onClick }, prefix, h('span', {}, label));
}

function textBox({ value, max, placeholder, rows, onInput, single }) {
  const counter = h('div', { class: 'counter' }, `${(value || '').length} / ${max}`);
  const el = single
    ? h('input', { type: 'text', maxlength: max, placeholder, value: value || '' })
    : h('textarea', { maxlength: max, placeholder, rows: rows || 4 }, value || '');
  el.addEventListener('input', () => {
    counter.textContent = `${el.value.length} / ${max}`;
    onInput(el.value);
  });
  return h('div', {}, el, counter);
}

function choiceList(options, selected, onPick) {
  return h('div', { class: 'options' }, options.map(o => optionButton({
    label: o.icon ? `${o.icon} ${loc(o.label)}` : loc(o.label),
    pressed: selected === o.id,
    onClick: () => onPick(o.id)
  })));
}

function chipList(options, selected, onToggle) {
  return h('div', { class: 'options chips' }, options.map(o => optionButton({
    label: loc(o.label),
    pressed: selected.includes(o.id),
    onClick: () => onToggle(o.id)
  })));
}

function toggleMulti(options, current, id) {
  const opt = options.find(o => o.id === id);
  if (current.includes(id)) return current.filter(x => x !== id);
  if (opt.exclusive) return [id];
  return [...current.filter(x => !options.find(o => o.id === x)?.exclusive), id];
}

// Mirrors rankRange() in src/game/values.js
export function rankRange(q) {
  if (q.pick) return { min: q.pick, max: q.pick };
  return { min: Math.min(3, q.options.length), max: q.options.length };
}

// Why Next is disabled: { key, params } for t(), or null when the answer is complete.
export function whyIncomplete(q, deck, value, mode) {
  const v = value || {};
  if (isComplete(q, deck, v, mode)) return null;
  switch (q.type) {
    case 'rank': {
      if (mode === 'guess') break;
      const { min } = rankRange(q);
      return { key: 'why.rank', params: { k: (v.order || []).length, n: min } };
    }
    case 'choice':
      if (v.option && mode === 'self') return { key: 'why.custom' };
      break;
    case 'slider': return { key: 'why.slider' };
    case 'scene': return { key: 'why.scene' };
    case 'wishlist': {
      const total = C().wishlist.length;
      const done = C().wishlist.filter(w => v.items?.[w.id]).length;
      return { key: 'why.wishlist', params: { k: done, n: total } };
    }
    default: break;
  }
  return { key: 'why.answerOrPass' };
}

export function isComplete(q, deck, value, mode) {
  const v = value || {};
  switch (q.type) {
    case 'choice':
      if (!v.option) return false;
      if (mode === 'self' && q.options.find(o => o.id === v.option)?.custom) return !!v.custom?.trim();
      return true;
    case 'multi': return !!v.options?.length;
    case 'rank': {
      if (mode === 'guess') return !!v.option;
      const { min, max } = rankRange(q);
      const n = v.order?.length || 0;
      return n >= min && n <= max;
    }
    case 'scale':
    case 'slider': return Number.isInteger(v.value);
    case 'text': return !!(v.text?.trim() || v.voiceId);
    case 'weather': return !!v.icon;
    case 'scene': return !!(v.feel?.length && v.do);
    case 'wishlist': return C().wishlist.every(w => v.items?.[w.id]);
    default: return false;
  }
}

// Returns an element. onChange(value) fires on every change.
export function questionInput({ q, deck, value, mode, onChange, api, voiceContext }) {
  const root = h('div', { class: 'input' });
  let v = clone(value);
  const set = patch => {
    v = { ...v, ...patch };
    onChange(v);
    render();
  };
  const quiet = patch => {
    v = { ...v, ...patch };
    onChange(v);
  };

  function render() {
    switch (q.type) {
      case 'choice': {
        const parts = [choiceList(q.options, v.option, id => set({ option: id }))];
        if (mode === 'self' && q.options.find(o => o.id === v.option)?.custom) {
          parts.push(h('div', { class: 'sub-q' }, textBox({
            value: v.custom, max: 200, single: true, placeholder: t('input.yourOption'),
            onInput: text => quiet({ custom: text })
          })));
        }
        if (mode === 'self' && q.followup) {
          parts.push(h('div', { class: 'sub-q' },
            h('div', { class: 'label' }, loc(q.followup.prompt), ' ', h('span', { class: 'muted' }, t('input.optional'))),
            textBox({ value: v.followup, max: q.followup.maxLength || 600, rows: 3, onInput: text => quiet({ followup: text }) })
          ));
        }
        return mount(root, parts);
      }
      case 'multi':
        return mount(root,
          h('p', { class: 'muted small' }, t('input.multiHint')),
          chipList(q.options, v.options || [], id => set({ options: toggleMulti(q.options, v.options || [], id) }))
        );
      case 'rank': {
        if (mode === 'guess') {
          return mount(root,
            h('p', { class: 'muted small' }, t('input.rankGuessHint')),
            choiceList(q.options, v.option, id => set({ option: id }))
          );
        }
        const order = v.order || [];
        const { min, max } = rankRange(q);
        return mount(root,
          h('p', { class: 'muted small' }, q.pick ? t('input.rankPickHint', { n: min }) : t('input.rankHint', { n: min })),
          h('div', { class: 'options' }, q.options.map(o => {
            const i = order.indexOf(o.id);
            return optionButton({
              label: loc(o.label),
              pressed: i >= 0,
              prefix: h('span', { class: 'rank-num' }, i >= 0 ? String(i + 1) : ''),
              onClick: () => {
                if (i >= 0) set({ order: order.filter(x => x !== o.id) });
                else if (order.length < max) set({ order: [...order, o.id] });
              }
            });
          })),
          h('div', { class: 'row between', style: { marginTop: '0.5rem' } },
            h('span', { class: `tiny ${order.length >= min ? 'muted' : ''}` }, order.length > min ? t('input.rankCountMore', { k: order.length }) : t('input.rankCount', { k: order.length, n: min })),
            order.length ? h('button', { type: 'button', class: 'link-btn', onclick: () => set({ order: [] }) }, t('input.reset')) : h('span'))
        );
      }
      case 'scale': {
        const nums = [];
        for (let n = q.min; n <= q.max; n++) nums.push(n);
        return mount(root,
          h('div', { class: 'scale' }, nums.map(n => h('button', {
            type: 'button', class: 'opt', 'aria-pressed': String(v.value === n), onclick: () => set({ value: n })
          }, String(n)))),
          h('div', { class: 'scale-ends' }, h('span', {}, t('scale.low')), h('span', {}, t('scale.high')))
        );
      }
      case 'slider': {
        const touched = Number.isInteger(v.value);
        const shown = touched ? v.value : 50;
        const readout = h('div', { class: 'slider-value' }, touched ? (q.unit ? `${shown}${q.unit} · ${loc(q.right)}` : '✓') : t('input.moveSlider'));
        const range = h('input', { type: 'range', min: 0, max: 100, step: 5, value: shown, 'aria-label': loc(q.prompt) });
        const commit = () => {
          const n = parseInt(range.value, 10);
          readout.textContent = q.unit ? `${n}${q.unit} · ${loc(q.right)}` : '✓';
          quiet({ value: n });
        };
        // 'input' fires only when the value changes; a plain tap on the handle
        // (keeping 50) should count as an answer too.
        range.addEventListener('input', commit);
        range.addEventListener('change', commit);
        range.addEventListener('pointerup', commit);
        range.addEventListener('keyup', commit);
        return mount(root,
          h('div', { class: 'slider-wrap' }, readout, range,
            h('div', { class: 'slider-ends' }, h('span', {}, loc(q.left)), h('span', {}, loc(q.right))))
        );
      }
      case 'text':
        return mount(root,
          textBox({ value: v.text, max: q.maxLength || 1000, placeholder: t('input.typeHere'), onInput: text => quiet({ text }) }),
          q.voice && api ? voiceRecorder({
            api,
            context: voiceContext,
            voiceId: v.voiceId,
            onChange: id => { if (id) v.voiceId = id; else delete v.voiceId; onChange(v); }
          }) : null
        );
      case 'weather':
        return mount(root,
          h('div', { class: 'weather-grid' }, q.options.map(o => h('button', {
            type: 'button', class: 'opt', 'aria-pressed': String(v.icon === o.id), onclick: () => set({ icon: o.id })
          }, h('span', { class: 'icon' }, o.icon), loc(o.label)))),
          mode === 'self' ? h('div', { class: 'sub-q' },
            h('div', { class: 'label' }, t('input.weatherPhrase')),
            textBox({ value: v.phrase, max: q.maxLength || 120, single: true, placeholder: t('input.weatherPlaceholder'), onInput: phrase => quiet({ phrase }) })
          ) : null
        );
      case 'scene': {
        const f = deck.sceneFields;
        return mount(root,
          h('div', { class: 'sub-q' }, h('div', { class: 'label' }, loc(f.feel.prompt)),
            chipList(f.feel.options, v.feel || [], id => set({ feel: toggleMulti(f.feel.options, v.feel || [], id) }))),
          h('div', { class: 'sub-q' }, h('div', { class: 'label' }, loc(f.do.prompt)),
            choiceList(f.do.options, v.do, id => set({ do: id }))),
          mode === 'self' ? h('div', { class: 'sub-q' }, h('div', { class: 'label' }, loc(f.want.prompt)),
            textBox({ value: v.want, max: f.want.maxLength || 140, single: true, placeholder: t('input.oneLine'), onInput: want => quiet({ want }) })) : null
        );
      }
      case 'wishlist': {
        const items = v.items || {};
        return mount(root,
          q.hint ? h('p', { class: 'banner' }, '🔒 ', loc(q.hint)) : null,
          C().wishlist.map(w => h('div', { class: 'wish-row' },
            h('span', {}, loc(w.label)),
            h('div', { class: 'seg' }, ['yes', 'maybe', 'no'].map(level => h('button', {
              type: 'button',
              'aria-pressed': String(items[w.id] === level),
              onclick: () => set({ items: { ...items, [w.id]: level } })
            }, t(`wish.${level}`))))
          ))
        );
      }
      default:
        return mount(root, h('p', { class: 'err' }, q.type));
    }
  }

  render();
  return root;
}
