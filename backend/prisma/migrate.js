// Apply schema migrations via Prisma $executeRaw (bypasses schema-engine, uses query engine).
// Idempotent: safe to run on every startup.
try { require('dotenv').config(); } catch (_) {}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying migrations...');

  // Ensure enum types exist
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "RoomState" AS ENUM ('WAITING_FOR_P2', 'GAME_STARTED', 'FINISHED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "RoundState" AS ENUM ('QUESTION_SHOWN', 'PLAYER_ANSWERED', 'TASK_SHOWN', 'TASK_DONE', 'APPROVED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);

  // Ensure tables exist
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Room" (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      state           "RoomState" NOT NULL DEFAULT 'WAITING_FOR_P2',
      "turnNum"       INTEGER NOT NULL DEFAULT 0,
      "activePlayerNum" INTEGER NOT NULL DEFAULT 1,
      "inviteMessage" TEXT
    )
  `);

  // Add inviteMessage to existing rooms table (idempotent)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "inviteMessage" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Player" (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name        TEXT NOT NULL,
      "roomId"    TEXT NOT NULL REFERENCES "Room"(id) ON DELETE CASCADE,
      "playerNum" INTEGER NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Round" (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "roomId"     TEXT NOT NULL REFERENCES "Room"(id) ON DELETE CASCADE,
      "playerId"   TEXT NOT NULL REFERENCES "Player"(id) ON DELETE CASCADE,
      "questionId" INTEGER,
      "taskId"     INTEGER,
      "usedTask"   BOOLEAN NOT NULL DEFAULT false,
      state        "RoundState" NOT NULL DEFAULT 'QUESTION_SHOWN',
      "turnNum"    INTEGER NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Question" (
      id    SERIAL PRIMARY KEY,
      level INTEGER NOT NULL,
      text  TEXT NOT NULL UNIQUE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Task" (
      id    SERIAL PRIMARY KEY,
      level INTEGER NOT NULL,
      text  TEXT NOT NULL UNIQUE
    )
  `);

  console.log('Migrations applied successfully.');
}

main()
  .catch(err => { console.error('Migration failed:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
