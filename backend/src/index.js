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

// Serve frontend — works both locally (../../frontend) and in Railway (../public)
const frontendPath = path.join(__dirname, '../public');
app.use(express.static(frontendPath));

app.use('/api', roomRouter);

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
