// End-to-end over HTTP against a real Postgres: two players, all four decks,
// every stage, the reveal board, threads, voice, summary, export, capsule,
// purge, delete. Needs TEST_DATABASE_URL (defaults to a local sdmeet_test).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, sampleSelf, sampleGuess, prisma } = require('./helpers');
const { purgeExpired } = require('../src/purge');

let srv;
let C; // content
test.before(async () => {
  srv = await startServer();
  C = (await client(srv.base).get('/api/content')).data;
});
test.after(async () => srv.stop());

const ALL = ['no-gloss', 'perpetual', 'six-hours', 'closer'];

async function setupRoom({ decks = ALL, adult = true } = {}) {
  const anon = client(srv.base);
  const created = await anon.post('/api/rooms', { name: 'Ana', decks, adultConfirmed: decks.includes('closer') });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const joined = await anon.post(`/api/rooms/${created.data.roomId}/join`, { name: 'Ben', adult });
  assert.equal(joined.status, 200);
  return {
    roomId: created.data.roomId,
    a: client(srv.base, created.data.token),
    b: client(srv.base, joined.data.token)
  };
}

function decksOf(ids) {
  return C.decks.filter(d => ids.includes(d.id));
}

async function answerStage1(p, deckIds, variant) {
  for (const deck of decksOf(deckIds)) {
    for (const q of deck.stage1) {
      const body = { kind: 'self', qkey: `${deck.id}:${q.id}`, value: sampleSelf(q, deck, C.wishlist, variant) };
      if (deck.labels) body.label = variant && q.id === 'values' ? 'fixed' : 'negotiable';
      const r = await p.put('/api/answers', body);
      assert.equal(r.status, 200, `${body.qkey}: ${JSON.stringify(r.data)}`);
    }
  }
}

async function pickQuestions(p, deckIds, extra = []) {
  const items = [];
  for (const deck of decksOf(deckIds)) items.push({ deckId: deck.id, poolId: deck.pool[0].id });
  items.push(...extra);
  while (items.length < 5) {
    const deck = decksOf(deckIds)[0];
    items.push({ deckId: deck.id, poolId: deck.pool[items.length].id });
  }
  return p.post('/api/asked', { items });
}

async function guessAll(p, deckIds, partnerVariant) {
  for (const deck of decksOf(deckIds)) {
    for (const q of deck.stage1.filter(x => x.predictable)) {
      const actual = sampleSelf(q, deck, C.wishlist, partnerVariant);
      const r = await p.put('/api/answers', { kind: 'guess', qkey: `${deck.id}:${q.id}`, value: sampleGuess(q, deck, actual) });
      assert.equal(r.status, 200, JSON.stringify(r.data));
    }
  }
}

async function replyAll(p) {
  const st = (await p.get('/api/state')).data;
  for (const a of st.askedToMe) {
    const r = await p.put('/api/answers', { kind: 'reply', qkey: a.id, value: { text: 'my reply' } });
    assert.equal(r.status, 200);
  }
  return st.askedToMe;
}

