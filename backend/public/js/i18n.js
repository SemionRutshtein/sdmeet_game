// UI strings. English is the default; Russian and Hebrew (RTL) are switchable.
// Deck content carries its own translations (backend/content); this file is
// only the interface. test/i18n.test.js checks that every key used in the
// code exists in all three languages.
export const APP_NAME = 'Two Maps';
export const LANGS = ['en', 'ru', 'he'];
const STORAGE_KEY = 'sdmeet2.lang';

const en = {
  why: {
    answerOrPass: 'Pick an answer, or tap Pass.', rank: '{k} of {n} chosen. Tap at least {n}.', custom: 'Write your own answer in the box.',
    slider: 'Move or tap the slider.', scene: 'Pick at least one feeling and one action.', wishlist: '{k} of {n} answered. Every item needs yes, maybe or no.',
    label: 'Now pick how much this matters.', reply: 'Write an answer, record a voice note, or tap Pass.'
  },
  common: {
    you: 'You', partner: 'your partner', next: 'Next', back: 'Back', pass: 'Pass', done: 'Done', save: 'Save', saved: 'Saved',
    cancel: 'Cancel', close: 'Close', copy: 'Copy', copied: 'Copied', share: 'Share', open: 'Open', remove: 'Remove',
    send: 'Send', home: 'Home', retry: 'Try again', loading: 'Loading…'
  },
  home: {
    eyebrow: 'A game for two',
    title: 'Draw your map. Guess theirs.',
    concept: 'Each of you draws a map of yourself and guesses your partner\'s. Then you open it together and see where you matched and where you missed. It\'s not a compatibility test, it\'s a reason to talk.',
    step1: 'answer questions about yourself, on your own time.',
    step2: 'pick 5–7 questions for your partner.',
    step3: 'answer theirs and guess how they answered.',
    step4: 'open the cards together, ideally on a video call.',
    notATest: 'No compatibility score. No personality labels. Just the specifics.',
    yourName: 'Your name', namePlaceholder: 'How should your partner see you?',
    decks: 'Decks', decksNote: 'Two decks take about 20–30 minutes each.',
    adultConfirm: 'I\'m 18+ and want the Closer deck. It only stays on if my partner opts in too.',
    create: 'Create a room', myRooms: 'Your rooms on this device', roomAs: 'As {name}',
    privacy: 'Answers and voice notes are encrypted. Either of you can delete the room at any time. No shared stats between couples.'
  },
  join: {
    title: '{name} invited you', decks: 'Decks:', button: 'Join',
    adultOffer: '{name} also suggested {deck}. I\'m 18+ and want it too. (If you leave this off, the deck is removed for both of you.)',
    notFound: 'This room doesn\'t exist or has expired.', full: 'This room already has two players',
    fullText: 'If it\'s yours, open it from the device where you joined.'
  },
  stage: { label: 'Stage {n}' },
  stage1: {
    title: 'About me', intro: 'Answer for yourself. Your partner won\'t see these until you open the cards together. You can pass on anything.',
    finish: 'Finish stage 1', review: 'Review my answers', reviewing: 'You\'re editing your answers. They lock once your partner starts guessing.',
    frozen: '{name} has started guessing, so your answers are locked now.'
  },
  stage2: {
    title: 'Questions for your partner', intro: 'Choose 5–7 questions you want your partner to answer. You can write your own.',
    ownQuestion: 'Your own question', customPlaceholder: 'Write a question…', customLock: 'Double lock (opens only when both press "show")',
    add: 'Add', count: '{n} selected ({min}–{max})', hidden: '{name} won\'t see your choice until stage 3.', send: 'Send to {name}'
  },
  stage3: {
    title: 'Answer and predict', intro: 'Answer the questions your partner picked for you, then guess how they answered about themselves.',
    fromPartner: 'From {name}', guessHeader: 'Guess {name}', guessIntro: 'How did {name} answer this about themselves?',
    freezeNote: 'Heads up: once you save your first guess, {name}\'s answers are locked.', finish: 'Finish stage 3'
  },
  stage4: { title: 'Reveal', intro: 'Open the cards together.' },
  wait: {
    partner: { title: 'Waiting for {name}', text: '{name} needs to finish stages 1 and 2 before you can move on. We\'ll update this page when they do.' },
    stage3: { title: 'Almost there', text: 'Finish your own stages first.' },
    reveal: { title: 'Waiting for {name}', text: 'The reveal opens as soon as {name} finishes stage 3. Best done together on a call.' }
  },
  partner: { atStage: 'stage {n}', done: 'done', notJoined: 'Partner hasn\'t joined yet' },
  invite: { text: 'Send this link to your partner. They can join any time and play at their own pace.', shareText: 'Let\'s draw our map' },
  input: {
    multiHint: 'Pick all that apply.', rankHint: 'Tap at least your top {n}, most important first. You can rank more.', rankPickHint: 'Tap your top {n} in order.',
    rankCount: '{k} of {n} chosen', rankCountMore: '{k} ranked',
    rankGuessHint: 'Pick what you think is their #1.', reset: 'Reset', moveSlider: 'Move the slider', typeHere: 'Write here…',
    oneLine: 'One line', yourOption: 'Your own answer', optional: '(optional)',
    weatherPhrase: 'In one phrase', weatherPlaceholder: 'e.g. quiet and grey, then it passes'
  },
  scale: { low: 'Not at all', high: 'Completely' },
  label: { howImportant: 'How much does this matter?', negotiable: 'negotiable', important: 'important', fixed: 'non-negotiable' },
  wish: {
    yes: 'Yes', maybe: 'Maybe', no: 'No', bothYes: 'both yes', someMaybe: 'yes / maybe',
    privacy: 'Only the items where you both said yes or maybe. Nobody\'s "no" is ever shown.'
  },
  lock: {
    short: 'double lock', explain: 'Double lock: this card opens only when both of you press "Show".',
    show: 'Show', youPressed: 'you pressed show', youNot: 'you haven\'t pressed yet',
    theyPressed: '{name} pressed show', theyNot: '{name} hasn\'t pressed yet'
  },
  wizard: { passedHere: 'You passed on this one' },
  voice: {
    record: 'Record a voice note', stop: 'Stop', remove: 'Remove voice note', saving: 'Saving…',
    noMic: 'No access to the microphone', unavailable: 'Voice note not available'
  },
  reveal: {
    board: 'Board', yourTurn: 'Your turn: open any highlighted card', theirTurn: '{name}\'s turn',
    howto: 'Take turns opening cards. Mountains and locked cards come last.', allOpen: 'Every card is open.',
    tapToOpen: 'Open', savedForLast: 'saved for last', lockedLast: 'locked, last', later: 'later', card: 'Card',
    ownQuestions: 'Your own questions', question: 'Question', passed: 'passed',
    youGuessed: 'You guessed', theyGuessed: '{name} guessed', hit: 'hit', miss: 'miss',
    askedBy: '{from} asked {to}', talkAsked: 'What else do you want to ask about this?',
    ruleHint: 'Agreed on something? Save it as your rule.', rulePlaceholder: 'Our rule…',
    thread: 'Talk about it', writeHere: 'Write a message…'
  },
  climate: { storm: 'In a storm I need', asIs: 'as it is', asThought: 'as {name} thought', asThoughtByYou: 'as you thought' },
  scene: { feel: 'feelings', do: 'action' },
  status: { discussed: 'Discussed', later: 'Come back later', rule: 'Make it our rule' },
  statusBadge: { discussed: 'discussed', later: 'later', rule: 'our rule' },
  terrain: { valley: 'Valley', hill: 'Hill', mountain: 'Mountain' },
  concl: {
    passed: '{name} passed.',
    same: 'You answered the same.',
    differ: 'Your answers differ.',
    apart_points: '{n} points apart.',
    apart_percent: '{n} points apart on the scale.',
    multi_shared: '{n} in common.',
    rank_shared: '{n} of your top {k} overlap.',
    rank_top_same: 'Same first choice.',
    rank_top_differ: 'Different first choices.',
    scene_same_do: 'You\'d do the same thing, but feel it differently.',
    guess_both: 'You both read each other right here.',
    guess_none: 'Neither guess landed. Worth asking about.',
    guess_one: '{name} guessed right, {other} missed.',
    read_forecast: '{name} read the forecast: {hits} of {total}.',
    terrain_valley: 'Valley: you\'re in the same place.',
    terrain_hill: 'Hill: different, but open to discussion.',
    terrain_mountain: 'Mountain: different, and non-negotiable for at least one of you.',
    chase: 'Here one of you reaches out and the other pulls back.',
    wish_matches: '{n} shared wishes.',
    wish_none: 'No overlaps yet. That\'s an answer too.'
  },
  map: {
    title: 'Our map', opened: '{n} of {total} cards opened', accuracy: 'How well you read each other',
    accuracyNote: 'Only for questions where you guessed. Not a score of the relationship.',
    youRead: 'You read {name}', theyRead: '{name} read you',
    climate: 'Climate', relief: 'Relief', storyboard: 'One reaches out, the other pulls back: {n} of {total} scenes.',
    rules: 'Our rules', noRules: 'No rules yet. Use "Make it our rule" on a card.',
    later: 'Come back later', noLater: 'Nothing saved for later.',
    share: 'Share image', shareNote: 'Climate, relief and accuracy. Never a single answer word for word, and never the 18+ deck.',
    makeImage: 'Make the image', download: 'Download', shareFooter: 'Drawn together on Two Maps',
    export: 'Export to PDF', exportNote: 'A printable page with the cards you opened. Needs both of you to agree.',
    exportNeedsBoth: 'Available once both of you agree.', openExport: 'Open printable version'
  },
  consent: {
    agree: 'I agree', agreed: 'Agreed ✓', theyAgreed: '{name} agreed', theyNot: '{name} hasn\'t agreed',
    shareRules: 'Include our rules in the image', export: 'Allow the PDF export', adultExport: 'Include the 18+ deck in the PDF'
  },
  capsule: {
    title: 'Time capsule', intro: 'Each of you writes a few lines to open together later. Nobody can read it before the date, not even you.',
    save: 'Save my part', update: 'Update my part', youWrote: 'your part is saved',
    when: 'Open in', months: '{n} months', theyPicked: '{name} picked {n} months.',
    theyWrote: '{name} has written their part.', theyNotWrote: '{name} hasn\'t written yet.',
    sealRule: 'It seals when both of you have written and picked the same date.',
    sealedOn: 'Sealed on {date}. Opens on {open}.',
    linkNote: 'Your personal link to open it from any device. Keep it private: it works only for you.',
    openTitle: 'Your capsule is open', openedNote: 'Written on {date}.'
  },
  retake: {
    title: 'Then and now', intro: 'Retake stage 1 of any deck and see what changed, and how much better you read each other.',
    now: '{deck}: answer again', guess: 'Now guess {name} again', waiting: 'Waiting for {name}…',
    compareTitle: '{deck}: then and now', then: 'then', nowCol: 'now', wishMatches: 'Shared wishes: {then} then, {now} now.'
  },
  menu: { title: 'Room', myRooms: 'All my rooms', expires: 'This room is kept until {date} (extended with activity).' },
  danger: {
    title: 'Delete the room', text: 'Deletes every answer, voice note and the capsule for both of you. This can\'t be undone.',
    delete: 'Delete room', confirmTitle: 'Delete everything?', confirmText: 'All answers, threads, voice notes and the capsule will be gone for both of you.',
    deleted: 'Room deleted'
  },
  room: {
    noAccess: 'This room isn\'t on this device', noAccessText: 'Open it from the device you used to create or join it, or use your capsule link.',
    gone: 'This room is gone', goneText: 'It was deleted or it expired.',
    archived: 'The room expired and its answers were deleted. Only the capsule is kept.'
  },
  format: { middle: 'in the middle' },
  export: { print: 'Print / save as PDF', voiceOnly: '(voice note)' },
  error: {
    generic: 'Something went wrong. Try again.', network: 'No connection. Check your internet.',
    not_found: 'Not found.', unauthorized: 'No access to this room.', name_required: 'Enter your name.',
    decks_required: 'Pick at least one deck (not only the 18+ one).', adult_confirm_required: 'Confirm that you\'re 18+ to include the Closer deck.',
    room_full: 'This room already has two players.', bad_value: 'That answer doesn\'t look right.',
    wrong_stage: 'Not available at this stage.', frozen: 'Your partner has started guessing, so your answers are locked.',
    incomplete: 'A few questions are still open.', ask_count: 'Pick 5 to 7 questions.',
    not_your_turn: 'It\'s not your turn.', not_openable: 'This card opens later.', not_opened: 'This card isn\'t open yet.',
    too_large: 'Too large.', consent_required: 'Both of you need to agree first.', sealed: 'The capsule is already sealed.',
    rate_limited: 'Too many attempts. Wait a minute.', server_error: 'Server error. Try again.'
  }
};

