// Service -> socket bridge. The service says "room X changed"; the socket
// layer tells the clients in that room to refetch. No payloads go out here,
// so nothing personal can leak to the wrong seat.
const { EventEmitter } = require('events');

const bus = new EventEmitter();

function changed(roomId, scope = 'state', extra = {}) {
  bus.emit('changed', { roomId, scope, ...extra });
}

module.exports = { bus, changed };
