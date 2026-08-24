// No external audio file needed — generates a short two-note chime in the
// browser. Browsers block audio until the user has interacted with the
// page at least once; that's a browser rule, not a bug, and resolves
// itself silently after their first click/tap.
let audioCtx = null;

function getContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

const TONES = {
  default: [880, 1108],
  reminder: [660, 880],
  upload: [988, 1318],
  storage: [740, 880],
  collection: [880, 988],
  digest: [660, 784],
  security: [523, 440],
};

export function playNotificationSound(kind = "default") {
  try {
    const ctx = getContext();
    const notes = TONES[kind] || TONES.default;
    const noteDuration = 0.12;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;

      const startTime = ctx.currentTime + i * noteDuration;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);

      osc.connect(gain).connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + noteDuration);
    });
  } catch (err) {
    console.warn("Notification sound skipped:", err.message);
  }
}
