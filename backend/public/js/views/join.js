import { h, mount } from '../dom.js';
import { t, loc } from '../i18n.js';
import { publicApi, sessions } from '../api.js';
import { decksIn } from '../content.js';
import { topbar } from './topbar.js';

export async function joinView(root, roomId, navigate) {
  if (sessions.get(roomId)) {
    navigate(`/room/${roomId}`, { replace: true });
    return () => {};
  }
  let info;
  try {
    info = await publicApi.roomInfo(roomId);
  } catch {
    mount(root, topbar(), h('div', { class: 'card' }, h('h2', {}, t('join.notFound')), h('a', { class: 'btn primary', href: '/' }, t('common.home'))));
    return () => {};
  }
  if (info.full) {
    mount(root, topbar(), h('div', { class: 'card' }, h('h2', {}, t('join.full')), h('p', { class: 'muted' }, t('join.fullText')), h('a', { class: 'btn primary', href: '/' }, t('common.home'))));
    return () => {};
  }

  let adult = false;
  let name = '';
  const err = h('p', { class: 'err hidden' });

  function render() {
    const input = h('input', { type: 'text', maxlength: 30, placeholder: t('home.namePlaceholder'), value: name, autocomplete: 'given-name' });
    input.addEventListener('input', () => { name = input.value; });
    const join = h('button', { class: 'btn primary block' }, t('join.button'));
    join.addEventListener('click', async () => {
      err.classList.add('hidden');
      join.disabled = true;
      try {
        const res = await publicApi.join(roomId, { name, adult });
        sessions.set(roomId, { token: res.token, seat: 2, name: name.trim(), at: Date.now() });
        navigate(`/room/${roomId}`, { replace: true });
      } catch (e) {
        err.textContent = t(`error.${e.code}`, {}, t('error.generic'));
        err.classList.remove('hidden');
        join.disabled = false;
      }
    });
    const normal = decksIn(info.decks).filter(d => !d.adult);
    const adultDecks = decksIn(info.decks).filter(d => d.adult);
    mount(root,
      topbar(),
      h('div', { class: 'card' },
        h('div', { class: 'eyebrow' }, t('home.eyebrow')),
        h('h1', {}, t('join.title', { name: info.hostName })),
        h('p', { class: 'muted' }, t('home.concept')),
        h('p', { class: 'small' }, t('join.decks'), ' ', normal.map(d => `${d.icon} ${loc(d.title)}`).join(' · ')),
        h('label', { class: 'field' }, h('span', {}, t('home.yourName')), input),
        info.adultPending && adultDecks.length ? h('label', { class: `check${adult ? ' on' : ''}` },
          h('input', { type: 'checkbox', checked: adult, onchange: () => { adult = !adult; render(); } }),
          h('span', { class: 'small' }, t('join.adultOffer', { name: info.hostName, deck: loc(adultDecks[0].title) }))) : null,
        join,
        err),
      h('p', { class: 'tiny muted center' }, t('home.privacy'))
    );
  }
  render();
  return () => {};
}
