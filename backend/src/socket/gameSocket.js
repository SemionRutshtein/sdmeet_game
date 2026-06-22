const { PrismaClient } = require('@prisma/client');
const game = require('../services/gameService');

const prisma = new PrismaClient();

function setupGameSocket(io) {
  io.on('connection', (socket) => {

    // Both P1 (waiting) and any player reconnecting to an active game use this
    socket.on('wait_in_room', async ({ roomId, playerId }) => {
      try {
        const room = await game.getRoomState(roomId);
        if (!room) return socket.emit('error', { message: 'Комната не найдена' });

        socket.join(roomId);
        socket.data = { roomId, playerId };

        if (room.state === 'FINISHED') {
          return socket.emit('game_finished', { players: room.players });
        }

        if (room.state === 'GAME_STARTED') {
          const content = await game.getRoundWithContent(roomId);
          return socket.emit('resync', { room, content });
        }

        // WAITING_FOR_P2
        socket.emit('waiting', { roomId });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // P2 joins via link (or reconnects as existing player)
    socket.on('join_room', async ({ roomId, playerName, playerId }) => {
      try {
        // Reconnect: player already exists in DB
        if (playerId) {
          const existing = await prisma.player.findUnique({
            where: { id: playerId },
            include: { room: { include: { players: true } } }
          });
          if (existing && existing.roomId === roomId) {
            socket.join(roomId);
            socket.data = { roomId, playerId };

            if (existing.room.state === 'FINISHED') {
              return socket.emit('game_finished', { players: existing.room.players });
            }

            const content = await game.getRoundWithContent(roomId);
            return socket.emit('rejoined', {
              playerId: existing.id,
              playerNum: existing.playerNum,
              playerName: existing.name,
              room: existing.room,
              content
            });
          }
        }

        // New P2 joining
        const { player, players } = await game.joinRoom(roomId, playerName);
        socket.join(roomId);
        socket.data = { roomId, playerId: player.id };

        socket.emit('joined', {
          playerId: player.id,
          playerNum: 2,
          playerName: player.name
        });

        // Notify P1 (still on index.html waiting screen)
        io.to(roomId).emit('partner_joined', { players });

        // Start first turn — both players will get this or resync on game.html load
        const turnData = await game.startTurn(roomId);
        io.to(roomId).emit('turn_started', turnData);

      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('player_answered', async ({ roomId }) => {
      try {
        await game.playerAnswered(roomId);
        io.to(roomId).emit('waiting_approval', { type: 'answer' });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('skip_question', async ({ roomId }) => {
      try {
        const { task } = await game.skipToTask(roomId);
        io.to(roomId).emit('task_shown', { task });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('task_done', async ({ roomId }) => {
      try {
        await game.taskDone(roomId);
        io.to(roomId).emit('waiting_approval', { type: 'task' });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('approve', async ({ roomId }) => {
      try {
        const turnData = await game.approve(roomId);
        if (turnData.finished) {
          io.to(roomId).emit('game_finished', { players: turnData.players });
        } else {
          io.to(roomId).emit('turn_started', turnData);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });
  });
}

module.exports = { setupGameSocket };
