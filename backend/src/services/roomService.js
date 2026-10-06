// Room lifecycle: create/join, the three async stages, the reveal board,
// threads, voice, summary/export, capsule, deletion.
// Every function that takes `player` expects the result of authenticate().
const prisma = require('../db');
const config = require('../config');
const events = require('../events');
const presence = require('../presence');
const { content } = require('../content');
const { encryptJson, decryptJson, encryptBuffer, decryptBuffer, newToken, hashToken } = require('../crypto');
const V = require('../game/values');
const B = require('../game/board');
const score = require('../game/score');

const { AppError } = V;
const err = (code, status = 400) => new AppError(code, status);
const notFound = () => err('not_found', 404);
const other = B.other;

const DAY_MS = 24 * 60 * 60 * 1000;
const CONSENT_COLUMNS = { share: 'shareConsent', export: 'exportConsent', adultExport: 'adultExportConsent' };
const CARD_STATUSES = ['discussed', 'later', 'rule'];
const VOICE_MIME = /^audio\/(webm|ogg|mp4|mpeg|aac|x-m4a|wav)(;[\w=.,\s-]*)?$/i;

const expiry = () => new Date(Date.now() + config.roomTtlDays * DAY_MS);
const adultDeckIds = () => content().decks.filter(d => d.adult).map(d => d.id);

function cleanName(name) {
  try {
    return V.cleanText(name, 30, { required: true });
  } catch {
    throw err('name_required');
  }
}

async function touch(roomId) {
  await prisma.room.updateMany({ where: { id: roomId }, data: { expiresAt: expiry() } });
}

// ---------- auth ----------

async function authenticate(token) {
  if (!token || typeof token !== 'string' || token.length > 100) throw err('unauthorized', 401);
  const player = await prisma.player.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { room: { include: { players: { orderBy: { seat: 'asc' } } } } }
  });
  if (!player) throw err('unauthorized', 401);
  return player;
}

function partnerOf(player) {
  return player.room.players.find(p => p.seat !== player.seat) || null;
}

function requireStatus(player, ...statuses) {
  if (!statuses.includes(player.room.status)) throw err('wrong_stage', 409);
}

// ---------- create / join ----------

async function createRoom({ name, decks, adultConfirmed }) {
  const c = content();
  const playerName = cleanName(name);
  if (!Array.isArray(decks)) throw err('decks_required');
  const chosen = c.decks.filter(d => decks.includes(d.id));
  if (!chosen.some(d => !d.adult)) throw err('decks_required');
  const hasAdult = chosen.some(d => d.adult);
  if (hasAdult && adultConfirmed !== true) throw err('adult_confirm_required');

  const token = newToken();
  const room = await prisma.room.create({
    data: {
      expiresAt: expiry(),
      decks: chosen.map(d => d.id),
      adultPending: hasAdult,
      players: { create: { seat: 1, name: playerName, tokenHash: hashToken(token) } }
    }
  });
  return { roomId: room.id, token, seat: 1 };
}

async function publicInfo(roomId) {
  const room = await prisma.room.findUnique({
    where: { id: String(roomId) },
    include: { players: { select: { seat: true, name: true } } }
  });
  if (!room || room.status === 'archived') throw notFound();
  return {
    id: room.id,
    hostName: room.players.find(p => p.seat === 1)?.name || null,
    decks: room.decks,
    adultPending: room.adultPending,
    full: room.players.length >= 2
  };
}

// Removing a deck after the creator may already have answered it
// (the partner declined the 18+ deck).
async function dropDeck(tx, roomId, deckId) {
  await tx.answer.deleteMany({ where: { roomId, qkey: { startsWith: `${deckId}:` } } });
  await tx.voice.deleteMany({
    where: { roomId, OR: [{ cardKey: { startsWith: `s:${deckId}:` } }, { cardKey: { startsWith: `g:${deckId}:` } }] }
  });
  const removed = await tx.asked.deleteMany({ where: { roomId, deckId } });
  if (removed.count) {
    const left = await tx.asked.count({ where: { roomId, fromSeat: 1 } });
    if (left < config.askMin) await tx.player.updateMany({ where: { roomId, seat: 1 }, data: { stage2At: null } });
  }
}

