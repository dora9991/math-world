// ============================================================
// sound.js — 効果音（Web Audio APIでその場合成、音素材ファイルは使わない）。
//
// 2026-09-12：「正解/不正解の音、攻撃の発射音・着弾音を付けたい。ブラウザでは
//   限界があるか？」への回答：**限界はない。** Web Audio APIはこの用途
//   （短い効果音を低遅延で重ねて鳴らす）には十分すぎる性能があり、
//   ここまでのエフェクト同様、波形をコードで合成すれば音素材(mp3/wav)は
//   一切不要——無料・追加アセットゼロという、これまでの方針とも一致する。
//
//   唯一の制約は「ブラウザの自動再生ポリシー」：ユーザー操作（タップ/
//   クリック）より前に音を鳴らすことはできない。このアプリはタイトル
//   画面のタップから始まるので実質問題にならないが、念のため毎回の
//   再生関数の中でAudioContextをresume()している。
// ============================================================

let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** タイトル画面のタップ等、最初のユーザー操作で呼ぶと以後の再生が確実になる。 */
export function unlockAudio() {
  getCtx();
}

function envGain(audioCtx, { attack = 0.005, peak = 0.5, decay = 0.15, delay = 0 } = {}) {
  const g = audioCtx.createGain();
  const t0 = audioCtx.currentTime + delay;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay);
  return g;
}

function tone(audioCtx, { freq, endFreq, type = "sine", duration = 0.15, gain = 0.5, delay = 0 }) {
  const osc = audioCtx.createOscillator();
  osc.type = type;
  const t0 = audioCtx.currentTime + delay;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
  const g = envGain(audioCtx, { attack: 0.005, peak: gain, decay: duration, delay });
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noiseBurst(audioCtx, { duration = 0.15, gain = 0.4, filterFreq = 1200, filterType = "bandpass", delay = 0 }) {
  const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;

  const g = envGain(audioCtx, { attack: 0.003, peak: gain, decay: duration, delay });

  src.connect(filter);
  filter.connect(g);
  g.connect(audioCtx.destination);

  const t0 = audioCtx.currentTime + delay;
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

/** 正解：明るい上昇2音（ピンポン）。 */
export function playCorrectSound() {
  const c = getCtx();
  if (!c) return;
  tone(c, { freq: 660, type: "triangle", duration: 0.09, gain: 0.35 });
  tone(c, { freq: 880, type: "triangle", duration: 0.14, gain: 0.4, delay: 0.08 });
}

/** 不正解：低いブザー音。 */
export function playIncorrectSound() {
  const c = getCtx();
  if (!c) return;
  tone(c, { freq: 220, endFreq: 140, type: "sawtooth", duration: 0.22, gain: 0.3 });
}

/** 攻撃の発射音（たまが飛び出す瞬間）。クリティカル狙い時は気持ち鋭く。 */
export function playLaunchSound({ crit = false } = {}) {
  const c = getCtx();
  if (!c) return;
  noiseBurst(c, {
    duration: crit ? 0.16 : 0.12,
    gain: crit ? 0.32 : 0.22,
    filterFreq: crit ? 2600 : 2000,
    filterType: "highpass",
  });
  tone(c, { freq: crit ? 900 : 700, endFreq: crit ? 300 : 260, type: "sine", duration: 0.12, gain: 0.15 });
}

/** 着弾音（たまが当たった瞬間）。クリティカルはより低く・大きく＝重い一撃。 */
export function playImpactSound({ crit = false } = {}) {
  const c = getCtx();
  if (!c) return;
  tone(c, { freq: crit ? 130 : 170, endFreq: crit ? 55 : 80, type: "sine", duration: crit ? 0.28 : 0.16, gain: crit ? 0.55 : 0.4 });
  noiseBurst(c, {
    duration: crit ? 0.22 : 0.14,
    gain: crit ? 0.4 : 0.28,
    filterFreq: crit ? 900 : 1400,
    filterType: "bandpass",
  });
  if (crit) {
    // 追加の高音のきらめき（クリティカルのみ）
    tone(c, { freq: 1400, type: "triangle", duration: 0.12, gain: 0.18, delay: 0.03 });
  }
}

/** ミス（たまが届かず失速）の、こもった軽い音。 */
export function playMissSound() {
  const c = getCtx();
  if (!c) return;
  noiseBurst(c, { duration: 0.18, gain: 0.18, filterFreq: 500, filterType: "lowpass" });
}

/** 敵の反撃（引っ掻き）音。低いうなり＋ひっかくようなノイズ。 */
export function playEnemyHitSound() {
  const c = getCtx();
  if (!c) return;
  tone(c, { freq: 180, endFreq: 90, type: "sawtooth", duration: 0.2, gain: 0.28 });
  noiseBurst(c, { duration: 0.22, gain: 0.32, filterFreq: 2200, filterType: "highpass", delay: 0.02 });
  noiseBurst(c, { duration: 0.16, gain: 0.22, filterFreq: 3200, filterType: "highpass", delay: 0.1 });
}

/** 撃破音（華やかに）。 */
export function playDefeatSound() {
  const c = getCtx();
  if (!c) return;
  tone(c, { freq: 520, type: "triangle", duration: 0.12, gain: 0.35 });
  tone(c, { freq: 780, type: "triangle", duration: 0.14, gain: 0.4, delay: 0.09 });
  tone(c, { freq: 1040, type: "triangle", duration: 0.22, gain: 0.45, delay: 0.18 });
  noiseBurst(c, { duration: 0.3, gain: 0.3, filterFreq: 1200, filterType: "bandpass", delay: 0.18 });
}
