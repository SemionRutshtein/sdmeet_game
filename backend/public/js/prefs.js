// Small per-device flags ("this player has read the briefing for this room").
// Lost storage only means a screen is shown again, never lost data.
const KEY = 'twomaps.seen';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

const memory = {};

export function seen(roomId, what) {
  const id = `${roomId}:${what}`;
  return !!(memory[id] || read()[id]);
}

export function markSeen(roomId, what) {
  const id = `${roomId}:${what}`;
  memory[id] = true;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: Date.now() }));
  } catch {
    // storage blocked: remembered for this tab only
  }
}
