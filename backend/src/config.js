const int = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

module.exports = {
  port: int(process.env.PORT, 3000),
  roomTtlDays: int(process.env.ROOM_TTL_DAYS, 30),
  // "months" in production; "minutes" makes capsules testable
  capsuleUnit: process.env.CAPSULE_UNIT === 'minutes' ? 'minutes' : 'months',
  askMin: 5,
  askMax: 7,
  voiceMaxBytes: int(process.env.VOICE_MAX_BYTES, 3 * 1024 * 1024),
  voiceMaxMs: 3 * 60 * 1000,
  purgeEveryMs: 60 * 60 * 1000
};
