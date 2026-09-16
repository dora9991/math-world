// ============================================================
// expCurve.js — 経験値→レベルの簡易換算（MVP用の仮置き）。
//   必要EXP(lv→lv+1) = 20 + lv*8 の等差的カーブ。レア度のレベル上限
//   （growthCurve.js）に達したら経験値をこれ以上レベルに反映しない。
//   #todo 実プレイでの伸び方を見てバランス調整
// ============================================================

import { getLevelCap } from "../data/growthCurve.js";

function expToNext(level) {
  return 20 + level * 8;
}

/** 累積EXPからレベルを算出する（レア度の上限でクランプ）。 */
export function levelFromExp(totalExp, rarity) {
  const cap = getLevelCap(rarity);
  let level = 1;
  let remaining = totalExp;
  while (level < cap) {
    const need = expToNext(level);
    if (remaining < need) break;
    remaining -= need;
    level += 1;
  }
  return level;
}

/** 指定レベルに到達するのに必要な累計EXP（管理モードの「レベルを指定」用）。 */
export function expForLevel(targetLevel) {
  let total = 0;
  for (let lv = 1; lv < targetLevel; lv++) total += expToNext(lv);
  return total;
}

export function expProgress(totalExp, rarity) {
  const level = levelFromExp(totalExp, rarity);
  const cap = getLevelCap(rarity);
  if (level >= cap) return { level, cap, current: 0, need: 0, isMax: true };
  let remaining = totalExp;
  for (let lv = 1; lv < level; lv++) remaining -= expToNext(lv);
  return { level, cap, current: remaining, need: expToNext(level), isMax: false };
}
