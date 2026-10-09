// Reveal board: which cards exist, in which order, which can be opened,
// and what an opened card shows. Pure functions over decrypted answers.
//
// ctx = {
//   content,                         // from content()
//   decks: ['no-gloss', ...],        // selected deck ids
//   self:  { 1: Map, 2: Map },       // qkey -> { v, pass, label }   (own stage-1 answers)
//   guess: { 1: Map, 2: Map },       // qkey -> { v, pass }           (seat's guess about the OTHER seat)
//   asked: [{ id, fromSeat, deckId, poolId, custom, lock, position }],
//   reply: { 1: Map, 2: Map }        // askedId -> { v, pass }        (seat's reply)
// }
const score = require('./score');

const other = seat => (seat === 1 ? 2 : 1);
const qkey = (deckId, qid) => `${deckId}:${qid}`;

function selectedDecks(ctx) {
  return ctx.content.decks.filter(d => ctx.decks.includes(d.id));
}

function cardKeyForQuestion(deck, qid) {
  const group = (deck.reveal?.groups || []).find(g => g.questions.includes(qid));
  return group ? `g:${deck.id}:${group.id}` : `s:${deck.id}:${qid}`;
}

function answered(rec) {
  return rec && !rec.pass && rec.v != null;
}

function compareFor(ctx, deck, q) {
  const a = ctx.self[1].get(qkey(deck.id, q.id));
  const b = ctx.self[2].get(qkey(deck.id, q.id));
  if (!answered(a) || !answered(b)) return { a, b, cmp: null };
  return { a, b, cmp: score.compareAnswers(q, a.v, b.v) };
}

function terrainFor(ctx, deck, q) {
  if (!deck.labels) return null;
  const { a, b, cmp } = compareFor(ctx, deck, q);
  if (!cmp) return null;
  return score.terrain(cmp, a.label, b.label);
}

// Static card list, computed once when the reveal starts.
function buildBoard(ctx) {
  const cards = [];
  for (const deck of selectedDecks(ctx)) {
    const groups = deck.reveal?.groups || [];
    const grouped = new Set(groups.flatMap(g => g.questions));
    for (const g of groups) {
      cards.push({ key: `g:${deck.id}:${g.id}`, deck: deck.id, kind: 'group', group: g.id, qids: g.questions, phase: 1, lock: false });
    }
    for (const q of deck.stage1) {
      if (grouped.has(q.id)) continue;
      const t = terrainFor(ctx, deck, q);
      cards.push({
        key: `s:${deck.id}:${q.id}`,
        deck: deck.id,
        kind: q.type === 'wishlist' ? 'wishlist' : 'self',
        qids: [q.id],
        phase: q.phase || 1,
        lock: !!q.lock,
        terrain: t
      });
    }
    const asked = ctx.asked
      .filter(a => a.deckId === deck.id && a.poolId)
      .sort((x, y) => x.fromSeat - y.fromSeat || x.position - y.position);
    for (const a of asked) {
      cards.push({ key: `a:${a.id}`, deck: deck.id, kind: 'asked', askedId: a.id, phase: a.lock ? 3 : 1, lock: !!a.lock });
    }
  }
  const custom = ctx.asked
    .filter(a => !a.poolId)
    .sort((x, y) => x.fromSeat - y.fromSeat || x.position - y.position);
  for (const a of custom) {
    cards.push({ key: `a:${a.id}`, deck: null, kind: 'asked', askedId: a.id, phase: 1, lock: !!a.lock });
  }
  for (const c of cards) c.last = c.lock || c.terrain === 'mountain';
  return cards;
}

// opened: Set of card keys already opened
function isOpenable(cards, opened, card) {
  if (opened.has(card.key)) return false;
  if (card.last && cards.some(c => !c.last && !opened.has(c.key))) return false;
  if (card.deck && cards.some(c => c.deck === card.deck && c.phase < card.phase && !opened.has(c.key))) return false;
  return true;
}

function seatAnswer(rec) {
  if (!rec) return null;
  if (rec.pass) return { pass: true };
  const out = { value: rec.v };
  if (rec.label) out.label = rec.label;
  return out;
}

function guessView(deck, q, guessRec, actualRec) {
  if (!guessRec) return null;
  if (guessRec.pass) return { pass: true };
  const out = { value: guessRec.v };
  if (answered(actualRec)) out.checks = score.checkGuess(q, actualRec.v, guessRec.v, deck);
  return out;
}