async function joinRoom(roomId, { name, adult }) {
  const playerName = cleanName(name);
  const room = await prisma.room.findUnique({ where: { id: String(roomId) }, include: { players: true } });
  if (!room || room.status === 'archived') throw notFound();
  if (room.players.length >= 2) throw err('room_full', 409);

  const token = newToken();
  const adultIds = adultDeckIds();
  const dropAdult = room.adultPending && adult !== true;
  const decks = dropAdult ? room.decks.filter(d => !adultIds.includes(d)) : room.decks;
  try {
    await prisma.$transaction(async tx => {
      await tx.player.create({ data: { roomId: room.id, seat: 2, name: playerName, tokenHash: hashToken(token) } });
      await tx.room.update({ where: { id: room.id }, data: { decks, adultPending: false, expiresAt: expiry() } });
      if (dropAdult) for (const d of room.decks.filter(x => adultIds.includes(x))) await dropDeck(tx, room.id, d);
    });
  } catch (e) {
    if (e.code === 'P2002') throw err('room_full', 409);
    throw e;
  }
  events.changed(room.id);
  return { roomId: room.id, token, seat: 2 };
}

// ---------- state ----------

function playerView(p) {
  return {
    seat: p.seat,
    name: p.name,
    stage1Done: !!p.stage1At,
    stage2Done: !!p.stage2At,
    stage3Done: !!p.stage3At,
    guessStarted: !!p.guessStartedAt,
    retakeDone: !!p.retakeAt,
    retakeGuessDone: !!p.retakeGuessAt
  };
}

function stage3Available(me, partner) {
  return !!(me.stage1At && me.stage2At && partner?.stage1At && partner?.stage2At);
}

function askedView(roomId, a) {
  return {
    id: a.id,
    fromSeat: a.fromSeat,
    deckId: a.deckId,
    poolId: a.poolId,
    custom: a.custom ? decryptJson(roomId, a.custom) : null,
    lock: a.lock,
    position: a.position
  };
}

async function getState(player) {
  const room = player.room;
  const partner = partnerOf(player);
  const out = {
    room: {
      id: room.id,
      status: room.status,
      decks: room.decks,
      adultPending: room.adultPending,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt
    },
    me: playerView(player),
    partner: partner ? { ...playerView(partner), online: presence.isOnline(room.id, partner.seat) } : null
  };

  const rows = await prisma.answer.findMany({ where: { playerId: player.id } });
  const answers = { self: {}, guess: {}, reply: {}, retake: {}, retake_guess: {} };
  for (const r of rows) answers[r.kind][r.qkey] = decryptJson(room.id, r.data);
  out.answers = answers;

  if (room.status === 'archived') {
    out.capsule = await capsuleView(player);
    return out;
  }

  const asked = await prisma.asked.findMany({ where: { roomId: room.id }, orderBy: { position: 'asc' } });
  out.asked = asked.filter(a => a.fromSeat === player.seat).map(a => askedView(room.id, a));
  out.stage3Available = stage3Available(player, partner);
  // The partner's picks stay hidden until stage 3.
  out.askedToMe = out.stage3Available || room.status === 'reveal'
    ? asked.filter(a => a.fromSeat !== player.seat).map(a => askedView(room.id, a))
    : [];
  out.frozen = !!partner?.guessStartedAt;

  if (room.status === 'reveal') {
    out.board = await boardView(room);
    out.capsule = await capsuleView(player);
    out.consents = {
      share: room.shareConsent,
      export: room.exportConsent,
      adultExport: room.adultExportConsent
    };
  }
  return out;
}

// ---------- stage 1 & 3 answers ----------

function findQuestion(deckIds, qkey) {
  const hit = content().questionByKey.get(String(qkey));
  if (!hit || !deckIds.includes(hit.deck.id)) throw err('bad_value');
  return hit;
}

async function ensureOwnVoice(player, value) {
  if (!value?.voiceId) return;
  const v = await prisma.voice.findFirst({ where: { id: String(value.voiceId), playerId: player.id } });
  if (!v) throw err('bad_value');
}

async function getCapsule(roomId) {
  return prisma.capsule.findUnique({ where: { roomId } });
}

function capsuleIsOpen(cap) {
  return !!(cap?.sealedAt && cap.openAt && cap.openAt <= new Date());
}

