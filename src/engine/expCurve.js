// ============================================================
// expCurve.js — 経験値→レベルの換算。
// 2026-09-18：kazu指定の必要経験値テーブルに置き換えた（以前は20+lv*8の仮置き）。
//   Lv1→2から10レベルごとに区切り、区切りが変わるたびにステップがほぼ倍になる
//   （1〜9は+30/Lv、10〜19は+50、20〜29は+100、30〜39は+200、40〜49は+400、
//    50〜59は+800、60〜69は+1600。Lv69→70で32000、レア度のレベル上限
//    （growthCurve.js）の最大値=UR70と一致する）。
//   レベル上限に達したら経験値をこれ以上レベルに反映しない。
// ============================================================

import { getLevelCap } from "../data/growthCurve.js";

function expToNext(level) {
  if (level <= 9) return 30 * (level + 1);
  if (level <= 19) return 350 + 50 * (level - 10);
  if (level <= 29) return 900 + 100 * (level - 20);
  if (level <= 39) return 2000 + 200 * (level - 30);
  if (level <= 49) return 4200 + 400 * (level - 40);
  if (level <= 59) return 8600 + 800 * (level - 50);
  return 17600 + 1600 * (level - 60); // level 60〜69
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
