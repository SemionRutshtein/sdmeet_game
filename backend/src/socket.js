// Realtime: clients authenticate with their player token, join their room,
// and get "changed" pings. They refetch over HTTP, which keeps all the
// per-seat filtering in one place (roomService).
const svc = require('./services/roomService');
const presence = require('./presence');
const { bus } = require('./events');

function setupSocket(io) {
  io.use(async (socket, next) => {
    try {
      const player = await svc.authenticate(socket.handshake.auth?.token);
      socket.data.roomId = player.room.id;
      socket.data.seat = player.seat;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', socket => {
    const { roomId, seat } = socket.data;
    socket.join(roomId);
    presence.join(roomId, seat);
    socket.to(roomId).emit('presence', { seat, online: true });

    socket.on('disconnect', () => {
      presence.leave(roomId, seat);
      if (!presence.isOnline(roomId, seat)) socket.to(roomId).emit('presence', { seat, online: false });
    });
  });

  bus.on('changed', ({ roomId, ...rest }) => {
    io.to(roomId).emit('changed', rest);
  });
}

module.exports = { setupSocket };
