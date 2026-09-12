// ============================================================
// battleEngine.js — 戦闘の計算部分（ダメージ・クリティカル・敵の攻撃）。
//
// クリティカル式は gachaRoster.js のヘッダーコメント（9/9・3回目の叩き台）
// をそのまま採用：
//   基礎ダメージ倍率 = 0.5 + P/100
//   クリティカル率   = 5% + P×0.30%
//   クリティカル倍率 = 1.8 + P×0.004
// P = 攻撃キャラの5パラメータのうち、そのステージの章に対応する1つ
//     （CHAPTER_SUBJECT、storyMap.js参照）。5パラメータはゼロサムなので
//     得意な章では輝き、不得意な章では0.7倍・クリ率11%程度に沈む
//     （9/9・3回目の設計どおり）。
//
// パーティのHPは共有1本（7/18設計の踏襲）。MVPでは1000固定。
// ============================================================

import { getStatsAtLevel } from "../data/growthCurve.js";

export const PARTY_MAX_HP = 1000;

export function subjectParam(character, subject) {
  return character?.subjects?.[subject] ?? 0;
}

/** 攻撃側のP値から、基礎倍率・クリ率・クリ倍率を返す。 */
export function critProfile(P) {
  return {
    baseMultiplier: 0.5 + P / 100,
    critChance: Math.min(0.95, 0.05 + P * 0.003),
    critMultiplier: 1.8 + P * 0.004,
  };
}

/**
 * プレイヤーの1攻撃を解決する。
 * @param {object} character GACHA_ROSTERのキャラ本体
 * @param {number} level 現在レベル
 * @param {string} subject そのステージの章に対応する系統キー
 * @param {boolean} correct 出題に正解したか
 * @param {boolean} useSkill スキルを使ったか（使うと固定1.5倍。簡易実装）
 */
export function resolvePlayerAttack(character, level, subject, correct, useSkill) {
  if (!correct) {
    return { damage: 0, isCrit: false, correct: false };
  }
  const { atk } = getStatsAtLevel(character, level);
  const P = subjectParam(character, subject);
  const { baseMultiplier, critChance, critMultiplier } = critProfile(P);
  const isCrit = Math.random() < critChance;
  let damage = atk * baseMultiplier;
  if (isCrit) damage *= critMultiplier;
  if (useSkill) damage *= 1.5;
  return { damage: Math.max(1, Math.round(damage)), isCrit, correct: true };
}

/** 敵の1攻撃（パーティ共有HPへのダメージ）。乱数で±20%のブレを持たせる。 */
export function resolveEnemyAttack(enemy) {
  const base = enemy.atk;
  const variance = 0.8 + Math.random() * 0.4;
  return Math.max(1, Math.round(base * variance));
}

// 「初回の敵から強すぎる」フィードバックへの対応（2026-09-12）。gachaRoster.jsの
// 数値はレベルMAX(上限)到達時を基準に置いていたため、レベル1の初期パーティには
// 章の後半のつもりの強さで襲いかかってきてしまっていた。章が進むほど「本来の
// 強さ」に近づくよう、早い章の敵だけ大きく弱くする（＝最初はちゃんと倒せる）。
function earlyGameScale(baseEnemy) {
  const chapterNum = baseEnemy.chapterId ? parseInt(baseEnemy.chapterId.replace("c", ""), 10) : null;
  if (!chapterNum) return 1; // 大ボス等、章に属さないものはそのまま
  if (chapterNum <= 1) return 0.4;
  if (chapterNum === 2) return 0.6;
  if (chapterNum === 3) return 0.75;
  if (chapterNum === 4) return 0.9;
  return 1;
}

/** グループ内の敵インスタンスを作る（1〜3組の雑魚は同一キャラを使い回す）。 */
export function spawnEnemyGroup(baseEnemy, groupIndex) {
  const scale = (1 + groupIndex * 0.08) * earlyGameScale(baseEnemy); // 後の組ほど少しだけ硬くする
  return {
    ...baseEnemy,
    instanceId: `${baseEnemy.id}_g${groupIndex}`,
    hp: Math.round(baseEnemy.hp * scale),
    maxHp: Math.round(baseEnemy.hp * scale),
    atk: Math.round(baseEnemy.atk * scale),
  };
}

export function spawnBoss(bossEntry) {
  const scale = earlyGameScale(bossEntry);
  return {
    ...bossEntry,
    instanceId: `${bossEntry.id}_boss`,
    hp: Math.round(bossEntry.hp * scale),
    maxHp: Math.round(bossEntry.hp * scale),
    atk: Math.round(bossEntry.atk * scale),
  };
}
