// Validation and normalization of everything a player submits.
// Throws AppError('bad_value') on anything that doesn't fit the question.

class AppError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const LABELS = ['negotiable', 'important', 'fixed'];
const WISH_LEVELS = ['yes', 'maybe', 'no'];
const MAX_CUSTOM = 200;

function bad() {
  return new AppError('bad_value');
}

function cleanText(s, max, { required = false } = {}) {
  if (s == null) s = '';
  if (typeof s !== 'string') throw bad();
  // Drop control characters except newlines and tabs.
  const text = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (text.length > max) throw bad();
  if (required && !text) throw bad();
  return text;
}

function hasOption(options, id) {
  return typeof id === 'string' && options.some(o => o.id === id);
}

function pickOne(options, id) {
  if (!hasOption(options, id)) throw bad();
  return id;
}

function pickMany(options, ids) {
  if (!Array.isArray(ids) || !ids.length) throw bad();
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length || !unique.every(id => hasOption(options, id))) throw bad();
  const exclusive = unique.filter(id => options.find(o => o.id === id).exclusive);
  if (exclusive.length && unique.length > 1) throw bad();
  return unique;
}

// "Top N of M" questions need exactly N. Full rankings need at least the top 3
// (ranking every last item was tedious and nothing is scored past #1).
const RANK_MIN = 3;
function rankRange(q) {
  if (q.pick) return { min: q.pick, max: q.pick };
  return { min: Math.min(RANK_MIN, q.options.length), max: q.options.length };
}

function intInRange(v, min, max) {
  if (!Number.isInteger(v) || v < min || v > max) throw bad();
  return v;
}

// value submitted for your own stage-1 answer
function normalizeSelf(q, deck, value, { wishlistIds } = {}) {
  if (!value || typeof value !== 'object') throw bad();
  switch (q.type) {
    case 'choice': {
      const option = pickOne(q.options, value.option);
      const out = { option };
      if (q.options.find(o => o.id === option).custom) {
        out.custom = cleanText(value.custom, MAX_CUSTOM, { required: true });
      }
      if (q.followup) {
        const followup = cleanText(value.followup, q.followup.maxLength || 600);
        if (followup) out.followup = followup;
      }
      return out;
    }
    case 'multi':
      return { options: pickMany(q.options, value.options) };
    case 'rank': {
      const { min, max } = rankRange(q);
      const order = value.order;
      if (!Array.isArray(order) || order.length < min || order.length > max) throw bad();
      if (new Set(order).size !== order.length || !order.every(id => hasOption(q.options, id))) throw bad();
      return { order: [...order] };
    }
    case 'scale':
      return { value: intInRange(value.value, q.min, q.max) };
    case 'slider':
      return { value: intInRange(value.value, 0, 100) };
    case 'text': {
      const text = cleanText(value.text, q.maxLength || 1000);
      const voiceId = value.voiceId == null ? null : String(value.voiceId);
      if (!text && !voiceId) throw bad();
      return voiceId ? { text, voiceId } : { text };
    }
    case 'weather':
      return {
        icon: pickOne(q.options, value.icon),
        phrase: cleanText(value.phrase, q.maxLength || 120)
      };
    case 'scene':
      return sceneValue(deck.sceneFields, value, () => true);
    case 'wishlist': {
      const items = value.items;
      if (!items || typeof items !== 'object') throw bad();
      const out = {};
      for (const id of wishlistIds) {
        if (!WISH_LEVELS.includes(items[id])) throw bad();
        out[id] = items[id];
      }
      return { items: out };
    }
    default:
      throw bad();
  }
}

// value submitted as a guess about the partner's stage-1 answer
function normalizeGuess(q, deck, value) {
  if (!q.predictable) throw bad();
  if (!value || typeof value !== 'object') throw bad();
  switch (q.type) {
    case 'choice':
    case 'rank':
      // rank: you guess the partner's #1
      return { option: pickOne(q.options, value.option) };
    case 'multi':
      return { options: pickMany(q.options, value.options) };
    case 'scale':
      return { value: intInRange(value.value, q.min, q.max) };
    case 'weather':
      return { icon: pickOne(q.options, value.icon) };
    case 'scene':
      return sceneValue(deck.sceneFields, value, f => f.guess);
    default:
      throw bad();
  }
}

// One scene answer: every field the filter keeps. Text is optional, the rest required.
function sceneValue(fields, value, keep) {
  const out = {};
  for (const [key, f] of Object.entries(fields)) {
    if (!keep(f)) continue;
    const v = value[key];
    if (f.type === 'scale') out[key] = intInRange(v, f.min, f.max);
    else if (f.type === 'choice') out[key] = pickOne(f.options, v);
    else if (f.type === 'multi') {
      out[key] = pickMany(f.options, v);
      if (f.max && out[key].length > f.max) throw bad();
    } else if (f.type === 'text') {
      const text = cleanText(v, f.maxLength || 160);
      if (text) out[key] = text;
    }
  }
  return out;
}

function normalizeReply(value) {
  if (!value || typeof value !== 'object') throw bad();
  const text = cleanText(value.text, 2000);
  const voiceId = value.voiceId == null ? null : String(value.voiceId);
  if (!text && !voiceId) throw bad();
  return voiceId ? { text, voiceId } : { text };
}

function normalizeLabel(label) {
  if (!LABELS.includes(label)) throw bad();
  return label;
}

module.exports = {
  AppError,
  rankRange,
  LABELS,
  WISH_LEVELS,
  cleanText,
  normalizeSelf,
  normalizeGuess,
  normalizeReply,
  normalizeLabel
};