async function openAll(room) {
  // Alternate turns until every card is open, respecting the board's order rules.
  for (let guard = 0; guard < 200; guard++) {
    const st = (await room.a.get('/api/state')).data;
    if (st.board.allOpened) return;
    const mover = st.board.turnSeat === 1 ? room.a : room.b;
    const next = st.board.cards.find(c => c.openable);
    assert.ok(next, 'some card must be openable');
    const r = await mover.post(`/api/cards/${encodeURIComponent(next.key)}/open`);
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  throw new Error('board never finished');
}

test('content: four decks, all locales present, capsule prompts', () => {
  assert.deepEqual(C.decks.map(d => d.id), ALL);
  assert.equal(C.capsule.prompts.length, 5);
  assert.ok(C.wishlist.length > 5);
});

test('create/join validation', async () => {
  const anon = client(srv.base);
  assert.equal((await anon.post('/api/rooms', { name: '', decks: ['no-gloss'] })).data.error, 'name_required');
  assert.equal((await anon.post('/api/rooms', { name: 'X', decks: ['closer'], adultConfirmed: true })).data.error, 'decks_required');
  assert.equal((await anon.post('/api/rooms', { name: 'X', decks: ['no-gloss', 'closer'] })).data.error, 'adult_confirm_required');
  const r = await anon.post('/api/rooms', { name: 'X', decks: ['no-gloss'] });
  const pub = await anon.get(`/api/rooms/${r.data.roomId}/public`);
  assert.equal(pub.data.hostName, 'X');
  assert.equal((await anon.post(`/api/rooms/${r.data.roomId}/join`, { name: 'Y' })).status, 200);
  assert.equal((await anon.post(`/api/rooms/${r.data.roomId}/join`, { name: 'Z' })).data.error, 'room_full');
  assert.equal((await client(srv.base, 'nope').get('/api/state')).status, 401);
});

test('partner declining the 18+ deck removes it and the creator\'s answers to it', async () => {
  const anon = client(srv.base);
  const created = await anon.post('/api/rooms', { name: 'Ana', decks: ['no-gloss', 'closer'], adultConfirmed: true });
  const a = client(srv.base, created.data.token);
  const closer = C.decks.find(d => d.id === 'closer');
  const q = closer.stage1[0];
  assert.equal((await a.put('/api/answers', { kind: 'self', qkey: `closer:${q.id}`, value: sampleSelf(q, closer, C.wishlist) })).status, 200);
  await anon.post(`/api/rooms/${created.data.roomId}/join`, { name: 'Ben', adult: false });
  const st = (await a.get('/api/state')).data;
  assert.deepEqual(st.room.decks, ['no-gloss']);
  assert.equal(Object.keys(st.answers.self).length, 0);
});

test('full game: stages, freeze, reveal board, locks, threads, voice, summary, export, capsule, purge', async () => {
  const room = await setupRoom();
  const { a, b, roomId } = room;

  // ---- stage 1
  const early = await a.post('/api/stages/1/complete');
  assert.equal(early.data.error, 'incomplete');
  await answerStage1(a, ALL, 0);
  await answerStage1(b, ALL, 1);
  // a pass is allowed and shows up later
  assert.equal((await b.put('/api/answers', { kind: 'self', qkey: 'no-gloss:hardest-emotion', pass: true })).status, 200);
  // deck 2 needs a label unless passing
  const noLabel = await a.put('/api/answers', { kind: 'self', qkey: 'perpetual:relocate', value: { value: 3 } });
  assert.equal(noLabel.data.error, 'bad_value');
  // wrong shapes are refused
  assert.equal((await a.put('/api/answers', { kind: 'self', qkey: 'no-gloss:ok-seen', value: { value: 9 } })).status, 400);
  assert.equal((await a.put('/api/answers', { kind: 'self', qkey: 'no-gloss:anger', value: { option: 'other' } })).status, 400);
  assert.equal((await a.post('/api/stages/1/complete')).status, 200);
  assert.equal((await b.post('/api/stages/1/complete')).status, 200);

  // ---- stage 2
  const tooFew = await a.post('/api/asked', { items: [{ deckId: 'no-gloss', poolId: 'hidden-trait' }] });
  assert.equal(tooFew.data.error, 'ask_count');
  assert.equal((await pickQuestions(a, ALL, [{ custom: 'What is your favourite smell?' }, { custom: 'Secret one', lock: true }])).status, 200);
  // b can't see a's picks before stage 3
  assert.equal((await b.get('/api/state')).data.askedToMe.length, 0);
  // and nobody can guess before both finished stage 2
  const tooSoon = await a.put('/api/answers', { kind: 'guess', qkey: 'no-gloss:anger', value: { option: 'say' } });
  assert.equal(tooSoon.data.error, 'wrong_stage');
  assert.equal((await pickQuestions(b, ALL)).status, 200);

  // ---- stage 3 + freeze
  assert.equal((await b.put('/api/answers', { kind: 'self', qkey: 'no-gloss:ok-seen', value: { value: 7 } })).status, 200);
  await guessAll(a, ALL, 1); // a guesses b exactly
  const frozen = await b.put('/api/answers', { kind: 'self', qkey: 'no-gloss:ok-seen', value: { value: 6 } });
  assert.equal(frozen.data.error, 'frozen');
  assert.equal((await b.get('/api/state')).data.frozen, true);
  const toA = await replyAll(a);
  assert.equal(toA.length, 5);
  assert.equal((await a.post('/api/stages/3/complete')).status, 200);
  assert.equal((await a.get('/api/state')).data.room.status, 'playing');

  const toB = await replyAll(b);
  assert.equal(toB.length, 6);
  assert.ok(toB.find(x => x.custom === 'Secret one').lock);
  // b passes on one reply and guesses everything "wrong" (as if a were variant 1)
  await b.put('/api/answers', { kind: 'reply', qkey: toB[0].id, pass: true });
  await guessAll(b, ALL, 1);
  assert.equal((await b.post('/api/stages/3/complete')).status, 200);

  // ---- reveal
  let st = (await a.get('/api/state')).data;
  assert.equal(st.room.status, 'reveal');
  const board = st.board;
  const keys = board.cards.map(c => c.key);
  assert.equal(keys[0], 'g:no-gloss:climate', 'deck 1 starts with the climate card');
  const lastCards = board.cards.filter(c => c.last);
  assert.ok(lastCards.some(c => c.key === 's:perpetual:values'), 'a non-negotiable difference is a mountain');
  assert.ok(lastCards.some(c => c.key === 's:closer:feel-desired'));
  assert.ok(lastCards.every(c => !c.openable), 'last cards wait');
  assert.ok(!board.cards.find(c => c.key === 's:closer:wishlist').openable, 'wishlist waits for deck-4 phase 1');

  const waiting = board.turnSeat === 1 ? b : a;
  const r = await waiting.post(`/api/cards/${encodeURIComponent(keys[0])}/open`);
  assert.equal(r.data.error, 'not_your_turn');
  // unopened cards don't leak
  assert.equal((await a.get(`/api/cards/${encodeURIComponent(keys[0])}`)).data.error, 'not_opened');

  await openAll(room);

  // climate card: a guessed b perfectly, b guessed a wrong
  const climate = (await a.get('/api/cards/g%3Ano-gloss%3Aclimate')).data;
  assert.equal(climate.questions.length, 5);
  const forecast = climate.conclusions.filter(c => c.code === 'read_forecast');
  const bySeat = Object.fromEntries(forecast.map(c => [c.params.seat, c.params]));
  assert.equal(bySeat[1].hits, bySeat[1].total);
  assert.ok(bySeat[2].hits < bySeat[2].total);

  // the pass is visible
  const hardest = (await a.get('/api/cards/s%3Ano-gloss%3Ahardest-emotion')).data;
  assert.deepEqual(hardest.questions[0].answers[2], { pass: true });
  assert.ok(hardest.conclusions.some(c => c.code === 'passed' && c.params.seat === 2));

  // deck 2 mountain + talk question
  const values = (await a.get('/api/cards/s%3Aperpetual%3Avalues')).data;
  assert.equal(values.terrain, 'mountain');
  assert.equal(values.talk.ref, 'talkMountain');

  // deck 3: shut-down vs call is the chase pattern; the scene brings its own talk prompt
  const scene = (await a.get('/api/cards/s%3Asix-hours%3Ano-reply')).data;
  assert.equal(scene.questions[0].pattern, 'chase');
  assert.deepEqual(scene.talk, { deck: 'six-hours', qid: 'no-reply', ref: 'qtalk' });
  assert.ok(scene.conclusions.some(c => c.code === 'scene_need_clash'));
  assert.ok(scene.questions[0].guesses[1].checks.length === 3);

  // wishlist: only the overlap, never the raw answers
  const wish = (await b.get('/api/cards/s%3Acloser%3Awishlist')).data;
  assert.equal(wish.questions[0].answers, undefined);
  assert.ok(Array.isArray(wish.questions[0].matches));
  assert.ok(!JSON.stringify(wish).includes('"no"'));

  // double lock
  const lockKey = 's%3Acloser%3Afeel-desired';
  assert.equal((await a.get(`/api/cards/${lockKey}`)).data.locked, true);
  await a.post(`/api/cards/${lockKey}/show`);
  await a.post(`/api/cards/${lockKey}/show`); // idempotent
  assert.deepEqual((await b.get(`/api/cards/${lockKey}`)).data.lockSeats, [1]);
  assert.equal((await b.get(`/api/cards/${lockKey}`)).data.locked, true);
  await b.post(`/api/cards/${lockKey}/show`);
  const unlockedCard = (await b.get(`/api/cards/${lockKey}`)).data;
  assert.equal(unlockedCard.locked, false);
  assert.equal(unlockedCard.questions[0].answers[1].value.text, 'answer 0');

  // asked card shows the reply; the custom one is locked
  const customCard = st.board.cards.find(c => c.kind === 'asked' && c.lock && !c.deck);
  assert.ok(customCard, 'custom locked question is on the board');

  // thread: text + voice; partner can play it, outsiders can't
  const anger = 's%3Ano-gloss%3Aanger';
  assert.equal((await a.post(`/api/cards/${anger}/messages`, { text: 'hi there' })).status, 200);
  const audio = Buffer.from('fake-webm-bytes');
  const up = await a.raw(`/api/voice?kind=thread&cardKey=${anger}&durationMs=1500`, audio, 'audio/webm');
  assert.equal(up.status, 200, JSON.stringify(up.data));
  assert.equal((await a.post(`/api/cards/${anger}/messages`, { voiceId: up.data.voiceId })).status, 200);
  const heard = await b.get(`/api/voice/${up.data.voiceId}`);
  assert.equal(heard.status, 200);
  assert.equal(heard.data.toString(), 'fake-webm-bytes');
  const other = await setupRoom({ decks: ['no-gloss'] });
  assert.equal((await other.a.get(`/api/voice/${up.data.voiceId}`)).status, 404);
  const thread = (await b.get(`/api/cards/${anger}`)).data.messages;
  assert.equal(thread.length, 2);
  assert.equal(thread[0].text, 'hi there');
  assert.equal((await a.raw('/api/voice?kind=thread&cardKey=x', audio, 'text/plain')).status, 400);

  // statuses + rules
  assert.equal((await a.post(`/api/cards/${anger}/status`, { status: 'rule', rule: 'We say "pause" and come back in an hour' })).status, 200);
  assert.equal((await b.post('/api/cards/s%3Ano-gloss%3Afamily-anger/status', { status: 'later' })).status, 200);

  // data at rest is encrypted
  const raw = await prisma.answer.findFirst({ where: { roomId } });
  assert.ok(raw.data.startsWith('v1:'));
  assert.ok(!raw.data.includes('answer'));
  const rawMsg = await prisma.message.findFirst({ where: { roomId, body: { not: null } } });
  assert.ok(!rawMsg.body.includes('hi there'));

  // ---- summary
  const sum = (await a.get('/api/summary')).data;
  assert.equal(sum.cardsOpened, sum.cardsTotal);
  assert.equal(sum.rules.length, 1);
  assert.equal(sum.later.length, 1);
  const ng = sum.accuracy.find(x => x.deck === 'no-gloss');
  assert.equal(ng.bySeat[1].hits, ng.bySeat[1].total);
  assert.ok(sum.relief.mountain >= 1);
  assert.ok(sum.storyboard.chase >= 1);
  assert.equal(sum.storyboard.sameStory, 0);
  assert.deepEqual([sum.storyboard.needs[1], sum.storyboard.needs[2]].sort(), ['reassure', 'time']);
  assert.ok(sum.climate[1] && sum.climate[2]);
  assert.ok(!sum.accuracy.some(x => x.deck === 'closer'));

  // ---- export needs both
  assert.equal((await a.get('/api/export')).status, 403);
  await a.post('/api/consents', { type: 'export', value: true });
  await a.post('/api/consents', { type: 'export', value: true });
  assert.equal((await a.get('/api/export')).status, 403);
  await b.post('/api/consents', { type: 'export', value: true });
  let exp = (await b.get('/api/export')).data;
  assert.ok(exp.cards.length > 5);
  assert.ok(!exp.cards.some(c => c.deck === 'closer'), '18+ deck stays out by default');
  await a.post('/api/consents', { type: 'adultExport', value: true });
  await b.post('/api/consents', { type: 'adultExport', value: true });
  exp = (await b.get('/api/export')).data;
  assert.ok(exp.cards.some(c => c.deck === 'closer'));
  await b.post('/api/consents', { type: 'adultExport', value: false });
  assert.ok(!(await b.get('/api/export')).data.cards.some(c => c.deck === 'closer'));

  // ---- capsule
  const entry = { admire: 'your calm', fear: 'distance', 'half-year': 'same city', remember: 'I chose you', 'change-first': 'the schedule' };
  assert.equal((await a.put('/api/capsule/entry', { answers: entry })).status, 200);
  assert.equal((await a.put('/api/capsule/months', { months: 6 })).status, 200);
  assert.equal((await b.put('/api/capsule/entry', { answers: { ...entry, admire: 'your laugh' } })).status, 200);
  assert.equal((await b.put('/api/capsule/months', { months: 2 })).status, 400);
  await b.put('/api/capsule/months', { months: 3 });
  st = (await a.get('/api/state')).data;
  assert.equal(st.capsule.sealed, false, 'different durations: not sealed');
  assert.equal(st.capsule.partnerWrote, true);
  assert.equal(st.capsule.entries, undefined);
  await b.put('/api/capsule/months', { months: 6 });
  st = (await a.get('/api/state')).data;
  assert.equal(st.capsule.sealed, true);
  assert.equal(st.capsule.open, false);
  assert.equal(st.capsule.entries, undefined, 'nobody reads it before the date');
  const openIn = new Date(st.capsule.openAt) - Date.now();
  assert.ok(openIn > 150 * 24 * 3600 * 1000, 'six months out');
  assert.equal((await a.put('/api/capsule/entry', { answers: entry })).data.error, 'sealed');

  // ---- purge: room expires, capsule survives
  await prisma.room.update({ where: { id: roomId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await purgeExpired();
  st = (await a.get('/api/state')).data;
  assert.equal(st.room.status, 'archived');
  assert.equal(await prisma.answer.count({ where: { roomId } }), 0);
  assert.equal(await prisma.voice.count({ where: { roomId } }), 0);
  assert.equal(await prisma.message.count({ where: { roomId } }), 0);

  // ---- the date arrives
  await prisma.capsule.update({ where: { roomId }, data: { openAt: new Date(Date.now() - 1000) } });
  st = (await b.get('/api/state')).data;
  assert.equal(st.capsule.open, true);
  assert.equal(st.capsule.entries[1].admire, 'your calm');
  assert.equal(st.capsule.entries[2].admire, 'your laugh');

  // retake deck 1, then/now + accuracy change
  assert.equal((await a.post('/api/capsule/retake', { deckId: 'no-gloss' })).status, 200);
  assert.equal((await b.post('/api/capsule/retake', { deckId: 'perpetual' })).data.error, 'wrong_stage');
  const ng1 = C.decks.find(d => d.id === 'no-gloss');
  for (const [p, variant] of [[a, 1], [b, 1]]) {
    for (const q of ng1.stage1) {
      const res = await p.put('/api/answers', { kind: 'retake', qkey: `no-gloss:${q.id}`, value: sampleSelf(q, ng1, C.wishlist, variant) });
      assert.equal(res.status, 200);
    }
    assert.equal((await p.post('/api/stages/retake/complete')).status, 200);
  }
  for (const p of [a, b]) {
    for (const q of ng1.stage1.filter(x => x.predictable)) {
      const actual = sampleSelf(q, ng1, C.wishlist, 1);
      await p.put('/api/answers', { kind: 'retake_guess', qkey: `no-gloss:${q.id}`, value: sampleGuess(q, ng1, actual) });
    }
    assert.equal((await p.post('/api/stages/retake_guess/complete')).status, 200);
  }
  const cmp = (await a.get('/api/capsule/compare')).data;
  assert.equal(cmp.deck, 'no-gloss');
  assert.ok(cmp.accuracyThen.bySeat[2].hits < cmp.accuracyNow.bySeat[2].hits, 'b reads a better now');
  const okSeen = cmp.questions.find(q => q.qid === 'ok-seen');
  assert.equal(okSeen.then[1].value.value, 1);
  assert.equal(okSeen.now[1].value.value, 7);

  // ---- archive expires too -> gone
  await prisma.room.update({ where: { id: roomId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await purgeExpired();
  assert.equal((await a.get('/api/state')).status, 401);
  assert.equal(await prisma.capsule.count({ where: { roomId } }), 0);
});

test('either player can delete the room with everything in it', async () => {
  const room = await setupRoom({ decks: ['no-gloss'] });
  await answerStage1(room.a, ['no-gloss'], 0);
  assert.equal((await room.b.del('/api/room')).status, 200);
  assert.equal((await room.a.get('/api/state')).status, 401);
  assert.equal(await prisma.answer.count({ where: { roomId: room.roomId } }), 0);
});

test('expired room without a capsule is deleted', async () => {
  const room = await setupRoom({ decks: ['no-gloss'] });
  await prisma.room.update({ where: { id: room.roomId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await purgeExpired();
  assert.equal(await prisma.room.count({ where: { id: room.roomId } }), 0);
});

test('content sent to the browser has no seek/withdraw weights', () => {
  assert.ok(!JSON.stringify(C).includes('"w":'));
  assert.ok(C.decks.find(d => d.id === 'six-hours').sceneFields.do.options.length > 3);
});
