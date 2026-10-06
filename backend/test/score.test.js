const test = require('node:test');
const assert = require('node:assert/strict');
const score = require('../src/game/score');
const { content } = require('../src/content');

const deck = id => content().deckById.get(id);
const q = (d, id) => deck(d).stage1.find(x => x.id === id);

test('guess checks per type', () => {
  assert.deepEqual(score.checkGuess(q('no-gloss', 'anger'), { option: 'cry' }, { option: 'cry' }), [{ part: 'main', hit: true }]);
  assert.equal(score.checkGuess(q('no-gloss', 'bad-day-needs'), { order: ['hug', 'alone'] }, { option: 'hug' })[0].hit, true);
  assert.equal(score.checkGuess(q('no-gloss', 'ok-seen'), { value: 4 }, { value: 5 })[0].hit, true);
  assert.equal(score.checkGuess(q('no-gloss', 'ok-seen'), { value: 4 }, { value: 6 })[0].hit, false);
  assert.equal(score.checkGuess(q('no-gloss', 'weather'), { icon: 'fog', phrase: 'x' }, { icon: 'fog' })[0].hit, true);
  const scene = score.checkGuess(q('six-hours', 'no-reply'), { feel: ['anxiety', 'fear'], do: 'call' }, { feel: ['anxiety'], do: 'wait' });
  assert.deepEqual(scene, [{ part: 'feel', hit: true }, { part: 'do', hit: false }]);
});

test('terrain: valley / hill / mountain', () => {
  const values = q('perpetual', 'values');
  const same = score.compareAnswers(values, { order: ['a', 'b', 'c', 'd', 'e'] }, { order: ['b', 'a', 'c', 'd', 'x'] });
  assert.equal(score.terrain(same, 'fixed', 'fixed'), 'valley');
  const diff = score.compareAnswers(values, { order: ['a', 'b', 'c', 'd', 'e'] }, { order: ['v', 'w', 'x', 'd', 'e'] });
  assert.equal(score.terrain(diff, 'negotiable', 'negotiable'), 'hill');
  assert.equal(score.terrain(diff, 'important', 'negotiable'), 'hill');
  assert.equal(score.terrain(diff, 'negotiable', 'fixed'), 'mountain');
  const slider = q('perpetual', 'money-style');
  assert.equal(score.compareAnswers(slider, { value: 40 }, { value: 60 }).same, true);
  assert.equal(score.compareAnswers(slider, { value: 30 }, { value: 60 }).same, false);
});

test('seek/withdraw chase pattern', () => {
  const d = deck('six-hours');
  assert.equal(score.chasePattern(d, { feel: ['anxiety'], do: 'call' }, { feel: ['relief'], do: 'shut-down' }), true);
  assert.equal(score.chasePattern(d, { feel: ['anxiety'], do: 'call' }, { feel: ['anxiety'], do: 'write-more' }), false);
  assert.equal(score.chasePattern(d, { feel: ['sadness'], do: 'wait' }, { feel: ['hurt'], do: 'own-thing' }), false);
});

test('wishlist matches never include a "no"', () => {
  const m = score.wishlistMatches({ a: 'yes', b: 'maybe', c: 'no', d: 'yes' }, { a: 'yes', b: 'yes', c: 'yes', d: 'no' }, ['a', 'b', 'c', 'd']);
  assert.deepEqual(m, [{ id: 'a', level: 'yes' }, { id: 'b', level: 'maybe' }]);
});