async function saveAnswer(player, body = {}) {
  const { kind, qkey, pass, value, label } = body;
  const room = player.room;
  const partner = partnerOf(player);
  const c = content();
  let rec;

  if (kind === 'self' || kind === 'retake') {
    let deckIds = room.decks;
    if (kind === 'self') {
      requireStatus(player, 'playing');
      if (partner?.guessStartedAt) throw err('frozen', 409);
    } else {
      const cap = await getCapsule(room.id);
      if (!capsuleIsOpen(cap) || !cap.retakeDeck || player.retakeAt) throw err('wrong_stage', 409);
      deckIds = [cap.retakeDeck];
    }
    const { deck, q } = findQuestion(deckIds, qkey);
    if (pass === true) {
      rec = { v: null, pass: true };
    } else {
      rec = { v: V.normalizeSelf(q, deck, value, { wishlistIds: c.wishlist.map(w => w.id) }), pass: false };
      if (deck.labels) rec.label = V.normalizeLabel(label);
      await ensureOwnVoice(player, rec.v);
    }
  } else if (kind === 'guess' || kind === 'retake_guess') {
    let deckIds = room.decks;
    if (kind === 'guess') {
      requireStatus(player, 'playing');
      if (!stage3Available(player, partner) || player.stage3At) throw err('wrong_stage', 409);
    } else {
      const cap = await getCapsule(room.id);
      if (!capsuleIsOpen(cap) || !cap.retakeDeck) throw err('wrong_stage', 409);
      if (!player.retakeAt || !partner?.retakeAt || player.retakeGuessAt) throw err('wrong_stage', 409);
      deckIds = [cap.retakeDeck];
    }
    const { deck, q } = findQuestion(deckIds, qkey);
    if (!q.predictable) throw err('bad_value');
    rec = pass === true ? { v: null, pass: true } : { v: V.normalizeGuess(q, deck, value), pass: false };
  } else if (kind === 'reply') {
    requireStatus(player, 'playing');
    if (!stage3Available(player, partner) || player.stage3At) throw err('wrong_stage', 409);
    const asked = await prisma.asked.findFirst({ where: { id: String(qkey), roomId: room.id, fromSeat: partner.seat } });
    if (!asked) throw err('bad_value');
    rec = pass === true ? { v: null, pass: true } : { v: V.normalizeReply(value), pass: false };
    await ensureOwnVoice(player, rec.v);
  } else {
    throw err('bad_value');
  }

  const where = { playerId_kind_qkey: { playerId: player.id, kind, qkey: String(qkey) } };
  const old = await prisma.answer.findUnique({ where });
  const data = encryptJson(room.id, rec);
  await prisma.answer.upsert({
    where,
    update: { data },
    create: { roomId: room.id, playerId: player.id, kind, qkey: String(qkey), data }
  });

  // A replaced voice note is gone for good.
  const oldVoice = old ? decryptJson(room.id, old.data)?.v?.voiceId : null;
  if (oldVoice && oldVoice !== rec.v?.voiceId) await prisma.voice.deleteMany({ where: { id: oldVoice, playerId: player.id } });

  if (kind === 'guess' && !player.guessStartedAt) {
    // From now on the partner's stage-1 answers are frozen.
    await prisma.player.update({ where: { id: player.id }, data: { guessStartedAt: new Date() } });
    events.changed(room.id);
  }
  await touch(room.id);
  return { ok: true };
}

async function answerKeys(player, kind) {
  const rows = await prisma.answer.findMany({ where: { playerId: player.id, kind }, select: { qkey: true } });
  return new Set(rows.map(r => r.qkey));
}

function stage1Keys(deckIds) {
  return content().decks
    .filter(d => deckIds.includes(d.id))
    .flatMap(d => d.stage1.map(q => B.qkey(d.id, q.id)));
}

function predictableKeys(deckIds) {
  return content().decks
    .filter(d => deckIds.includes(d.id))
    .flatMap(d => d.stage1.filter(q => q.predictable).map(q => B.qkey(d.id, q.id)));
}

