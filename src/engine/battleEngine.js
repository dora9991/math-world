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
// 【2026-09-17時点でも「敵のATK」だけはこの単純な式のまま】：敵から受けるダメージは
// PARTY_MAX_HP(1000固定)に対する割合で決まるべきもので、下のhpScaleのように
// 章が進むごとに何十倍にもしてしまうと即死する。ATKの再調整は今回のスコープ外。
function earlyGameScale(baseEnemy) {
  // 中1(c1〜c7)だけを対象にした式（元々の設計のまま）。中2・中3(g2c*/g3c*)や
  // 大ボス等(chapterIdなし)は対象外＝フルパワー(1)を返す。
  const m = baseEnemy.chapterId ? /^c(\d+)$/.exec(baseEnemy.chapterId) : null;
  if (!m) return 1;
  const chapterNum = parseInt(m[1], 10);
  if (chapterNum <= 1) return 0.4;
  if (chapterNum === 2) return 0.6;
  if (chapterNum === 3) return 0.75;
  if (chapterNum === 4) return 0.9;
  return 1;
}

// ============================================================
// 2026-09-17：「敵の強さのバランスを取りたい」への対応（HPのみ）。
//
// kazu指定の3つのベンチマーク（すべて「普通」難易度、パーティ5体、対象は
// 単体の敵1体に全火力が入る前提）から、敵HPの章ごとのスケールを逆算した：
//   ①最初の頃(中1第1章・スターター3体Lv1)   ：雑魚=3回で撃破、ボス=5回で撃破
//   ②計算の単元の最後(中1第2章・R個体値MAX5体)：雑魚=4回で撃破、ボス=10回で撃破
//   ③中1第7章の章ボス(SR個体値MAX5体)         ：雑魚=5回で撃破、ボス=20回で撃破
//
// battleEngine.js内のクリティカル式で1ラウンド(全員1回ずつ攻撃)の期待ダメージ合計を
// 計算し、「期待ダメージ×狙った撃破回数＝目標HP」から、gachaRoster.jsの生HP値に
// 対する倍率(スケール)を3点(章1・章2・章7)で算出。①→②の間はレア度も1個体しか
// 上がらないのに全体火力が約26倍に跳ね上がる（Lv1→Lv40のレベル差・N→Rのレア度差・
// 専門化されたP値によるクリ率/クリ倍率の複利的な伸びが重なるため）ので、章1→章2は
// そのまま実測値を採用し、章2→章7の5ステップ分だけ等比数列でなめらかに補間した
// （雑魚は1章あたり×1.10、章ボスは×1.245、小ボスは×1.21）。中2・中3は明示的な
// ベンチマークが無いため、この等比成長をそのまま延長してある（#todo 中2・3は
// 実測して調整）。算出の詳細は /private/tmp配下のスクラッチパッドのbalance_fit.mjs
// を参照（このコミット時点のセッションのスクラッチパッドなので後から追えない点に注意）。
// ============================================================

// c1〜c7→1〜7、g2c1〜g2c6→8〜13、g3c1〜g3c8→14〜21 の通し位置に変換。
// 章にひもづかない(finalBoss等)場合はnullを返す。
function chapterPosition(chapterId) {
  if (!chapterId) return null;
  let m = /^c(\d+)$/.exec(chapterId);
  if (m) return parseInt(m[1], 10);
  m = /^g2c(\d+)$/.exec(chapterId);
  if (m) return 7 + parseInt(m[1], 10);
  m = /^g3c(\d+)$/.exec(chapterId);
  if (m) return 13 + parseInt(m[1], 10);
  return null;
}
// 学年ごとの最終位置（finalBossの位置算出に使う）。
const GRADE_LAST_POSITION = { 1: 7, 2: 13, 3: 21 };

// pos<=1は実測値そのまま、pos>=2は章2の実測値を起点に等比成長でなめらかに繋ぐ。
function scaleCurve(scaleAt1, scaleAt2, growthRate) {
  return (pos) => (pos <= 1 ? scaleAt1 : scaleAt2 * Math.pow(growthRate, pos - 2));
}
const mobHpScaleCurve = scaleCurve(0.766, 27.58, 1.1035);
const smallBossHpScaleCurve = scaleCurve(0.728, 31.17, 1.2105);
const chapterBossHpScaleCurve = scaleCurve(0.825, 42.96, 1.245);
// 大ボス(kind="unitBoss"、現状バトルには未登場)は章ボスよりさらに一段強い、の目安。
const UNIT_BOSS_HP_MULT = 1.15;
// 学年の最終ボス(数学の魔王等)は、その学年最終章の章ボスよりさらに一段強い、の目安。
const FINAL_BOSS_HP_MULT = 1.3;

/** そのgachaRosterエンティティのHPに掛けるスケール（kindで雑魚/小ボス/章ボス等を判定）。 */
function hpScaleFor(entry) {
  if (entry.kind === "finalBoss") {
    const lastPos = GRADE_LAST_POSITION[entry.grade] ?? 21;
    return chapterBossHpScaleCurve(lastPos) * FINAL_BOSS_HP_MULT;
  }
  const pos = chapterPosition(entry.chapterId);
  if (pos == null) return 1; // secretBoss等、章にひもづかないものは現状維持
  if (entry.kind === "unitSmallBoss") return smallBossHpScaleCurve(pos);
  if (entry.kind === "unitBoss") return chapterBossHpScaleCurve(pos) * UNIT_BOSS_HP_MULT;
  if (entry.kind === "chapterBoss") return chapterBossHpScaleCurve(pos);
  return mobHpScaleCurve(pos); // kind === "unit"（雑魚）
}

/** グループ内の敵インスタンスを作る（1〜3組の雑魚は同一キャラを使い回す）。 */
export function spawnEnemyGroup(baseEnemy, groupIndex) {
  const groupBonus = 1 + groupIndex * 0.08; // 後の組ほど少しだけ硬くする
  const hpScale = hpScaleFor(baseEnemy) * groupBonus;
  const atkScale = earlyGameScale(baseEnemy) * groupBonus;
  return {
    ...baseEnemy,
    instanceId: `${baseEnemy.id}_g${groupIndex}`,
    hp: Math.round(baseEnemy.hp * hpScale),
    maxHp: Math.round(baseEnemy.hp * hpScale),
    atk: Math.round(baseEnemy.atk * atkScale),
  };
}

export function spawnBoss(bossEntry) {
  const hpScale = hpScaleFor(bossEntry);
  const atkScale = earlyGameScale(bossEntry);
  return {
    ...bossEntry,
    instanceId: `${bossEntry.id}_boss`,
    hp: Math.round(bossEntry.hp * hpScale),
    maxHp: Math.round(bossEntry.hp * hpScale),
    atk: Math.round(bossEntry.atk * atkScale),
  };
}
