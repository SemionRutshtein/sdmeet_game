import { h, mount } from './dom.js';
import { t, initLang, onLangChange } from './i18n.js';
import { loadContent } from './content.js';
import { sessions } from './api.js';
import { homeView } from './views/home.js';
import { joinView } from './views/join.js';
import { roomView } from './views/room.js';
import { exportView } from './views/exportPage.js';

const root = document.getElementById('app');
let cleanup = null;
let rendering = 0;

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  render();
}

// Personal capsule link: /capsule#<roomId>.<token>. The token never leaves
// the URL fragment, so it doesn't hit server logs.
function importCapsuleLink() {
  const [roomId, token] = location.hash.slice(1).split('.');
  if (roomId && token) {
    if (!sessions.get(roomId)) sessions.set(roomId, { token, at: Date.now() });
    history.replaceState({}, '', `/room/${roomId}`);
    return true;
  }
  return false;
}

async function render() {
  const run = ++rendering;
  cleanup?.();
  cleanup = null;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  let m;
  let done;
  try {
    if (path === '/capsule' && importCapsuleLink()) return render();
    if (path === '/') done = await homeView(root, navigate);
    else if ((m = path.match(/^\/join\/([\w-]+)$/))) done = await joinView(root, m[1], navigate);
    else if ((m = path.match(/^\/room\/([\w-]+)\/export$/))) done = await exportView(root, m[1]);
    else if ((m = path.match(/^\/room\/([\w-]+)$/))) done = await roomView(root, m[1], navigate);
    else {
      mount(root, h('div', { class: 'card' }, h('h2', {}, t('error.not_found')), h('a', { class: 'btn primary', href: '/' }, t('common.home'))));
    }
  } catch (e) {
    console.error(e);
    mount(root, h('div', { class: 'card' }, h('h2', {}, t('error.generic')), h('a', { class: 'btn primary', href: '/' }, t('common.home'))));
  }
  if (run !== rendering) done?.();
  else cleanup = done || null;
}

// Same-origin links go through the router.
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/api')) return;
  e.preventDefault();
  navigate(url.pathname + url.search + url.hash);
});
window.addEventListener('popstate', render);
onLangChange(render);

(async function boot() {
  initLang();
  try {
    await loadContent();
  } catch {
    mount(root, h('div', { class: 'card' }, h('h2', {}, t('error.network')), h('button', { class: 'btn primary', onclick: () => location.reload() }, t('common.retry'))));
    return;
  }
  render();
})();
