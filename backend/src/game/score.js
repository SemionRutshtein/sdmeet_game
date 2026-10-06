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

// Is a guess right? Returns one check per scored part (scenes have two).
function checkGuess(q, actual, guess) {
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
      return [
        { part: 'feel', hit: jaccard(actual.feel, guess.feel) >= JACCARD_SAME },
        { part: 'do', hit: actual.do === guess.do }
      ];
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
    case 'scene':
      return { same: a.do === b.do && jaccard(a.feel, b.feel) >= JACCARD_SAME, sameDo: a.do === b.do };
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

// Deck 3: net lean of one scene answer. > 0 seeks contact, < 0 withdraws.
function sceneLean(deck, value) {
  const { feel, do: doField } = deck.sceneFields;
  let seek = 0;
  let withdraw = 0;
  for (const id of value.feel) {
    const o = feel.options.find(x => x.id === id);
    if (o) { seek += o.w[0]; withdraw += o.w[1]; }
  }
  const d = doField.options.find(x => x.id === value.do);
  if (d) { seek += d.w[0]; withdraw += d.w[1]; }
  return seek - withdraw;
}

// One reaches out, the other pulls back.
function chasePattern(deck, a, b) {
  const la = sceneLean(deck, a);
  const lb = sceneLean(deck, b);
  return (la >= 2 && lb <= -1) || (lb >= 2 && la <= -1);
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
  wishlistMatches
};