const ru = {
  why: {
    answerOrPass: 'Выбери ответ или нажми «Пас».', rank: 'Выбрано {k} из {n}. Нужно хотя бы {n}.', custom: 'Напиши свой вариант в поле.',
    slider: 'Сдвинь ползунок или нажми на него.', scene: 'Выбери хотя бы одно чувство и одно действие.', wishlist: 'Отвечено {k} из {n}. Для каждого пункта нужно «да», «может» или «нет».',
    label: 'Теперь отметь, насколько это важно.', reply: 'Напиши ответ, запиши голосовое или нажми «Пас».'
  },
  common: {
    you: 'Ты', partner: 'партнёр', next: 'Дальше', back: 'Назад', pass: 'Пас', done: 'Готово', save: 'Сохранить', saved: 'Сохранено',
    cancel: 'Отмена', close: 'Закрыть', copy: 'Копировать', copied: 'Скопировано', share: 'Поделиться', open: 'Открыть', remove: 'Убрать',
    send: 'Отправить', home: 'На главную', retry: 'Ещё раз', loading: 'Загрузка…'
  },
  home: {
    eyebrow: 'Игра на двоих',
    title: 'Нарисуй свою карту. Угадай чужую.',
    concept: 'Каждый рисует карту себя и угадывает карту партнёра, потом вместе открываете, где совпали и где промахнулись. Не тест на совместимость, а повод поговорить.',
    step1: 'отвечаешь на вопросы о себе, когда удобно.',
    step2: 'выбираешь 5–7 вопросов для партнёра.',
    step3: 'отвечаешь на его вопросы и угадываешь его ответы.',
    step4: 'открываете карточки вместе, лучше на видеозвонке.',
    notATest: 'Никакого процента совместимости. Никаких ярлыков. Только конкретика.',
    yourName: 'Твоё имя', namePlaceholder: 'Как тебя увидит партнёр?',
    decks: 'Колоды', decksNote: 'Каждая колода — примерно 20–30 минут.',
    adultConfirm: 'Мне есть 18 и я хочу колоду «Ближе». Она останется, только если партнёр тоже согласится.',
    create: 'Создать комнату', myRooms: 'Твои комнаты на этом устройстве', roomAs: 'Как {name}',
    privacy: 'Ответы и голосовые шифруются. Любой из вас может удалить комнату в любой момент. Никакой общей статистики между парами.'
  },
  join: {
    title: '{name} приглашает тебя', decks: 'Колоды:', button: 'Войти',
    adultOffer: '{name} предлагает ещё колоду {deck}. Мне есть 18 и я тоже хочу. (Если не отмечать, колода исчезнет для обоих.)',
    notFound: 'Такой комнаты нет или срок её жизни истёк.', full: 'В этой комнате уже двое',
    fullText: 'Если это твоя комната, открой её на устройстве, с которого ты входил(а).'
  },
  stage: { label: 'Этап {n}' },
  stage1: {
    title: 'Сам о себе', intro: 'Отвечай за себя. Партнёр увидит ответы только когда вы вместе откроете карточки. На любой вопрос можно сказать «пас».',
    finish: 'Завершить этап 1', review: 'Посмотреть мои ответы', reviewing: 'Ты редактируешь ответы. Они замёрзнут, как только партнёр начнёт угадывать.',
    frozen: '{name} уже начал(а) угадывать, поэтому твои ответы заморожены.'
  },
  stage2: {
    title: 'Вопросы партнёру', intro: 'Выбери 5–7 вопросов, на которые хочешь услышать ответ партнёра. Можно дописать свой.',
    ownQuestion: 'Свой вопрос', customPlaceholder: 'Напиши вопрос…', customLock: 'Двойной замок (откроется, только когда оба нажмут «показать»)',
    add: 'Добавить', count: 'Выбрано {n} (нужно {min}–{max})', hidden: '{name} не увидит твой выбор до этапа 3.', send: 'Отправить: {name}'
  },
  stage3: {
    title: 'Ответ и прогноз', intro: 'Ответь на вопросы, которые выбрал(а) партнёр, а потом угадай, как он(а) ответил(а) о себе.',
    fromPartner: 'Вопрос от: {name}', guessHeader: 'Угадай: {name}', guessIntro: 'Как {name} ответил(а) на это о себе?',
    freezeNote: 'Важно: как только ты сохранишь первый прогноз, ответы ({name}) замёрзнут.', finish: 'Завершить этап 3'
  },
  stage4: { title: 'Reveal', intro: 'Открываете карточки вместе.' },
  wait: {
    partner: { title: 'Ждём: {name}', text: '{name} должен(на) пройти этапы 1 и 2, прежде чем ты продолжишь. Страница обновится сама.' },
    stage3: { title: 'Почти', text: 'Сначала закончи свои этапы.' },
    reveal: { title: 'Ждём: {name}', text: 'Reveal откроется, как только {name} закончит этап 3. Лучше открывать вместе, на звонке.' }
  },
  partner: { atStage: 'этап {n}', done: 'готово', notJoined: 'Партнёр ещё не зашёл' },
  invite: { text: 'Отправь эту ссылку партнёру. Войти можно в любой момент и играть в своём темпе.', shareText: 'Давай нарисуем нашу карту' },
  input: {
    multiHint: 'Можно выбрать несколько.', rankHint: 'Выбери хотя бы топ-{n} по порядку, самое важное первым. Можно и больше.', rankPickHint: 'Выбери топ-{n} по порядку.',
    rankCount: 'Выбрано {k} из {n}', rankCountMore: 'Расставлено: {k}',
    rankGuessHint: 'Выбери, что у партнёра на первом месте.', reset: 'Сбросить', moveSlider: 'Сдвинь ползунок', typeHere: 'Напиши здесь…',
    oneLine: 'Одна строка', yourOption: 'Свой вариант', optional: '(необязательно)',
    weatherPhrase: 'Одной фразой', weatherPlaceholder: 'например: тихо и серо, потом проходит'
  },
  scale: { low: 'Совсем нет', high: 'Полностью' },
  label: { howImportant: 'Насколько это важно?', negotiable: 'обсуждаемо', important: 'важно', fixed: 'не обсуждается' },
  wish: {
    yes: 'Да', maybe: 'Может быть', no: 'Нет', bothYes: 'оба «да»', someMaybe: 'да / может',
    privacy: 'Только то, где вы оба сказали «да» или «может быть». Чужое «нет» не показывается никогда.'
  },
  lock: {
    short: 'двойной замок', explain: 'Двойной замок: карточка откроется, только когда вы оба нажмёте «Показать».',
    show: 'Показать', youPressed: 'ты нажал(а)', youNot: 'ты ещё не нажал(а)',
    theyPressed: '{name}: нажато', theyNot: '{name}: ещё не нажато'
  },
  wizard: { passedHere: 'Здесь ты сказал(а) «пас»' },
  voice: {
    record: 'Записать голосовое', stop: 'Стоп', remove: 'Удалить голосовое', saving: 'Сохраняю…',
    noMic: 'Нет доступа к микрофону', unavailable: 'Голосовое недоступно'
  },
  reveal: {
    board: 'Доска', yourTurn: 'Твой ход: открой любую подсвеченную карточку', theirTurn: 'Ход: {name}',
    howto: 'Открывайте карточки по очереди. Горы и карточки под замком — в самом конце.', allOpen: 'Все карточки открыты.',
    tapToOpen: 'Открыть', savedForLast: 'на потом', lockedLast: 'под замком, в конце', later: 'позже', card: 'Карточка',
    ownQuestions: 'Ваши вопросы', question: 'Вопрос', passed: 'пас',
    youGuessed: 'Твой прогноз', theyGuessed: 'Прогноз ({name})', hit: 'попал', miss: 'мимо',
    askedBy: '{from} → {to}', talkAsked: 'Что ещё хочется об этом спросить?',
    ruleHint: 'Договорились? Сохраните это как ваше правило.', rulePlaceholder: 'Наше правило…',
    thread: 'Обсудить', writeHere: 'Напиши сообщение…'
  },
  climate: { storm: 'В грозу мне нужно', asIs: 'как есть', asThought: 'как думал(а): {name}', asThoughtByYou: 'как думал(а) ты' },
  scene: { feel: 'чувства', do: 'действие' },
  status: { discussed: 'Обсудили', later: 'Вернуться позже', rule: 'Сделать нашим правилом' },
  statusBadge: { discussed: 'обсудили', later: 'позже', rule: 'наше правило' },
  terrain: { valley: 'Долина', hill: 'Холм', mountain: 'Гора' },
  concl: {
    passed: '{name}: пас.',
    same: 'Вы ответили одинаково.',
    differ: 'Ответы разные.',
    apart_points: 'Разница: {n}.',
    apart_percent: 'Разница на шкале: {n}.',
    multi_shared: 'Общего: {n}.',
    rank_shared: 'Совпадает {n} из топ-{k}.',
    rank_top_same: 'Первое место совпадает.',
    rank_top_differ: 'Первое место разное.',
    scene_same_do: 'Сделали бы одно и то же, но чувствуете по-разному.',
    guess_both: 'Здесь вы оба угадали друг друга.',
    guess_none: 'Оба прогноза мимо. Есть о чём спросить.',
    guess_one: '{name} — попадание, {other} — мимо.',
    read_forecast: '{name}: прогноз угадан на {hits} из {total}.',
    terrain_valley: 'Долина: вы в одном месте.',
    terrain_hill: 'Холм: по-разному, но обсуждаемо.',
    terrain_mountain: 'Гора: по-разному, и хотя бы для одного это не обсуждается.',
    chase: 'Здесь один тянется навстречу, а другой отходит.',
    wish_matches: 'Общих желаний: {n}.',
    wish_none: 'Пока совпадений нет. Это тоже ответ.'
  },
  map: {
    title: 'Наша карта', opened: 'Открыто карточек: {n} из {total}', accuracy: 'Как хорошо вы знаете друг друга',
    accuracyNote: 'Только по вопросам, где был прогноз. Это не оценка отношений.',
    youRead: 'Ты угадал(а): {name}', theyRead: '{name} угадал(а) тебя',
    climate: 'Климат', relief: 'Рельеф', storyboard: 'Один догоняет, другой отходит: {n} из {total} сцен.',
    rules: 'Наши правила', noRules: 'Правил пока нет. На карточке есть кнопка «Сделать нашим правилом».',
    later: 'Вернуться позже', noLater: 'Ничего не отложено.',
    share: 'Картинка', shareNote: 'Климат, рельеф и точность. Ни одного ответа дословно, колода 18+ — никогда.',
    makeImage: 'Сделать картинку', download: 'Скачать', shareFooter: 'Нарисовано вдвоём в Two Maps',
    export: 'Экспорт в PDF', exportNote: 'Страница для печати с открытыми карточками. Нужно согласие обоих.',
    exportNeedsBoth: 'Станет доступно, когда согласятся оба.', openExport: 'Открыть версию для печати'
  },
  consent: {
    agree: 'Согласен(на)', agreed: 'Согласие дано ✓', theyAgreed: '{name}: согласие дано', theyNot: '{name}: ещё нет согласия',
    shareRules: 'Добавить наши правила в картинку', export: 'Разрешить экспорт в PDF', adultExport: 'Включить колоду 18+ в PDF'
  },
  capsule: {
    title: 'Капсула времени', intro: 'Каждый пишет несколько строк, чтобы открыть их вместе позже. До даты не прочитает никто, даже ты сам(а).',
    save: 'Сохранить мою часть', update: 'Обновить мою часть', youWrote: 'твоя часть сохранена',
    when: 'Открыть через', months: '{n} мес.', theyPicked: '{name}: выбрано {n} мес.',
    theyWrote: '{name}: часть написана.', theyNotWrote: '{name}: ещё не написано.',
    sealRule: 'Капсула запечатается, когда оба напишут и выберут одинаковый срок.',
    sealedOn: 'Запечатана {date}. Откроется {open}.',
    linkNote: 'Твоя личная ссылка, чтобы открыть капсулу с любого устройства. Не пересылай её: она работает только для тебя.',
    openTitle: 'Капсула открыта', openedNote: 'Написано {date}.'
  },
  retake: {
    title: 'Тогда и сейчас', intro: 'Пройдите заново этап 1 любой колоды и посмотрите, что изменилось и насколько лучше вы стали угадывать друг друга.',
    now: '{deck}: ответь заново', guess: 'Теперь снова угадай: {name}', waiting: 'Ждём: {name}…',
    compareTitle: '{deck}: тогда и сейчас', then: 'тогда', nowCol: 'сейчас', wishMatches: 'Общих желаний: тогда {then}, сейчас {now}.'
  },
  menu: { title: 'Комната', myRooms: 'Все мои комнаты', expires: 'Комната хранится до {date} (продлевается при активности).' },
  danger: {
    title: 'Удалить комнату', text: 'Удаляет все ответы, голосовые и капсулу для обоих. Отменить нельзя.',
    delete: 'Удалить комнату', confirmTitle: 'Удалить всё?', confirmText: 'Все ответы, треды, голосовые и капсула исчезнут для вас обоих.',
    deleted: 'Комната удалена'
  },
  room: {
    noAccess: 'Этой комнаты нет на этом устройстве', noAccessText: 'Открой её на устройстве, с которого создавал(а) или входил(а), или по ссылке на капсулу.',
    gone: 'Комнаты больше нет', goneText: 'Её удалили или истёк срок.',
    archived: 'Срок комнаты истёк, ответы удалены. Осталась только капсула.'
  },
  format: { middle: 'посередине' },
  export: { print: 'Печать / сохранить в PDF', voiceOnly: '(голосовое)' },
  error: {
    generic: 'Что-то пошло не так. Попробуй ещё раз.', network: 'Нет связи. Проверь интернет.',
    not_found: 'Не найдено.', unauthorized: 'Нет доступа к этой комнате.', name_required: 'Введи имя.',
    decks_required: 'Выбери хотя бы одну колоду (не только 18+).', adult_confirm_required: 'Подтверди, что тебе есть 18, чтобы включить «Ближе».',
    room_full: 'В комнате уже двое.', bad_value: 'Ответ выглядит неправильно.',
    wrong_stage: 'Сейчас это недоступно.', frozen: 'Партнёр уже начал угадывать, поэтому твои ответы заморожены.',
    incomplete: 'Остались вопросы без ответа.', ask_count: 'Выбери от 5 до 7 вопросов.',
    not_your_turn: 'Сейчас не твой ход.', not_openable: 'Эта карточка откроется позже.', not_opened: 'Карточка ещё не открыта.',
    too_large: 'Слишком большой файл.', consent_required: 'Сначала нужно согласие обоих.', sealed: 'Капсула уже запечатана.',
    rate_limited: 'Слишком много попыток. Подожди минуту.', server_error: 'Ошибка сервера. Попробуй ещё раз.'
  }
};

