const test = require('node:test');
const assert = require('node:assert/strict');
const { loadContent, validateContent } = require('../src/content');

test('shipped content is valid in en/ru/he', () => {
  const c = loadContent();
  assert.equal(c.decks.length, 4);
  // design doc: deck 1 has 9 stage-1 questions and 10 pool questions, etc.
  const counts = Object.fromEntries(c.decks.map(d => [d.id, [d.stage1.length, d.pool.length]]));
  assert.deepEqual(counts, { 'no-gloss': [9, 10], perpetual: [12, 10], 'six-hours': [8, 7], closer: [8, 7] });
  assert.ok(c.decks.find(d => d.id === 'closer').pool.every(p => p.lock), 'all deck-4 pool questions are locked');
  assert.ok(c.decks.find(d => d.id === 'no-gloss').stage1.filter(q => q.id !== 'first-impression').every(q => q.predictable));
});

test('validator catches a missing translation and a bad group', () => {
  const deck = {
    id: 'x', order: 1, title: { en: 'X', ru: 'X', he: '' },
    reveal: { groups: [{ id: 'g', questions: ['nope'], title: { en: 'a', ru: 'a', he: 'a' } }] },
    stage1: [{ id: 'q', type: 'scale', min: 1, max: 7, prompt: { en: 'a', ru: 'a', he: 'a' } }],
    pool: [{ id: 'p', text: { en: 'a', ru: 'a' } }]
  };
  const problems = validateContent({ decks: [deck], wishlist: [], capsule: { prompts: [{ id: 'a', text: { en: 'a', ru: 'a', he: 'a' } }] } });
  assert.ok(problems.some(p => p.includes('title: missing "he"')));
  assert.ok(problems.some(p => p.includes('pool[0].text: missing "he"')));
  assert.ok(problems.some(p => p.includes('unknown question nope')));
});
