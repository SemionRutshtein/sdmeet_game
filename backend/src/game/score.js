// Pure scoring rules. No DB, no I/O. See docs/IMPLEMENTATION.md for the thresholds.

const SCALE_CLOSE = 1;
const SLIDER_CLOSE = 20;
const JACCARD_SAME = 0.5;

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  const union = new Set([...A, ...B]).size;
  if (!union) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / union;
}

function intersection(a, b) {
  const B = new Set(b);
  return a.filter(x => B.has(x));
}

function sceneFieldHit(f, actual, guess) {
  if (f.type === 'multi') return jaccard(actual, guess) >= JACCARD_SAME;
  if (f.type === 'scale') return Math.abs(actual - guess) <= SCALE_CLOSE;
  return actual === guess;
}

// Is a guess right? Returns one check per scored part (a scene has one per guessable field).
function checkGuess(q, actual, guess, deck) {
  switch (q.type) {
    case 'choice':
      return [{ part: 'main', hit: actual.option === guess.option }];
    case 'rank':
      return [{ part: 'main', hit: actual.order[0] === guess.option }];
    case 'multi':
      return [{ part: 'main', hit: jaccard(actual.options, guess.options) >= JACCARD_SAME }];
    case 'scale':
      return [{ part: 'main', hit: Math.abs(actual.value - guess.value) <= SCALE_CLOSE }];
    case 'weather':
      return [{ part: 'main', hit: actual.icon === guess.icon }];
    case 'scene':
      // Answers saved before a field existed simply don't score on it.
      return Object.entries(deck.sceneFields)
        .filter(([key, f]) => f.guess && actual[key] != null && guess[key] != null)
        .map(([key, f]) => ({ part: key, hit: sceneFieldHit(f, actual[key], guess[key]) }));
    default:
      return [];
  }
}

// How close are two people's own answers? null when the type isn't comparable.
function compareAnswers(q, a, b) {
  switch (q.type) {
    case 'choice':
      return { same: a.option === b.option };
    case 'weather':
      return { same: a.icon === b.icon };
    case 'multi': {
      const shared = intersection(a.options, b.options);
      return { same: jaccard(a.options, b.options) >= JACCARD_SAME, shared };
    }
    case 'rank': {
      const shared = intersection(a.order, b.order);
      const topSame = a.order[0] === b.order[0];
      // top-N picks: near-identical sets count as the same; full rankings: same #1
      const same = q.pick ? shared.length >= q.pick - 1 : topSame;
      return { same, topSame, shared, k: a.order.length };
    }
    case 'scale': {
      const distance = Math.abs(a.value - b.value);
      return { same: distance <= SCALE_CLOSE, distance };
    }
    case 'slider': {
      const distance = Math.abs(a.value - b.value);
      return { same: distance <= SLIDER_CLOSE, distance };
    }
    case 'scene': {
      const sameStory = a.story != null && a.story === b.story;
      const sameDo = a.do === b.do;
      return { same: sameDo && (sameStory || jaccard(a.feel || [], b.feel || []) >= JACCARD_SAME), sameDo, sameStory };
    }
    default:
      return null;
  }
}

// Deck 2: valley / hill / mountain. Labels: negotiable | important | fixed.
function terrain(cmp, labelA, labelB) {
  if (!cmp) return null;
  if (cmp.same) return 'valley';
  if (labelA === 'fixed' || labelB === 'fixed') return 'mountain';
  return 'hill';
}

// Deck 3: net lean of one scene answer, summed over every weighted field.
// > 0 seeks contact, < 0 withdraws.
function sceneLean(deck, value) {
  let lean = 0;
  for (const [key, f] of Object.entries(deck.sceneFields)) {
    if (!f.options || value[key] == null) continue;
    const ids = Array.isArray(value[key]) ? value[key] : [value[key]];
    for (const id of ids) {
      const o = f.options.find(x => x.id === id);
      if (o) lean += o.w[0] - o.w[1];
    }
  }
  return lean;
}

// One reaches out, the other pulls back.
const CHASE_SEEK = 3;
const CHASE_WITHDRAW = -2;
function chasePattern(deck, a, b) {
  const la = sceneLean(deck, a);
  const lb = sceneLean(deck, b);
  return (la >= CHASE_SEEK && lb <= CHASE_WITHDRAW) || (lb >= CHASE_SEEK && la <= CHASE_WITHDRAW);
}

// What a scene card says beyond "same / different". Seats are 1 and 2.
const SHAKE_GAP = 2;
function sceneInsights(deck, a, b) {
  const out = [];
  if (a.story != null && a.story === b.story) out.push({ code: 'scene_same_story' });
  else if (a.do === b.do) out.push({ code: 'scene_same_do' });
  const need = deck.sceneFields.need;
  if (need && a.need != null && b.need != null) {
    if (a.need === b.need) out.push({ code: 'scene_same_need' });
    else {
      const lean = id => { const o = need.options.find(x => x.id === id); return o ? o.w[0] - o.w[1] : 0; };
      if (lean(a.need) * lean(b.need) < 0) out.push({ code: 'scene_need_clash' });
    }
  }
  if (Number.isInteger(a.shake) && Number.isInteger(b.shake) && Math.abs(a.shake - b.shake) >= SHAKE_GAP) {
    out.push({ code: 'scene_shake_gap', params: { seat: a.shake > b.shake ? 1 : 2 } });
  }
  if (!out.length) out.push({ code: 'differ' });
  return out;
}

// Deck 4 wishlist: only items where both said yes or maybe. The "no" side is never exposed.
function wishlistMatches(itemsA, itemsB, ids) {
  const out = [];
  for (const id of ids) {
    const a = itemsA[id];
    const b = itemsB[id];
    if ((a === 'yes' || a === 'maybe') && (b === 'yes' || b === 'maybe')) {
      out.push({ id, level: a === 'yes' && b === 'yes' ? 'yes' : 'maybe' });
    }
  }
  return out;
}

module.exports = {
  jaccard,
  checkGuess,
  compareAnswers,
  terrain,
  sceneLean,
  chasePattern,
  sceneInsights,
  wishlistMatches
};
