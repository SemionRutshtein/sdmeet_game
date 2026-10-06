// Voice notes: record with MediaRecorder, upload encrypted-at-rest, play back
// through an authenticated fetch (an <audio src> can't send the token).
import { h, mount, toast } from './dom.js';
import { t } from './i18n.js';

const MAX_MS = 2 * 60 * 1000;
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];

export const canRecord = () => typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export function voicePlayer(api, voiceId) {
  const audio = h('audio', { controls: true, preload: 'metadata' });
  api.voiceUrl(voiceId).then(url => { audio.src = url; }).catch(() => audio.replaceWith(h('span', { class: 'muted small' }, t('voice.unavailable'))));
  return audio;
}

// context: { kind: 'self', qkey } | { kind: 'reply', askedId } | { kind: 'thread', cardKey }
export function voiceRecorder({ api, context, voiceId, onChange, compact = false }) {
  const root = h('div', { class: 'voice' });
  let recorder = null;
  let stream = null;
  let started = 0;
  let tick = null;

  const stopAll = () => {
    clearInterval(tick);
    stream?.getTracks().forEach(tr => tr.stop());
    stream = null;
  };

  function renderIdle() {
    if (voiceId) {
      mount(root,
        voicePlayer(api, voiceId),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { voiceId = null; onChange(null); renderIdle(); } }, t('voice.remove'))
      );
      return;
    }
    if (!canRecord()) {
      mount(root);
      return;
    }
    mount(root, h('button', { type: 'button', class: 'btn ghost small', onclick: start }, '🎙 ', compact ? '' : t('voice.record')));
  }

  async function start() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast(t('voice.noMic'));
      return;
    }
    const mimeType = TYPES.find(x => MediaRecorder.isTypeSupported?.(x));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      const ms = Date.now() - started;
      stopAll();
      const blob = new Blob(chunks, { type: (recorder.mimeType || mimeType || 'audio/webm') });
      mount(root, h('span', { class: 'muted small' }, t('voice.saving')));
      try {
        const res = await api.uploadVoice(blob, context, ms);
        voiceId = res.voiceId;
        onChange(voiceId);
      } catch (e) {
        toast(t(`error.${e.code}`, {}, t('error.generic')));
      }
      renderIdle();
    };
    started = Date.now();
    recorder.start();
    const timer = h('span', { class: 'small' }, '0:00');
    tick = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (Date.now() - started >= MAX_MS) recorder.stop();
    }, 250);
    mount(root,
      h('span', { class: 'rec-dot' }),
      timer,
      h('button', { type: 'button', class: 'btn primary small', onclick: () => recorder.state !== 'inactive' && recorder.stop() }, t('voice.stop')),
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => { recorder.onstop = null; recorder.stop(); stopAll(); renderIdle(); } }, t('common.cancel'))
    );
  }

  renderIdle();
  return root;
}
