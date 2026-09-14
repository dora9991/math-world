// ============================================================
// mathLaboRng.js — 数学ラボ2 の src/engine/rng.js から必要な部分だけコピー。
// mathLaboProblems/ 配下の build(r) が呼ぶ r(min,max) はこれ。
// ============================================================

/** min 以上 max 以下の整数をランダムに返す */
export function rng(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
