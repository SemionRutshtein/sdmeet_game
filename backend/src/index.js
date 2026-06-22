try { require('dotenv').config(); } catch (_) {}
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { setupGameSocket } = require('./socket/gameSocket');
const roomRouter = require('./routes/room');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 }
});

app.use(cors());
app.use(express.json());

// Serve frontend from /frontend relative to project root
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

app.use('/api', roomRouter);

// Fallback: all non-API routes serve index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

setupGameSocket(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`sdmeet game running on port ${PORT}`);
});
