// Apply schema migrations via Prisma $executeRaw (bypasses schema-engine, uses query engine).
// Idempotent: safe to run on every startup. Mirrors prisma/schema.prisma;
// test/schema.test.js fails if the two drift apart.
try { require('dotenv').config(); } catch (_) {}
const { PrismaClient } = require('@prisma/client');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS "sd_rooms" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'playing',
    "decks" TEXT[],
    "adultPending" BOOLEAN NOT NULL DEFAULT false,
    "turnSeat" INTEGER NOT NULL DEFAULT 1,
    "board" TEXT,
    "revealAt" TIMESTAMP(3),
    "shareConsent" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "exportConsent" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "adultExportConsent" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    CONSTRAINT "sd_rooms_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "sd_players" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage1At" TIMESTAMP(3),
    "stage2At" TIMESTAMP(3),
    "stage3At" TIMESTAMP(3),
    "guessStartedAt" TIMESTAMP(3),
    "retakeAt" TIMESTAMP(3),
    "retakeGuessAt" TIMESTAMP(3),
    CONSTRAINT "sd_players_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "sd_answers" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "qkey" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sd_answers_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "sd_asked" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "fromSeat" INTEGER NOT NULL,
    "deckId" TEXT,
    "poolId" TEXT,
    "custom" TEXT,
    "lock" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    CONSTRAINT "sd_asked_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "sd_cards" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3),
    "openedBy" INTEGER,
    "lockSeats" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "status" TEXT,
    "rule" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sd_cards_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "sd_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "cardKey" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "body" TEXT,
    "voiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sd_messages_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "sd_voices" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "cardKey" TEXT,
    "mime" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sd_voices_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "sd_capsules" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entry1" TEXT,
    "entry2" TEXT,
    "months1" INTEGER,
    "months2" INTEGER,
    "sealedAt" TIMESTAMP(3),
    "openAt" TIMESTAMP(3),
    "snapshot" TEXT,
    "retakeDeck" TEXT,
    CONSTRAINT "sd_capsules_pkey" PRIMARY KEY ("id")
  )`
];

TABLES.push(`CREATE TABLE IF NOT EXISTS "sd_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "sd_settings_pkey" PRIMARY KEY ("key")
  )`);

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS "sd_rooms_expiresAt_idx" ON "sd_rooms"("expiresAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "sd_players_tokenHash_key" ON "sd_players"("tokenHash")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "sd_players_roomId_seat_key" ON "sd_players"("roomId", "seat")`,
  `CREATE INDEX IF NOT EXISTS "sd_answers_roomId_idx" ON "sd_answers"("roomId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "sd_answers_playerId_kind_qkey_key" ON "sd_answers"("playerId", "kind", "qkey")`,
  `CREATE INDEX IF NOT EXISTS "sd_asked_roomId_idx" ON "sd_asked"("roomId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "sd_cards_roomId_key_key" ON "sd_cards"("roomId", "key")`,
  `CREATE INDEX IF NOT EXISTS "sd_messages_roomId_cardKey_idx" ON "sd_messages"("roomId", "cardKey")`,
  `CREATE INDEX IF NOT EXISTS "sd_voices_roomId_idx" ON "sd_voices"("roomId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "sd_capsules_roomId_key" ON "sd_capsules"("roomId")`
];

const FOREIGN_KEYS = ['sd_players', 'sd_answers', 'sd_asked', 'sd_cards', 'sd_messages', 'sd_voices', 'sd_capsules'].map(t => `
  DO $$ BEGIN
    ALTER TABLE "${t}" ADD CONSTRAINT "${t}_roomId_fkey" FOREIGN KEY ("roomId")
      REFERENCES "sd_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

async function migrate(prisma) {
  for (const sql of [...TABLES, ...INDEXES, ...FOREIGN_KEYS]) {
    await prisma.$executeRawUnsafe(sql);
  }
}

module.exports = { migrate };

if (require.main === module) {
  const prisma = new PrismaClient();
  console.log('Applying migrations...');
  migrate(prisma)
    .then(() => console.log('Migrations applied successfully.'))
    .catch(err => { console.error('Migration failed:', err.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
