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
  const six = deck('six-hours');
  const actual = { shake: 4, story: 'not-priority', feel: ['anxiety', 'fear'], do: 'call', need: 'reassure' };
  const scene = score.checkGuess(q('six-hours', 'no-reply'), actual, { story: 'not-priority', do: 'wait', need: 'reassure' }, six);
  assert.deepEqual(scene, [{ part: 'story', hit: true }, { part: 'do', hit: false }, { part: 'need', hit: true }]);
  // an answer saved before story/need existed only scores what it has
  const old = score.checkGuess(q('six-hours', 'no-reply'), { feel: ['anxiety'], do: 'call' }, { story: 'busy', do: 'call', need: 'time' }, six);
  assert.deepEqual(old, [{ part: 'do', hit: true }]);
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
  const seeker = { story: 'not-priority', feel: ['anxiety'], do: 'call', need: 'reassure' };
  const withdrawer = { story: 'their-right', feel: ['relief'], do: 'shut-down', need: 'time' };
  assert.equal(score.chasePattern(d, seeker, withdrawer), true);
  assert.equal(score.chasePattern(d, seeker, { story: 'drifting', feel: ['fear'], do: 'write-more', need: 'voice' }), false);
  assert.equal(score.chasePattern(d, { story: 'busy', feel: ['sadness'], do: 'wait', need: 'explain' }, { feel: ['hurt'], do: 'own-thing' }), false);
});

test('scene insights: shared story, needs that pull apart, who it hits harder', () => {
  const d = deck('six-hours');
  const codes = (a, b) => score.sceneInsights(d, a, b).map(x => x.code);
  assert.deepEqual(codes({ story: 'busy', do: 'wait', need: 'time', shake: 1 }, { story: 'busy', do: 'call', need: 'time', shake: 2 }),
    ['scene_same_story', 'scene_same_need']);
  assert.deepEqual(codes({ story: 'busy', do: 'wait', need: 'voice', shake: 5 }, { story: 'unfair', do: 'wait', need: 'time', shake: 2 }),
    ['scene_same_do', 'scene_need_clash', 'scene_shake_gap']);
  assert.deepEqual(score.sceneInsights(d, { story: 'busy', do: 'wait', need: 'voice', shake: 2 }, { story: 'unfair', do: 'ask', need: 'time', shake: 5 })
    .find(x => x.code === 'scene_shake_gap').params, { seat: 2 });
  assert.deepEqual(codes({ story: 'busy', do: 'wait', need: 'voice' }, { story: 'unfair', do: 'ask', need: 'plan' }), ['differ']);
});

test('wishlist matches never include a "no"', () => {
  const m = score.wishlistMatches({ a: 'yes', b: 'maybe', c: 'no', d: 'yes' }, { a: 'yes', b: 'yes', c: 'yes', d: 'no' }, ['a', 'b', 'c', 'd']);
  assert.deepEqual(m, [{ id: 'a', level: 'yes' }, { id: 'b', level: 'maybe' }]);
});
