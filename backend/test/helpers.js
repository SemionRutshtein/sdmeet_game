// Shared test helpers: a running server on a throwaway database, and
// generators for valid answers to any question type.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://sdmeet:sdmeet@localhost:5432/sdmeet_test';
process.env.NODE_ENV = 'test';

const prisma = require('../src/db');
const { migrate } = require('../prisma/migrate');
const { createApp } = require('../src/index');
const { initKeys } = require('../src/crypto');

async function startServer() {
  await migrate(prisma);
  await prisma.$executeRawUnsafe('TRUNCATE "sd_rooms" CASCADE');
  await initKeys(prisma);
  const { httpServer, io } = createApp();
  await new Promise(r => httpServer.listen(0, r));
  const base = `http://127.0.0.1:${httpServer.address().port}`;
  const stop = async () => {
    io.close();
    await new Promise(r => httpServer.close(r));
    await prisma.$disconnect();
  };
  return { base, stop };
}

function client(base, token) {
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body === undefined ? undefined : body instanceof Buffer ? body : JSON.stringify(body)
    });
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data };
  };
  return {
    get: p => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    put: (p, b) => call('PUT', p, b),
    del: p => call('DELETE', p),
    raw: (p, buf, type) => call('POST', p, buf, { 'Content-Type': type })
  };
}

// variant 0/1 lets two players answer differently
function sampleSelf(q, deck, wishlist, variant = 0) {
  const opt = i => q.options[(i + variant) % q.options.length].id;
  switch (q.type) {
    case 'choice': {
      const o = q.options.find(x => !x.custom && x.id === opt(0)) ? opt(0) : q.options[0].id;
      const v = { option: o };
      if (q.followup) v.followup = 'some thoughts';
      return v;
    }
    case 'multi': return { options: q.options.filter(o => !o.exclusive).slice(variant, variant + 2).map(o => o.id) };
    case 'rank': {
      const ids = q.options.map(o => o.id);
      const shift = variant ? Math.floor(ids.length / 3) : 0;
      const rotated = ids.slice(shift).concat(ids.slice(0, shift));
      return { order: rotated.slice(0, q.pick || ids.length) };
    }
    case 'scale': return { value: variant ? q.max : q.min };
    case 'slider': return { value: variant ? 90 : 10 };
    case 'text': return { text: `answer ${variant}` };
    case 'weather': return { icon: opt(0), phrase: 'grey and quiet' };
    case 'scene': {
      const f = deck.sceneFields;
      return variant
        ? { feel: ['anxiety', 'fear'], do: 'call', want: 'reply soon' }
        : { feel: ['relief'], do: 'shut-down', want: 'space' };
    }
    case 'wishlist': {
      const items = {};
      wishlist.forEach((w, i) => { items[w.id] = ['yes', 'maybe', 'no'][(i + variant) % 3]; });
      return { items };
    }
  }
  throw new Error(`no sample for ${q.type}`);
}

// a guess that matches what sampleSelf(variant) produced
function sampleGuess(q, deck, actual) {
  switch (q.type) {
    case 'choice': return { option: actual.option };
    case 'rank': return { option: actual.order[0] };
    case 'multi': return { options: actual.options };
    case 'scale': return { value: actual.value };
    case 'weather': return { icon: actual.icon };
    case 'scene': return { feel: actual.feel, do: actual.do };
  }
  throw new Error(`no guess for ${q.type}`);
}

module.exports = { startServer, client, sampleSelf, sampleGuess, prisma };
