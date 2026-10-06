// Who has a socket open, per room and seat. In-memory: one process.
const rooms = new Map(); // roomId -> Map(seat -> connection count)

function join(roomId, seat) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  const seats = rooms.get(roomId);
  seats.set(seat, (seats.get(seat) || 0) + 1);
}

function leave(roomId, seat) {
  const seats = rooms.get(roomId);
  if (!seats) return;
  const n = (seats.get(seat) || 0) - 1;
  if (n > 0) seats.set(seat, n);
  else seats.delete(seat);
  if (!seats.size) rooms.delete(roomId);
}

function isOnline(roomId, seat) {
  return !!rooms.get(roomId)?.get(seat);
}

module.exports = { join, leave, isOnline };
