#!/usr/bin/env bash
# SDMeet 2.0 smoke test with curl + jq: plays a whole game through the API
# (create -> join -> stage 1/2/3 -> reveal -> thread -> summary -> export ->
# capsule -> delete) and checks the important rules on the way.
#
#   ./scripts/smoke.sh                       # against http://localhost:3000
#   ./scripts/smoke.sh https://your-app.up.railway.app
#   DECKS='["no-gloss","perpetual","six-hours","closer"]' ./scripts/smoke.sh URL
#
# Needs: bash, curl, jq. Creates one room and deletes it at the end.
set -euo pipefail

BASE="${1:-http://localhost:3000}"
BASE="${BASE%/}"
DECKS="${DECKS:-[\"no-gloss\",\"perpetual\",\"six-hours\",\"closer\"]}"
command -v jq >/dev/null || { echo "jq is required"; exit 1; }

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$*"; exit 1; }
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# api METHOD PATH [TOKEN] [JSON]  -> prints body, sets $CODE
api() {
  local method=$1 path=$2 token=${3:-} body=${4:-}
  local args=(-sS -X "$method" -w '\n%{http_code}' "$BASE$path")
  [[ -n $token ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n $body ]] && args+=(-H 'Content-Type: application/json' -d "$body")
  local out
  out=$(curl "${args[@]}")
  CODE=${out##*$'\n'}
  RESP=${out%$'\n'*}
}
expect() { # expect CODE description
  [[ $CODE == "$1" ]] || fail "$2: expected HTTP $1, got $CODE: $RESP"
  ok "$2"
}

# ---------------------------------------------------------------------------
step "1. Health and content"
api GET /healthz; expect 200 "GET /healthz"
api GET /api/content; expect 200 "GET /api/content"
CONTENT=$RESP
echo "$CONTENT" | jq -e '.decks | length == 4' >/dev/null || fail "expected 4 decks"
echo "$CONTENT" | jq -e '[.. | objects | has("w")] | any | not' >/dev/null || fail "seek/withdraw weights leaked"
ok "4 decks, no hidden weights in the payload"
for l in en ru he; do
  echo "$CONTENT" | jq -e --arg l "$l" '[.decks[].stage1[].prompt[$l]] | all(. != null and . != "")' >/dev/null || fail "missing $l prompts"
done
ok "every stage-1 prompt has en / ru / he"

# ---------------------------------------------------------------------------
step "2. Create and join"
api POST /api/rooms "" '{"name":"","decks":["no-gloss"]}'; expect 400 "empty name is rejected"
api POST /api/rooms "" "{\"name\":\"Ana\",\"decks\":$DECKS,\"adultConfirmed\":true}"; expect 200 "Ana creates a room"
ROOM=$(echo "$RESP" | jq -r .roomId); TA=$(echo "$RESP" | jq -r .token)
api GET "/api/rooms/$ROOM/public"; expect 200 "public room info"
echo "  host: $(echo "$RESP" | jq -r .hostName), decks: $(echo "$RESP" | jq -c .decks)"
api POST "/api/rooms/$ROOM/join" "" '{"name":"Ben","adult":true}'; expect 200 "Ben joins (opts into 18+)"
TB=$(echo "$RESP" | jq -r .token)
api POST "/api/rooms/$ROOM/join" "" '{"name":"Eve"}'; expect 409 "a third player is refused"
api GET /api/state "bad-token"; expect 401 "bad token is refused"
api GET /api/state "$TA"; expect 200 "Ana's state"
ROOM_DECKS=$(echo "$RESP" | jq -c .room.decks)
echo "  room: $ROOM"
echo "  open in a browser: $BASE/join/$ROOM (already full, for a look only)"

# ---------------------------------------------------------------------------
# A valid answer / guess for any question type ($v = 0 or 1 makes the two players differ)
JQ_ANSWER='
def ids($o): $o | map(select((.custom // false) | not)) | map(.id);
def plain($o): $o | map(select(((.custom // false) or (.exclusive // false)) | not)) | map(.id);
. as $d | $q |
if .type == "choice" then {option: ids(.options)[$v]} + (if .followup then {followup: "some thoughts"} else {} end)
elif .type == "multi" then {options: [plain(.options)[$v]]}
elif .type == "rank" then {order: ((.options | map(.id)) | (if $v == 1 then reverse else . end) | .[0:($q.pick // ($q.options | length))])}
elif .type == "scale" then {value: (if $v == 1 then .max else .min end)}
elif .type == "slider" then {value: (10 + 80 * $v)}
elif .type == "text" then {text: "answer from player \($v)"}
elif .type == "weather" then {icon: .options[$v].id, phrase: "grey, then it passes"}
elif .type == "scene" then {feel: [$d.sceneFields.feel.options[$v].id], do: $d.sceneFields.do.options[$v].id, want: "a short call"}
elif .type == "wishlist" then {items: ($wish | map({key: .id, value: (if $v == 1 then "yes" else "maybe" end)}) | from_entries)}
else error("unknown type") end'
JQ_GUESS='
. as $d | $q |
if .type == "choice" or .type == "rank" then {option: .options[0].id}
elif .type == "multi" then {options: [.options[0].id]}
elif .type == "scale" then {value: 4}
elif .type == "weather" then {icon: .options[0].id}
elif .type == "scene" then {feel: [$d.sceneFields.feel.options[0].id], do: $d.sceneFields.do.options[0].id}
else error("not predictable") end'

answer_stage1() { # token variant
  local token=$1 v=$2 n=0
  while IFS=$'\t' read -r deck qid; do
    local d q value label=""
    d=$(echo "$CONTENT" | jq -c --arg d "$deck" '.decks[] | select(.id == $d)')
    q=$(echo "$d" | jq -c --arg q "$qid" '.stage1[] | select(.id == $q)')
    value=$(echo "$d" | jq -c --argjson q "$q" --argjson v "$v" --argjson wish "$(echo "$CONTENT" | jq -c .wishlist)" "$JQ_ANSWER")
    [[ $(echo "$d" | jq -r '.labels // false') == true ]] && label=$([[ $v == 1 ]] && echo fixed || echo negotiable)
    api PUT /api/answers "$token" "$(jq -nc --arg k "$deck:$qid" --argjson val "$value" --arg l "$label" \
      '{kind:"self", qkey:$k, value:$val} + (if $l != "" then {label:$l} else {} end)')"
    [[ $CODE == 200 ]] || fail "answer $deck:$qid -> $CODE $RESP"
    n=$((n + 1))
  done < <(echo "$CONTENT" | jq -r --argjson ids "$ROOM_DECKS" '.decks[] | select(.id as $i | $ids | index($i)) | .id as $d | .stage1[] | [$d, .id] | @tsv')
  ok "$n stage-1 answers saved"
}

guess_all() { # token
  local token=$1 n=0
  while IFS=$'\t' read -r deck qid; do
    local d q value
    d=$(echo "$CONTENT" | jq -c --arg d "$deck" '.decks[] | select(.id == $d)')
    q=$(echo "$d" | jq -c --arg q "$qid" '.stage1[] | select(.id == $q)')
    value=$(echo "$d" | jq -c --argjson q "$q" "$JQ_GUESS")
    api PUT /api/answers "$token" "$(jq -nc --arg k "$deck:$qid" --argjson val "$value" '{kind:"guess", qkey:$k, value:$val}')"
    [[ $CODE == 200 ]] || fail "guess $deck:$qid -> $CODE $RESP"
    n=$((n + 1))
  done < <(echo "$CONTENT" | jq -r --argjson ids "$ROOM_DECKS" '.decks[] | select(.id as $i | $ids | index($i)) | .id as $d | .stage1[] | select(.predictable) | [$d, .id] | @tsv')
  ok "$n guesses saved"
}

# ---------------------------------------------------------------------------
step "3. Stage 1: about me"
api POST /api/stages/1/complete "$TA"; expect 409 "can't finish stage 1 with nothing answered"
echo "  Ana:"; answer_stage1 "$TA" 0
echo "  Ben:"; answer_stage1 "$TB" 1
api PUT /api/answers "$TB" '{"kind":"self","qkey":"no-gloss:hardest-emotion","pass":true}'; expect 200 "Ben passes on one question"
api PUT /api/answers "$TA" '{"kind":"self","qkey":"no-gloss:ok-seen","value":{"value":9}}'; expect 400 "out-of-range scale is rejected"
api POST /api/stages/1/complete "$TA"; expect 200 "Ana finishes stage 1"
api POST /api/stages/1/complete "$TB"; expect 200 "Ben finishes stage 1"

# ---------------------------------------------------------------------------
step "4. Stage 2: questions for the partner"
POOL=$(echo "$CONTENT" | jq -c --argjson ids "$ROOM_DECKS" '[.decks[] | select(.id as $i | $ids | index($i)) | .id as $d | .pool[] | {deckId:$d, poolId:.id}] | .[0:5]')
api POST /api/asked "$TA" '{"items":[{"deckId":"no-gloss","poolId":"one-ask"}]}'; expect 400 "fewer than 5 questions is refused"
api POST /api/asked "$TA" "$(jq -nc --argjson p "$POOL" '{items: ($p + [{custom:"What do you hum when nobody listens?"}])}')"; expect 200 "Ana sends 6 questions (one custom)"
api GET /api/state "$TB"
[[ $(echo "$RESP" | jq '.askedToMe | length') == 0 ]] && ok "Ben can't see Ana's picks yet" || fail "picks leaked before stage 3"
api POST /api/asked "$TB" "$(jq -nc --argjson p "$POOL" '{items: $p}')"; expect 200 "Ben sends 5 questions"

# ---------------------------------------------------------------------------
step "5. Stage 3: answer and predict"
echo "  Ana:"; guess_all "$TA"
api PUT /api/answers "$TB" '{"kind":"self","qkey":"no-gloss:ok-seen","value":{"value":5}}'; expect 409 "Ben's answers are frozen once Ana guesses"
for T in "$TA" "$TB"; do
  api GET /api/state "$T"
  for id in $(echo "$RESP" | jq -r '.askedToMe[].id'); do
    api PUT /api/answers "$T" "{\"kind\":\"reply\",\"qkey\":\"$id\",\"value\":{\"text\":\"my honest reply\"}}"
    [[ $CODE == 200 ]] || fail "reply -> $CODE $RESP"
  done
done
ok "both answered each other's questions"
echo "  Ben:"; guess_all "$TB"
api POST /api/stages/3/complete "$TA"; expect 200 "Ana finishes stage 3"
api GET /api/state "$TA"
[[ $(echo "$RESP" | jq -r .room.status) == playing ]] && ok "reveal waits for Ben" || fail "reveal opened too early"
api POST /api/stages/3/complete "$TB"; expect 200 "Ben finishes stage 3"

# ---------------------------------------------------------------------------
step "6. Reveal: open every card in turn"
api GET /api/state "$TA"
[[ $(echo "$RESP" | jq -r .room.status) == reveal ]] && ok "status is reveal" || fail "no reveal"
TOTAL=$(echo "$RESP" | jq '.board.cards | length')
LAST=$(echo "$RESP" | jq '[.board.cards[] | select(.last)] | length')
echo "  $TOTAL cards, $LAST of them saved for last (mountains + locked)"
FIRST=$(echo "$RESP" | jq -r '.board.cards[0].key')
api GET "/api/cards/$(jq -rn --arg k "$FIRST" '$k|@uri')" "$TA"; expect 409 "an unopened card stays closed"
OPENED=0
while :; do
  api GET /api/state "$TA"; S=$RESP
  [[ $(echo "$S" | jq .board.allOpened) == true ]] && break
  TURN=$(echo "$S" | jq .board.turnSeat)
  T=$([[ $TURN == 1 ]] && echo "$TA" || echo "$TB"); O=$([[ $TURN == 1 ]] && echo "$TB" || echo "$TA")
  if [[ $OPENED == 0 ]]; then
    api POST "/api/cards/$(jq -rn --arg k "$FIRST" '$k|@uri')/open" "$O"; expect 409 "wrong player can't open"
  fi
  CARD=$(echo "$S" | jq -r '[.board.cards[] | select(.openable)][0]')
  KEY=$(echo "$CARD" | jq -r .key); EK=$(jq -rn --arg k "$KEY" '$k|@uri')
  api POST "/api/cards/$EK/open" "$T"; [[ $CODE == 200 ]] || fail "open $KEY -> $CODE $RESP"
  if [[ $(echo "$CARD" | jq .lock) == true ]]; then
    api GET "/api/cards/$EK" "$T"; [[ $(echo "$RESP" | jq .locked) == true ]] || fail "locked card shown before both pressed"
    api POST "/api/cards/$EK/show" "$T"; api POST "/api/cards/$EK/show" "$O"
    api GET "/api/cards/$EK" "$T"; [[ $(echo "$RESP" | jq .locked) == false ]] || fail "lock didn't open"
  fi
  OPENED=$((OPENED + 1))
done
ok "opened $OPENED cards, turns alternated, locks needed both"

CLIMATE=$(jq -rn '"g:no-gloss:climate"|@uri')
if echo "$ROOM_DECKS" | jq -e 'index("no-gloss")' >/dev/null; then
  api GET "/api/cards/$CLIMATE" "$TA"; expect 200 "climate card"
  echo "$RESP" | jq -r '.conclusions[] | "    conclusion: \(.code) \(.params // {} | tostring)"'
  echo "    talk: $(echo "$RESP" | jq -c .talk)"
fi
if echo "$ROOM_DECKS" | jq -e 'index("closer")' >/dev/null; then
  api GET "/api/cards/$(jq -rn '"s:closer:wishlist"|@uri')" "$TB"; expect 200 "wishlist card"
  echo "$RESP" | jq -e '.questions[0] | has("answers") | not' >/dev/null && ok "wishlist shows only matches ($(echo "$RESP" | jq '.questions[0].matches | length')), no raw answers" || fail "wishlist leaked answers"
fi

# ---------------------------------------------------------------------------
step "7. Thread, rule, summary"
ANGER=$(jq -rn '"s:no-gloss:anger"|@uri')
api POST "/api/cards/$ANGER/messages" "$TA" '{"text":"Let us talk about this"}'; expect 200 "Ana writes in the thread"
api POST "/api/cards/$ANGER/status" "$TB" '{"status":"rule","rule":"We call instead of texting when it matters"}'; expect 200 "Ben makes it our rule"
api GET "/api/cards/$ANGER" "$TB"
[[ $(echo "$RESP" | jq '.messages | length') -ge 1 ]] && ok "Ben sees the message" || fail "message missing"
api GET /api/summary "$TA"; expect 200 "Our map"
echo "$RESP" | jq -r '"    opened \(.cardsOpened)/\(.cardsTotal), rules: \(.rules | length), relief: \(.relief // "-" | tostring), climate: \(.climate // "-" | tostring)"'
echo "$RESP" | jq -r '.accuracy[] | "    \(.deck): Ana read Ben \(.bySeat."1".hits)/\(.bySeat."1".total), Ben read Ana \(.bySeat."2".hits)/\(.bySeat."2".total)"'

# ---------------------------------------------------------------------------
step "8. Export needs both"
api GET /api/export "$TA"; expect 403 "no export without consent"
api POST /api/consents "$TA" '{"type":"export","value":true}'
api GET /api/export "$TA"; expect 403 "one consent is not enough"
api POST /api/consents "$TB" '{"type":"export","value":true}'
api GET /api/export "$TA"; expect 200 "export after both agreed"
[[ $(echo "$RESP" | jq '[.cards[] | select(.deck == "closer")] | length') == 0 ]] && ok "18+ deck excluded without its own consent" || fail "18+ deck leaked into export"

# ---------------------------------------------------------------------------
step "9. Time capsule"
ENTRY='{"answers":{"admire":"your calm","fear":"distance","half-year":"same city","remember":"I chose you","change-first":"the schedule"}}'
api PUT /api/capsule/entry "$TA" "$ENTRY"; expect 200 "Ana writes her part"
api PUT /api/capsule/entry "$TB" "$ENTRY"; expect 200 "Ben writes his part"
api PUT /api/capsule/months "$TA" '{"months":6}'; expect 200 "Ana picks 6 months"
api PUT /api/capsule/months "$TB" '{"months":3}'; expect 200 "Ben picks 3 months"
api GET /api/state "$TA"
[[ $(echo "$RESP" | jq .capsule.sealed) == false ]] && ok "different dates: not sealed" || fail "sealed without agreement"
api PUT /api/capsule/months "$TB" '{"months":6}'
api GET /api/state "$TA"
[[ $(echo "$RESP" | jq .capsule.sealed) == true && $(echo "$RESP" | jq .capsule.open) == false ]] \
  && ok "sealed, opens $(echo "$RESP" | jq -r .capsule.openAt)" || fail "capsule not sealed"
echo "$RESP" | jq -e '.capsule | has("entries") | not' >/dev/null && ok "nobody can read it before the date" || fail "capsule readable early"

# ---------------------------------------------------------------------------
step "10. Delete"
if [[ -n ${KEEP:-} ]]; then
  echo "  KEEP set: room kept. Tokens: Ana=$TA Ben=$TB"
else
  api DELETE /api/room "$TB"; expect 200 "Ben deletes the room"
  api GET /api/state "$TA"; expect 401 "Ana no longer has access"
fi

printf '\n\033[32mAll checks passed.\033[0m\n'
