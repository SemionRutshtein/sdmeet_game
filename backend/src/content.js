// Loads deck content from backend/content and indexes it.
// Content is versioned with the code (no DB seed): edit the JSON, redeploy.
const fs = require('fs');
const path = require('path');

const LOCALES = ['en', 'ru', 'he'];
const QUESTION_TYPES = ['choice', 'multi', 'rank', 'scale', 'slider', 'text', 'weather', 'scene', 'wishlist'];
const CONTENT_DIR = path.join(__dirname, '../content');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Any object that has one of the locale keys and only string values is a
// localized string; it must carry every locale, non-empty.
function findLocalizationProblems(node, where, out) {
  if (Array.isArray(node)) {
    node.forEach((child, i) => findLocalizationProblems(child, `${where}[${i}]`, out));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const keys = Object.keys(node);
  const looksLocalized = keys.some(k => LOCALES.includes(k)) && keys.every(k => typeof node[k] === 'string');
  if (looksLocalized) {
    for (const loc of LOCALES) {
      if (!node[loc] || !node[loc].trim()) out.push(`${where}: missing "${loc}"`);
    }
    return;
  }
  for (const k of keys) findLocalizationProblems(node[k], `${where}.${k}`, out);
}

function checkOptions(options, where, out) {
  if (!Array.isArray(options) || options.length < 2) {
    out.push(`${where}: needs at least 2 options`);
    return;
  }
  const ids = new Set();
  for (const o of options) {
    if (!o.id) out.push(`${where}: option without id`);
    if (ids.has(o.id)) out.push(`${where}: duplicate option "${o.id}"`);
    ids.add(o.id);
  }
}

// Scene fields are answered for every scene of the deck. Choice/multi options
// carry hidden seek/withdraw weights (w), except on the free-text field.
const SCENE_FIELD_TYPES = ['scale', 'choice', 'multi', 'text'];
function checkSceneFields(fields, dw, out) {
  const entries = Object.entries(fields);
  if (!entries.length) out.push(`${dw}: empty sceneFields`);
  for (const [key, f] of entries) {
    const fw = `${dw} sceneFields.${key}`;
    if (!SCENE_FIELD_TYPES.includes(f.type)) {
      out.push(`${fw}: unknown type "${f.type}"`);
      continue;
    }
    if (f.type === 'scale' && !(Number.isInteger(f.min) && Number.isInteger(f.max) && f.min < f.max)) out.push(`${fw}: bad scale range`);
    if (f.type === 'text' && f.guess) out.push(`${fw}: text can't be guessed`);
    if (f.type === 'choice' || f.type === 'multi') {
      checkOptions(f.options, fw, out);
      for (const o of f.options || []) {
        if (!Array.isArray(o.w) || o.w.length !== 2) out.push(`${fw} option ${o.id}: needs w: [seek, withdraw]`);
        if (f.layers && !f.layers[o.layer]) out.push(`${fw} option ${o.id}: unknown layer "${o.layer}"`);
      }
    }
  }
  if (!entries.some(([, f]) => f.guess)) out.push(`${dw}: sceneFields has nothing to guess`);
}

function validateContent({ decks, wishlist, capsule }) {
  const out = [];
  const deckIds = new Set();
  for (const deck of decks) {
    const dw = `deck ${deck.id}`;
    if (!deck.id) out.push('deck without id');
    if (deckIds.has(deck.id)) out.push(`${dw}: duplicate deck id`);
    deckIds.add(deck.id);
    if (!Array.isArray(deck.stage1) || !deck.stage1.length) out.push(`${dw}: empty stage1`);
    if (!Array.isArray(deck.pool) || deck.pool.length < 1) out.push(`${dw}: empty pool`);

    const qids = new Set();
    for (const q of deck.stage1 || []) {
      const qw = `${dw} question ${q.id}`;
      if (qids.has(q.id)) out.push(`${qw}: duplicate id`);
      qids.add(q.id);
      if (!QUESTION_TYPES.includes(q.type)) out.push(`${qw}: unknown type "${q.type}"`);
      if (['choice', 'multi', 'rank', 'weather'].includes(q.type)) checkOptions(q.options, qw, out);
      if (q.type === 'rank' && q.pick && q.pick > q.options.length) out.push(`${qw}: pick > options`);
      if (q.type === 'scale' && !(q.min < q.max)) out.push(`${qw}: bad scale range`);
      if (q.type === 'slider' && (!q.left || !q.right)) out.push(`${qw}: slider needs left/right`);
      if (q.type === 'scene' && !deck.sceneFields) out.push(`${qw}: scene without deck.sceneFields`);
      if (q.type === 'wishlist' && !deck.adult) out.push(`${qw}: wishlist outside an adult deck`);
      if (q.predictable && ['text', 'slider', 'wishlist'].includes(q.type)) {
        out.push(`${qw}: type ${q.type} can't be predictable`);
      }
    }
    if (deck.sceneFields) checkSceneFields(deck.sceneFields, dw, out);
    for (const g of deck.reveal?.groups || []) {
      for (const qid of g.questions) {
        if (!qids.has(qid)) out.push(`${dw} group ${g.id}: unknown question ${qid}`);
      }
    }
    const pids = new Set();
    for (const p of deck.pool || []) {
      if (pids.has(p.id)) out.push(`${dw} pool: duplicate id ${p.id}`);
      pids.add(p.id);
    }
    findLocalizationProblems(deck, dw, out);
  }
  const wids = new Set();
  for (const w of wishlist) {
    if (wids.has(w.id)) out.push(`wishlist: duplicate id ${w.id}`);
    wids.add(w.id);
  }
  findLocalizationProblems(wishlist, 'wishlist', out);
  if (!capsule.prompts?.length) out.push('capsule: no prompts');
  findLocalizationProblems(capsule, 'capsule', out);
  return out;
}

function buildIndex({ decks, wishlist, capsule }) {
  const deckById = new Map(decks.map(d => [d.id, d]));
  const questionByKey = new Map();
  const poolByKey = new Map();
  for (const deck of decks) {
    for (const q of deck.stage1) questionByKey.set(`${deck.id}:${q.id}`, { deck, q });
    for (const p of deck.pool) poolByKey.set(`${deck.id}:${p.id}`, { deck, p });
  }
  return {
    decks,
    wishlist,
    capsule,
    deckById,
    questionByKey,
    poolByKey,
    wishlistIds: new Set(wishlist.map(w => w.id))
  };
}

function loadContent(dir = CONTENT_DIR) {
  const deckDir = path.join(dir, 'decks');
  const decks = fs.readdirSync(deckDir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJson(path.join(deckDir, f)))
    .sort((a, b) => a.order - b.order);
  const wishlist = readJson(path.join(dir, 'wishlist.json')).items;
  const capsule = readJson(path.join(dir, 'capsule.json'));
  const problems = validateContent({ decks, wishlist, capsule });
  if (problems.length) throw new Error(`Invalid content:\n  ${problems.join('\n  ')}`);
  return buildIndex({ decks, wishlist, capsule });
}

let cached = null;
function content() {
  if (!cached) cached = loadContent();
  return cached;
}

module.exports = { content, loadContent, validateContent, LOCALES };
