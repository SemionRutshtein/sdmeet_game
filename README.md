# SDMeet — Date Game

A real-time two-player intimacy game built for dates. Based on Altman & Taylor's social penetration theory — questions escalate from light icebreakers to deep vulnerability across 20 turns.

**Live demo:** [sdmeet-app-production.up.railway.app](https://sdmeet-app-production.up.railway.app)

---

## How it works

1. **Player 1** opens the app, enters their name → clicks **Create Game**
2. Shares the link with their date
3. **Player 2** opens the link, enters their name → game starts instantly
4. Active player gets a question → answers verbally → clicks **"Ответил(а)"**
5. Partner confirms with **"Засчитано"** → turn passes
6. Skip a question → get a **Task** (physical or creative challenge) instead
7. 20 turns total, three levels:
   - **L1 (turns 1–6):** Light / Funny
   - **L2 (turns 7–14):** Personal / Past
   - **L3 (turns 15–20):** Intimate / Here and now

**120 questions · 59 tasks** — seeded automatically on first deploy.

Both players see state changes instantly via WebSocket. Closing and reopening the tab resumes the exact game state via `localStorage` session restore.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 + Express + Socket.io |
| Database | PostgreSQL + Prisma ORM |
| Frontend | Vanilla JS + Tailwind CSS (CDN) |
| Realtime | Socket.io rooms (one per game) |
| Deploy | Railway (nixpacks) |

---

## Run locally

**Requirements:** Node.js 20+, PostgreSQL running locally.

```bash
# 1. Create the database
createdb sdmeet

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment
echo "DATABASE_URL=postgresql://$(whoami)@localhost:5432/sdmeet" > .env

# 4. Push schema + seed questions
npx prisma db push
node prisma/seed.js

# 5. Start
npm start
# → http://localhost:3000
```

Open two tabs to play both sides.

---

## Docker Compose

```bash
docker-compose up --build
# → http://localhost:3000
```

---

## Deploy on Railway

The repo is pre-configured for Railway via `nixpacks.toml`.

1. Push repo to GitHub
2. Railway → **New Project** → from GitHub repo
3. Add **PostgreSQL** plugin (Railway dashboard → Add Service → Database → PostgreSQL)
4. Set environment variables on the app service:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
PORT=3000
TOTAL_TURNS=20
```

5. Railway auto-deploys on every push to `main`

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | required | PostgreSQL connection string |
| `PORT` | `3000` | HTTP server port |
| `TOTAL_TURNS` | `20` | Total rounds per game session |

---

## Architecture

```
sdmeet_game/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Room, Player, Round, Question, Task
│   │   └── seed.js           # 120 questions + 59 tasks (idempotent upsert)
│   ├── src/
│   │   ├── index.js          # Express + Socket.io server
│   │   ├── routes/room.js    # POST /api/rooms, GET /api/rooms/:id
│   │   ├── services/
│   │   │   └── gameService.js  # All game logic (pure functions)
│   │   └── socket/
│   │       └── gameSocket.js   # Real-time event handlers
│   └── public/               # Frontend static files (served by Express)
│       ├── index.html        # Create / join / wait screens
│       └── game.html         # Game UI
├── nixpacks.toml             # Railway build config
├── docker-compose.yml        # Local Docker setup
└── .env.example
```

**Game state machine:** `WAITING_FOR_P2 → GAME_STARTED → [per-turn cycle] → FINISHED`

**Per-turn cycle:**
```
QUESTION_SHOWN → PLAYER_ANSWERED → APPROVED (next turn)
             ↘ TASK_SHOWN → TASK_DONE → APPROVED (next turn)
```

**Multi-room:** Each room is a UUID. Socket.io rooms isolate real-time events. Any number of concurrent games are supported.

**Reconnect:** On page reload, `localStorage` holds `{roomId, playerId, playerNum}`. The server checks room state via `/api/rooms/:id` and resumes the exact round. Finished rooms clear the session so a new game can start immediately.

---

## Question database

Questions are split across three intimacy levels and served in proportion:

| Level | Theme | Count | % of game |
|---|---|---|---|
| 1 | Light / Funny | 34 | First 30% of turns |
| 2 | Personal / Past | 34 | Middle 40% of turns |
| 3 | Intimate / Here & now | 52 | Final 30% of turns |

Level 3 includes a **lover mode** pack — bold physical tasks and direct desire questions.

---

## License

MIT
