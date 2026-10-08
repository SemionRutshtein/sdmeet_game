// "How it works": a four-scene animated walkthrough with a real sample
// question. Autoplays, swipeable, keyboard and screen-reader friendly, and
// still (all scenes in their final state) when reduced motion is requested.
import { h, mount, sheet } from '../dom.js';
import { t, loc } from '../i18n.js';
import { deck as deckOf } from '../content.js';
import { reducedMotion } from '../motion.js';

const SCENE_MS = 6000;

function phone(...children) {
  return h('div', { class: 'phone', 'aria-hidden': 'true' }, ...children);
}

function sampleQuestion() {
  const q = deckOf('no-gloss')?.stage1.find(x => x.id === 'anger');
  const opts = q ? q.options.filter(o => !o.custom).slice(0, 3).map(o => loc(o.label)) : ['…', '…', '…'];
  return { prompt: q ? loc(q.prompt) : '', opts };
}

function sceneAnswer() {
  const { prompt, opts } = sampleQuestion();
  return phone(
    h('div', { class: 'ph-who' }, h('span', { class: 'avatar a' }, t('demo.nameA')[0]), t('demo.nameA')),
    h('div', { class: 'ph-q' }, prompt),
    opts.map((o, i) => h('div', { class: `ph-opt${i === 1 ? ' pick' : ''}` }, o))
  );
}

function sceneGuess() {
  const { opts } = sampleQuestion();
  const a = t('demo.nameA');
  return phone(
    h('div', { class: 'ph-who' }, h('span', { class: 'avatar b' }, t('demo.nameB')[0]), t('demo.nameB'), h('span', { class: 'ph-tag' }, '🔮')),
    h('div', { class: 'ph-q' }, t('demo.guessQ', { name: a })),
    opts.map((o, i) => h('div', { class: `ph-opt${i === 0 ? ' pick' : ''}` }, o)),
    h('div', { class: 'ph-stamp' }, '🔒 ', t('demo.sealed')),
  );
}

function sceneReveal() {
  const { opts } = sampleQuestion();
  return phone(
    h('div', { class: 'ph-tiles' },
      h('div', { class: 'ph-tile flip' },
        h('div', { class: 'face back' }, '🌦️'),
        h('div', { class: 'face front' },
          h('div', { class: 'ph-mini' }, t('demo.answered', { name: t('demo.nameA') })),
          h('div', { class: 'ph-val' }, opts[1]),
          h('div', { class: 'ph-mini' }, t('demo.guessed', { name: t('demo.nameB') })),
          h('div', { class: 'ph-val' }, opts[0], ' ', h('span', { class: 'pill miss' }, t('reveal.miss'))))),
      h('div', { class: 'ph-tile' }, h('div', { class: 'face back solo' }, '⛰️')),
      h('div', { class: 'ph-tile' }, h('div', { class: 'face back solo' }, '📵'))),
    h('div', { class: 'ph-line l1' }, t('concl.guess_none')),
    h('div', { class: 'ph-line l2 talk-mini' }, '💬 ', loc(deckOf('no-gloss')?.reveal.talk))
  );
}

function sceneKeep() {
  return phone(
    h('div', { class: 'ph-rule' }, '★ ', t('demo.rule')),
    h('div', { class: 'ph-capsule' }, h('span', { class: 'cap-icon' }, '⏳'), t('demo.capsule')),
    h('div', { class: 'ph-hearts' }, h('span', {}, '🗺️'), h('span', {}, '🗺️'))
  );
}

const SCENES = [
  { title: 'demo.s1t', text: 'demo.s1d', art: sceneAnswer },
  { title: 'demo.s2t', text: 'demo.s2d', art: sceneGuess },
  { title: 'demo.s3t', text: 'demo.s3d', art: sceneReveal },
  { title: 'demo.s4t', text: 'demo.s4d', art: sceneKeep }
];

