const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Create room (Player 1)
router.post('/rooms', async (req, res) => {
  const { playerName } = req.body;
  if (!playerName?.trim()) {
    return res.status(400).json({ error: 'Имя обязательно' });
  }

  const room = await prisma.room.create({ data: {} });
  const player = await prisma.player.create({
    data: { name: playerName.trim(), roomId: room.id, playerNum: 1 }
  });

  res.json({ roomId: room.id, playerId: player.id, playerNum: 1, playerName: player.name });
});

// Get room info (for join page pre-check)
router.get('/rooms/:roomId', async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.roomId },
    include: { players: { select: { playerNum: true, name: true } } }
  });
  if (!room) return res.status(404).json({ error: 'Комната не найдена' });
  res.json({ id: room.id, state: room.state, playerCount: room.players.length });
});

module.exports = router;
