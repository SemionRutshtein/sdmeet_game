# Two Maps — implementation notes

The design itself lives in [`GAME_DESIGN.ru.md`](GAME_DESIGN.ru.md) (Russian is the source language).
This file records the decisions the design leaves open and how the code maps to it.

## Where things live

| What | Where |
|---|---|
| Deck content (RU source + EN/HE) | `backend/content/decks/*.json` |
| Wishlist items for deck 4 | `backend/content/wishlist.json` |
| Content loader + schema checks | `backend/src/content.js` |
| Scoring: guesses, similarity, terrain, seek/withdraw | `backend/src/game/score.js` |
| Reveal board, card views, summary | `backend/src/game/board.js` |
| Room lifecycle, stages, reveal, capsule | `backend/src/services/roomService.js` |
| App-level encryption | `backend/src/crypto.js` |
| TTL purge | `backend/src/purge.js` |
| UI strings (EN default, RU, HE with RTL) | `backend/public/js/i18n.js` |

## Decisions not spelled out in the design

**Stage 2 count.** 5–7 questions *in total* across all selected decks (not per deck). Custom questions count toward the 7.

**When stage 3 unlocks.** You need to have finished stages 1 and 2, and your partner needs to have finished stages 1 and 2.
Requiring the partner's stage 1 to be done matters because of the freeze rule: once you start guessing, their stage 1 is locked,
so it must already be complete.

**Freeze.** Your stage-1 answers stay editable (even after you hit "done") until your partner saves their first guess.

**Rank questions.** "Top N of M" questions (deck 2 values) need exactly N. Full rankings (deck 1 Q2, deck 4 Q3) need at least the top 3; ranking the rest is optional, since nothing is scored past #1.

**What is guessed.** Only questions with `predictable: true`:

| Type | Guess | Hit when |
|---|---|---|
| choice | one option | same option |
| rank | the partner's #1 | same #1 |
| multi | a set | Jaccard ≥ 0.5 |
| scale 1–7 | a value | off by ≤ 1 |
| weather | the icon | same icon (the phrase is not guessed) |
| scene (deck 3) | feelings + action | scored as two checks: feelings (Jaccard ≥ 0.5) and action (same) |

Deck 2 and deck 4 have no predictable questions (the design doesn't mark them), so they have no accuracy score.

**Deck 2 terrain.** "Same" means: same option (choice), Jaccard ≥ 0.5 (multi), ≤ 1 apart (scale), ≤ 20 apart (slider), 4+ of top-5 overlap (rank).
Same → valley. Different and at least one "non-negotiable" → mountain. Any other difference → hill. If someone passed there is no terrain.

**Deck 3 seek/withdraw.** Weights sit on each option in `six-hours.json` (`w: [seek, withdraw]`). A scene is highlighted when one
person's net score is ≥ 2 toward seeking and the other's is ≥ 1 toward withdrawing. Neither the axes nor the numbers ever reach the client.

**Board order.** Cards go by deck. Deck 1 opens with the "climate" card (questions 2, 3, 4, 7, 9 merged). Deck 2 mountains and every
locked card (deck 4 Q6/Q7, all deck 4 pool questions, custom questions marked locked) wait until every other card is open.
Inside deck 4: scales/rank/multi/choice → wishlist → locked. Opening a card passes the turn. The first turn goes to a random player.

**Wishlist privacy.** The server never sends the partner's wishlist answers. The reveal card only gets the list of items where both
said yes/maybe.

**Room TTL.** Sliding: `ROOM_TTL_DAYS` (default 30) from the last write. On expiry, if a capsule is sealed, everything except the room,
players and capsule is deleted and the room becomes `archived` until `openAt + ROOM_TTL_DAYS`. Otherwise the room is deleted outright.
The capsule keeps an encrypted snapshot of both players' stage-1 answers so "then / now" works after the purge.

**Capsule duration.** Each player picks 3/6/12 months; the capsule seals only when both have written their 5 answers and picked the same
duration. For testing, `CAPSULE_UNIT=minutes` turns months into minutes.

**Encryption.** AES-256-GCM. Per-room keys are derived with HKDF from `DATA_KEY` (32 bytes, base64). Answers, guesses, replies,
custom questions, thread messages, rules, voice clips, board metadata and the capsule are encrypted. Names and progress timestamps are not.
In production the server refuses to start without `DATA_KEY`.

**Auth.** No accounts. Each player gets a random token at create/join; only its SHA-256 is stored. The browser keeps tokens in
`localStorage`. After sealing a capsule each player gets a personal link (token in the URL fragment, never sent to the server in logs)
to open it later from another device.

**Share image / PDF.** The image is drawn client-side on a canvas from `/api/summary` (no verbatim answers, never deck 4). Rules are
included only when both agreed. The PDF is the browser's print-to-PDF of `/api/export`, which the server only returns once both agreed;
deck 4 cards are included only with a second, separate consent from both.

**v1.** The old turn-based game and its tables (`Room`, `Player`, `Round`, `Question`, `Task`) are no longer used. 2.0 uses new tables
prefixed `sd_`, so deploying doesn't touch the old data. Drop the old tables by hand when you're sure you don't need them.
