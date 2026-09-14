// ============================================================
// mathLaboProblems.js — 数学ラボ2の本物の問題（src/data/mathLaboProblems/、
//   数学ラボ2から丸ごとコピー）を、このゲームの4択バトルUIに変換する層。
//
// 2026-09-14：「問題のストックは数学ラボから」「難易度を簡単/普通/難しい/鬼
//   で選べるように」への対応。数学ラボ2は元々この4段階（easy/standard/
//   advanced/oni）を持っていたので、そのままの粒度で使える。
//
// 【4択への変換について】数学ラボ2本体は自由記述+数式パーサで採点している。
//   math-worldのバトルUIは4択ボタン方式（Battle.jsx）なので、正解(ans)の
//   周辺値から不正解の選択肢を自動生成している。これは元の問題の意図を
//   変えるものではないが、「本物の記述式」ではなく「本物の問題文＋自動生成の
//   選択肢」である点は明記しておく（#todo 将来、数式入力UIにする選択肢もある）。
// ============================================================

import { rng } from "./mathLaboRng.js";
import { chapter as c1 } from "../data/mathLaboProblems/c1_seisu.js";
import { chapter as c2 } from "../data/mathLaboProblems/c2_moji.js";
import { chapter as c3 } from "../data/mathLaboProblems/c3_houteishiki.js";
import { chapter as c4 } from "../data/mathLaboProblems/c4_hirei.js";
import { chapter as c5 } from "../data/mathLaboProblems/c5_heimen.js";
import { chapter as c6 } from "../data/mathLaboProblems/c6_kukan.js";
import { chapter as c7 } from "../data/mathLaboProblems/c7_data.js";

const CHAPTERS = { c1, c2, c3, c4, c5, c6, c7 };
const ALL_CHAPTER_IDS = Object.keys(CHAPTERS);

export const DIFFICULTY_KEYS = ["easy", "standard", "advanced", "oni"];
export const DIFFICULTY_LABEL = { easy: "簡単", standard: "普通", advanced: "難しい", oni: "鬼" };
// kazu指定のダメージ倍率
export const DIFFICULTY_DAMAGE_MULTIPLIER = { easy: 0.8, standard: 1.0, advanced: 1.2, oni: 1.5 };

function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 見た目上の不正解の選択肢を、正解の近くの値から作る（正解と重複しないよう調整）。
function buildChoices(correctAns) {
  const correct = Math.round(correctAns * 100) / 100; // 小数第2位まで（対応する問題はまれ）
  const seen = new Set([correct]);
  const distractors = [];
  const candidates = [
    correct + 1,
    correct - 1,
    correct + 2,
    correct - 2,
    -correct,
    correct === 0 ? 1 : correct * 2,
  ];
  for (const cand of candidates) {
    if (distractors.length >= 3) break;
    if (seen.has(cand)) continue;
    seen.add(cand);
    distractors.push(cand);
  }
  // 万一候補が足りなければランダムなオフセットで埋める
  let guard = 0;
  while (distractors.length < 3 && guard < 20) {
    guard++;
    const cand = correct + (Math.floor(Math.random() * 9) - 4 || 3);
    if (seen.has(cand)) continue;
    seen.add(cand);
    distractors.push(cand);
  }

  const choices = [correct, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { choices: choices.map(String), correctIndex: choices.indexOf(correct) };
}

/** その単元(chapter)・難易度から、単元内のランダムなunit×テンプレを1問作る。 */
function tryBuildFromChapter(chapterMod, difficulty) {
  const units = chapterMod.units.filter((u) => (u.problems?.[difficulty] || []).length > 0);
  if (!units.length) return null;
  const unit = pickFrom(units);
  const templates = unit.problems[difficulty];
  const template = pickFrom(templates);
  for (let i = 0; i < 10; i++) {
    const made = template.build(rng);
    if (made && !made.skip) return made;
  }
  return null;
}

/**
 * 数学ラボ2の本物の問題を1問、4択の形にして返す。
 * chapterId が無い場合（大ボス戦等）は中1の7章からランダムに選ぶ。
 * difficulty は "easy" | "standard" | "advanced" | "oni"。
 */
export function generateMathLaboProblem(chapterId, difficulty = "standard") {
  const diff = DIFFICULTY_KEYS.includes(difficulty) ? difficulty : "standard";
  const idsToTry = chapterId && CHAPTERS[chapterId] ? [chapterId] : ALL_CHAPTER_IDS;

  for (let attempt = 0; attempt < 6; attempt++) {
    const cid = pickFrom(idsToTry);
    const made = tryBuildFromChapter(CHAPTERS[cid], diff);
    if (made) {
      const { choices, correctIndex } = buildChoices(made.ans);
      return { question: made.q, choices, correctIndex, hint1: made.h1, hint2: made.h2 };
    }
  }
  // 万一その難易度の問題が1問も無ければ、standardへフォールバック
  if (diff !== "standard") return generateMathLaboProblem(chapterId, "standard");
  return { question: "（問題を用意できませんでした）", choices: ["1", "2", "3", "4"], correctIndex: 0 };
}
