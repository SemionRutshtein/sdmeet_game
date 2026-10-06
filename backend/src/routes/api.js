const express = require('express');
const svc = require('../services/roomService');
const config = require('../config');
const { content } = require('../content');
const { AppError } = require('../game/values');

const router = express.Router();

// async handler -> errors go to the error middleware
const h = fn => (req, res, next) => Promise.resolve(fn(req, res)).then(out => {
  if (out !== undefined && !res.headersSent) res.json(out);
}).catch(next);

// Tiny fixed-window limiter for the unauthenticated endpoints.
function limit(max, windowMs) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const n = (hits.get(req.ip) || 0) + 1;
    hits.set(req.ip, n);
    if (n > max) return res.status(429).json({ error: 'rate_limited' });
    next();
  };
}

async function auth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    req.player = await svc.authenticate(token);
    next();
  } catch (e) {
    next(e);
  }
}

// ---------- public ----------

// Seek/withdraw weights stay on the server: the axes are never shown.
let publicContent = null;
function contentForClient() {
  if (!publicContent) {
    const c = content();
    const decks = JSON.parse(JSON.stringify(c.decks, (k, v) => (k === 'w' ? undefined : v)));
    publicContent = { decks, wishlist: c.wishlist, capsule: c.capsule, askMin: config.askMin, askMax: config.askMax };
  }
  return publicContent;
}

router.get('/content', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(contentForClient());
});

router.post('/rooms', limit(30, 60 * 1000), h(req => svc.createRoom(req.body || {})));
router.get('/rooms/:id/public', h(req => svc.publicInfo(req.params.id)));
router.post('/rooms/:id/join', limit(30, 60 * 1000), h(req => svc.joinRoom(req.params.id, req.body || {})));

// ---------- authenticated ----------

router.get('/state', auth, h(req => svc.getState(req.player)));
router.delete('/room', auth, h(req => svc.deleteRoom(req.player)));

router.put('/answers', auth, h(req => svc.saveAnswer(req.player, req.body || {})));
router.post('/stages/:stage/complete', auth, h(req => svc.completeStage(req.player, req.params.stage)));
router.post('/asked', auth, h(req => svc.submitAsked(req.player, req.body?.items)));

router.get('/cards/:key', auth, h(req => svc.getCard(req.player, req.params.key)));
router.post('/cards/:key/open', auth, h(req => svc.openCard(req.player, req.params.key)));
router.post('/cards/:key/show', auth, h(req => svc.pressShow(req.player, req.params.key)));
router.post('/cards/:key/status', auth, h(req => svc.setCardStatus(req.player, req.params.key, req.body || {})));
router.post('/cards/:key/messages', auth, h(req => svc.addMessage(req.player, req.params.key, req.body || {})));

router.post(
  '/voice',
  auth,
  limit(120, 60 * 1000),
  express.raw({ type: 'audio/*', limit: config.voiceMaxBytes }),
  h(req => svc.uploadVoice(req.player, {
    buffer: req.body,
    mime: req.get('content-type'),
    durationMs: req.query.durationMs,
    context: { kind: req.query.kind, qkey: req.query.qkey, askedId: req.query.askedId, cardKey: req.query.cardKey }
  }))
);
router.get('/voice/:id', auth, h(async (req, res) => {
  const { mime, data } = await svc.getVoice(req.player, req.params.id);
  res.set('Content-Type', mime);
  res.set('Cache-Control', 'private, no-store');
  res.send(data);
}));

router.get('/summary', auth, h(req => svc.summary(req.player)));
router.post('/consents', auth, h(req => svc.setConsent(req.player, req.body || {})));
router.get('/export', auth, h(req => svc.exportData(req.player)));

router.put('/capsule/entry', auth, h(req => svc.saveCapsuleEntry(req.player, req.body?.answers)));
router.put('/capsule/months', auth, h(req => svc.setCapsuleMonths(req.player, req.body?.months)));
router.post('/capsule/retake', auth, h(req => svc.startRetake(req.player, req.body?.deckId)));
router.get('/capsule/compare', auth, h(req => svc.retakeCompare(req.player)));

router.use((req, res) => res.status(404).json({ error: 'not_found' }));

// eslint-disable-next-line no-unused-vars
router.use((e, req, res, next) => {
  if (e instanceof AppError) return res.status(e.status).json({ error: e.code, details: e.details });
  if (e.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
  if (e.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_value' });
  console.error(e);
  res.status(500).json({ error: 'server_error' });
});

module.exports = router;
