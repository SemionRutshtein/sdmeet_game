# Two Maps

An online game for two. Each of you draws a map of yourself and guesses your partner's. Then you open it together and see where you matched and where you missed. It's not a compatibility test, it's a reason to talk.

Built on Love Maps and meta-emotion (Gottman), the 36 questions (Aron, 1997), perpetual problems (Gottman, Wile) and Joel et al., PNAS 2020. There's deliberately no compatibility percentage, no "love language" types and no psychological labels on screen.

- **Design (source of truth, Russian):** [`docs/GAME_DESIGN.ru.md`](docs/GAME_DESIGN.ru.md)
- **Implementation notes and decisions:** [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md)
- **UI languages:** English (default), Russian, Hebrew (RTL). Switch at the top right.

---

## How a game goes

A room has two players and 1–4 decks (default: *No Gloss* + *69%*).

| Stage | Mode | What happens |
|---|---|---|
| 1. About me | async | Answer stage-1 questions of the chosen decks. Anything can be passed. |
| 2. Questions for your partner | async | Pick 5–7 questions from the decks' pools, or write your own. Hidden until stage 3. |
| 3. Answer and predict | async | Answer your partner's picks, and guess how they answered stage 1. Your first guess freezes their stage-1 answers. |
| 4. Reveal | together | A board of face-down cards. Take turns opening them. Each card has both answers, the guesses (hit/miss), a 1–2 line conclusion, a question to talk about, a thread with text and voice notes, and actions: discussed / come back later / make it our rule. |

After that comes **Our map** (accuracy, climate, relief, rules, share image, PDF export) and the **time capsule**, which opens in 3, 6 or 12 months and offers a retake for "then / now".

| Deck | Reveal | Notes |
|---|---|---|
| No Gloss | Weather Forecast | All predictable. A "climate" card per person. |
| 69% | Relief Map | Each answer gets a label: negotiable / important / non-negotiable. Valleys, hills, mountains. Mountains open last. |
| Six Hours of Silence | Storyboard | Situations, not attachment types. Hidden seek/withdraw weights highlight the "one reaches out, the other pulls back" pattern. |
| Closer (18+) | Matches | On only if both opt in. Double-locked questions. The wishlist only ever shows shared yes/maybe. |

## Privacy

- Answers, guesses, threads, rules, custom questions, the capsule and voice notes are encrypted with AES-256-GCM, using a per-room key derived from `DATA_KEY`.
- There are no accounts: each player has a random token kept in their browser. Only its hash is stored.
- Either player can delete the room and everything in it.
- Rooms expire `ROOM_TTL_DAYS` after the last activity. A sealed capsule outlives its room: the answers are deleted, the capsule stays until it has been open for the same period.
- The share image is drawn in the browser from aggregates only, never the 18+ deck. The PDF export needs both players to agree, and the 18+ deck needs a second, separate agreement from both.
- No statistics are shared across couples.

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20+, Express, Socket.io |
| Database | PostgreSQL + Prisma (schema applied by `prisma/migrate.js`) |
| Frontend | Vanilla JS ES modules, no build step |
| Realtime | Socket.io pings ("room changed"). Clients refetch their own filtered state over HTTP. |
| Deploy | Railway (nixpacks / Railpack) or Docker |

## Run locally

Requires Node.js 20+ (22+ to run the tests) and PostgreSQL.

```bash
createdb sdmeet
cd backend
npm install
cat > .env <<EOF
DATABASE_URL=postgresql://$(whoami)@localhost:5432/sdmeet
DATA_KEY=$(openssl rand -base64 32)
EOF
npm run migrate
npm start            # http://localhost:3000
```

Open two browser profiles (or one normal and one private window) to play both seats.

With Docker: `docker-compose up --build`.

## Tests

```bash
cd backend
createdb sdmeet_test   # TEST_DATABASE_URL overrides the default local URL
npm test               # unit + API flow against Postgres + schema drift + i18n completeness

# Browser end-to-end (two players, all decks, voice, lock, map, capsule, delete):
CAPSULE_UNIT=minutes DATA_KEY=... npm start &
BASE_URL=http://localhost:3000 npm run test:e2e
# E2E_WAIT_CAPSULE=1 also waits ~3 minutes for the capsule to open and runs the retake.
```

### Quick check with curl

`scripts/smoke.sh` plays a whole game through the API with curl + jq: create, join, all three stages, reveal (turns, locks), thread, rule, summary, export consent, capsule sealing, delete. It prints a ✓ per check and stops at the first failure.

```bash
./scripts/smoke.sh http://localhost:3000
./scripts/smoke.sh https://your-app.up.railway.app      # after deploy
DECKS='["no-gloss","perpetual"]' ./scripts/smoke.sh URL  # fewer decks
KEEP=1 ./scripts/smoke.sh URL                            # keep the room and print both tokens
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | required | PostgreSQL connection string |
| `DATA_KEY` | required in production | 32 random bytes, base64 (`openssl rand -base64 32`). **Don't change it on a live deployment**: existing data becomes unreadable. |
| `PORT` | `3000` | HTTP port |
| `ROOM_TTL_DAYS` | `30` | Days a room is kept after its last activity |
| `CAPSULE_UNIT` | months | `minutes` makes capsule durations minutes (testing only) |

## Deploy on Railway

1. Add the PostgreSQL plugin and set `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the app.
2. Set `DATA_KEY`. Without it the app refuses to start in production.
3. Push. The start command runs `prisma/migrate.js` (idempotent raw SQL, no schema engine) and then the server. The healthcheck is `/healthz`.

2.0 uses its own tables (`sd_*`), so the v1 tables (`Room`, `Player`, `Round`, `Question`, `Task`) stay untouched. Drop them by hand once you no longer need them.

## Editing content

Decks live in `backend/content/decks/*.json`, the 18+ wishlist in `backend/content/wishlist.json`, and the capsule prompts in `backend/content/capsule.json`. Every text has `ru` (source), `en` and `he`. The server refuses to start if a translation is missing or a question is malformed, and `npm test` checks the same. UI strings are in `backend/public/js/i18n.js`.

## Layout

```
backend/
  content/              decks, wishlist, capsule prompts (ru/en/he)
  prisma/               schema.prisma + migrate.js (raw SQL, kept in sync by a test)
  src/
    content.js          loads + validates content
    crypto.js           AES-GCM per-room encryption, tokens
    game/values.js      validation of every submitted value
    game/score.js       guesses, similarity, terrain, seek/withdraw, wishlist overlap
    game/board.js       reveal board, card views, summary
    services/roomService.js   rooms, stages, reveal, threads, voice, export, capsule
    routes/api.js       REST API
    socket.js           auth + presence + "changed" pings
    purge.js            room lifetime
  public/               SPA (index.html, css/, js/)
  test/                 node:test suites + e2e/browser.mjs (Playwright)
docs/                   design (ru) + implementation notes
```

## License

MIT
