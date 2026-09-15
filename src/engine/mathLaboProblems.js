// ============================================================
// mathLaboProblems.js — 数学ラボ2の本物の問題（src/data/mathLaboProblems/、
//   数学ラボ2から丸ごとコピー）を、このゲームの4択バトルUIに変換する層。
//
// 2026-09-14：「問題のストックは数学ラボから」「難易度を簡単/普通/難しい/鬼
//   で選べるように」への対応。数学ラボ2は元々この4段階（easy/standard/
//   advanced/oni）を持っていたので、そのままの粒度で使える。
//
// 2026-09-16：「中1〜中3までの問題を全て入れて」への対応。数学ラボ2の
//   grade2・grade3フォルダ（g2c1〜g2c6・g3c1〜g3c8）を追加コピー。
//   中1の7ファイルは自己完結だったが、中2・中3は共通の算数/代数ヘルパー
//   _algebra.js（式の文字列化・√の簡約・選択肢生成など）に依存していた
//   ため、_algebra.js もあわせてコピーしている（このディレクトリ内で
//   相対importが完結するよう import 先を書き換え済み）。
//
// 【4択への変換について】数学ラボ2本体は自由記述+数式パーサで採点している。
//   math-worldのバトルUIは4択ボタン方式（Battle.jsx）なので、正解(ans)の
//   周辺値から不正解の選択肢を自動生成している…が、中2・中3の問題の多くは
//   数学ラボ2側が既に「本物の誤答パターン」から4択(choices)を作って
//   くれているので、それがあればそのまま使い、無いもの（答えが単純な数値の
//   問題）だけ従来どおりmath-world側で機械的に近い数を生成する。
// ============================================================

import { rng } from "./mathLaboRng.js";
import { chapter as c1 } from "../data/mathLaboProblems/c1_seisu.js";
import { chapter as c2 } from "../data/mathLaboProblems/c2_moji.js";
import { chapter as c3 } from "../data/mathLaboProblems/c3_houteishiki.js";
import { chapter as c4 } from "../data/mathLaboProblems/c4_hirei.js";
import { chapter as c5 } from "../data/mathLaboProblems/c5_heimen.js";
import { chapter as c6 } from "../data/mathLaboProblems/c6_kukan.js";
import { chapter as c7 } from "../data/mathLaboProblems/c7_data.js";
import { chapter as g2c1 } from "../data/mathLaboProblems/g2c1.js";
import { chapter as g2c2 } from "../data/mathLaboProblems/g2c2.js";
import { chapter as g2c3 } from "../data/mathLaboProblems/g2c3.js";
import { chapter as g2c4 } from "../data/mathLaboProblems/g2c4.js";
import { chapter as g2c5 } from "../data/mathLaboProblems/g2c5.js";
import { chapter as g2c6 } from "../data/mathLaboProblems/g2c6.js";
import { chapter as g3c1 } from "../data/mathLaboProblems/g3c1_shiki.js";
import { chapter as g3c2 } from "../data/mathLaboProblems/g3c2.js";
import { chapter as g3c3 } from "../data/mathLaboProblems/g3c3.js";
import { chapter as g3c4 } from "../data/mathLaboProblems/g3c4.js";
import { chapter as g3c5 } from "../data/mathLaboProblems/g3c5.js";
import { chapter as g3c6 } from "../data/mathLaboProblems/g3c6.js";
import { chapter as g3c7 } from "../data/mathLaboProblems/g3c7.js";
import { chapter as g3c8 } from "../data/mathLaboProblems/g3c8.js";

const CHAPTERS_BY_GRADE = {
  1: { c1, c2, c3, c4, c5, c6, c7 },
  2: { g2c1, g2c2, g2c3, g2c4, g2c5, g2c6 },
  3: { g3c1, g3c2, g3c3, g3c4, g3c5, g3c6, g3c7, g3c8 },
};
const CHAPTERS = { ...CHAPTERS_BY_GRADE[1], ...CHAPTERS_BY_GRADE[2], ...CHAPTERS_BY_GRADE[3] };
const CHAPTER_IDS_BY_GRADE = Object.fromEntries(
  Object.entries(CHAPTERS_BY_GRADE).map(([g, chs]) => [g, Object.keys(chs)])
);
const ALL_CHAPTER_IDS = Object.keys(CHAPTERS);

export const DIFFICULTY_KEYS = ["easy", "standard", "advanced", "oni"];
export const DIFFICULTY_LABEL = { easy: "簡単", standard: "普通", advanced: "難しい", oni: "鬼" };
// kazu指定のダメージ倍率
export const DIFFICULTY_DAMAGE_MULTIPLIER = { easy: 0.8, standard: 1.0, advanced: 1.2, oni: 1.5 };

function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 見た目上の不正解の選択肢を、正解の近くの値から作る（正解と重複しないよう調整）。
// 数学ラボ2側がchoicesを用意していない問題（答えが単純な数値のみ）専用のフォールバック。
function buildNumericChoices(correctAns) {
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

// build(r)の戻り値から4択を作る。数学ラボ2側が既にchoicesを用意していれば
// それをそのまま使い（式の答え・語句の答えなど数値でないものはこちらが必須）、
// 無ければ答えが数値の場合だけmath-world側で機械的に選択肢を作る。
// どちらにも当てはまらない場合はnullを返し、呼び出し側に別テンプレを試させる。
function toChoiceResult(made) {
  if (Array.isArray(made.choices) && made.choices.length) {
    const correctIndex = made.choices.findIndex((c) => c === made.ans);
    if (correctIndex !== -1) {
      return { choices: made.choices.map(String), correctIndex };
    }
  }
  if (typeof made.ans === "number" && Number.isFinite(made.ans)) {
    return buildNumericChoices(made.ans);
  }
  return null;
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
 * chapterId が無い場合（大ボス戦等）は、gradeが分かればその学年の章から、
 * 分からなければ中1〜中3の全章からランダムに選ぶ。
 * difficulty は "easy" | "standard" | "advanced" | "oni"。
 */
export function generateMathLaboProblem(chapterId, difficulty = "standard", grade) {
  const diff = DIFFICULTY_KEYS.includes(difficulty) ? difficulty : "standard";
  const idsToTry =
    chapterId && CHAPTERS[chapterId]
      ? [chapterId]
      : CHAPTER_IDS_BY_GRADE[grade] || ALL_CHAPTER_IDS;

  for (let attempt = 0; attempt < 10; attempt++) {
    const cid = pickFrom(idsToTry);
    const made = tryBuildFromChapter(CHAPTERS[cid], diff);
    if (!made) continue;
    const result = toChoiceResult(made);
    if (!result) continue;
    return { question: made.q, choices: result.choices, correctIndex: result.correctIndex, hint1: made.h1, hint2: made.h2 };
  }
  // 万一その難易度の問題が1問も無ければ、standardへフォールバック
  if (diff !== "standard") return generateMathLaboProblem(chapterId, "standard", grade);
  return { question: "（問題を用意できませんでした）", choices: ["1", "2", "3", "4"], correctIndex: 0 };
}