async function completeStage(player, stage) {
  const room = player.room;
  const partner = partnerOf(player);
  const missing = (need, have) => need.filter(k => !have.has(k));

  if (stage === '1') {
    requireStatus(player, 'playing');
    const gaps = missing(stage1Keys(room.decks), await answerKeys(player, 'self'));
    if (gaps.length) throw Object.assign(err('incomplete', 409), { details: gaps });
    if (!player.stage1At) await prisma.player.update({ where: { id: player.id }, data: { stage1At: new Date() } });
  } else if (stage === '3') {
    requireStatus(player, 'playing');
    if (!stage3Available(player, partner) || player.stage3At) throw err('wrong_stage', 409);
    const toMe = await prisma.asked.findMany({ where: { roomId: room.id, fromSeat: partner.seat }, select: { id: true } });
    const gaps = [
      ...missing(toMe.map(a => a.id), await answerKeys(player, 'reply')),
      ...missing(predictableKeys(room.decks), await answerKeys(player, 'guess'))
    ];
    if (gaps.length) throw Object.assign(err('incomplete', 409), { details: gaps });
    await prisma.player.update({ where: { id: player.id }, data: { stage3At: new Date() } });
    const fresh = await prisma.player.findUnique({ where: { id: partner.id } });
    if (fresh.stage3At) await startReveal(room.id);
  } else if (stage === 'retake' || stage === 'retake_guess') {
    const cap = await getCapsule(room.id);
    if (!capsuleIsOpen(cap) || !cap.retakeDeck) throw err('wrong_stage', 409);
    if (stage === 'retake') {
      if (player.retakeAt) throw err('wrong_stage', 409);
      const gaps = missing(stage1Keys([cap.retakeDeck]), await answerKeys(player, 'retake'));
      if (gaps.length) throw Object.assign(err('incomplete', 409), { details: gaps });
      const data = { retakeAt: new Date() };
      // Nothing to guess in this deck: skip straight past the guess step.
      if (!predictableKeys([cap.retakeDeck]).length) data.retakeGuessAt = data.retakeAt;
      await prisma.player.update({ where: { id: player.id }, data });
    } else {
      if (!player.retakeAt || !partner?.retakeAt || player.retakeGuessAt) throw err('wrong_stage', 409);
      const gaps = missing(predictableKeys([cap.retakeDeck]), await answerKeys(player, 'retake_guess'));
      if (gaps.length) throw Object.assign(err('incomplete', 409), { details: gaps });
      await prisma.player.update({ where: { id: player.id }, data: { retakeGuessAt: new Date() } });
    }
  } else {
    throw err('bad_value');
  }
  await touch(room.id);
  events.changed(room.id);
  return { ok: true };
}

// ---------- stage 2 ----------

async function submitAsked(player, items) {
  const room = player.room;
  requireStatus(player, 'playing');
  if (!player.stage1At || player.stage2At) throw err('wrong_stage', 409);
  if (!Array.isArray(items) || items.length < config.askMin || items.length > config.askMax) throw err('ask_count');

  const c = content();
  const adultActive = room.decks.some(d => c.deckById.get(d)?.adult);
  const seen = new Set();
  const rows = items.map((it, position) => {
    const base = { roomId: room.id, fromSeat: player.seat, position };
    if (it && it.custom != null) {
      const text = V.cleanText(it.custom, 300, { required: true });
      return { ...base, custom: encryptJson(room.id, text), lock: adultActive && it.lock === true };
    }
    const key = `${it?.deckId}:${it?.poolId}`;
    const hit = c.poolByKey.get(key);
    if (!hit || !room.decks.includes(it.deckId) || seen.has(key)) throw err('bad_value');
    seen.add(key);
    return { ...base, deckId: it.deckId, poolId: it.poolId, lock: !!hit.p.lock };
  });

  await prisma.$transaction(async tx => {
    await tx.asked.deleteMany({ where: { roomId: room.id, fromSeat: player.seat } });
    await tx.asked.createMany({ data: rows });
    await tx.player.update({ where: { id: player.id }, data: { stage2At: new Date() } });
  });
  await touch(room.id);
  events.changed(room.id);
  return { ok: true };
}

// ---------- reveal ----------

// Decrypted answers for the whole room, shaped for game/board.js.
async function loadCtx(room, { selfKind = 'self', guessKind = 'guess', decks } = {}) {
  const seatOf = new Map(room.players.map(p => [p.id, p.seat]));
  const ctx = {
    content: content(),
    decks: decks || room.decks,
    self: { 1: new Map(), 2: new Map() },
    guess: { 1: new Map(), 2: new Map() },
    reply: { 1: new Map(), 2: new Map() },
    asked: []
  };
  const rows = await prisma.answer.findMany({
    where: { roomId: room.id, kind: { in: [selfKind, guessKind, 'reply'] } }
  });
  for (const r of rows) {
    const seat = seatOf.get(r.playerId);
    if (!seat) continue;
    const bucket = r.kind === selfKind ? ctx.self : r.kind === guessKind ? ctx.guess : ctx.reply;
    bucket[seat].set(r.qkey, decryptJson(room.id, r.data));
  }
  const asked = await prisma.asked.findMany({ where: { roomId: room.id } });
  ctx.asked = asked.map(a => askedView(room.id, a));
  return ctx;
}

