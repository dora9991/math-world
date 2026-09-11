// ============================================================
// gacha.js — 「小単元ごとの、その単元のガチャ」を引く。
//
// プール＝そのchapterIdに属するGACHA_ROSTER全件（雑魚〜裏ボス格まで）。
// N/R/SR/URがそのまま混ざっているので、レア度の幅は自動的に出る
// （kindによる「仲間にできる/できない」の絞り込みはあえて入れていない。
//  9/9のgachaRoster.js自体が「N/R/SR/UR」への再編集を目的にしていたため、
//  今回のkazuの指示「小単元ごとにその単元のガチャが引ける」を素直に
//  実装するなら、章の全キャラがプールになるのが一番自然、という判断。
//  #todo 章ボス・裏ボス格を仲間にできてよいかはkazu確認）
// ============================================================

import { getChapterGachaPool } from "../data/storyMap.js";

export function pullGacha(grade, chapterId) {
  const pool = getChapterGachaPool(grade, chapterId);
  if (pool.length === 0) return null;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

export function pullGachaMultiple(grade, chapterId, times) {
  const results = [];
  for (let i = 0; i < times; i++) {
    const r = pullGacha(grade, chapterId);
    if (r) results.push(r);
  }
  return results;
}
