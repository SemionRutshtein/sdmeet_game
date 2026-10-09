// Stage 4: the board of face-down cards and the card detail sheet.
import { h, mount, toast, sheet } from '../dom.js';
import { t, loc } from '../i18n.js';
import { deck as deckOf, decksIn, poolText, wishlistLabel } from '../content.js';
import { voiceRecorder, voicePlayer } from '../voice.js';
import { answerOrPass, formatValue, labelPill, terrainPill, cardTitle, conclusionText, names } from './format.js';

const STATUS_ICON = { discussed: '✓', later: '↺', rule: '★' };

export function boardView(ctx) {
  const root = h('div');
  let lastOpened = null;
  let justOpened = new Set();

  function render(state) {
    const board = state.board;
    const myTurn = board.turnSeat === state.me.seat;
    const opened = new Set(board.cards.filter(c => c.opened).map(c => c.key));
    // A card the partner just opened pops up here too: you look at it together.
    // Only tiles opened since the last render get the flip animation.
    justOpened = lastOpened ? new Set([...opened].filter(k => !lastOpened.has(k))) : new Set();
    if (lastOpened) {
      const fresh = board.cards.find(c => c.opened && !lastOpened.has(c.key) && c.openedBy !== state.me.seat);
      if (fresh && !ctx.sheetOpen()) ctx.openCard(fresh.key);
    }
    lastOpened = opened;

    const sections = [];
    for (const d of decksIn(state.room.decks)) {
      const cards = board.cards.filter(c => c.deck === d.id);
      if (cards.length) sections.push({ title: `${d.icon} ${loc(d.title)}`, sub: loc(d.reveal.name), cards });
    }
    const own = board.cards.filter(c => !c.deck);
    if (own.length) sections.push({ title: `✍️ ${t('reveal.ownQuestions')}`, sub: '', cards: own });

    let n = 0;
    mount(root,
      board.allOpened
        ? h('div', { class: 'turn-banner mine' }, '🗺️ ', t('reveal.allOpen'), h('span', { style: { flex: 1 } }),
            h('button', { class: 'btn primary small', onclick: () => ctx.setTab('map') }, t('map.title')))
        : h('div', { class: `turn-banner${myTurn ? ' mine' : ''}` },
            h('span', { class: `dot ${myTurn ? 'on' : 'pulse'}` }),
            myTurn ? t('reveal.yourTurn') : t('reveal.theirTurn', { name: state.partner.name })),
      h('p', { class: 'small muted' }, t('reveal.howto')),
      sections.map(s => h('section', { class: 'deck-section' },
        h('header', {}, h('h3', { style: { margin: 0 } }, s.title), s.sub ? h('span', { class: 'muted small' }, s.sub) : null),
        h('div', { class: 'board-grid' }, s.cards.map(c => tile(c, ++n, state, myTurn)))
      ))
    );
  }

  function tile(c, n, state, myTurn) {
    if (c.opened) {
      return h('button', { class: `tile opened${justOpened.has(c.key) ? ' just-opened' : ''}`, onclick: () => ctx.openCard(c.key) },
        h('div', { class: 'tile-badges' },
          c.lock ? h('span', { class: 'pill gold' }, c.lockSeats.length >= 2 ? '🔓' : '🔒') : null,
          terrainPill(c.terrain),
          c.status ? h('span', { class: 'pill gold' }, STATUS_ICON[c.status], ' ', t(`statusBadge.${c.status}`)) : null),
        h('div', { class: 'tile-title' }, cardTitle(c, state)));
    }
    const icon = c.deck ? deckOf(c.deck).icon : '✍️';
    const canOpen = c.openable && myTurn;
    const label = !c.openable
      ? (c.last ? (c.lock ? `🔒 ${t('reveal.lockedLast')}` : `🏔️ ${t('reveal.savedForLast')}`) : t('reveal.later'))
      : (myTurn ? t('reveal.tapToOpen') : '');
    return h('button', {
      class: `tile back${canOpen ? ' openable' : ''}${!c.openable ? ' waiting' : ''}`,
      disabled: !canOpen,
      'aria-label': `${t('reveal.card')} ${n}`,
      onclick: async () => {
        try {
          await ctx.api.openCard(c.key);
          ctx.openCard(c.key);
          await ctx.refresh();
        } catch (e) {
          toast(t(`error.${e.code}`, {}, t('error.generic')));
          ctx.refresh();
        }
      }
    }, h('span', { class: 'tile-icon' }, icon), h('span', {}, String(n)), h('span', { class: 'tiny' }, label));
  }

  return { el: root, render };
}

