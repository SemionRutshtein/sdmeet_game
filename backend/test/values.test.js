const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/game/values');
const { content } = require('../src/content');

const deck = id => content().deckById.get(id);
const q = (d, id) => deck(d).stage1.find(x => x.id === id);
const self = (d, id, v) => V.normalizeSelf(q(d, id), deck(d), v, { wishlistIds: content().wishlist.map(w => w.id) });
const throwsBad = fn => assert.throws(fn, e => e.code === 'bad_value');

test('choice with custom option needs text', () => {
  throwsBad(() => self('no-gloss', 'anger', { option: 'other' }));
  assert.deepEqual(self('no-gloss', 'anger', { option: 'other', custom: ' I sing ' }), { option: 'other', custom: 'I sing' });
  throwsBad(() => self('no-gloss', 'anger', { option: 'nope' }));
});

test('scene: every field but the free text is required, feelings capped, guesses cover only guessable fields', () => {
  const full = { shake: 4, story: 'busy', feel: ['anger', 'fear'], do: 'call', need: 'voice', want: '  call me  ' };
  assert.deepEqual(self('six-hours', 'no-reply', full), { ...full, want: 'call me' });
  const { want, ...noText } = full;
  assert.deepEqual(self('six-hours', 'no-reply', noText), noText);
  throwsBad(() => self('six-hours', 'no-reply', { ...full, need: undefined }));
  throwsBad(() => self('six-hours', 'no-reply', { ...full, shake: 6 }));
  throwsBad(() => self('six-hours', 'no-reply', { ...full, feel: ['anger', 'fear', 'hurt', 'lonely', 'shame'] }));
  throwsBad(() => self('six-hours', 'no-reply', { ...full, feel: ['nothing', 'fear'] }));
  const guess = V.normalizeGuess(q('six-hours', 'no-reply'), deck('six-hours'), full);
  assert.deepEqual(guess, { story: 'busy', do: 'call', need: 'voice' });
  throwsBad(() => V.normalizeGuess(q('six-hours', 'no-reply'), deck('six-hours'), { story: 'busy', do: 'call' }));
});

test('rank must be a full permutation (or exactly top-N)', () => {
  throwsBad(() => self('no-gloss', 'bad-day-needs', { order: ['hug'] }));
  throwsBad(() => self('perpetual', 'values', { order: ['freedom', 'freedom', 'family', 'calm', 'care'] }));
  assert.equal(self('perpetual', 'values', { order: ['freedom', 'security', 'family', 'calm', 'care'] }).order.length, 5);
});

test('multi: exclusive option stands alone', () => {
  throwsBad(() => self('perpetual', 'chores-hate', { options: ['none', 'dishes'] }));
  assert.deepEqual(self('perpetual', 'chores-hate', { options: ['none'] }), { options: ['none'] });
});

test('scale and slider ranges', () => {
  throwsBad(() => self('no-gloss', 'ok-seen', { value: 0 }));
  throwsBad(() => self('no-gloss', 'ok-seen', { value: 3.5 }));
  throwsBad(() => self('perpetual', 'money-style', { value: 101 }));
});

test('text limits and control characters', () => {
  assert.equal(self('no-gloss', 'first-impression', { text: 'a\u0000b' }).text, 'ab');
  throwsBad(() => self('no-gloss', 'first-impression', { text: 'x'.repeat(1001) }));
  throwsBad(() => self('no-gloss', 'first-impression', { text: '   ' }));
});

test('wishlist needs every item', () => {
  throwsBad(() => self('closer', 'wishlist', { items: { massage: 'yes' } }));
});

test('guesses only for predictable questions', () => {
  throwsBad(() => V.normalizeGuess(q('perpetual', 'values'), deck('perpetual'), { option: 'freedom' }));
  throwsBad(() => V.normalizeGuess(q('no-gloss', 'first-impression'), deck('no-gloss'), { text: 'x' }));
  assert.deepEqual(V.normalizeGuess(q('no-gloss', 'bad-day-needs'), deck('no-gloss'), { option: 'hug' }), { option: 'hug' });
});

test('full rankings need at least the top 3; top-N picks need exactly N', () => {
  assert.equal(self('no-gloss', 'bad-day-needs', { order: ['hug', 'alone', 'listen'] }).order.length, 3);
  assert.equal(self('no-gloss', 'bad-day-needs', { order: ['hug', 'alone', 'listen', 'advice', 'distract', 'hands-off'] }).order.length, 6);
  throwsBad(() => self('no-gloss', 'bad-day-needs', { order: ['hug', 'alone'] }));
  throwsBad(() => self('perpetual', 'values', { order: ['freedom', 'security', 'family'] }));
});