const he = {
  why: {
    answerOrPass: 'בחרו תשובה או לחצו דלג.', rank: 'נבחרו {k} מתוך {n}. צריך לפחות {n}.', custom: 'כתבו את התשובה שלכם בתיבה.',
    slider: 'הזיזו את המחוון או לחצו עליו.', scene: 'בחרו לפחות רגש אחד ופעולה אחת.', wishlist: 'נענו {k} מתוך {n}. לכל פריט צריך כן, אולי או לא.',
    label: 'עכשיו סמנו כמה זה חשוב.', reply: 'כתבו תשובה, הקליטו הודעה קולית או לחצו דלג.'
  },
  common: {
    you: 'את/ה', partner: 'בן/בת הזוג', next: 'הבא', back: 'חזרה', pass: 'דלג', done: 'סיום', save: 'שמירה', saved: 'נשמר',
    cancel: 'ביטול', close: 'סגירה', copy: 'העתקה', copied: 'הועתק', share: 'שיתוף', open: 'פתיחה', remove: 'הסרה',
    send: 'שליחה', home: 'לדף הבית', retry: 'לנסות שוב', loading: 'טוען…'
  },
  home: {
    eyebrow: 'משחק לשניים',
    title: 'ציירו את המפה שלכם. נחשו את של השני.',
    concept: 'כל אחד מצייר מפה של עצמו ומנחש את המפה של בן/בת הזוג. אחר כך פותחים יחד ורואים איפה פגעתם ואיפה פספסתם. זה לא מבחן התאמה, זו סיבה לדבר.',
    step1: 'עונים על שאלות על עצמכם, בזמן שנוח לכם.',
    step2: 'בוחרים 5–7 שאלות לבן/בת הזוג.',
    step3: 'עונים על השאלות שלהם ומנחשים מה הם ענו.',
    step4: 'פותחים את הקלפים יחד, הכי טוב בשיחת וידאו.',
    notATest: 'בלי ציון התאמה. בלי תוויות. רק דברים קונקרטיים.',
    yourName: 'השם שלך', namePlaceholder: 'איך בן/בת הזוג יראו אותך?',
    decks: 'חפיסות', decksNote: 'כל חפיסה לוקחת בערך 20–30 דקות.',
    adultConfirm: 'אני מעל גיל 18 ורוצה את החפיסה "קרובים יותר". היא תישאר רק אם גם בן/בת הזוג יסכימו.',
    create: 'יצירת חדר', myRooms: 'החדרים שלך במכשיר הזה', roomAs: 'בתור {name}',
    privacy: 'התשובות וההודעות הקוליות מוצפנות. כל אחד מכם יכול למחוק את החדר בכל רגע. אין סטטיסטיקה משותפת בין זוגות.'
  },
  join: {
    title: '{name} מזמין/ה אותך', decks: 'חפיסות:', button: 'הצטרפות',
    adultOffer: '{name} הציע/ה גם את {deck}. אני מעל 18 ורוצה גם. (אם לא מסמנים, החפיסה תוסר לשניכם.)',
    notFound: 'החדר לא קיים או שפג תוקפו.', full: 'בחדר הזה כבר יש שני שחקנים',
    fullText: 'אם זה החדר שלך, פתח/י אותו מהמכשיר שממנו הצטרפת.'
  },
  stage: { label: 'שלב {n}' },
  stage1: {
    title: 'על עצמי', intro: 'עונים על עצמכם. בן/בת הזוג יראו את התשובות רק כשתפתחו את הקלפים יחד. אפשר לדלג על כל שאלה.',
    finish: 'סיום שלב 1', review: 'לעבור על התשובות שלי', reviewing: 'את/ה עורך/ת את התשובות. הן יינעלו ברגע שבן/בת הזוג יתחילו לנחש.',
    frozen: '{name} כבר התחיל/ה לנחש, אז התשובות שלך נעולות.'
  },
  stage2: {
    title: 'שאלות לבן/בת הזוג', intro: 'בחר/י 5–7 שאלות שתרצה/י לשמוע עליהן תשובה. אפשר גם לכתוב שאלה משלך.',
    ownQuestion: 'שאלה משלך', customPlaceholder: 'כתוב/י שאלה…', customLock: 'נעילה כפולה (תיפתח רק כששניכם תלחצו "הצג")',
    add: 'הוספה', count: 'נבחרו {n} (צריך {min}–{max})', hidden: '{name} לא יראו את הבחירה שלך עד שלב 3.', send: 'שליחה אל {name}'
  },
  stage3: {
    title: 'תשובה ותחזית', intro: 'ענו על השאלות שבן/בת הזוג בחרו בשבילכם, ואז נחשו מה הם ענו על עצמם.',
    fromPartner: 'שאלה מ{name}', guessHeader: 'לנחש את {name}', guessIntro: 'מה {name} ענה/תה על עצמו/ה כאן?',
    freezeNote: 'שימו לב: ברגע שתשמרו את הניחוש הראשון, התשובות של {name} יינעלו.', finish: 'סיום שלב 3'
  },
  stage4: { title: 'חשיפה', intro: 'פותחים את הקלפים יחד.' },
  wait: {
    partner: { title: 'מחכים ל{name}', text: '{name} צריך/ה לסיים את שלבים 1 ו־2 לפני שאפשר להמשיך. הדף יתעדכן לבד.' },
    stage3: { title: 'כמעט', text: 'קודם סיימו את השלבים שלכם.' },
    reveal: { title: 'מחכים ל{name}', text: 'החשיפה תיפתח ברגע ש{name} יסיים/תסיים את שלב 3. הכי טוב לפתוח יחד בשיחה.' }
  },
  partner: { atStage: 'שלב {n}', done: 'סיים/ה', notJoined: 'בן/בת הזוג עוד לא הצטרפו' },
  invite: { text: 'שלחו את הקישור הזה לבן/בת הזוג. אפשר להצטרף בכל זמן ולשחק בקצב שלכם.', shareText: 'בוא/י נצייר את המפה שלנו' },
  input: {
    multiHint: 'אפשר לבחור כמה.', rankHint: 'בחרו לפחות את ה־{n} המובילים, הכי חשוב קודם. אפשר גם יותר.', rankPickHint: 'בחרו את ה־{n} המובילים לפי הסדר.',
    rankCount: 'נבחרו {k} מתוך {n}', rankCountMore: 'דורגו {k}',
    rankGuessHint: 'בחרו מה לדעתכם במקום הראשון אצלם.', reset: 'איפוס', moveSlider: 'הזיזו את המחוון', typeHere: 'כתבו כאן…',
    oneLine: 'שורה אחת', yourOption: 'תשובה משלך', optional: '(לא חובה)',
    weatherPhrase: 'במשפט אחד', weatherPlaceholder: 'למשל: שקט ואפור, ואז עובר'
  },
  scale: { low: 'בכלל לא', high: 'לגמרי' },
  label: { howImportant: 'כמה זה חשוב?', negotiable: 'פתוח לדיון', important: 'חשוב', fixed: 'לא נתון למשא ומתן' },
  wish: {
    yes: 'כן', maybe: 'אולי', no: 'לא', bothYes: 'שניכם כן', someMaybe: 'כן / אולי',
    privacy: 'רק פריטים ששניכם אמרתם עליהם כן או אולי. ה"לא" של אף אחד לא מוצג אף פעם.'
  },
  lock: {
    short: 'נעילה כפולה', explain: 'נעילה כפולה: הקלף ייפתח רק כששניכם תלחצו "הצג".',
    show: 'הצג', youPressed: 'לחצת', youNot: 'עוד לא לחצת',
    theyPressed: '{name} לחץ/ה', theyNot: '{name} עוד לא לחץ/ה'
  },
  wizard: { passedHere: 'דילגת על השאלה הזו' },
  voice: {
    record: 'הקלטת הודעה קולית', stop: 'עצירה', remove: 'מחיקת ההודעה הקולית', saving: 'שומר…',
    noMic: 'אין גישה למיקרופון', unavailable: 'ההודעה הקולית לא זמינה'
  },
  reveal: {
    board: 'לוח', yourTurn: 'התור שלך: פתח/י קלף מסומן', theirTurn: 'התור של {name}',
    howto: 'פותחים קלפים בתורות. הרים וקלפים נעולים מגיעים בסוף.', allOpen: 'כל הקלפים פתוחים.',
    tapToOpen: 'פתיחה', savedForLast: 'נשמר לסוף', lockedLast: 'נעול, בסוף', later: 'אחר כך', card: 'קלף',
    ownQuestions: 'השאלות שלכם', question: 'שאלה', passed: 'דילוג',
    youGuessed: 'הניחוש שלך', theyGuessed: 'הניחוש של {name}', hit: 'פגיעה', miss: 'החטאה',
    askedBy: '{from} ← {to}', talkAsked: 'מה עוד בא לך לשאול על זה?',
    ruleHint: 'הסכמתם על משהו? שמרו את זה ככלל שלכם.', rulePlaceholder: 'הכלל שלנו…',
    thread: 'לדבר על זה', writeHere: 'כתבו הודעה…'
  },
  climate: { storm: 'בסערה אני צריך/ה', asIs: 'כמו שזה', asThought: 'כמו ש{name} חשב/ה', asThoughtByYou: 'כמו שחשבת' },
  scene: { feel: 'רגשות', do: 'פעולה' },
  status: { discussed: 'דיברנו', later: 'לחזור לזה', rule: 'להפוך לכלל שלנו' },
  statusBadge: { discussed: 'דיברנו', later: 'אחר כך', rule: 'הכלל שלנו' },
  terrain: { valley: 'עמק', hill: 'גבעה', mountain: 'הר' },
  concl: {
    passed: '{name}: דילוג.',
    same: 'עניתם אותו דבר.',
    differ: 'התשובות שונות.',
    apart_points: 'הפרש: {n}.',
    apart_percent: 'הפרש על הסקאלה: {n}.',
    multi_shared: 'במשותף: {n}.',
    rank_shared: '{n} מתוך {k} המובילים משותפים.',
    rank_top_same: 'אותו מקום ראשון.',
    rank_top_differ: 'מקום ראשון שונה.',
    scene_same_do: 'הייתם עושים אותו דבר, אבל מרגישים אחרת.',
    guess_both: 'כאן שניכם קראתם אחד את השני נכון.',
    guess_none: 'שני הניחושים פספסו. שווה לשאול.',
    guess_one: '{name}: פגיעה · {other}: החטאה.',
    read_forecast: '{name}: התחזית נוחשה {hits} מתוך {total}.',
    terrain_valley: 'עמק: אתם באותו מקום.',
    terrain_hill: 'גבעה: שונה, אבל פתוח לדיון.',
    terrain_mountain: 'הר: שונה, ולפחות לאחד מכם זה לא נתון למשא ומתן.',
    chase: 'כאן אחד מכם מתקרב והשני מתרחק.',
    wish_matches: 'משאלות משותפות: {n}.',
    wish_none: 'עוד אין חפיפה. גם זו תשובה.'
  },
  map: {
    title: 'המפה שלנו', opened: 'נפתחו {n} מתוך {total} קלפים', accuracy: 'כמה טוב אתם קוראים אחד את השני',
    accuracyNote: 'רק בשאלות שבהן ניחשתם. זה לא ציון לקשר.',
    youRead: 'ניחשת את {name}', theyRead: '{name} ניחש/ה אותך',
    climate: 'אקלים', relief: 'תבליט', storyboard: 'אחד מתקרב, השני מתרחק: {n} מתוך {total} סצנות.',
    rules: 'הכללים שלנו', noRules: 'עוד אין כללים. בכל קלף יש כפתור "להפוך לכלל שלנו".',
    later: 'לחזור לזה', noLater: 'לא נשמר כלום לאחר כך.',
    share: 'תמונה לשיתוף', shareNote: 'אקלים, תבליט ודיוק. אף תשובה מילה במילה, ואף פעם לא חפיסת ה־18+.',
    makeImage: 'יצירת תמונה', download: 'הורדה', shareFooter: 'צוירה יחד ב־Two Maps',
    export: 'ייצוא ל־PDF', exportNote: 'דף להדפסה עם הקלפים שנפתחו. צריך הסכמה של שניכם.',
    exportNeedsBoth: 'יהיה זמין כששניכם תסכימו.', openExport: 'פתיחת גרסה להדפסה'
  },
  consent: {
    agree: 'אני מסכים/ה', agreed: 'הסכמתי ✓', theyAgreed: '{name} הסכים/ה', theyNot: '{name} עוד לא הסכים/ה',
    shareRules: 'לכלול את הכללים שלנו בתמונה', export: 'לאפשר ייצוא ל־PDF', adultExport: 'לכלול את חפיסת ה־18+ ב־PDF'
  },
  capsule: {
    title: 'קפסולת זמן', intro: 'כל אחד כותב כמה שורות כדי לפתוח יחד בהמשך. אף אחד לא יוכל לקרוא לפני התאריך, גם לא את/ה.',
    save: 'שמירת החלק שלי', update: 'עדכון החלק שלי', youWrote: 'החלק שלך נשמר',
    when: 'לפתוח בעוד', months: '{n} חודשים', theyPicked: '{name} בחר/ה {n} חודשים.',
    theyWrote: '{name} כתב/ה את החלק שלו/ה.', theyNotWrote: '{name} עוד לא כתב/ה.',
    sealRule: 'הקפסולה נחתמת כששניכם כתבתם ובחרתם אותו מועד.',
    sealedOn: 'נחתמה ב־{date}. תיפתח ב־{open}.',
    linkNote: 'הקישור האישי שלך לפתיחת הקפסולה מכל מכשיר. אל תעבירו אותו הלאה: הוא עובד רק בשבילך.',
    openTitle: 'הקפסולה נפתחה', openedNote: 'נכתבה ב־{date}.'
  },
  retake: {
    title: 'אז ועכשיו', intro: 'עברו שוב על שלב 1 של חפיסה כלשהי וראו מה השתנה, וכמה יותר טוב אתם קוראים אחד את השני.',
    now: '{deck}: לענות שוב', guess: 'עכשיו לנחש שוב את {name}', waiting: 'מחכים ל{name}…',
    compareTitle: '{deck}: אז ועכשיו', then: 'אז', nowCol: 'עכשיו', wishMatches: 'משאלות משותפות: אז {then}, עכשיו {now}.'
  },
  menu: { title: 'חדר', myRooms: 'כל החדרים שלי', expires: 'החדר נשמר עד {date} (מתארך עם פעילות).' },
  danger: {
    title: 'מחיקת החדר', text: 'מוחק את כל התשובות, ההודעות הקוליות והקפסולה לשניכם. אי אפשר לבטל.',
    delete: 'מחיקת החדר', confirmTitle: 'למחוק הכול?', confirmText: 'כל התשובות, השיחות, ההודעות הקוליות והקפסולה ייעלמו לשניכם.',
    deleted: 'החדר נמחק'
  },
  room: {
    noAccess: 'החדר הזה לא נמצא במכשיר הזה', noAccessText: 'פתחו אותו מהמכשיר שבו יצרתם או הצטרפתם, או דרך הקישור לקפסולה.',
    gone: 'החדר כבר לא קיים', goneText: 'הוא נמחק או שפג תוקפו.',
    archived: 'תוקף החדר פג והתשובות נמחקו. נשארה רק הקפסולה.'
  },
  format: { middle: 'באמצע' },
  export: { print: 'הדפסה / שמירה כ־PDF', voiceOnly: '(הודעה קולית)' },
  error: {
    generic: 'משהו השתבש. נסו שוב.', network: 'אין חיבור. בדקו את האינטרנט.',
    not_found: 'לא נמצא.', unauthorized: 'אין גישה לחדר הזה.', name_required: 'הכניסו שם.',
    decks_required: 'בחרו לפחות חפיסה אחת (לא רק את ה־18+).', adult_confirm_required: 'אשרו שאתם מעל 18 כדי לכלול את "קרובים יותר".',
    room_full: 'בחדר כבר יש שני שחקנים.', bad_value: 'התשובה לא נראית תקינה.',
    wrong_stage: 'לא זמין בשלב הזה.', frozen: 'בן/בת הזוג כבר התחילו לנחש, אז התשובות שלך נעולות.',
    incomplete: 'נשארו שאלות פתוחות.', ask_count: 'בחרו בין 5 ל־7 שאלות.',
    not_your_turn: 'זה לא התור שלך.', not_openable: 'הקלף הזה ייפתח אחר כך.', not_opened: 'הקלף עוד לא נפתח.',
    too_large: 'גדול מדי.', consent_required: 'קודם צריך הסכמה של שניכם.', sealed: 'הקפסולה כבר נחתמה.',
    rate_limited: 'יותר מדי ניסיונות. חכו דקה.', server_error: 'שגיאת שרת. נסו שוב.'
  }
};

export const STRINGS = { en, ru, he };

let lang = 'en';
const listeners = new Set();

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);
}

export function t(key, params = {}, fallback) {
  let s = lookup(STRINGS[lang], key);
  if (typeof s !== 'string') s = lookup(en, key);
  if (typeof s !== 'string') return fallback !== undefined ? fallback : key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : ''));
}

// Content objects carry { en, ru, he }.
export function loc(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.en || '';
}

export function getLang() {
  return lang;
}

function apply() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
}

export function initLang() {
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
  if (LANGS.includes(saved)) lang = saved;
  apply();
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage blocked */ }
  apply();
  listeners.forEach(fn => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function formatDate(d) {
  if (!d) return '';
  const locale = { en: 'en-GB', ru: 'ru-RU', he: 'he-IL' }[lang];
  // ru adds a trailing "г."; drop the dot so templates can end the sentence
  return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\.$/, '');
}
