// App-level encryption: AES-256-GCM with a per-room key derived (HKDF-SHA256)
// from DATA_KEY. Deleting a room's rows is the only way data goes away; the
// key derivation just keeps one room's ciphertext useless under another's key.
const crypto = require('crypto');

const IV_LEN = 12;
const TAG_LEN = 16;
const DEV_KEY = Buffer.alloc(32, 7); // only ever used outside production

let masterKey = null;
const roomKeys = new Map(); // small cache, bounded below

function loadMasterKey() {
  const raw = process.env.DATA_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('DATA_KEY must be 32 bytes, base64-encoded');
    return key;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATA_KEY is required in production (32 random bytes, base64). Generate: openssl rand -base64 32');
  }
  console.warn('[crypto] DATA_KEY not set: using an insecure development key');
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

module.exports = { encryptJson, decryptJson, encryptBuffer, decryptBuffer, newToken, hashToken };
