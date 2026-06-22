const { PrismaClient } = require('@prisma/client');
const game = require('../services/gameService');

const prisma = new PrismaClient();

function setupGameSocket(io) {
  io.on('connection', (socket) => {

    // P1 reconnects to waiting room after creating
    socket.on('wait_in_room', async ({ roomId, playerId }) => {
      try {
        const room = await game.getRoomState(roomId);
        if (!room) return socket.emit('error', { message: 'Комната не найдена' });

        socket.join(roomId);
        socket.data = { roomId, playerId };

        if (room.state === 'GAME_STARTED') {
          // Game already started — resync
          const content = await game.getRoundWithContent(roomId);
          socket.emit('resync', { room, content });
        } else {
          socket.emit('waiting', { roomId });
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // P2 joins via link
    socket.on('join_room', async ({ roomId, playerName, playerId }) => {
      try {
        // Reconnect case: player already exists
        if (playerId) {
          const existing = await prisma.player.findUnique({
            where: { id: playerId },
            include: { room: { include: { players: true } } }
          });
          if (existing && existing.roomId === roomId) {
            socket.join(roomId);
            socket.data = { roomId, playerId };
            const content = await game.getRoundWithContent(roomId);
            socket.emit('rejoined', {
              playerId: existing.id,
              playerNum: existing.playerNum,
              playerName: existing.name,
              room: existing.room,
              content
            });
            return;
          }
        }

        const { player, players } = await game.joinRoom(roomId, playerName);
        socket.join(roomId);
        socket.data = { roomId, playerId: player.id };

        // Tell P2 their identity
        socket.emit('joined', {
          playerId: player.id,
          playerNum: 2,
          playerName: player.name
        });

        // Tell everyone game starts
        io.to(roomId).emit('partner_joined', { players });

        // Kick off turn 0
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