export function explainer({ autoplay = true } = {}) {
  const still = reducedMotion();
  const root = h('section', {
    class: `demo${still ? ' still' : ''}`,
    'aria-roledescription': 'carousel',
    'aria-label': t('demo.eyebrow')
  });
  let i = 0;
  let playing = autoplay && !still;
  let timer = null;
  let hovering = false;
  let visible = true;

  const stage = h('div', { class: 'demo-stage', 'aria-live': playing ? 'off' : 'polite' });
  const dots = h('div', { class: 'demo-dots', role: 'tablist' });
  const toggle = h('button', { type: 'button', class: 'demo-btn', onclick: () => { playing = !playing; schedule(); drawControls(); } });

  function show(n) {
    i = (n + SCENES.length) % SCENES.length;
    const s = SCENES[i];
    mount(stage, h('div', { class: 'scene play', role: 'group', 'aria-roledescription': 'slide', 'aria-label': t('demo.step', { n: i + 1 }) },
      h('div', { class: 'scene-text' },
        h('div', { class: 'scene-num' }, String(i + 1).padStart(2, '0')),
        h('h3', {}, t(s.title)),
        h('p', {}, t(s.text))),
      h('div', { class: 'scene-art' }, s.art())));
    drawControls();
    schedule();
  }

  function drawControls() {
    mount(dots, SCENES.map((s, n) => h('button', {
      type: 'button', role: 'tab', class: 'dot-btn', 'aria-selected': String(n === i),
      'aria-label': `${t('demo.step', { n: n + 1 })}: ${t(s.title)}`, onclick: () => show(n)
    }, h('span', { class: 'fill' }))));
    toggle.textContent = playing ? '❚❚' : '▶';
    toggle.setAttribute('aria-label', playing ? t('demo.pause') : t('demo.play'));
    root.classList.toggle('playing', playing);
  }

  function schedule() {
    clearTimeout(timer);
    if (!playing || hovering || !visible) return;
    timer = setTimeout(() => { if (root.isConnected) show(i + 1); }, SCENE_MS);
  }

  // swipe
  let x0 = null;
  stage.addEventListener('pointerdown', e => { x0 = e.clientX; });
  stage.addEventListener('pointerup', e => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 40) return;
    const rtl = document.documentElement.dir === 'rtl';
    show(i + ((dx < 0) !== rtl ? 1 : -1));
  });
  root.addEventListener('keydown', e => {
    const rtl = document.documentElement.dir === 'rtl';
    if (e.key === 'ArrowRight') show(i + (rtl ? -1 : 1));
    if (e.key === 'ArrowLeft') show(i + (rtl ? 1 : -1));
  });
  root.addEventListener('pointerenter', () => { hovering = true; schedule(); });
  root.addEventListener('pointerleave', () => { hovering = false; schedule(); });
  root.addEventListener('focusin', () => { hovering = true; schedule(); });
  root.addEventListener('focusout', () => { hovering = false; schedule(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); }).observe(root);
  }
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; schedule(); });

  mount(root,
    h('div', { class: 'eyebrow' }, '✦ ', t('demo.eyebrow')),
    stage,
    h('div', { class: 'demo-controls' },
      h('button', { type: 'button', class: 'demo-btn', 'aria-label': t('demo.prev'), onclick: () => show(i - 1) }, h('span', { class: 'flip-rtl' }, '‹')),
      dots,
      h('button', { type: 'button', class: 'demo-btn', 'aria-label': t('demo.next'), onclick: () => show(i + 1) }, h('span', { class: 'flip-rtl' }, '›')),
      still ? null : toggle));
  show(0);
  return root;
}

export function howToPlaySheet() {
  const s = sheet();
  mount(s.el,
    h('div', { class: 'sheet-head' }, h('h2', { class: 'grow' }, t('menu.howTo')),
      h('button', { class: 'close-x', 'aria-label': t('common.close'), onclick: s.close }, '✕')),
    explainer());
  return s;
}