async function startReveal(roomId) {
  const room = await prisma.room.findUnique({ where: { id: roomId }, include: { players: true } });
  if (room.status !== 'playing') return;
  const ctx = await loadCtx(room);
  const cards = B.buildBoard(ctx);
  await prisma.$transaction(async tx => {
    const res = await tx.room.updateMany({
      where: { id: roomId, status: 'playing' },
      data: {
        status: 'reveal',
        revealAt: new Date(),
        board: encryptJson(roomId, cards),
        turnSeat: Math.random() < 0.5 ? 1 : 2,
        expiresAt: expiry()
      }
    });
    if (!res.count) return; // the other player's request got here first
    await tx.cardState.createMany({ data: cards.map((c, position) => ({ roomId, key: c.key, position })) });
  });
}

async function loadBoard(room) {
  const cards = decryptJson(room.id, room.board);
  const states = await prisma.cardState.findMany({ where: { roomId: room.id } });
  return { cards, states: new Map(states.map(s => [s.key, s])) };
}

function unlocked(card, state) {
  return !card.lock || state.lockSeats.length >= 2;
}

async function boardView(room) {
  const { cards, states } = await loadBoard(room);
  const opened = new Set([...states.values()].filter(s => s.openedAt).map(s => s.key));
  return {
    turnSeat: room.turnSeat,
    allOpened: opened.size === cards.length,
    cards: cards.map(c => {
      const s = states.get(c.key);
      return {
        key: c.key,
        deck: c.deck,
        kind: c.kind,
        qids: c.qids,
        group: c.group,
        askedId: c.askedId,
        phase: c.phase,
        lock: c.lock,
        last: c.last,
        opened: !!s.openedAt,
        openedBy: s.openedBy,
        openable: B.isOpenable(cards, opened, c),
        lockSeats: s.lockSeats,
        status: s.status,
        hasRule: !!s.rule,
        terrain: s.openedAt ? c.terrain || null : null
      };
    })
  };
}

async function revealCard(player, key) {
  requireStatus(player, 'reveal');
  const { cards, states } = await loadBoard(player.room);
  const card = cards.find(c => c.key === key);
  if (!card) throw notFound();
  return { cards, states, card, state: states.get(key) };
}

async function openCard(player, key) {
  const room = player.room;
  const { cards, states, card } = await revealCard(player, key);
  if (room.turnSeat !== player.seat) throw err('not_your_turn', 409);
  const opened = new Set([...states.values()].filter(s => s.openedAt).map(s => s.key));
  if (!B.isOpenable(cards, opened, card)) throw err('not_openable', 409);

  await prisma.$transaction(async tx => {
    const turn = await tx.room.updateMany({
      where: { id: room.id, status: 'reveal', turnSeat: player.seat },
      data: { turnSeat: other(player.seat), expiresAt: expiry() }
    });
    if (!turn.count) throw err('not_your_turn', 409);
    const open = await tx.cardState.updateMany({
      where: { roomId: room.id, key, openedAt: null },
      data: { openedAt: new Date(), openedBy: player.seat }
    });
    if (!open.count) throw err('not_openable', 409);
  });
  events.changed(room.id, 'board', { card: key });
  return { ok: true };
}

// Double lock: each player presses "show"; content appears once both did.
async function pressShow(player, key) {
  const { card, state } = await revealCard(player, key);
  if (!state.openedAt || !card.lock) throw err('wrong_stage', 409);
  await prisma.$executeRaw`
    UPDATE "sd_cards" SET "lockSeats" = array_append("lockSeats", ${player.seat}), "updatedAt" = NOW()
    WHERE "roomId" = ${player.room.id} AND "key" = ${key} AND NOT (${player.seat} = ANY("lockSeats"))`;
  events.changed(player.room.id, 'board', { card: key });
  return { ok: true };
}

async function setCardStatus(player, key, { status, rule } = {}) {
  const { card, state } = await revealCard(player, key);
  if (!state.openedAt || !unlocked(card, state)) throw err('wrong_stage', 409);
  if (status != null && !CARD_STATUSES.includes(status)) throw err('bad_value');
  const data = { status: status || null, rule: null };
  if (status === 'rule') data.rule = encryptJson(player.room.id, V.cleanText(rule, 300, { required: true }));
  await prisma.cardState.update({ where: { id: state.id }, data });
  events.changed(player.room.id, 'card', { card: key });
  return { ok: true };
}