function guessLine(views, names) {
  // views: { 1: guessView by seat 1, 2: guessView by seat 2 }
  const hit = s => views[s]?.checks?.length && views[s].checks.every(c => c.hit);
  const scored = [1, 2].filter(s => views[s]?.checks?.length);
  if (scored.length < 2) return null;
  if (hit(1) && hit(2)) return { code: 'guess_both' };
  if (!hit(1) && !hit(2)) return { code: 'guess_none' };
  const winner = hit(1) ? 1 : 2;
  return { code: 'guess_one', params: { seat: winner } };
}

function compareLine(q, cmp) {
  if (!cmp) return null;
  if (q.type === 'rank') {
    if (q.pick) return { code: 'rank_shared', params: { n: cmp.shared.length, k: cmp.k } };
    return { code: cmp.topSame ? 'rank_top_same' : 'rank_top_differ' };
  }
  if (cmp.same) return { code: 'same' };
  if (q.type === 'scale') return { code: 'apart_points', params: { n: cmp.distance } };
  if (q.type === 'slider') return { code: 'apart_percent', params: { n: cmp.distance } };
  if (q.type === 'multi') return { code: 'multi_shared', params: { n: cmp.shared.length } };
  return { code: 'differ' };
}

function passLines(a, b) {
  const out = [];
  if (a?.pass) out.push({ code: 'passed', params: { seat: 1 } });
  if (b?.pass) out.push({ code: 'passed', params: { seat: 2 } });
  return out;
}

function questionView(ctx, deck, q) {
  const key = qkey(deck.id, q.id);
  const a = ctx.self[1].get(key);
  const b = ctx.self[2].get(key);
  const view = { qid: q.id, type: q.type, answers: { 1: seatAnswer(a), 2: seatAnswer(b) } };
  if (q.predictable) {
    view.guesses = {
      1: guessView(deck, q, ctx.guess[1].get(key), b), // seat 1 guessed seat 2
      2: guessView(deck, q, ctx.guess[2].get(key), a)
    };
  }
  return view;
}

function selfCardView(ctx, card) {
  const deck = ctx.content.deckById.get(card.deck);
  const q = deck.stage1.find(x => x.id === card.qids[0]);
  const key = qkey(deck.id, q.id);
  const a = ctx.self[1].get(key);
  const b = ctx.self[2].get(key);

  if (q.type === 'wishlist') {
    const lines = passLines(a, b);
    let matches = [];
    if (answered(a) && answered(b)) {
      matches = score.wishlistMatches(a.v.items, b.v.items, ctx.content.wishlist.map(w => w.id));
      lines.push(matches.length ? { code: 'wish_matches', params: { n: matches.length } } : { code: 'wish_none' });
    }
    // Never expose the raw answers: only the overlap and who passed.
    return {
      questions: [{ qid: q.id, type: q.type, passed: { 1: !!a?.pass, 2: !!b?.pass }, matches }],
      conclusions: lines,
      talk: { deck: deck.id, ref: 'talk' }
    };
  }

  const view = questionView(ctx, deck, q);
  const { cmp } = compareFor(ctx, deck, q);
  const lines = passLines(a, b);
  const bothAnswered = answered(a) && answered(b);
  if (q.type === 'scene') {
    if (bothAnswered) lines.push(...score.sceneInsights(deck, a.v, b.v));
  } else {
    const cl = compareLine(q, cmp);
    if (cl) lines.push(cl);
  }
  if (view.guesses) {
    const gl = guessLine(view.guesses);
    if (gl) lines.push(gl);
  }
  // A question can carry its own talk prompt; the deck's is the fallback.
  let talk = q.talk ? { deck: deck.id, qid: q.id, ref: 'qtalk' } : { deck: deck.id, ref: 'talk' };
  if (card.terrain) {
    view.terrain = card.terrain;
    lines.unshift({ code: `terrain_${card.terrain}` });
    if (card.terrain === 'mountain' && deck.reveal.talkMountain) talk = { deck: deck.id, ref: 'talkMountain' };
  }
  if (q.type === 'scene' && bothAnswered && score.chasePattern(deck, a.v, b.v)) {
    view.pattern = 'chase';
    lines.push({ code: 'chase' });
  }
  return { questions: [view], conclusions: lines, talk, ruleSuggested: !!deck.reveal.ruleSuggested };
}

