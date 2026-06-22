// Raw SQL migrations — bypasses Prisma schema-engine (avoids OpenSSL issues on Railway).
// Idempotent: safe to run on every startup.
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "RoomState" AS ENUM ('WAITING_FOR_P2', 'GAME_STARTED', 'FINISHED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "RoundState" AS ENUM ('QUESTION_SHOWN', 'PLAYER_ANSWERED', 'TASK_SHOWN', 'TASK_DONE', 'APPROVED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS "Room" (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        state      "RoomState" NOT NULL DEFAULT 'WAITING_FOR_P2',
        "turnNum"  INTEGER NOT NULL DEFAULT 0,
        "activePlayerNum" INTEGER NOT NULL DEFAULT 1,
        "inviteMessage" TEXT
      );

      ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "inviteMessage" TEXT;

      CREATE TABLE IF NOT EXISTS "Player" (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name       TEXT NOT NULL,
        "roomId"   TEXT NOT NULL REFERENCES "Room"(id) ON DELETE CASCADE,
        "playerNum" INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "Round" (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "roomId"    TEXT NOT NULL REFERENCES "Room"(id) ON DELETE CASCADE,
        "playerId"  TEXT NOT NULL REFERENCES "Player"(id) ON DELETE CASCADE,
        "questionId" INTEGER,
        "taskId"    INTEGER,
        "usedTask"  BOOLEAN NOT NULL DEFAULT false,
        state       "RoundState" NOT NULL DEFAULT 'QUESTION_SHOWN',
        "turnNum"   INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "Question" (
        id    SERIAL PRIMARY KEY,
        level INTEGER NOT NULL,
        text  TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS "Task" (
        id    SERIAL PRIMARY KEY,
        level INTEGER NOT NULL,
        text  TEXT NOT NULL UNIQUE
      );
    `);
    console.log('Migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error('Migration error:', err.message); process.exit(1); });
