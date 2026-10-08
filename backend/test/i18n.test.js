// Every UI key the frontend uses exists in en, ru and he, and the three
// dictionaries have exactly the same keys.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '../public/js');

function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? sources(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);
}

// Keys built at runtime from codes the server sends.
const DYNAMIC = {
  'concl.': ['passed', 'same', 'differ', 'apart_points', 'apart_percent', 'multi_shared', 'rank_shared', 'rank_top_same',
    'rank_top_differ', 'scene_same_do', 'scene_same_story', 'scene_same_need', 'scene_need_clash', 'scene_shake_gap', 'guess_both', 'guess_none', 'guess_one', 'read_forecast', 'terrain_valley',
    'terrain_hill', 'terrain_mountain', 'chase', 'wish_matches', 'wish_none'],
  'error.': ['generic', 'network', 'not_found', 'unauthorized', 'name_required', 'decks_required', 'adult_confirm_required',
    'room_full', 'bad_value', 'wrong_stage', 'frozen', 'incomplete', 'ask_count', 'not_your_turn', 'not_openable',
    'not_opened', 'too_large', 'consent_required', 'sealed', 'rate_limited', 'server_error'],
  'label.': ['negotiable', 'important', 'fixed'],
  'status.': ['discussed', 'later', 'rule'],
  'statusBadge.': ['discussed', 'later', 'rule'],
  'terrain.': ['valley', 'hill', 'mountain'],
  'scene.': ['story', 'do', 'need'],
  'wish.': ['yes', 'maybe', 'no'],
  'home.step': ['1', '2', '3', '4'],
  'stage': ['1.title', '2.title', '3.title', '4.title', '1.intro', '2.intro', '3.intro'],
  'wait.': ['partner.title', 'partner.text', 'stage3.title', 'stage3.text', 'reveal.title', 'reveal.text']
};

test('i18n: all used keys exist in every language', async () => {
  const { STRINGS } = await import(path.join(JS_DIR, 'i18n.js'));
  const used = new Set();
  for (const file of sources(JS_DIR)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*['`]([^'`$]+)['`]/g)) used.add(m[1]);
  }
  for (const [prefix, rest] of Object.entries(DYNAMIC)) rest.forEach(r => used.add(prefix + r));

  const sets = Object.fromEntries(Object.entries(STRINGS).map(([l, d]) => [l, flatten(d)]));
  for (const [lang, keys] of Object.entries(sets)) {
    const missing = [...used].filter(k => !keys.has(k));
    assert.deepEqual(missing, [], `${lang} is missing keys`);
  }
  const en = [...sets.en].sort();
  assert.deepEqual([...sets.ru].sort(), en, 'ru and en have different keys');
  assert.deepEqual([...sets.he].sort(), en, 'he and en have different keys');
});

test('i18n: placeholders match across languages', async () => {
  const { STRINGS } = await import(path.join(JS_DIR, 'i18n.js'));
  const get = (d, k) => k.split('.').reduce((n, p) => n[p], d);
  const ph = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  for (const key of flatten(STRINGS.en)) {
    for (const lang of ['ru', 'he']) {
      assert.equal(ph(get(STRINGS[lang], key)), ph(get(STRINGS.en, key)), `${lang}:${key}`);
    }
  }
});