// ---------- card detail ----------

export function cardSheet(ctx, key, onClosed) {
  const s = sheet(onClosed);
  let detail = null;
  let ruleDraft = '';
  let msgDraft = '';
  // Created once: a refresh mid-recording must not throw the recorder away.
  const threadRecorder = voiceRecorder({
    api: ctx.api,
    context: { kind: 'thread', cardKey: key },
    voiceId: null,
    onChange: async id => {
      if (!id) return;
      try {
        await ctx.api.message(key, { voiceId: id });
        await load();
      } catch (e) {
        toast(t(`error.${e.code}`, {}, t('error.generic')));
      }
    }
  });

  async function load() {
    try {
      detail = await ctx.api.card(key);
      render();
    } catch (e) {
      toast(t(`error.${e.code}`, {}, t('error.generic')));
      s.close();
    }
  }

  function render() {
    const state = ctx.state();
    const d = detail.deck ? deckOf(detail.deck) : null;
    const card = state.board.cards.find(c => c.key === key) || detail;
    const focusKey = s.el.contains(document.activeElement) ? document.activeElement.dataset?.focus : null;
    mount(s.el,
      h('div', { class: 'sheet-head' },
        h('div', { class: 'grow' },
          h('div', { class: 'eyebrow' }, d ? `${d.icon} ${loc(d.title)} · ${loc(d.reveal.name)}` : t('reveal.ownQuestions')),
          h('h2', {}, cardTitle(card, state))),
        h('button', { class: 'close-x', 'aria-label': t('common.close'), onclick: s.close }, '✕')),
      detail.locked ? lockBox(state) : body(state, d)
    );
    if (focusKey) {
      const el = s.el.querySelector(`[data-focus="${focusKey}"]`);
      el?.focus();
      el?.setSelectionRange?.(el.value.length, el.value.length);
    }
  }

  function lockBox(state) {
    const mine = detail.lockSeats.includes(state.me.seat);
    const theirs = detail.lockSeats.includes(state.partner.seat);
    return h('div', { class: 'lock-box' },
      h('div', { class: 'big' }, '🔒'),
      h('p', {}, t('lock.explain')),
      h('p', { class: 'small muted' },
        mine ? t('lock.youPressed') : t('lock.youNot'), ' · ',
        theirs ? t('lock.theyPressed', { name: state.partner.name }) : t('lock.theyNot', { name: state.partner.name })),
      h('button', {
        class: 'btn primary', disabled: mine,
        onclick: async () => { await ctx.api.showCard(key).catch(e => toast(t(`error.${e.code}`, {}, t('error.generic')))); load(); }
      }, t('lock.show')));
  }

  function body(state, d) {
    const parts = [];
    if (detail.kind === 'group') parts.push(climate(state, d));
    else if (detail.kind === 'wishlist') parts.push(wishlist(state));
    else if (detail.kind === 'asked') parts.push(asked(state));
    else parts.push(...detail.questions.map(qv => questionBlock(state, d, qv, false)));

    if (detail.conclusions?.length) {
      parts.push(h('div', { class: 'conclusions' }, detail.conclusions.map(c => h('p', {}, conclusionText(c, state)))));
    }
    parts.push(h('div', { class: 'talk' }, talkText(detail.talk, d)));
    if (detail.ruleSuggested && detail.status !== 'rule') parts.push(h('p', { class: 'small muted' }, t('reveal.ruleHint')));
    parts.push(actions(state));
    parts.push(thread(state));
    return parts;
  }

  function talkText(talk, d) {
    if (!talk) return '';
    if (talk.ref === 'asked') return t('reveal.talkAsked');
    if (talk.ref.startsWith('group:')) return loc(d.reveal.groups.find(g => g.id === talk.ref.slice(6)).talk);
    if (talk.ref === 'qtalk') return loc(d.stage1.find(q => q.id === talk.qid).talk);
    return loc(d.reveal[talk.ref]);
  }

  function seatOrder(state) {
    return [state.me.seat, state.partner.seat];
  }

  function seatName(state, seat) {
    return seat === state.me.seat ? t('common.you') : state.partner.name;
  }

  function guessLine(state, d, q, qv, aboutSeat) {
    const by = aboutSeat === 1 ? 2 : 1;
    const g = qv.guesses?.[by];
    if (!g) return null;
    const who = by === state.me.seat ? t('reveal.youGuessed') : t('reveal.theyGuessed', { name: state.partner.name });
    if (g.pass) return h('div', { class: 'guess-line' }, who, ': ', h('span', { class: 'passed' }, t('reveal.passed')));
    const checks = g.checks || [];
    return h('div', { class: 'guess-line' }, who, ': ', formatValue(q, d, g.value),
      checks.map(c => h('span', { class: `pill ${c.hit ? 'hit' : 'miss'}` },
        c.part !== 'main' ? `${t(`scene.${c.part}`)} ` : '', c.hit ? t('reveal.hit') : t('reveal.miss'))));
  }

  function questionBlock(state, d, qv, withTitle) {
    const q = d.stage1.find(x => x.id === qv.qid);
    return h('div', { class: 'q-block' },
      withTitle ? h('div', { class: 'q-title' }, loc(q.prompt)) : null,
      qv.terrain ? h('div', { style: { marginBottom: '0.6rem' } }, terrainPill(qv.terrain)) : null,
      h('div', { class: 'answers' }, seatOrder(state).map(seat => {
        const ans = qv.answers[seat];
        return h('div', { class: 'answer-box' },
          h('div', { class: 'who' }, seatName(state, seat)),
          h('div', { class: 'val' }, answerOrPass(q, d, ans, { api: ctx.api })),
          ans?.label ? h('div', { style: { marginTop: '0.4rem' } }, labelPill(ans.label)) : null,
          guessLine(state, d, q, qv, seat));
      })),
      qv.pattern ? h('div', { class: 'pattern' }, '↔ ', t('concl.chase')) : null
    );
  }

  // Deck 1: each person's "climate" card.
  function climate(state, d) {
    const qv = id => detail.questions.find(x => x.qid === id);
    const q = id => d.stage1.find(x => x.id === id);
    const weather = qv('weather');
    const needs = qv('bad-day-needs');
    const scales = ['ok-seen', 'anger-scares', 'self-reliant'];
    return h('div', { class: 'answers' }, seatOrder(state).map(seat => {
      const other = seat === 1 ? 2 : 1;
      const w = weather.answers[seat];
      const wOpt = w?.value ? q('weather').options.find(o => o.id === w.value.icon) : null;
      return h('div', { class: 'answer-box' },
        h('div', { class: 'who' }, seatName(state, seat)),
        h('div', { class: 'climate' },
          h('div', { class: 'big' }, wOpt ? wOpt.icon : '·'),
          wOpt ? h('div', {}, loc(wOpt.label)) : h('div', { class: 'passed' }, t('reveal.passed')),
          w?.value?.phrase ? h('p', { class: 'small' }, `“${w.value.phrase}”`) : null),
        guessLine(state, d, q('weather'), weather, seat),
        h('div', { class: 'sub-q' },
          h('div', { class: 'label tiny muted' }, t('climate.storm')),
          answerOrPass(q('bad-day-needs'), d, needs.answers[seat]),
          guessLine(state, d, q('bad-day-needs'), needs, seat)),
        h('div', { class: 'sub-q' },
          h('div', { class: 'legend' }, h('span', { class: 'l-real' }, t('climate.asIs')),
            h('span', { class: 'l-guess' }, other === state.me.seat ? t('climate.asThoughtByYou') : t('climate.asThought', { name: state.partner.name }))),
          scales.map(id => {
            const v = qv(id);
            const real = v.answers[seat]?.value?.value;
            const guess = v.guesses?.[other]?.value?.value;
            const pos = n => `${((n - 1) / 6) * 100}%`;
            return h('div', { style: { marginTop: '0.6rem' } },
              h('div', { class: 'small' }, loc(q(id).prompt)),
              h('div', { class: 'track' },
                real != null ? h('span', { class: 'pt real', style: { insetInlineStart: pos(real) }, title: String(real) }) : null,
                guess != null ? h('span', { class: 'pt guess', style: { insetInlineStart: pos(guess) }, title: String(guess) }) : null),
              v.answers[seat]?.pass ? h('div', { class: 'passed tiny' }, t('reveal.passed')) : null);
          }))
      );
    }));
  }

  function wishlist(state) {
    const qv = detail.questions[0];
    const passed = [1, 2].filter(s => qv.passed[s]);
    return h('div', {},
      h('p', { class: 'small muted' }, t('wish.privacy')),
      passed.map(s => h('p', { class: 'passed' }, t('concl.passed', { name: seatName(state, s) }))),
      qv.matches.length
        ? h('div', { class: 'options' }, qv.matches.map(m => h('div', { class: 'opt' },
            h('span', { style: { flex: 1 } }, wishlistLabel(m.id)),
            h('span', { class: 'pill gold' }, m.level === 'yes' ? t('wish.bothYes') : t('wish.someMaybe')))))
        : null);
  }

  function asked(state) {
    const a = detail.asked;
    const nm = names(state);
    const from = a.fromSeat === state.me.seat ? t('common.you') : nm[a.fromSeat];
    const to = a.toSeat === state.me.seat ? t('common.you') : nm[a.toSeat];
    const reply = a.reply;
    return h('div', {},
      h('p', { class: 'small muted' }, t('reveal.askedBy', { from, to })),
      h('div', { class: 'answer-box' },
        h('div', { class: 'who' }, to),
        !reply ? h('span', { class: 'passed' }, '—')
          : reply.pass ? h('span', { class: 'passed' }, t('reveal.passed'))
          : h('div', {},
              reply.value.text ? h('div', { style: { whiteSpace: 'pre-wrap' } }, reply.value.text) : null,
              reply.value.voiceId ? h('div', { class: 'voice' }, voicePlayer(ctx.api, reply.value.voiceId)) : null)));
  }

  function actions(state) {
    const set = async (status, rule) => {
      try {
        await ctx.api.cardStatus(key, status, rule);
        await load();
        ctx.refresh();
      } catch (e) {
        toast(t(`error.${e.code}`, {}, t('error.generic')));
      }
    };
    const btn = status => h('button', {
      class: 'btn small ghost',
      'aria-pressed': String(detail.status === status),
      onclick: () => {
        if (status === 'rule') { ruleOpen = !ruleOpen; render(); return; }
        set(detail.status === status ? null : status);
      }
    }, STATUS_ICON[status], ' ', t(`status.${status}`));
    const d = detail.deck ? deckOf(detail.deck) : null;
    const placeholder = d?.reveal.rulePlaceholder ? loc(d.reveal.rulePlaceholder) : t('reveal.rulePlaceholder');
    const ruleInput = h('input', { type: 'text', 'data-focus': 'rule', maxlength: 300, placeholder, value: ruleDraft || detail.rule || '' });
    ruleInput.addEventListener('input', () => { ruleDraft = ruleInput.value; });
    return h('div', {},
      h('div', { class: 'actions' }, btn('discussed'), btn('later'), btn('rule')),
      detail.status === 'rule' && detail.rule && !ruleOpen
        ? h('div', { class: 'rule-item', style: { marginTop: '0.6rem' } }, '★ ', detail.rule) : null,
      ruleOpen ? h('div', { class: 'row', style: { marginTop: '0.6rem' } },
        h('div', { style: { flex: 1 } }, ruleInput),
        h('button', { class: 'btn primary small', onclick: () => { const r = ruleInput.value.trim(); if (r) { ruleOpen = false; ruleDraft = ''; set('rule', r); } } }, t('common.save'))) : null
    );
  }
  let ruleOpen = false;

  function thread(state) {
    const list = h('div', {}, detail.messages.map(m => h('div', { class: `msg${m.seat === state.me.seat ? ' mine' : ''}` },
      h('span', { class: 'who' }, seatName(state, m.seat)),
      m.text || null,
      m.voiceId ? h('div', { class: 'voice' }, voicePlayer(ctx.api, m.voiceId)) : null)));
    const ta = h('textarea', { 'data-focus': 'msg', maxlength: 2000, placeholder: t('reveal.writeHere') }, msgDraft);
    ta.addEventListener('input', () => { msgDraft = ta.value; });
    const send = async () => {
      const text = ta.value.trim();
      if (!text) return;
      try {
        await ctx.api.message(key, { text });
        msgDraft = '';
        await load();
      } catch (e) {
        toast(t(`error.${e.code}`, {}, t('error.generic')));
      }
    };
    return h('div', { class: 'thread' },
      h('div', { class: 'eyebrow' }, t('reveal.thread')),
      list,
      h('div', { class: 'composer' },
        h('div', { style: { flex: 1 } }, ta),
        h('button', { class: 'btn primary small', onclick: () => send() }, t('common.send'))),
      threadRecorder);
  }

  load();
  return {
    key,
    reload: load,
    close: s.close
  };
}

// for the export page
export { formatValue };
export function askedText(a) {
  return a.custom || poolText(a.deck, a.poolId);
}
