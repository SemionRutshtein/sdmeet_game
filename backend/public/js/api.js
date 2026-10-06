// HTTP client + where tokens live. A token is the only key to a seat in a
// room, so it stays in this browser's localStorage and nowhere else.
const KEY = 'sdmeet2.sessions';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // private mode etc.: the session lives only as long as the tab
  }
}

const memory = {};

export const sessions = {
  all() {
    return { ...readAll(), ...memory };
  },
  get(roomId) {
    return memory[roomId] || readAll()[roomId] || null;
  },
  set(roomId, session) {
    memory[roomId] = session;
    writeAll({ ...readAll(), [roomId]: session });
  },
  remove(roomId) {
    delete memory[roomId];
    const all = readAll();
    delete all[roomId];
    writeAll(all);
  }
};

export class ApiError extends Error {
  constructor(status, code, details) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, { body, token, raw, contentType } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (raw) {
    payload = raw;
    headers['Content-Type'] = contentType;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'network');
  }
  const type = res.headers.get('content-type') || '';
  if (!res.ok) {
    const data = type.includes('json') ? await res.json().catch(() => ({})) : {};
    throw new ApiError(res.status, data.error || 'server_error', data.details);
  }
  if (type.includes('json')) return res.json();
  return res.blob();
}

export const publicApi = {
  content: () => request('GET', '/api/content'),
  createRoom: body => request('POST', '/api/rooms', { body }),
  roomInfo: id => request('GET', `/api/rooms/${encodeURIComponent(id)}/public`),
  join: (id, body) => request('POST', `/api/rooms/${encodeURIComponent(id)}/join`, { body })
};

export function roomApi(token) {
  const call = (method, path, body) => request(method, path, { body, token });
  const card = key => `/api/cards/${encodeURIComponent(key)}`;
  const voiceCache = new Map();
  return {
    token,
    state: () => call('GET', '/api/state'),
    saveAnswer: body => call('PUT', '/api/answers', body),
    complete: stage => call('POST', `/api/stages/${stage}/complete`),
    submitAsked: items => call('POST', '/api/asked', { items }),
    card: key => call('GET', card(key)),
    openCard: key => call('POST', `${card(key)}/open`),
    showCard: key => call('POST', `${card(key)}/show`),
    cardStatus: (key, status, rule) => call('POST', `${card(key)}/status`, { status, rule }),
    message: (key, body) => call('POST', `${card(key)}/messages`, body),
    summary: () => call('GET', '/api/summary'),
    consent: (type, value) => call('POST', '/api/consents', { type, value }),
    exportData: () => call('GET', '/api/export'),
    capsuleEntry: answers => call('PUT', '/api/capsule/entry', { answers }),
    capsuleMonths: months => call('PUT', '/api/capsule/months', { months }),
    retake: deckId => call('POST', '/api/capsule/retake', { deckId }),
    compare: () => call('GET', '/api/capsule/compare'),
    deleteRoom: () => call('DELETE', '/api/room'),
    uploadVoice(blob, context, durationMs) {
      const qs = new URLSearchParams({ ...context, durationMs: String(Math.round(durationMs)) });
      return request('POST', `/api/voice?${qs}`, { token, raw: blob, contentType: blob.type || 'audio/webm' });
    },
    async voiceUrl(id) {
      if (!voiceCache.has(id)) {
        voiceCache.set(id, request('GET', `/api/voice/${encodeURIComponent(id)}`, { token }).then(b => URL.createObjectURL(b)));
      }
      return voiceCache.get(id);
    }
  };
}