async function getCard(player, key) {
  const room = player.room;
  const { card, state } = await revealCard(player, key);
  if (!state.openedAt) throw err('not_opened', 409);
  const base = {
    key,
    deck: card.deck,
    kind: card.kind,
    qids: card.qids,
    group: card.group,
    askedId: card.askedId,
    lock: card.lock,
    lockSeats: state.lockSeats,
    openedBy: state.openedBy
  };
  if (!unlocked(card, state)) return { ...base, locked: true };

  const ctx = await loadCtx(room);
  const messages = await prisma.message.findMany({ where: { roomId: room.id, cardKey: key }, orderBy: { createdAt: 'asc' } });
  return {
    ...base,
    locked: false,
    terrain: card.terrain || null,
    status: state.status,
    rule: state.rule ? decryptJson(room.id, state.rule) : null,
    ...B.cardView(ctx, card),
    messages: messages.map(m => ({
      id: m.id,
      seat: m.seat,
      text: m.body ? decryptJson(room.id, m.body) : '',
      voiceId: m.voiceId,
      at: m.createdAt
    }))
  };
}

async function addMessage(player, key, { text, voiceId } = {}) {
  const room = player.room;
  const { card, state } = await revealCard(player, key);
  if (!state.openedAt || !unlocked(card, state)) throw err('wrong_stage', 409);
  const body = V.cleanText(text, 2000);
  let voice = null;
  if (voiceId != null) {
    voice = await prisma.voice.findFirst({ where: { id: String(voiceId), playerId: player.id, cardKey: key } });
    if (!voice) throw err('bad_value');
  }
  if (!body && !voice) throw err('bad_value');
  await prisma.message.create({
    data: { roomId: room.id, cardKey: key, seat: player.seat, body: body ? encryptJson(room.id, body) : null, voiceId: voice?.id || null }
  });
  await touch(room.id);
  events.changed(room.id, 'thread', { card: key });
  return { ok: true };
}

// ---------- voice ----------

async function voiceCardKey(player, ctx = {}) {
  const room = player.room;
  if (ctx.kind === 'self') {
    requireStatus(player, 'playing');
    const { deck, q } = findQuestion(room.decks, ctx.qkey);
    if (!q.voice) throw err('bad_value');
    return B.cardKeyForQuestion(deck, q.id);
  }
  if (ctx.kind === 'reply') {
    requireStatus(player, 'playing');
    const partner = partnerOf(player);
    const asked = partner && await prisma.asked.findFirst({ where: { id: String(ctx.askedId), roomId: room.id, fromSeat: partner.seat } });
    if (!asked) throw err('bad_value');
    return `a:${asked.id}`;
  }
  if (ctx.kind === 'thread') {
    const { card, state } = await revealCard(player, String(ctx.cardKey));
    if (!state.openedAt || !unlocked(card, state)) throw err('wrong_stage', 409);
    return card.key;
  }
  throw err('bad_value');
}

async function uploadVoice(player, { buffer, mime, durationMs, context }) {
  if (typeof mime !== 'string' || mime.length > 100 || !VOICE_MIME.test(mime)) throw err('bad_value');
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw err('bad_value');
  if (buffer.length > config.voiceMaxBytes) throw err('too_large', 413);
  const ms = Math.max(0, Math.min(config.voiceMaxMs, parseInt(durationMs, 10) || 0));
  const cardKey = await voiceCardKey(player, context);
  const v = await prisma.voice.create({
    data: {
      roomId: player.room.id,
      playerId: player.id,
      cardKey,
      mime,
      durationMs: ms,
      data: encryptBuffer(player.room.id, buffer)
    }
  });
  return { voiceId: v.id, durationMs: ms };
}

async function getVoice(player, id) {
  const room = player.room;
  const v = await prisma.voice.findFirst({ where: { id: String(id), roomId: room.id } });
  if (!v) throw notFound();
  if (v.playerId !== player.id) {
    // The partner hears it only once its card is open (and unlocked).
    if (room.status !== 'reveal' || !v.cardKey) throw notFound();
    const { card, state } = await revealCard(player, v.cardKey).catch(() => ({}));
    if (!card || !state.openedAt || !unlocked(card, state)) throw notFound();
  }
  return { mime: v.mime, data: decryptBuffer(room.id, v.data) };
}

// ---------- summary, consents, export ----------

async function summary(player) {
  const room = player.room;
  requireStatus(player, 'reveal');
  const ctx = await loadCtx(room);
  const { cards, states } = await loadBoard(room);
  const s = B.summary(ctx, cards);
  const rules = [];
  const later = [];
  for (const c of cards) {
    const st = states.get(c.key);
    if (st.status === 'rule' && st.rule) rules.push({ key: c.key, deck: c.deck, rule: decryptJson(room.id, st.rule) });
    if (st.status === 'later') later.push({ key: c.key, deck: c.deck });
  }
  return {
    ...s,
    rules,
    later,
    names: Object.fromEntries(room.players.map(p => [p.seat, p.name])),
    decks: room.decks,
    cardsTotal: cards.length,
    cardsOpened: [...states.values()].filter(x => x.openedAt).length,
    consents: { share: room.shareConsent, export: room.exportConsent, adultExport: room.adultExportConsent }
  };
}

