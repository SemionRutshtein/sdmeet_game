// "My answers": everything this player answered, as Markdown or JSON, to keep
// for later or to hand to an AI assistant or a therapist. Built in the browser
// from the player's own state only: the partner's answers never go in.
import { h, mount, toast, sheet, copyText } from '../dom.js';
import { t, loc, getLang, APP_NAME, formatDate } from '../i18n.js';
import { decksIn, poolText } from '../content.js';
import { valueText } from './format.js';

const today = () => new Date().toISOString().slice(0, 10);

// -> { meta, sections: [{ id, title, about, items: [{ id, prompt, detail, answer, passed, label, guess }] }] }
export function collectMyAnswers(state, { guesses = false, adult = false } = {}) {
  const partnerName = state.partner?.name || t('common.partner');
  const sections = [];
  for (const d of decksIn(state.room.decks)) {
    if (d.adult && !adult) continue;
    const items = [];
    for (const q of d.stage1) {
      const key = `${d.id}:${q.id}`;
      const rec = state.answers.self[key];
      const guess = guesses && q.predictable ? state.answers.guess[key] : null;
      if (!rec && !guess) continue;
      items.push({
        id: key,
        prompt: loc(q.prompt),
        detail: q.detail ? loc(q.detail) : null,
        passed: !!rec?.pass,
        answer: rec && !rec.pass ? valueText(q, d, rec.v) : null,
        label: rec?.label ? t(`label.${rec.label}`) : null,
        guess: guess ? (guess.pass ? t('reveal.passed') : valueText(q, d, guess.v)) : null
      });
    }
    if (items.length) sections.push({ id: d.id, title: loc(d.title), about: loc(d.goal), items });
  }

  const askedText = a => a.custom || poolText(a.deckId, a.poolId);
  const visible = a => adult || !a.deckId || !decksIn([a.deckId])[0]?.adult;
  const replies = (state.askedToMe || []).filter(visible).map(a => {
    const rec = state.answers.reply[a.id];
    return {
      id: `reply:${a.id}`,
      prompt: askedText(a),
      passed: !!rec?.pass,
      answer: rec && !rec.pass ? [rec.v.text, rec.v.voiceId ? t('export.voiceOnly') : null].filter(Boolean).join(' ') : null
    };
  }).filter(i => i.passed || i.answer);
  if (replies.length) sections.push({ id: 'replies', title: t('mine.replies', { name: partnerName }), items: replies });

  const asked = (state.asked || []).filter(visible).map(a => ({ id: `asked:${a.id}`, prompt: askedText(a) }));
  if (asked.length) sections.push({ id: 'asked', title: t('mine.asked', { name: partnerName }), about: t('mine.askedAbout'), items: asked, listOnly: true });

  return {
    meta: { app: APP_NAME, name: state.me.name, partner: partnerName, lang: getLang(), exportedAt: new Date().toISOString(), roomCreated: state.room.createdAt },
    sections
  };
}

export function toMarkdown(data, { aiNote = true, guesses = false } = {}) {
  const { meta } = data;
  const out = [`# ${t('mine.docTitle', { name: meta.name })}`, ''];
  out.push(`${meta.app} · ${t('mine.with', { name: meta.partner })} · ${formatDate(meta.exportedAt)}`, '');
  if (aiNote) out.push(`> ${t('mine.aiNote', { name: meta.partner })}`, '');
  for (const s of data.sections) {
    out.push(`## ${s.title}`, '');
    if (s.about) out.push(`_${s.about}_`, '');
    if (s.listOnly) {
      s.items.forEach(i => out.push(`- ${i.prompt}`));
      out.push('');
      continue;
    }
    for (const i of s.items) {
      out.push(`### ${i.prompt}`);
      if (i.detail) out.push(`_${i.detail}_`);
      out.push('');
      if (i.passed) out.push(`- ${t('mine.passed')}`);
      else if (i.answer) out.push(...i.answer.split('\n').map(line => `- ${line}`));
      if (i.label) out.push(`- ${t('label.howImportant')} ${i.label}`);
      if (guesses && i.guess) out.push(`- ${t('mine.myGuess', { name: meta.partner })} ${i.guess.split('\n').join('; ')}`);
      out.push('');
    }
  }
  return out.join('\n').trimEnd() + '\n';
}

export function toJson(data, { aiNote = true } = {}) {
  return JSON.stringify({
    ...data.meta,
    purpose: aiNote ? t('mine.aiNote', { name: data.meta.partner }) : undefined,
    sections: data.sections
  }, null, 2);
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function myAnswersSheet(state) {
  const s = sheet();
  const hasAdult = decksIn(state.room.decks).some(d => d.adult);
  const opts = { aiNote: true, guesses: false, adult: false };
  const preview = h('pre', { class: 'mine-preview', tabindex: '0', 'aria-label': t('mine.preview') });
  let md = '';
  let json = '';

  const refresh = () => {
    const data = collectMyAnswers(state, opts);
    md = toMarkdown(data, opts);
    json = toJson(data, opts);
    preview.textContent = data.sections.length ? md : t('mine.empty');
  };

  const toggle = (key, label) => {
    const box = h('input', { type: 'checkbox', checked: opts[key] });
    box.addEventListener('change', () => { opts[key] = box.checked; refresh(); });
    return h('label', { class: 'row small' }, box, label);
  };

  const file = ext => `two-maps-my-answers-${today()}.${ext}`;
  mount(s.el,
    h('div', { class: 'sheet-head' },
      h('div', { class: 'grow' }, h('div', { class: 'eyebrow' }, '📝 ', APP_NAME), h('h2', {}, t('mine.title'))),
      h('button', { class: 'close-x', 'aria-label': t('common.close'), onclick: s.close }, '✕')),
    h('p', { class: 'small' }, t('mine.intro')),
    h('div', { class: 'stack mine-options' },
      toggle('aiNote', t('mine.optAi')),
      toggle('guesses', t('mine.optGuesses', { name: state.partner?.name || t('common.partner') })),
      hasAdult ? toggle('adult', t('mine.optAdult')) : null),
    preview,
    h('div', { class: 'row wrap', style: { marginTop: '0.75rem' } },
      h('button', { class: 'btn primary small', onclick: async () => { if (await copyText(md)) toast(t('common.copied')); } }, t('mine.copy')),
      h('button', { class: 'btn ghost small', onclick: () => download(file('md'), md, 'text/markdown;charset=utf-8') }, '⬇ .md'),
      h('button', { class: 'btn ghost small', onclick: () => download(file('json'), json, 'application/json') }, '⬇ .json')),
    h('p', { class: 'tiny muted', style: { marginTop: '0.75rem' } }, '🔒 ', t('mine.privacy')));
  refresh();
  return s;
}
