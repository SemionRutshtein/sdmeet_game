const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('../src/crypto');

test('round trip, and one room cannot read another', () => {
  const enc = crypto.encryptJson('room-a', { secret: 'hi' });
  assert.ok(enc.startsWith('v1:'));
  assert.ok(!enc.includes('hi'));
  assert.deepEqual(crypto.decryptJson('room-a', enc), { secret: 'hi' });
  assert.throws(() => crypto.decryptJson('room-b', enc));
  const buf = crypto.encryptBuffer('room-a', Buffer.from('audio'));
  assert.equal(crypto.decryptBuffer('room-a', buf).toString(), 'audio');
});

test('tampering is detected', () => {
  const enc = crypto.encryptJson('room-a', { a: 1 });
  const raw = Buffer.from(enc.slice(3), 'base64');
  raw[raw.length - 1] ^= 1;
  assert.throws(() => crypto.decryptJson('room-a', 'v1:' + raw.toString('base64')));
});

test('tokens are random and only hashes are compared', () => {
  const t = crypto.newToken();
  assert.ok(t.length >= 40);
  assert.notEqual(t, crypto.newToken());
  assert.equal(crypto.hashToken(t), crypto.hashToken(t));
  assert.notEqual(crypto.hashToken(t), t);
});

test('without DATA_KEY a key is generated once and kept in the database', async () => {
  const { prisma } = require('./helpers');
  const { migrate } = require('../prisma/migrate');
  const fresh = require('crypto');
  await migrate(prisma);
  await prisma.$executeRawUnsafe(`DELETE FROM "sd_settings" WHERE key = 'data_key'`);
  const saved = process.env.DATA_KEY;
  delete process.env.DATA_KEY;
  try {
    assert.equal(await crypto.initKeys(prisma), 'db');
    const enc = crypto.encryptJson(`room-${fresh.randomUUID()}`, { a: 1 });
    const [{ value }] = await prisma.$queryRawUnsafe(`SELECT value FROM "sd_settings" WHERE key = 'data_key'`);
    assert.equal(Buffer.from(value, 'base64').length, 32);
    assert.equal(await crypto.initKeys(prisma), 'db'); // second start reuses it
    const [{ value: again }] = await prisma.$queryRawUnsafe(`SELECT value FROM "sd_settings" WHERE key = 'data_key'`);
    assert.equal(again, value);
    assert.ok(enc.startsWith('v1:'));
    // DATA_KEY set to the stored value: same key, old data still readable
    process.env.DATA_KEY = value;
    const room = `room-${fresh.randomUUID()}`;
    await crypto.initKeys(prisma);
    const enc2 = crypto.encryptJson(room, { b: 2 });
    delete process.env.DATA_KEY;
    await crypto.initKeys(prisma);
    assert.deepEqual(crypto.decryptJson(room, enc2), { b: 2 });
  } finally {
    if (saved) process.env.DATA_KEY = saved;
    await prisma.$disconnect();
  }
});
