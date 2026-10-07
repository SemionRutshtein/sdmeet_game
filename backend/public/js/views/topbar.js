import { h } from '../dom.js';
import { t, getLang, setLang, LANGS, APP_NAME } from '../i18n.js';

function partnerProgress(p, status) {
  if (status !== 'playing') return '';
  if (!p.stage1Done) return t('partner.atStage', { n: 1 });
  if (!p.stage2Done) return t('partner.atStage', { n: 2 });
  if (!p.stage3Done) return t('partner.atStage', { n: 3 });
  return t('partner.done');
}

export function topbar({ state, onMenu } = {}) {
  const p = state?.partner;
  return h('nav', { class: 'topbar' },
    h('a', { class: 'logo', href: '/' }, APP_NAME),
    state ? h('span', { class: 'partner-chip' },
      h('span', { class: `dot${p?.online ? ' on' : ''}` }),
      p ? `${p.name}${partnerProgress(p, state.room.status) ? ' · ' + partnerProgress(p, state.room.status) : ''}` : t('partner.notJoined')) : null,
    h('span', { class: 'spacer' }),
    h('span', { class: 'lang-switch', role: 'group', 'aria-label': 'Language' },
      LANGS.map(l => h('button', { type: 'button', 'aria-pressed': String(getLang() === l), lang: l, onclick: () => setLang(l) }, l.toUpperCase()))),
    onMenu ? h('button', { class: 'btn ghost small', 'aria-label': t('menu.title'), onclick: onMenu }, '⋯') : null
  );
}