async function setConsent(player, { type, value } = {}) {
  requireStatus(player, 'reveal');
  const column = CONSENT_COLUMNS[type];
  if (!column) throw err('bad_value');
  const id = player.room.id;
  const seat = player.seat;
  // column comes from the whitelist above, never from the request
  if (value === true) {
    await prisma.$executeRawUnsafe(
      `UPDATE "sd_rooms" SET "${column}" = array_append("${column}", $1) WHERE id = $2 AND NOT ($1 = ANY("${column}"))`,
      seat, id
    );
  } else {
    await prisma.$executeRawUnsafe(`UPDATE "sd_rooms" SET "${column}" = array_remove("${column}", $1) WHERE id = $2`, seat, id);
  }
  events.changed(id, 'consent');
  return { ok: true };
}

const both = seats => seats.includes(1) && seats.includes(2);

async function exportData(player) {
  const room = player.room;
  requireStatus(player, 'reveal');
  if (!both(room.exportConsent)) throw err('consent_required', 403);
  const includeAdult = both(room.adultExportConsent);
  const adultIds = adultDeckIds();
  const ctx = await loadCtx(room);
  const { cards, states } = await loadBoard(room);
  const out = [];
  for (const card of cards) {
    const st = states.get(card.key);
    if (!st.openedAt || !unlocked(card, st)) continue;
    if (card.deck && adultIds.includes(card.deck) && !includeAdult) continue;
    out.push({
      key: card.key,
      deck: card.deck,
      kind: card.kind,
      qids: card.qids,
      group: card.group,
      askedId: card.askedId,
      terrain: card.terrain || null,
      status: st.status,
      rule: st.rule ? decryptJson(room.id, st.rule) : null,
      ...B.cardView(ctx, card)
    });
  }
  return {
    names: Object.fromEntries(room.players.map(p => [p.seat, p.name])),
    includeAdult,
    generatedAt: new Date(),
    cards: out
  };
}

// ---------- capsule ----------

