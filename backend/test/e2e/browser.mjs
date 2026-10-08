// Browser end-to-end: two players in two browser contexts play a full game
// through the real UI (all four decks), including voice notes, the double
// lock, the map, export, share image and the capsule. Screenshots go to
// E2E_OUT (default ./e2e-shots).
//
//   BASE_URL=http://localhost:3000 node test/e2e/browser.mjs
//
// Uses playwright-core with the Chromium at CHROMIUM_PATH (or Playwright's default).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.E2E_OUT || path.resolve('e2e-shots');
const EXE = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
});
const errors = [];
async function newPlayer(label, viewport) {
  const ctx = await browser.newContext({ viewport, permissions: ['microphone', 'clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
  page.label = label;
  return page;
}
const shot = async (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
const step = msg => console.log(`• ${msg}`);

const A = await newPlayer('A', { width: 1100, height: 900 });
const B = await newPlayer('B', { width: 390, height: 844 }); // phone

// ---------- home / create ----------
step('A creates a room with all four decks (English)');
await A.goto(BASE);
await A.waitForSelector('text=Create a room');
await A.waitForSelector('.demo .scene .phone'); // animated walkthrough on the home screen
await shot(A, '01-home-en');
await A.fill('input[autocomplete="given-name"]', 'Ana');
for (const title of ['Six Hours of Silence', 'Closer (18+)']) await A.click(`label.check:has-text("${title}")`);
await A.click('label.check:has-text("I\'m 18+")');
await A.click('button:has-text("Create a room")');
await A.waitForURL(/\/room\//);
const roomUrl = A.url();
const roomId = roomUrl.split('/room/')[1];
await A.waitForSelector('.journey'); // briefing before stage 1
await A.waitForSelector('.copy-box code');
const invite = await A.textContent('.copy-box code');
assert.ok(invite.endsWith(`/join/${roomId}`));
await shot(A, '02-briefing');
await A.click('.sticky-cta .btn');
await A.waitForSelector('.wizard .deck-intro');

// ---------- join in Hebrew ----------
step('B opens the invite, switches to Hebrew, joins and opts into 18+');
await B.goto(invite);
await B.click('.lang-switch button:has-text("HE")');
assert.equal(await B.getAttribute('html', 'dir'), 'rtl');
await B.fill('input[autocomplete="given-name"]', 'Ben');
await B.click('label.check');
await shot(B, '03-join-he');
await B.click('button.btn.primary');
await B.waitForURL(/\/room\//);
await B.waitForSelector('.journey');
await B.click('.sticky-cta .btn');
await B.waitForSelector('.wizard');

// ---------- generic wizard filler ----------
async function fillStep(page, variant) {
  const card = page.locator('.wizard .card');
  await card.waitFor();
  const pick = variant ? 1 : 0;
  if (await card.locator('.weather-grid').count()) await card.locator('.weather-grid .opt').nth(pick).click();
  if (await card.locator('.scale').count()) await card.locator('.scale .opt').nth(variant ? 6 : 2).click();
  const range = card.locator('input[type=range]');
  if (await range.count()) await range.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, variant ? 90 : 20);
  if (await card.locator('.wish-row').count()) {
    const rows = await card.locator('.wish-row').count();
    for (let i = 0; i < rows; i++) await card.locator('.wish-row').nth(i).locator('.seg button').nth((i + pick) % 3).click();
  }
  // rank: tap in order until the widget stops accepting
  let rankOpts = card.locator('.opt:has(.rank-num)');
  const nRank = await rankOpts.count();
  if (nRank) {
    for (let i = 0; i < nRank; i++) {
      const idx = variant ? nRank - 1 - i : i;
      await card.locator('.opt:has(.rank-num)').nth(idx).click();
    }
  }
  // remaining option groups (choice / multi / scene parts)
  const groups = card.locator('.options:not(:has(.rank-num))');
  const nGroups = await groups.count();
  for (let g = 0; g < nGroups; g++) {
    const grp = card.locator('.options:not(:has(.rank-num))').nth(g);
    if (await grp.locator('.opt[aria-pressed="true"]').count()) continue;
    const opts = grp.locator('.opt');
    const n = await opts.count();
    await opts.nth(Math.min(pick, n - 1)).click();
  }
  const labels = card.locator('.labels-bar .seg button');
  if (await labels.count()) await labels.nth(variant ? 2 : 0).click();
  const texts = card.locator('textarea, input[type=text]');
  const nTexts = await texts.count();
  for (let i = 0; i < nTexts; i++) {
    const el = texts.nth(i);
    if (!(await el.inputValue())) await el.fill(`${page.label} answer ${i}`);
  }
}

async function runWizard(page, variant, { voiceOnFirstText = false, passEvery = 0 } = {}) {
  let n = 0;
  let didVoice = false;
  for (;;) {
    // deck intros / framing cards: read, then continue
    if (await page.locator('.wizard .intro-card').count()) {
      await page.click('.wizard .intro-card .btn.primary');
      await page.waitForSelector('.wizard .question-card, .wizard .intro-card:not(:has(.btn.primary[disabled]))');
      await page.waitForFunction(() => document.querySelector('.wizard .question-card'), null, { timeout: 5000 }).catch(() => {});
      continue;
    }
    const counter = await page.locator('.wizard .counter-q').first().textContent();
    const [cur, total] = counter.split('/').map(s => parseInt(s.trim(), 10));
    if (passEvery && n > 0 && n % passEvery === 0 && cur < total) {
      await page.click('.wizard-nav button:nth-child(2)');
    } else {
      await fillStep(page, variant);
      if (voiceOnFirstText && !didVoice && await page.locator('.wizard .voice button').count()) {
        await page.click('.wizard .voice button');
        await page.waitForTimeout(1200);
        await page.click('.wizard .voice .btn.primary');
        await page.waitForSelector('.wizard .voice audio', { timeout: 10000 });
        didVoice = true;
      }
      const next = page.locator('.wizard-nav .btn.primary');
      if (await next.isDisabled()) {
        await shot(page, `stuck-${page.label}`);
        throw new Error(`${page.label}: Next disabled at step ${counter}`);
      }
      await next.click();
    }
    n++;
    if (cur === total) break;
    await page.waitForFunction(prev => document.querySelector('.wizard .intro-card') || document.querySelector('.wizard .counter-q')?.textContent !== prev, counter);
  }
  return { didVoice };
}

// ---------- stage 1 ----------
step('Stage 1: both answer about themselves (A records a voice note)');
const v1 = await runWizard(A, 0, { voiceOnFirstText: true });
assert.ok(v1.didVoice, 'voice note recorded in stage 1');
await A.waitForSelector('text=Questions for your partner');
await shot(A, '04-stage2-en');
await runWizard(B, 1, { passEvery: 13 });
await B.waitForSelector('.check');

// ---------- stage 2 ----------
async function stage2(page, customText) {
  const boxes = page.locator('label.check input[type=checkbox]');
  for (let i = 0; i < 5; i++) await boxes.nth(i * 3).check();
  await page.fill('.card input[type=text]', customText);
  await page.click('.card button.btn.ghost.small:below(input[type=text])');
  await page.click('.card .btn.primary.block');
}
step('Stage 2: both pick questions (A adds a locked custom one)');
await A.locator('.card:has(input[type=text]) input[type=checkbox]').check();
await stage2(A, 'What do you hum when nobody is listening?');
await A.waitForSelector('.dot.pulse');
await shot(A, '05-waiting-en');
await stage2(B, 'מה הדבר הראשון ששמת לב אליו אצלי?');
await B.waitForSelector('.wizard');

// ---------- stage 3 ----------
step('Stage 3: answer partner questions and guess');
await A.waitForSelector('.wizard', { timeout: 15000 });
await shot(A, '06-stage3-en');
await runWizard(A, 1);
await A.waitForSelector('.dot.pulse');
await shot(B, '07-stage3-he');
await runWizard(B, 0);

// ---------- reveal ----------
step('Reveal: take turns opening every card');
for (const p of [A, B]) {
  await p.waitForSelector('.agreements', { timeout: 15000 }); // spoken agreements before the board
  await p.click('.sticky-cta .btn');
}
await A.waitForSelector('.board-grid', { timeout: 15000 });
await B.waitForSelector('.board-grid', { timeout: 15000 });
await shot(A, '08-board-en');
await shot(B, '09-board-he');

async function closeSheets() {
  for (const p of [A, B]) {
    while (await p.locator('.sheet').count()) {
      await p.keyboard.press('Escape');
      await p.waitForTimeout(50);
    }
  }
}

let opened = 0;
let sawLock = false;
let sawClimate = false;
for (let guard = 0; guard < 200; guard++) {
  await closeSheets();
  const mover = (await A.locator('.turn-banner.mine .dot.on').count()) ? A : (await B.locator('.turn-banner.mine .dot.on').count()) ? B : null;
  if (!mover) {
    if (await A.locator('text=Every card is open').count()) break;
    await A.waitForTimeout(200);
    continue;
  }
  const other = mover === A ? B : A;
  const tile = mover.locator('.tile.openable').first();
  if (!(await tile.count())) throw new Error('no openable tile on the mover');
  await tile.click();
  await mover.waitForSelector('.sheet h2');
  await other.waitForSelector('.sheet h2', { timeout: 10000 }); // pops up for the partner too
  opened++;
  if (!sawClimate && await mover.locator('.sheet .climate').count()) {
    sawClimate = true;
    await shot(mover, '10-card-climate');
    await shot(other, '11-card-climate-other');
  }
  if (await mover.locator('.sheet .lock-box').count()) {
    if (!sawLock) await shot(mover, '12-lock');
    await mover.click('.sheet .lock-box .btn.primary');
    await other.waitForSelector('.sheet .lock-box');
    await other.click('.sheet .lock-box .btn.primary');
    await other.waitForSelector('.sheet .talk', { timeout: 10000 });
    sawLock = true;
  }
  await mover.waitForFunction(() => !document.querySelector('.turn-banner.mine .dot.on') || document.querySelector('.turn-banner.mine:not(:has(.dot))'), null, { timeout: 10000 }).catch(() => {});
}
assert.ok(sawLock, 'locked card was shown after both pressed');
assert.ok(sawClimate, 'climate card opened');
console.log(`  opened ${opened} cards`);
await closeSheets();
await shot(A, '13-board-done');

// ---------- thread, voice, rule ----------
step('Thread: text + voice, mark as rule');
await A.locator('.tile.opened').nth(1).click();
await A.fill('.sheet .composer textarea', 'Let\'s talk about this one');
await A.click('.sheet .composer .btn.primary');
await A.waitForSelector('.sheet .msg.mine');
await A.click('.sheet .thread > .voice button');
await A.waitForTimeout(1200);
await A.click('.sheet .thread .voice .btn.primary');
await A.waitForSelector('.sheet .msg audio', { timeout: 10000 });
await A.click('.sheet .actions button:nth-child(3)');
await A.fill('.sheet input[type=text]', 'We call instead of texting when it matters');
await A.click('.sheet .row .btn.primary');
await A.waitForSelector('.sheet .rule-item');
await shot(A, '14-card-thread');
await B.locator('.tile.opened').nth(1).click();
await B.waitForSelector('.sheet .msg audio');
const src = await B.getAttribute('.sheet .msg audio', 'src', { timeout: 10000 });
assert.ok(src?.startsWith('blob:'), 'partner can load the voice note');
await shot(B, '15-card-thread-he');
await closeSheets();

// ---------- map ----------
step('Our map: accuracy, rules, share image, export consent, capsule');
await A.click('.tabs button:nth-child(2)');
await A.waitForSelector('.stat .bar');
await B.click('.tabs button:nth-child(2)');
await B.waitForSelector('.stat .bar');
assert.ok(await A.locator('.rule-item:has-text("We call instead")').count());
await A.click('button:has-text("Make the image")');
await A.waitForSelector('img.share-preview');
await shot(A, '16-map-en');
// export: both agree
await A.click('.card:has-text("Export to PDF") .consent-row button');
await B.click('.card:has-text("PDF") .consent-row button >> nth=0');
await A.waitForSelector('a:has-text("Open printable version")', { timeout: 10000 });
const exportPage = await A.context().newPage();
await exportPage.goto(`${BASE}/room/${roomId}/export`);
await exportPage.waitForSelector('h1');
const exportText = await exportPage.textContent('body');
assert.ok(!exportText.includes('Closer'), '18+ deck not in export without consent');
await exportPage.screenshot({ path: path.join(OUT, '17-export.png'), fullPage: true });
await exportPage.close();
// capsule
for (const [p, txt] of [[A, 'Your patience'], [B, 'הצחוק שלך']]) {
  const tas = p.locator('.card:has(.seg) textarea');
  const n = await tas.count();
  for (let i = 0; i < n; i++) await tas.nth(i).fill(`${txt} ${i}`);
  await p.locator('.card:has(.seg) .btn.primary').first().click();
  await p.locator('.card:has(.seg) .seg button').first().click();
}
await A.waitForSelector('text=Sealed on', { timeout: 10000 });
await shot(A, '18-capsule-sealed');
await shot(B, '19-map-he');

// ---------- capsule opens (CAPSULE_UNIT=minutes makes 3 "months" = 3 minutes) ----------
if (process.env.E2E_WAIT_CAPSULE) {
  step('Waiting for the capsule to open (server must run with CAPSULE_UNIT=minutes)…');
  const waitOpen = async p => {
    for (let i = 0; i < 50; i++) {
      await p.reload();
      await p.click('.tabs button:nth-child(2)');
      if (await p.waitForSelector('.answers .answer-box', { timeout: 3000 }).catch(() => null) && await p.locator('h3:has-text("📬")').count()) return;
      await p.waitForTimeout(5000);
    }
    throw new Error('capsule never opened');
  };
  await waitOpen(A);
  await waitOpen(B);
  await shot(A, '18b-capsule-open');
  step('Retake deck 1 and compare then / now');
  await A.click('.card button.btn.ghost:has-text("No Gloss")');
  await A.waitForSelector('.card .wizard');
  await B.waitForSelector('.card .wizard', { timeout: 10000 }).catch(async () => { await B.reload(); await B.click('.tabs button:nth-child(2)'); await B.waitForSelector('.card .wizard'); });
  await runWizard(A, 1);
  await runWizard(B, 0);
  for (const p of [A, B]) {
    await p.waitForSelector('.card .wizard', { timeout: 10000 }).catch(async () => { await p.reload(); await p.click('.tabs button:nth-child(2)'); await p.waitForSelector('.card .wizard'); });
  }
  await runWizard(A, 0);
  await runWizard(B, 1);
  for (const p of [A, B]) {
    await p.waitForSelector('.then-now', { timeout: 10000 }).catch(async () => { await p.reload(); await p.click('.tabs button:nth-child(2)'); await p.waitForSelector('.then-now'); });
  }
  await shot(A, '18c-then-now');
}

// ---------- delete ----------
step('B deletes the room; A is told it is gone');
const errorsBeforeDelete = errors.length; // the 401s after deletion are expected
await B.click('button.btn.danger');
await B.click('.sheet .btn.danger');
await B.waitForURL(BASE + '/');
await A.waitForSelector('text=This room is gone', { timeout: 10000 });
await shot(A, '20-gone');

await browser.close();
const unexpected = [...errors.slice(0, errorsBeforeDelete), ...errors.slice(errorsBeforeDelete).filter(e => !e.includes('401'))];
if (unexpected.length) {
  console.log('Browser errors:\n  ' + unexpected.join('\n  '));
  process.exitCode = 1;
} else {
  console.log('✓ e2e passed, screenshots in', OUT);
}
