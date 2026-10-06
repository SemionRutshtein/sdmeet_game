// prisma/migrate.js (raw SQL, used on Railway) must produce exactly what schema.prisma describes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');
const { prisma } = require('./helpers');
const { migrate } = require('../prisma/migrate');

test('migrate.js matches schema.prisma', async () => {
  await migrate(prisma);
  await migrate(prisma); // idempotent
  await prisma.$disconnect();
  const root = path.join(__dirname, '..');
  const out = execFileSync('npx', [
    'prisma', 'migrate', 'diff',
    '--from-url', process.env.DATABASE_URL,
    '--to-schema-datamodel', 'prisma/schema.prisma',
    '--exit-code'
  ], { cwd: root, encoding: 'utf8', env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' } });
  assert.match(out, /No difference detected/);
});
