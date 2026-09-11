// ============================================================
// storyMap.js — GACHA_ROSTER（下ごしらえデータ）から
//   学年 → 章（単元） → 小単元 → 雑魚グループ／小単元ボス
//   という「ストーリーモードの地図」を組み立てる。
//
// 2026-09-11 実装：中1・第7章まで（確率を含むデータの活用まで）が
//   GACHA_ROSTER に既に用意されていたため、新規にコンテンツを作らず、
//   既存データをこの形に並べ替えるだけで済んだ。
//   章ごとの構成（例：c1）：
//     kind="unit"          … その小単元の雑魚（1体、複製して1〜3組で出す）
//     kind="unitSmallBoss"  … その小単元のボス（小単元クリアの条件）
//     kind="chapterBoss"    … 章（単元）全体をクリアした後に出る章ボス
//     kind="unitBoss"       … 章の裏ボス的な最終関門（ボスの梯子の最終段。
//                              今回のMVPでは章ボスの"強い版"として後日開放する
//                              想定でデータだけ持たせておく。#todo 出現条件）
//   学年の最後の防具は kind="finalBoss"（例：boss_maou_1＝数学の魔王・中1）。
// ============================================================

import { GACHA_ROSTER } from "./gachaRoster.js";

// 8/11設計の「chapterId→5系統」マッピングをそのまま使用。
// バトルの相性計算（growthCurve.js内のクリ式）はこのsubjectキーで
// どのパラメータを見るかを決める。
export const CHAPTER_SUBJECT = {
  c1: "calc",
  c2: "calc",
  c3: "eq",
  c4: "func",
  c5: "geo",
  c6: "geo",
  c7: "data",
};

export const SUBJECT_LABEL = {
  calc: "計算",
  eq: "方程式",
  func: "関数",
  geo: "図形",
  data: "データ",
};

// 学年ごとの表示名（今回コンテンツがあるのは中1のみ。中2・中3はデータがあれば
// 自動的に地図へ出るが、章の抜けがある可能性が高いので現状は未検証扱い）
export const GRADE_LABEL = {
  1: "中学1年",
  2: "中学2年",
  3: "中学3年",
};

function buildChapter(grade, chapterId, entries) {
  const units = entries
    .filter((e) => e.kind === "unit")
    .sort((a, b) => (a.id > b.id ? 1 : -1));
  const smallBosses = entries.filter((e) => e.kind === "unitSmallBoss");
  const chapterBoss = entries.find((e) => e.kind === "chapterBoss") || null;
  const unitBoss = entries.find((e) => e.kind === "unitBoss") || null;

  // 小単元は「雑魚(unit)」と「その小単元ボス(unitSmallBoss)」を、
  // 出現順（su_uN の N）で対応付ける。対応が見つからない場合はnullのまま
  // （データの穴を落とさず可視化するため、黙って捨てない）。
  const subUnits = units.map((unit, index) => {
    const boss =
      smallBosses.find((b) => b.id === `su_u${index + 1}`) ||
      smallBosses[index] ||
      null;
    return {
      id: unit.id,
      order: index + 1,
      theme: unit.theme,
      enemy: unit,
      boss,
    };
  });

  const chapterName = (chapterBoss?.theme || entries[0]?.theme || chapterId).replace(
    /・全体$/,
    ""
  );

  return {
    chapterId,
    grade,
    name: chapterName,
    subject: CHAPTER_SUBJECT[chapterId] || null,
    subUnits,
    chapterBoss,
    unitBoss,
  };
}

function buildGrade(grade, entries) {
  const chapterIds = [...new Set(entries.filter((e) => e.chapterId).map((e) => e.chapterId))].sort();
  const chapters = chapterIds.map((cid) =>
    buildChapter(
      grade,
      cid,
      entries.filter((e) => e.chapterId === cid)
    )
  );
  const finalBoss = entries.find((e) => e.kind === "finalBoss") || null;
  const secretBosses = entries.filter((e) => e.kind === "secretBoss");
  return {
    grade,
    label: GRADE_LABEL[grade] || `${grade}年`,
    chapters,
    finalBoss,
    secretBosses,
  };
}

// STORY_MAP: [{grade, label, chapters:[...], finalBoss, secretBosses}, ...]
export const STORY_MAP = [...new Set(GACHA_ROSTER.map((e) => e.grade))]
  .sort((a, b) => a - b)
  .map((grade) => buildGrade(grade, GACHA_ROSTER.filter((e) => e.grade === grade)));

export function getGrade(grade) {
  return STORY_MAP.find((g) => g.grade === grade) || null;
}

export function getChapter(grade, chapterId) {
  const g = getGrade(grade);
  return g?.chapters.find((c) => c.chapterId === chapterId) || null;
}

export function getSubUnit(grade, chapterId, subUnitId) {
  const c = getChapter(grade, chapterId);
  return c?.subUnits.find((s) => s.id === subUnitId) || null;
}

// そのチャプターのガチャ対象プール（そのchapterIdに属する全キャラ。
// N=雑魚/R=小単元ボス/SR=章ボス/UR=裏ボス格、が自然に混ざり、
// レア度の幅が出る。「その単元のガチャ」の実体はこれ）。
export function getChapterGachaPool(grade, chapterId) {
  return GACHA_ROSTER.filter((e) => e.grade === grade && e.chapterId === chapterId);
}
