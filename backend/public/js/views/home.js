import { h, mount, toast } from '../dom.js';
import { t, loc } from '../i18n.js';
import { publicApi, sessions } from '../api.js';
import { C } from '../content.js';
import { topbar } from './topbar.js';
import { explainer } from './explainer.js';

const form = { name: '', decks: null, adult: false };

export async function homeView(root, navigate) {
  const c = C();
  if (!form.decks) form.decks = new Set(c.decks.filter(d => d.defaultSelected).map(d => d.id));
  const err = h('p', { class: 'err hidden' });
  const demo = explainer();

  function render() {
    const hasAdult = c.decks.some(d => d.adult && form.decks.has(d.id));
    const name = h('input', { type: 'text', maxlength: 30, placeholder: t('home.namePlaceholder'), value: form.name, autocomplete: 'given-name' });
    name.addEventListener('input', () => { form.name = name.value; });
    const create = h('button', { class: 'btn primary block' }, t('home.create'));
    create.addEventListener('click', async () => {
      err.classList.add('hidden');
      create.disabled = true;
      try {
        const res = await publicApi.createRoom({ name: form.name, decks: [...form.decks], adultConfirmed: hasAdult && form.adult });
        sessions.set(res.roomId, { token: res.token, seat: 1, name: form.name.trim(), at: Date.now() });
        form.name = '';
        navigate(`/room/${res.roomId}`);
      } catch (e) {
        err.textContent = t(`error.${e.code}`, {}, t('error.generic'));
        err.classList.remove('hidden');
        create.disabled = false;
      }
    });

    const mine = Object.entries(sessions.all()).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    mount(root,
      topbar(),
      h('section', { class: 'card hero-card reveal-in' },
        h('div', { class: 'eyebrow' }, t('home.eyebrow')),
        h('h1', { class: 'display' }, t('home.title')),
        h('p', { class: 'lead' }, t('home.concept')),
        h('div', { class: 'row', style: { marginTop: '1.25rem' } },
          h('a', { class: 'btn primary', href: '#create', onclick: e => { e.preventDefault(); document.getElementById('create')?.scrollIntoView({ behavior: 'smooth' }); setTimeout(() => name.focus({ preventScroll: true }), 400); } }, t('home.cta'), ' ↓'),
          h('span', { class: 'chip' }, '✦ ', t('home.notATest')))),
      h('section', { class: 'card demo-card reveal-in' }, demo),
      h('section', { class: 'card reveal-in', id: 'create' },
        h('h2', {}, t('home.createTitle')),
        h('label', { class: 'field' }, h('span', {}, t('home.yourName')), name),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('home.decks')),
          c.decks.map(d => {
            const on = form.decks.has(d.id);
            return h('label', { class: `check deck-check${on ? ' on' : ''}` },
              h('input', { type: 'checkbox', checked: on, onchange: () => { on ? form.decks.delete(d.id) : form.decks.add(d.id); render(); } }),
              h('span', { class: 'deck-option' }, h('span', { class: 'deck-icon' }, d.icon),
                h('span', {}, h('strong', {}, loc(d.title)), h('span', { class: 'small muted' }, loc(d.tagline)))));
          })),
        hasAdult ? h('label', { class: `check${form.adult ? ' on' : ''}` },
          h('input', { type: 'checkbox', checked: form.adult, onchange: () => { form.adult = !form.adult; render(); } }),
          h('span', { class: 'small' }, t('home.adultConfirm'))) : null,
        h('p', { class: 'tiny muted' }, t('home.decksNote')),
        create,
        err),
      mine.length ? h('div', { class: 'card' },
        h('h3', {}, t('home.myRooms')),
        mine.map(([id, s]) => h('div', { class: 'consent-row' },
          h('span', {}, s.name ? t('home.roomAs', { name: s.name }) : id.slice(0, 8),
            h('span', { class: 'tiny muted' }, s.at ? ` · ${new Date(s.at).toLocaleDateString()}` : '')),
          h('a', { class: 'btn ghost small', href: `/room/${id}` }, t('common.open'))))) : null,
      h('p', { class: 'tiny muted center' }, t('home.privacy'))
    );
  }
  render();
  // entrance animations only on first paint, not when the form re-renders
  const settle = setTimeout(() => root.classList.add('settled'), 900);
  return () => { clearTimeout(settle); root.classList.remove('settled'); };
}
