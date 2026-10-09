// The room: picks the right screen for where both players are, keeps it in
// sync over the socket, and owns the top bar and the card sheet.
import { h, mount, toast, sheet, debounce } from '../dom.js';
import { t } from '../i18n.js';
import { roomApi, sessions } from '../api.js';
import { stage1View, stage2View, stage3View, waitingView, inviteBox } from './stages.js';
import { boardView, cardSheet } from './reveal.js';
import { mapView } from './map.js';
import { capsuleSection } from './capsule.js';
import { topbar } from './topbar.js';
import { briefingView, agreementsView } from './briefing.js';
import { howToPlaySheet } from './explainer.js';
import { myAnswersSheet } from './myAnswers.js';
import { seen, markSeen } from '../prefs.js';
import { transition } from '../motion.js';

const draftsByRoom = new Map(); // survives language switches

export async function roomView(root, roomId, navigate) {
  const session = sessions.get(roomId);
  if (!session) {
    mount(root, topbar({}), h('div', { class: 'card' },
      h('h2', {}, t('room.noAccess')),
      h('p', { class: 'muted' }, t('room.noAccessText')),
      h('a', { class: 'btn primary', href: '/' }, t('common.home'))));
    return () => {};
  }
  const api = roomApi(session.token);
  if (!draftsByRoom.has(roomId)) draftsByRoom.set(roomId, new Map());
  const drafts = draftsByRoom.get(roomId);

  let state = null;
  let viewKey = null;
  let view = null;
  let review = false;
  let tab = 'board';
  let openSheet = null;
  let alive = true;
  let forceBrief = false;

  const header = h('div');
  const banner = h('div');
  const body = h('div', { class: 'view' });
  mount(root, header, banner, body);
  mount(body, h('div', { class: 'skeleton-stack', 'aria-busy': 'true' },
    h('div', { class: 'skeleton', style: { height: '7rem' } }),
    h('div', { class: 'skeleton', style: { height: '18rem' } })));

  const ctx = {
    api,
    state: () => state,
    refresh: () => refresh(),
    setTab: next => { tab = next; decide(); window.scrollTo?.(0, 0); },
    openCard: key => {
      if (openSheet?.key === key) return openSheet.reload();
      openSheet?.close();
      openSheet = cardSheet(ctx, key, () => { openSheet = null; });
    },
    sheetOpen: () => !!openSheet,
    confirmDelete
  };

  function confirmDelete() {
    const s = sheet();
    mount(s.el,
      h('h2', {}, t('danger.confirmTitle')),
      h('p', {}, t('danger.confirmText')),
      h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: s.close }, t('common.cancel')),
        h('button', {
          class: 'btn danger', onclick: async () => {
            try {
              await api.deleteRoom();
              sessions.remove(roomId);
              s.close();
              toast(t('danger.deleted'));
              navigate('/');
            } catch (e) {
              toast(t(`error.${e.code}`, {}, t('error.generic')));
            }
          }
        }, t('danger.delete'))));
  }

  function gone() {
    sessions.remove(roomId);
    openSheet?.close();
    mount(root, topbar({}), h('div', { class: 'card' },
      h('h2', {}, t('room.gone')),
      h('p', { class: 'muted' }, t('room.goneText')),
      h('a', { class: 'btn primary', href: '/' }, t('common.home'))));
  }

  async function refresh() {
    try {
      state = await api.state();
    } catch (e) {
      if (e.status === 401) return gone();
      toast(t(`error.${e.code}`, {}, t('error.generic')));
      return;
    }
    if (alive) decide();
  }

  function computeKey() {
    const { room, me } = state;
    if (room.status === 'archived') return 'capsule';
    if (room.status === 'reveal') {
      if (!seen(roomId, 'agree')) return 'agree';
      return tab === 'map' ? 'map' : 'board';
    }
    if (forceBrief || (!me.stage1Done && !seen(roomId, 'brief'))) return 'brief';
    if (review && !state.frozen) return 'review';
    if (!me.stage1Done) return 'stage1';
    if (!me.stage2Done) return 'stage2';
    if (!state.stage3Available) return state.partner?.stage1Done && state.partner?.stage2Done ? 'wait-stage3' : 'wait-partner';
    if (!me.stage3Done) return 'stage3';
    return 'wait-reveal';
  }

  function decide() {
    const partnerName = state.partner?.name || t('common.partner');
    mount(header, topbar({ state, onMenu: openMenu }));
    const showInvite = !state.partner && state.room.status === 'playing' && !['wait-partner', 'brief'].includes(computeKey());
    mount(banner, showInvite ? inviteBox(roomId) : null);

    const key = computeKey();
    if (key === viewKey) return view?.render?.(state);
    viewKey = key;
    const enterReview = () => { review = true; decide(); };
    const exitReview = () => { review = false; decide(); };
    const common = { state, api, drafts, refresh, partnerName, enterReview, exitReview };
    if (key === 'brief') {
      view = briefingView({
        state,
        onStart: () => { markSeen(roomId, 'brief'); forceBrief = false; decide(); window.scrollTo?.({ top: 0, behavior: 'smooth' }); }
      });
    } else if (key === 'agree') {
      view = agreementsView({ onAgree: () => { markSeen(roomId, 'agree'); decide(); window.scrollTo?.({ top: 0 }); } });
    } else if (key === 'stage1') view = stage1View(common);
    else if (key === 'review') view = stage1View({ ...common, review: true });
    else if (key === 'stage2') view = stage2View(common);
    else if (key === 'stage3') view = stage3View(common);
    else if (key === 'wait-partner') view = waitingView({ ...common, reason: 'partner' });
    else if (key === 'wait-stage3') view = waitingView({ ...common, reason: 'stage3' });
    else if (key === 'wait-reveal') view = waitingView({ ...common, reason: 'reveal' });
    else if (key === 'board' || key === 'map') {
      const inner = key === 'board' ? boardView(ctx) : mapView(ctx);
      const tabs = h('div', { class: 'tabs' },
        h('button', { class: 'btn small ghost', 'aria-pressed': String(key === 'board'), onclick: () => ctx.setTab('board') }, '🃏 ', t('reveal.board')),
        h('button', { class: 'btn small ghost', 'aria-pressed': String(key === 'map'), onclick: () => ctx.setTab('map') }, '🗺️ ', t('map.title')));
      view = { el: h('div', {}, tabs, inner.el), render: s => inner.render(s) };
      view.render(state);
    } else if (key === 'capsule') {
      const cap = capsuleSection(ctx);
      view = { el: h('div', {}, h('p', { class: 'banner small' }, t('room.archived')), cap.el), render: s => cap.render(s) };
      view.render(state);
    }
    const el = view.el;
    transition(() => mount(body, el));
  }

  // Waiting screens follow the partner live, so they are rebuilt on every
  // push; stage forms hold local input and are left alone.
  const LIVE = new Set(['wait-partner', 'wait-stage3', 'wait-reveal']);

  function openMenu() {
    const s = sheet();
    mount(s.el,
      h('div', { class: 'sheet-head' }, h('h2', { class: 'grow' }, t('menu.title')),
        h('button', { class: 'close-x', onclick: s.close }, '✕')),
      h('div', { class: 'stack' },
        state.room.status === 'playing' ? inviteBox(roomId) : null,
        h('button', { class: 'btn ghost block', onclick: () => { s.close(); howToPlaySheet(); } }, '▶ ', t('menu.howTo')),
        state.room.status === 'playing'
          ? h('button', { class: 'btn ghost block', onclick: () => { s.close(); forceBrief = true; decide(); window.scrollTo?.(0, 0); } }, '🧭 ', t('menu.briefing'))
          : null,
        state.room.status !== 'archived'
          ? h('button', { class: 'btn ghost block', onclick: () => { s.close(); myAnswersSheet(state); } }, '📝 ', t('mine.title'))
          : null,
        h('a', { class: 'btn ghost block', href: '/' }, t('menu.myRooms')),
        h('p', { class: 'small muted' }, t('menu.expires', { date: new Date(state.room.expiresAt).toLocaleDateString() })),
        h('button', { class: 'btn danger block', onclick: () => { s.close(); confirmDelete(); } }, t('danger.delete'))));
  }

  // socket: "something changed" -> refetch (personalized, filtered server-side)
  const socket = window.io ? window.io({ auth: { token: session.token }, transports: ['websocket', 'polling'] }) : null;
  const pull = debounce(async info => {
    await refresh();
    if (info?.card && openSheet?.key === info.card) openSheet.reload();
  }, 150);
  socket?.on('changed', info => {
    if (info.scope === 'deleted') return refresh();
    if (state && LIVE.has(computeKey())) viewKey = null;
    pull(info);
  });
  socket?.on('presence', () => pull());
  socket?.on('connect', () => pull());

  await refresh();
  return () => {
    alive = false;
    socket?.close();
    openSheet?.close();
  };
}