function addTime(date, months) {
  const d = new Date(date);
  if (config.capsuleUnit === 'minutes') return new Date(d.getTime() + months * 60 * 1000);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function capsuleView(player) {
  const room = player.room;
  const cap = await getCapsule(room.id);
  const seat = player.seat;
  const prompts = content().capsule.prompts.map(p => p.id);
  if (!cap) return { prompts, sealed: false, open: false, mine: null, partnerWrote: false, months: { 1: null, 2: null } };
  const open = capsuleIsOpen(cap);
  const out = {
    prompts,
    sealed: !!cap.sealedAt,
    sealedAt: cap.sealedAt,
    openAt: cap.openAt,
    open,
    mine: cap[`entry${seat}`] ? decryptJson(room.id, cap[`entry${seat}`]) : null,
    partnerWrote: !!cap[`entry${other(seat)}`],
    months: { 1: cap.months1, 2: cap.months2 },
    retakeDeck: cap.retakeDeck
  };
  if (open) {
    out.entries = {
      1: cap.entry1 ? decryptJson(room.id, cap.entry1) : null,
      2: cap.entry2 ? decryptJson(room.id, cap.entry2) : null
    };
    out.decks = decryptJson(room.id, cap.snapshot).decks;
  }
  return out;
}

async function trySeal(roomId) {
  const cap = await getCapsule(roomId);
  if (!cap || cap.sealedAt || !cap.entry1 || !cap.entry2 || !cap.months1 || cap.months1 !== cap.months2) return;
  const room = await prisma.room.findUnique({ where: { id: roomId }, include: { players: true } });
  const ctx = await loadCtx(room);
  const toObj = m => Object.fromEntries(m.entries());
  const snapshot = {
    decks: room.decks,
    self: { 1: toObj(ctx.self[1]), 2: toObj(ctx.self[2]) },
    guess: { 1: toObj(ctx.guess[1]), 2: toObj(ctx.guess[2]) }
  };
  const now = new Date();
  await prisma.capsule.updateMany({
    where: { id: cap.id, sealedAt: null },
    data: { sealedAt: now, openAt: addTime(now, cap.months1), snapshot: encryptJson(roomId, snapshot) }
  });
}

async function writeCapsule(player, data) {
  const room = player.room;
  requireStatus(player, 'reveal');
  const cap = await getCapsule(room.id);
  if (cap?.sealedAt) throw err('sealed', 409);
  await prisma.capsule.upsert({ where: { roomId: room.id }, update: data, create: { roomId: room.id, ...data } });
  await trySeal(room.id);
  await touch(room.id);
  events.changed(room.id, 'capsule');
  return { ok: true };
}

async function saveCapsuleEntry(player, answers) {
  if (!answers || typeof answers !== 'object') throw err('bad_value');
  const clean = {};
  for (const p of content().capsule.prompts) clean[p.id] = V.cleanText(answers[p.id], 1000);
  if (!Object.values(clean).some(Boolean)) throw err('bad_value');
  return writeCapsule(player, { [`entry${player.seat}`]: encryptJson(player.room.id, clean) });
}

async function setCapsuleMonths(player, months) {
  if (!content().capsule.durations.includes(months)) throw err('bad_value');
  return writeCapsule(player, { [`months${player.seat}`]: months });
}

async function startRetake(player, deckId) {
  const room = player.room;
  const cap = await getCapsule(room.id);
  if (!capsuleIsOpen(cap)) throw err('wrong_stage', 409);
  const { decks } = decryptJson(room.id, cap.snapshot);
  if (!decks.includes(deckId)) throw err('bad_value');
  const res = await prisma.capsule.updateMany({ where: { id: cap.id, retakeDeck: null }, data: { retakeDeck: deckId } });
  if (!res.count) throw err('wrong_stage', 409);
  await touch(room.id);
  events.changed(room.id, 'capsule');
  return { ok: true };
}

async function retakeCompare(player) {
  const room = player.room;
  const cap = await getCapsule(room.id);
  if (!capsuleIsOpen(cap) || !cap.retakeDeck) throw err('wrong_stage', 409);
  if (!room.players.every(p => p.retakeAt && p.retakeGuessAt)) throw err('wrong_stage', 409);

  const deckId = cap.retakeDeck;
  const deck = content().deckById.get(deckId);
  const snap = decryptJson(room.id, cap.snapshot);
  const toMap = obj => new Map(Object.entries(obj || {}));
  const thenCtx = {
    content: content(),
    decks: [deckId],
    self: { 1: toMap(snap.self[1]), 2: toMap(snap.self[2]) },
    guess: { 1: toMap(snap.guess[1]), 2: toMap(snap.guess[2]) },
    reply: { 1: new Map(), 2: new Map() },
    asked: []
  };
  const nowCtx = await loadCtx(room, { selfKind: 'retake', guessKind: 'retake_guess', decks: [deckId] });

  const view = (ctx, seat, q) => {
    const rec = ctx.self[seat].get(B.qkey(deckId, q.id));
    if (!rec) return null;
    if (rec.pass) return { pass: true };
    return { value: rec.v, label: rec.label };
  };
  const questions = deck.stage1.map(q => {
    if (q.type === 'wishlist') {
      // Same privacy rule as the reveal: only the overlap, never the answers.
      const matches = ctx => {
        const a = ctx.self[1].get(B.qkey(deckId, q.id));
        const b = ctx.self[2].get(B.qkey(deckId, q.id));
        if (!a?.v || !b?.v) return null;
        return score.wishlistMatches(a.v.items, b.v.items, content().wishlist.map(w => w.id)).length;
      };
      return { qid: q.id, type: q.type, matchesThen: matches(thenCtx), matchesNow: matches(nowCtx) };
    }
    return {
      qid: q.id,
      type: q.type,
      then: { 1: view(thenCtx, 1, q), 2: view(thenCtx, 2, q) },
      now: { 1: view(nowCtx, 1, q), 2: view(nowCtx, 2, q) }
    };
  });
  const acc = ctx => B.summary(ctx, []).accuracy.find(a => a.deck === deckId) || null;
  return { deck: deckId, questions, accuracyThen: acc(thenCtx), accuracyNow: acc(nowCtx) };
}

// ---------- delete ----------

async function deleteRoom(player) {
  await prisma.room.delete({ where: { id: player.room.id } });
  events.changed(player.room.id, 'deleted');
  return { ok: true };
}

module.exports = {
  authenticate,
  createRoom,
  publicInfo,
  joinRoom,
  getState,
  saveAnswer,
  completeStage,
  submitAsked,
  openCard,
  pressShow,
  setCardStatus,
  getCard,
  addMessage,
  uploadVoice,
  getVoice,
  summary,
  setConsent,
  exportData,
  saveCapsuleEntry,
  setCapsuleMonths,
  startRetake,
  retakeCompare,
  deleteRoom,
  // exposed for purge.js and tests
  loadCtx,
  startReveal
};
