# SDMeet — Date Game

Real-time two-player intimacy game for dates. Based on social penetration theory (Altman & Taylor) — questions escalate from light icebreakers to deep vulnerability.

## How it works

1. Player 1 creates a room, shares the link
2. Player 2 joins → game starts immediately via WebSocket
3. Active player gets a question → answers verbally → clicks **"Ответил(а)"**
4. Partner confirms with **"Засчитано"** → turn passes
5. Skip question → get a **Task** instead
6. 20 turns total: L1 (light) → L2 (personal) → L3 (intimate)

**120 questions · 59 tasks** — seeded from `backend/prisma/seed.js`

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express + Socket.io |
| Database | PostgreSQL + Prisma ORM |
| Frontend | Vanilla JS + Tailwind CDN |
| Deploy | Railway / Docker Compose |

## Run locally

```bash
# 1. Postgres must be running
createdb sdmeet

# 2. Backend
cd backend
cp ../.env.example .env        # set DATABASE_URL
npm install
npx prisma db push
node prisma/seed.js
npm start                       # → http://localhost:3000
```

## Docker Compose

```bash
docker-compose up --build
# → http://localhost:3000
```

## Deploy on Railway

1. Push repo to GitHub
2. Railway → New Project → from repo
3. Add PostgreSQL plugin → copy `DATABASE_URL` to env vars
4. Set: `ROOT_DIRECTORY=backend`
5. Build command: `npm install && npx prisma generate`
6. Start command: `npx prisma db push && node prisma/seed.js && node src/index.js`

Or use `railway.toml` (included) for zero-config deploy.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `PORT` | `3000` | Server port |
| `TOTAL_TURNS` | `20` | Number of rounds per game |

## Reconnect

If a player closes the tab mid-game, `localStorage` stores `{roomId, playerId, playerNum}`. On reload they rejoin automatically at the exact state they left.
