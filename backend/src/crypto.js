// App-level encryption: AES-256-GCM with a per-room key derived (HKDF-SHA256)
// from DATA_KEY. Deleting a room's rows is the only way data goes away; the
// key derivation just keeps one room's ciphertext useless under another's key.
const crypto = require('crypto');

const IV_LEN = 12;
const TAG_LEN = 16;
const DEV_KEY = Buffer.alloc(32, 7); // only ever used outside production

let masterKey = null;
const roomKeys = new Map(); // small cache, bounded below

function parseKey(raw, what) {
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error(`${what} must be 32 bytes, base64-encoded`);
  return key;
}

// Called once at startup. DATA_KEY from the environment wins. Without it the
// server generates a key on first start and keeps it in sd_settings, so a
// fresh deploy works with no manual step. Copy that value into DATA_KEY to
// keep the key out of the database (same key, nothing to re-encrypt).
async function initKeys(prisma) {
  if (process.env.DATA_KEY) {
    masterKey = parseKey(process.env.DATA_KEY, 'DATA_KEY');
    roomKeys.clear();
    return 'env';
  }
  const fresh = crypto.randomBytes(32).toString('base64');
  await prisma.$executeRaw`
    INSERT INTO "sd_settings" ("key", "value") VALUES ('data_key', ${fresh})
    ON CONFLICT ("key") DO NOTHING`;
  const rows = await prisma.$queryRaw`SELECT "value" FROM "sd_settings" WHERE "key" = 'data_key'`;
  masterKey = parseKey(rows[0].value, 'stored data_key');
  roomKeys.clear();
  console.warn('[crypto] DATA_KEY is not set: using the key stored in the database (sd_settings.data_key). ' +
    'For production, copy it into the DATA_KEY variable: SELECT value FROM sd_settings WHERE key = \'data_key\';');
  return 'db';
}

function loadMasterKey() {
  if (process.env.DATA_KEY) return parseKey(process.env.DATA_KEY, 'DATA_KEY');
  // Only unit tests that never call initKeys() get here.
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    throw new Error('Encryption key not initialised: call initKeys() before serving requests');
  }
  return DEV_KEY;
}

function roomKey(roomId) {
  if (!masterKey) masterKey = loadMasterKey();
  let key = roomKeys.get(roomId);
  if (!key) {
    key = Buffer.from(crypto.hkdfSync('sha256', masterKey, Buffer.from(roomId), Buffer.from('sdmeet-room-v1'), 32));
    if (roomKeys.size > 1000) roomKeys.clear();
    roomKeys.set(roomId, key);
  }
  return key;
}

function encryptBuffer(roomId, plain) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', roomKey(roomId), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decryptBuffer(roomId, blob) {
  const buf = Buffer.from(blob);
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', roomKey(roomId), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buf.subarray(IV_LEN + TAG_LEN)), decipher.final()]);
}

function encryptJson(roomId, value) {
  return 'v1:' + encryptBuffer(roomId, Buffer.from(JSON.stringify(value), 'utf8')).toString('base64');
}

function decryptJson(roomId, text) {
  if (text == null) return null;
  if (!text.startsWith('v1:')) throw new Error('Unknown ciphertext version');
  return JSON.parse(decryptBuffer(roomId, Buffer.from(text.slice(3), 'base64')).toString('utf8'));
}

function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = { initKeys, encryptJson, decryptJson, encryptBuffer, decryptBuffer, newToken, hashToken };
