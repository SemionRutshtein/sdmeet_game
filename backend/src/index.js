try { require('dotenv').config(); } catch (_) {}
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const config = require('./config');
const prisma = require('./db');
const { initKeys } = require('./crypto');
const { content } = require('./content');
const { setupSocket } = require('./socket');
const { schedulePurge } = require('./purge');
const apiRouter = require('./routes/api');

const PUBLIC_DIR = path.join(__dirname, '../public');

function createApp() {
  // Fail fast on broken content or a missing key instead of at the first request.
  content();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Frame-Options', 'DENY');
    res.set('Permissions-Policy', 'microphone=(self), camera=()');
    next();
  });
  app.use(express.json({ limit: '64kb' }));

  app.get('/healthz', (req, res) => res.json({ ok: true }));
  app.use('/api', apiRouter);
  app.use(express.static(PUBLIC_DIR, { index: 'index.html' }));
  // SPA: every other GET gets the shell
  app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 }
  });
  setupSocket(io);
  return { app, httpServer, io };
}

async function start() {
  const { httpServer } = createApp();
  const source = await initKeys(prisma);
  console.log(`[crypto] encryption key from ${source === 'env' ? 'DATA_KEY' : 'the database'}`);
  schedulePurge();
  httpServer.listen(config.port, () => {
    console.log(`sdmeet 2.0 running on port ${config.port}`);
  });
}

if (require.main === module) {
  start().catch(e => {
    console.error('Startup failed:', e);
    process.exit(1);
  });
}

module.exports = { createApp };