function groupCardView(ctx, card) {
  const deck = ctx.content.deckById.get(card.deck);
  const group = deck.reveal.groups.find(g => g.id === card.group);
  const questions = group.questions.map(qid => questionView(ctx, deck, deck.stage1.find(x => x.id === qid)));
  const lines = [];
  for (const seat of [1, 2]) {
    let hits = 0;
    let total = 0;
    for (const qv of questions) {
      const checks = qv.guesses?.[seat]?.checks;
      if (!checks) continue;
      total += checks.length;
      hits += checks.filter(c => c.hit).length;
    }
    if (total) lines.push({ code: 'read_forecast', params: { seat, hits, total } });
  }
  return { questions, conclusions: lines, talk: { deck: deck.id, ref: `group:${group.id}` } };
}

function askedCardView(ctx, card) {
  const a = ctx.asked.find(x => x.id === card.askedId);
  const toSeat = other(a.fromSeat);
  const rec = ctx.reply[toSeat].get(a.id);
  const lines = rec?.pass ? [{ code: 'passed', params: { seat: toSeat } }] : [];
  return {
    asked: {
      fromSeat: a.fromSeat,
      toSeat,
      deck: a.deckId,
      poolId: a.poolId,
      custom: a.custom || null,
      reply: seatAnswer(rec)
    },
    conclusions: lines,
    talk: { ref: 'asked' }
  };
}

function cardView(ctx, card) {
  if (card.kind === 'asked') return askedCardView(ctx, card);
  if (card.kind === 'group') return groupCardView(ctx, card);
  return selfCardView(ctx, card);
}

// Accuracy and the non-verbatim bits used by "Our map" and the share image.
function summary(ctx, cards) {
  const decks = selectedDecks(ctx);
  const accuracy = [];
  for (const deck of decks) {
    const bySeat = { 1: { hits: 0, total: 0 }, 2: { hits: 0, total: 0 } };
    let any = false;
    for (const q of deck.stage1) {
      if (!q.predictable) continue;
      any = true;
      const key = qkey(deck.id, q.id);
      for (const seat of [1, 2]) {
        const g = ctx.guess[seat].get(key);
        const actual = ctx.self[other(seat)].get(key);
        if (!answered(g) || !answered(actual)) continue;
        const checks = score.checkGuess(q, actual.v, g.v, deck);
        bySeat[seat].total += checks.length;
        bySeat[seat].hits += checks.filter(c => c.hit).length;
      }
    }
    if (any) accuracy.push({ deck: deck.id, bySeat });
  }

  const out = { accuracy };
  if (ctx.decks.includes('no-gloss')) {
    const w = s => {
      const rec = ctx.self[s].get('no-gloss:weather');
      return answered(rec) ? rec.v.icon : null;
    };
    out.climate = { 1: w(1), 2: w(2) };
  }
  if (ctx.decks.includes('perpetual')) {
    const relief = { valley: 0, hill: 0, mountain: 0 };
    for (const c of cards) if (c.deck === 'perpetual' && c.terrain) relief[c.terrain]++;
    out.relief = relief;
  }
  if (ctx.decks.includes('six-hours')) {
    const deck = ctx.content.deckById.get('six-hours');
    let chase = 0;
    let total = 0;
    let sameStory = 0;
    const needs = { 1: new Map(), 2: new Map() };
    for (const q of deck.stage1) {
      const key = qkey(deck.id, q.id);
      const a = ctx.self[1].get(key);
      const b = ctx.self[2].get(key);
      for (const [seat, rec] of [[1, a], [2, b]]) {
        const id = answered(rec) ? rec.v.need : null;
        if (id) needs[seat].set(id, (needs[seat].get(id) || 0) + 1);
      }
      if (!answered(a) || !answered(b)) continue;
      total++;
      if (score.chasePattern(deck, a.v, b.v)) chase++;
      if (a.v.story != null && a.v.story === b.v.story) sameStory++;
    }
    // What helps each person most often (ties: the first one picked).
    const top = m => [...m.entries()].reduce((best, e) => (!best || e[1] > best[1] ? e : best), null)?.[0] || null;
    out.storyboard = { chase, total, sameStory, needs: { 1: top(needs[1]), 2: top(needs[2]) } };
  }
  return out;
}

module.exports = {
  buildBoard,
  isOpenable,
  cardView,
  summary,
  cardKeyForQuestion,
  qkey,
  other
};
