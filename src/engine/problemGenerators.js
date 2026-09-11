// ============================================================
// problemGenerators.js — 章(chapterId)ごとの簡易問題ジェネレータ。
//
// 【位置づけ】「大きな型」を作るためのプレースホルダー実装。
//   数学ラボ2側の本物の問題エンジン（problem_bank.json・pipeline産の
//   1139問等）とは接続していない。8/11ノートの#todo「math-problems/
//   単一ソース化」が実行されたら、そちらに差し替える前提（#todo）。
//   それまでの間、戦闘の型（正解でダメージ・誤答は0ダメージ）を
//   実際に動かして確認できる最低限の問題を、章のテーマに沿って自作した。
//
// 【形式】4択（choices配列・correctIndexで正誤判定）で統一。
//   自由記述＋数式パーサはここでは持たない（採点ロジックの複雑化を避けた）。
// ============================================================

function shuffleChoices(correct, distractors) {
  const choices = [correct, ...distractors];
  // 決定論性は不要（バトル中の出題なので毎回ランダムでよい）
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  const correctIndex = choices.indexOf(correct);
  return { choices: choices.map(String), correctIndex };
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const GENERATORS = {
  // c1 正の数と負の数：符号つき整数の加減
  c1() {
    const a = randInt(-9, 9);
    const b = randInt(-9, 9);
    const op = Math.random() < 0.5 ? "+" : "-";
    const answer = op === "+" ? a + b : a - b;
    const question = `(${a}) ${op} (${b}) = ?`;
    const { choices, correctIndex } = shuffleChoices(answer, [
      answer + randInt(1, 3),
      answer - randInt(1, 3),
      -answer === answer ? answer + 4 : -answer,
    ]);
    return { question, choices, correctIndex };
  },

  // c2 文字の式：代入
  c2() {
    const x = randInt(-5, 5);
    const a = randInt(2, 6);
    const b = randInt(-5, 5);
    const answer = a * x + b;
    const question = `x = ${x} のとき、${a}x ${b >= 0 ? "+" : "-"} ${Math.abs(b)} の値は？`;
    const { choices, correctIndex } = shuffleChoices(answer, [
      answer + a,
      answer - a,
      a * x - b,
    ]);
    return { question, choices, correctIndex };
  },

  // c3 方程式：ax + b = c を解く（xは整数になるよう調整）
  c3() {
    const a = randInt(2, 6);
    const x = randInt(-6, 6);
    const b = randInt(-6, 6);
    const c = a * x + b;
    const question = `${a}x ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${c} のとき、x は？`;
    const { choices, correctIndex } = shuffleChoices(x, [x + 1, x - 1, x + a]);
    return { question, choices, correctIndex };
  },

  // c4 比例・反比例
  c4() {
    const proportional = Math.random() < 0.5;
    const k = randInt(2, 6);
    const x1 = randInt(1, 5);
    const x2 = randInt(1, 6);
    if (proportional) {
      const y1 = k * x1;
      const answer = k * x2;
      const question = `yはxに比例し、x=${x1}のときy=${y1}。x=${x2}のときyは？`;
      const { choices, correctIndex } = shuffleChoices(answer, [
        answer + k,
        answer - k,
        k * (x2 + 1),
      ]);
      return { question, choices, correctIndex };
    }
    const y1 = k * x1; // xy = k*x1 として反比例定数を作る
    const constVal = x1 * y1;
    const answer = constVal / x2 === Math.floor(constVal / x2) ? constVal / x2 : Math.round(constVal / x2);
    const question = `yはxに反比例し、x=${x1}のときy=${y1}。x=${x2}のときyに最も近いのは？`;
    const { choices, correctIndex } = shuffleChoices(answer, [
      answer + 1,
      Math.max(answer - 1, 0),
      answer + 2,
    ]);
    return { question, choices, correctIndex };
  },

  // c5 平面図形：三角形の内角
  c5() {
    const a = randInt(40, 100);
    const b = randInt(30, 100);
    const answer = 180 - a - b;
    const question = `三角形の内角が ${a}°と${b}°のとき、残りの角は？`;
    const { choices, correctIndex } = shuffleChoices(answer, [
      answer + 10,
      answer - 10,
      180 - a,
    ]);
    return { question, choices, correctIndex };
  },

  // c6 空間図形：直方体の体積
  c6() {
    const w = randInt(2, 8);
    const d = randInt(2, 8);
    const h = randInt(2, 8);
    const answer = w * d * h;
    const question = `たて${d}cm・よこ${w}cm・高さ${h}cmの直方体の体積は？`;
    const { choices, correctIndex } = shuffleChoices(answer, [
      answer + w * d,
      w * d + h,
      answer - h,
    ]);
    return { question, choices, correctIndex };
  },

  // c7 データの活用：平均・確率
  c7() {
    if (Math.random() < 0.5) {
      const nums = Array.from({ length: 5 }, () => randInt(1, 10));
      const sum = nums.reduce((s, n) => s + n, 0);
      const answer = Math.round((sum / nums.length) * 10) / 10;
      const question = `データ ${nums.join(", ")} の平均値に最も近いのは？`;
      const { choices, correctIndex } = shuffleChoices(answer, [
        Math.round((answer + 1) * 10) / 10,
        Math.round((answer - 1) * 10) / 10,
        Math.max(...nums),
      ]);
      return { question, choices, correctIndex };
    }
    const faces = 6;
    const evens = 3;
    const question = `サイコロを1回投げて偶数の目が出る確率は？`;
    const { choices, correctIndex } = shuffleChoices("1/2", ["1/3", "1/6", "2/3"]);
    return { question, choices, correctIndex };
  },
};

/** その章(chapterId)向けの問題を1問生成する。未知の章はc1相当にフォールバック。 */
export function generateProblem(chapterId) {
  const gen = GENERATORS[chapterId] || GENERATORS.c1;
  return gen();
}
