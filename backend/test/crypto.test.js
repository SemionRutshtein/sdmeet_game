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
