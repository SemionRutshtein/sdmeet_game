// "Our map": accuracy, climate, relief, rules, come-back-later, share image,
// PDF export (both must agree), the capsule and room deletion.
import { h, mount, toast } from '../dom.js';
import { t, loc } from '../i18n.js';
import { deck as deckOf, weatherIcon } from '../content.js';
import { drawShareImage } from '../share.js';
import { capsuleSection } from './capsule.js';
import { cardTitle } from './format.js';

export function mapView(ctx) {
  const root = h('div');
  let summary = null;
  let loading = false;
  const capsule = capsuleSection(ctx);

  async function render(state) {
    if (loading) return;
    loading = true;
    try {
      summary = await ctx.api.summary();
    } catch (e) {
      toast(t(`error.${e.code}`, {}, t('error.generic')));
      return;
    } finally {
      loading = false;
    }
    draw(state);
    capsule.render(state);
  }

  const both = arr => arr.includes(1) && arr.includes(2);
  const nameOf = (state, seat) => (seat === state.me.seat ? t('common.you') : state.partner.name);

  function consentRow(state, type, label) {
    const seats = summary.consents[type];
    const mine = seats.includes(state.me.seat);
    const theirs = seats.includes(state.partner.seat);
    return h('div', { class: 'consent-row' },
      h('div', {}, h('div', {}, label),
        h('div', { class: 'tiny muted' }, theirs ? t('consent.theyAgreed', { name: state.partner.name }) : t('consent.theyNot', { name: state.partner.name }))),
      h('button', {
        class: `btn small ${mine ? 'primary' : 'ghost'}`,
        onclick: async () => { await ctx.api.consent(type, !mine); ctx.refresh(); }
      }, mine ? t('consent.agreed') : t('consent.agree')));
  }

  function draw(state) {
    const s = summary;
    const adult = state.room.decks.some(id => deckOf(id)?.adult);
    const shareRules = both(s.consents.share);
    const preview = h('div');
    const canvasBtn = h('button', {
      class: 'btn primary', onclick: () => {
        const canvas = drawShareImage({ summary: s, state, includeRules: shareRules });
        const img = h('img', { class: 'share-preview', alt: t('map.title'), src: canvas.toDataURL('image/png') });
        const a = h('a', { class: 'btn ghost', download: 'sdmeet-our-map.png', href: img.src }, '⬇ ', t('map.download'));
        mount(preview, img, h('div', { class: 'row', style: { justifyContent: 'center' } }, a));
      }
    }, t('map.makeImage'));

    const accuracy = s.accuracy.map(a => h('div', { style: { marginBottom: '0.75rem' } },
      h('div', { class: 'small' }, deckOf(a.deck).icon, ' ', loc(deckOf(a.deck).title)),
      [state.me.seat, state.partner.seat].map(seat => {
        const { hits, total } = a.bySeat[seat];
        const who = seat === state.me.seat ? t('map.youRead', { name: state.partner.name }) : t('map.theyRead', { name: state.partner.name });
        return h('div', { class: 'stat' },
          h('span', { class: 'small', style: { minWidth: '9rem' } }, who),
          h('div', { class: 'bar' }, h('div', { style: { width: total ? `${(hits / total) * 100}%` : '0' } })),
          h('span', { class: 'num' }, `${hits}/${total}`));
      })));

    mount(root,
      h('div', { class: 'card' },
        h('div', { class: 'eyebrow' }, '🗺️ ', t('map.title')),
        h('h2', {}, `${s.names[1]} & ${s.names[2]}`),
        h('p', { class: 'muted small' }, t('map.opened', { n: s.cardsOpened, total: s.cardsTotal }))),
      accuracy.length ? h('div', { class: 'card' }, h('h3', {}, t('map.accuracy')), h('p', { class: 'small muted' }, t('map.accuracyNote')), accuracy) : null,
      s.climate ? h('div', { class: 'card' }, h('h3', {}, t('map.climate')),
        h('div', { class: 'grid-2 center' }, [1, 2].map(seat => h('div', {},
          h('div', { style: { fontSize: '2.6rem' } }, weatherIcon(s.climate[seat]) || '·'),
          h('div', { class: 'small' }, nameOf(state, seat)))))) : null,
      s.relief ? h('div', { class: 'card' }, h('h3', {}, t('map.relief')),
        h('div', { class: 'relief' },
          h('div', {}, h('div', { class: 'n' }, `🌿 ${s.relief.valley}`), h('div', { class: 'tiny muted' }, t('terrain.valley'))),
          h('div', {}, h('div', { class: 'n' }, `⛰ ${s.relief.hill}`), h('div', { class: 'tiny muted' }, t('terrain.hill'))),
          h('div', {}, h('div', { class: 'n' }, `🏔️ ${s.relief.mountain}`), h('div', { class: 'tiny muted' }, t('terrain.mountain'))))) : null,
      s.storyboard ? h('div', { class: 'card' }, h('h3', {}, loc(deckOf('six-hours').reveal.name)),
        h('p', { class: 'small' }, t('map.storyboard', { n: s.storyboard.chase, total: s.storyboard.total }))) : null,
      h('div', { class: 'card' }, h('h3', {}, '★ ', t('map.rules')),
        s.rules.length
          ? s.rules.map(r => h('div', { class: 'rule-item' },
              h('div', { class: 'tiny muted' }, cardTitle(state.board.cards.find(c => c.key === r.key), state)), r.rule))
          : h('p', { class: 'muted small' }, t('map.noRules'))),
      h('div', { class: 'card' }, h('h3', {}, '↺ ', t('map.later')),
        s.later.length
          ? s.later.map(l => h('div', { class: 'rule-item row between' },
              h('span', {}, cardTitle(state.board.cards.find(c => c.key === l.key), state)),
              h('button', { class: 'link-btn', onclick: () => ctx.openCard(l.key) }, t('common.open'))))
          : h('p', { class: 'muted small' }, t('map.noLater'))),
      h('div', { class: 'card' }, h('h3', {}, t('map.share')),
        h('p', { class: 'small muted' }, t('map.shareNote')),
        consentRow(state, 'share', t('consent.shareRules')),
        h('div', { class: 'row', style: { marginTop: '0.75rem' } }, canvasBtn),
        preview),
      h('div', { class: 'card' }, h('h3', {}, t('map.export')),
        h('p', { class: 'small muted' }, t('map.exportNote')),
        consentRow(state, 'export', t('consent.export')),
        adult ? consentRow(state, 'adultExport', t('consent.adultExport')) : null,
        both(s.consents.export)
          ? h('a', { class: 'btn primary', style: { marginTop: '0.75rem' }, href: `/room/${state.room.id}/export`, target: '_blank', rel: 'noopener' }, '🖨 ', t('map.openExport'))
          : h('p', { class: 'tiny muted', style: { marginTop: '0.5rem' } }, t('map.exportNeedsBoth'))),
      capsule.el,
      h('div', { class: 'card' }, h('h3', {}, t('danger.title')),
        h('p', { class: 'small muted' }, t('danger.text')),
        h('button', { class: 'btn danger', onclick: ctx.confirmDelete }, t('danger.delete')))
    );
  }

  return { el: root, render };
}
