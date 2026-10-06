// Room lifetime. Expired rooms are deleted with everything in them, except
// when a capsule is sealed: then only the room, players and capsule stay
// (status "archived") until the capsule has been open for ROOM_TTL_DAYS.
const prisma = require('./db');
const config = require('./config');
const events = require('./events');

const DAY_MS = 24 * 60 * 60 * 1000;

async function purgeExpired(now = new Date()) {
  const expired = await prisma.room.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, status: true, capsule: { select: { sealedAt: true, openAt: true } } }
  });
  let archived = 0;
  let deleted = 0;
  for (const room of expired) {
    const cap = room.capsule;
    if (cap?.sealedAt && room.status !== 'archived') {
      const keepUntil = new Date(Math.max(cap.openAt.getTime(), now.getTime()) + config.roomTtlDays * DAY_MS);
      await prisma.$transaction([
        prisma.answer.deleteMany({ where: { roomId: room.id, kind: { in: ['self', 'guess', 'reply'] } } }),
        prisma.asked.deleteMany({ where: { roomId: room.id } }),
        prisma.cardState.deleteMany({ where: { roomId: room.id } }),
        prisma.message.deleteMany({ where: { roomId: room.id } }),
        prisma.voice.deleteMany({ where: { roomId: room.id } }),
        prisma.room.update({
          where: { id: room.id },
          data: { status: 'archived', board: null, expiresAt: keepUntil, shareConsent: [], exportConsent: [], adultExportConsent: [] }
        })
      ]);
      archived++;
      events.changed(room.id, 'state');
    } else {
      await prisma.room.deleteMany({ where: { id: room.id } });
      deleted++;
      events.changed(room.id, 'deleted');
    }
  }
  if (archived || deleted) console.log(`[purge] archived ${archived}, deleted ${deleted}`);
  return { archived, deleted };
}

function schedulePurge() {
  const run = () => purgeExpired().catch(e => console.error('[purge] failed:', e.message));
  run();
  return setInterval(run, config.purgeEveryMs).unref();
}

module.exports = { purgeExpired, schedulePurge };
