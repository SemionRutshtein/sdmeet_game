// Deck content from the server, plus lookups. Fetched once per page load.
import { publicApi } from './api.js';
import { loc } from './i18n.js';

let data = null;

export async function loadContent() {
  if (!data) {
    data = await publicApi.content();
    data.deckById = new Map(data.decks.map(d => [d.id, d]));
  }
  return data;
}

export function C() {
  return data;
}

export function deck(id) {
  return data.deckById.get(id);
}

export function question(qkey) {
  const [deckId, qid] = qkey.split(':');
  const d = deck(deckId);
  return d ? { deck: d, q: d.stage1.find(x => x.id === qid) } : null;
}

export function poolText(deckId, poolId) {
  const p = deck(deckId)?.pool.find(x => x.id === poolId);
  return p ? loc(p.text) : '';
}

export function optionLabel(options, id) {
  const o = options.find(x => x.id === id);
  return o ? loc(o.label) : id;
}

export function weatherIcon(id) {
  return deck('no-gloss')?.stage1.find(q => q.id === 'weather')?.options.find(o => o.id === id)?.icon || '';
}

export function decksIn(ids) {
  return data.decks.filter(d => ids.includes(d.id));
}

export function wishlistLabel(id) {
  const w = data.wishlist.find(x => x.id === id);
  return w ? loc(w.label) : id;
}
