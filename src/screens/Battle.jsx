import { useEffect, useMemo, useRef, useState } from "react";
import { getChapter, getGrade, CHAPTER_SUBJECT, SUBJECT_LABEL } from "../data/storyMap.js";
import { useGame } from "../context/GameContext.jsx";
import {
  computePartyMaxHp,
  resolvePlayerAttack,
  resolveEnemyAttack,
  spawnEnemyGroup,
  spawnBoss,
  rollAttackCountdown,
  rollEnemyInflictedStatus,
  applyStatusEffect,
  canActThisRound,
  canUseSkillThisRound,
  isConfusedThisRound,
  isPartyAllPetrified,
  tickStatusEffects,
  cureStatusEffects,
  STATUS_DEFS,
} from "../engine/battleEngine.js";
import {
  generateMathLaboProblem,
  DIFFICULTY_KEYS,
  DIFFICULTY_LABEL,
  DIFFICULTY_DAMAGE_MULTIPLIER,
} from "../engine/mathLaboProblems.js";
import { levelFromExp } from "../engine/expCurve.js";
import BattleFX, { PROJECTILE_MS } from "../fx/BattleFX.jsx";
import { playCorrectSound, playIncorrectSound, playEnemyAttackStartSound } from "../fx/sound.js";
import MonsterPortrait from "../components/MonsterPortrait.jsx";
import { monsterImageUrl, monsterImgFilter } from "../data/monsterImages.js";

// スキルゲージの満タン値（2026-09-18：10→4に変更。4問正解でスキルが使えるようになる）。
const SKILL_GAUGE_MAX = 4;

// 状態異常アイコン（2026-09-18追加）。パーティ側の各ポートレートの下に表示する。
const STATUS_ICON = {
  poison: "🧪",
  paralysis: "⚡",
  seal: "🔒",
  slow: "🐌",
  confusion: "❓",
  petrification: "🗿",
};

const REWARD_EXP_GROUP = 12;
const REWARD_EXP_BOSS = 40;
const REWARD_COIN_GROUP = 8;
const REWARD_COIN_BOSS = 30;

// 正解/不正解の音を聞かせてから、少し間を置いてエフェクト(たま)を出す。
const ANSWER_SOUND_LEAD_MS = 200;
// 3体同時攻撃のときの、たま発射タイミングのずらし幅（「若干ランダムでずらす」）。
const STAGGER_MS = 110;
const STAGGER_JITTER_MS = 90;
// 3体分のダメージ表記/バーストが重なりすぎないようにする表示位置のずらし幅。
const OFFSET_SPREAD = 30;
// 自分たちの攻撃が落ち着いてから、敵の反撃(下がる→引っ掻く→揺れる)が始まるまでの間。
const COUNTER_LEAD_MS = 280;
// 「敵の攻撃開始音」(発動効果音)が鳴ってから、実際に引っ掻き(＝ダメージ発生)が
// 来るまでの予備動作の間。ここで被ダメージ数値・HPも即反映する。
const ENEMY_STRIKE_WINDUP_MS = 100;
// 反撃が複数回続くときの、1発ごとの間隔（「0.3秒ごとにどんどんくる」）。
const ENEMY_ATTACK_STEP_MS = 300;
// 引っ掻いた敵が「構え」を解除する(下がりポーズが戻る)までの見た目上の間。
const ENEMY_LUNGE_CLEAR_MS = 180;
// 攻撃するキャラが枠から2倍の大きさで飛び出してから、実際にたまを撃つまでの間。
const POPUP_GROW_MS = 220;
const POPUP_HOLD_MS = 140;
const POPUP_LEAD_MS = POPUP_GROW_MS + POPUP_HOLD_MS;
// ドラッグと判定するための、指を動かした距離のしきい値(px)。これ未満はタップ扱い。
const DRAG_THRESHOLD_PX = 10;
// 攻撃結果を表示してから、ボタンを押させずに自動で次のこうげきへ進むまでの間。
const AUTO_ADVANCE_MS = 1400;
// 難易度を選んだら、選んだボタンが光ってから自動で問題に移るまでの間。
const DIFF_PICK_DELAY_MS = 600;

// 「敵は1〜3体同時に出てくることもある」構成。1つの配列=1つの波(wave)。
// 小単元：雑魚の波(1〜3体・同時)→ボスの波(1体)。章ボス/大ボスは単体の波1つだけ。
function buildEncounters(params, chapter, gradeData) {
  const { kind, subUnitId } = params;
  if (kind === "subUnit") {
    const subUnit = chapter.subUnits.find((s) => s.id === subUnitId);
    const count = 1 + Math.floor(Math.random() * 3); // 1〜3体が同時に出てくる
    const wave = Array.from({ length: count }, (_, i) => spawnEnemyGroup(subUnit.enemy, i, count));
    // 中2・中3はgachaRoster側に小単元ごとのボス(unitSmallBoss)がまだ用意されて
    // いないchapterがある（#todo 追加）。boss不在の小単元は雑魚の波だけで終える。
    return subUnit.boss ? [wave, [spawnBoss(subUnit.boss)]] : [wave];
  }
  if (kind === "chapterBoss") {
    return [[spawnBoss(chapter.chapterBoss)]];
  }
  if (kind === "finalBoss") {
    return [[spawnBoss(gradeData.finalBoss)]];
  }
  return [];
}

// el を stageEl 基準の座標系（PixiJSのapp.screenと同じCSSピクセル単位）に変換する。
function pointOf(el, stageEl) {
  if (!el || !stageEl) return null;
  const r = el.getBoundingClientRect();
  const s = stageEl.getBoundingClientRect();
  return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
}
function rectOf(el, stageEl) {
  if (!el || !stageEl) return null;
  const r = el.getBoundingClientRect();
  const s = stageEl.getBoundingClientRect();
  return { x: r.left - s.left, y: r.top - s.top, width: r.width, height: r.height };
}

export default function Battle({ nav, params }) {
  const { grade, chapterId, kind } = params;
  const { save, actions, charactersById } = useGame();
  const gradeData = getGrade(grade);
  const chapter = chapterId ? getChapter(grade, chapterId) : null;

  const encounters = useMemo(() => buildEncounters(params, chapter, gradeData), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [waveIndex, setWaveIndex] = useState(0);
  const [enemies, setEnemies] = useState(() => (encounters[0] || []).map((e) => ({ ...e })));
  // パーティ最大HPは「今の編成の合計HP」（2026-09-16、1000固定から変更）。
  // 編成は戦闘中に変わらないので、レベルもsave.ownedのexpから毎回同じ値になる
  // ＝partyHpの初期値としてそのまま使ってよい。
  const partyMembers = save.party.filter(Boolean).map((id) => charactersById[id]);
  const partyMaxHp = computePartyMaxHp(partyMembers, (c) => levelFromExp(save.owned[c.id]?.exp || 0, c.rarity));
  const [partyHp, setPartyHp] = useState(partyMaxHp);
  const [phase, setPhase] = useState("choose"); // choose | question | resolving | result | defeat
  // スキルは10目盛のゲージが満タン(10)になったら発動できる。攻撃を当てるたびに+1、
  // 使うと0に戻る（8/11設計「累積正解でゲージが溜まる」のtoy実装）。
  const [skillToggle, setSkillToggle] = useState({});
  const [gauge, setGauge] = useState({});
  // 各キャラが「どの敵を狙うか」。ドラッグで上書きするまでは自動割り振り。
  const [targets, setTargets] = useState({});
  const [problem, setProblem] = useState(null);
  // 問題難易度（簡単/普通/難しい/鬼）。ターンごとに選ぶと、選んだボタンが光ってから自動で問題へ進む。
  const [difficulty, setDifficulty] = useState("standard");
  const [pickingDifficulty, setPickingDifficulty] = useState(false);
  const [totals, setTotals] = useState({ exp: 0, coins: 0 });
  // 状態異常（毒/麻痺/封印/スロー/混乱/石化）：{ characterId: { statusKey: {turnsLeft,...} } }。
  // 敵の攻撃がパーティメンバーにかける（2026-09-18・kazu確認済み）。
  const [partyStatus, setPartyStatus] = useState({});
  // 支援スキルの一時バフ：{ atk: {multiplier,turnsLeft} | null, guard: 同様 | null }。
  const [partyBuffs, setPartyBuffs] = useState({ atk: null, guard: null });
  // 敵の反撃はsetTimeoutごしに発火するため、Reactのstateをそのまま読むと
  // 古い値を掴む（Battle.jsxの他のドラッグ処理と同じ理由）。反撃時のガード
  // バフ参照はrefの方を見る。
  const partyBuffsRef = useRef(partyBuffs);
  useEffect(() => {
    partyBuffsRef.current = partyBuffs;
  }, [partyBuffs]);
  const partyStatusRef = useRef(partyStatus);
  useEffect(() => {
    partyStatusRef.current = partyStatus;
  }, [partyStatus]);
  const fxRef = useRef(null);
  const [shakingIds, setShakingIds] = useState(() => new Set());
  const [partyShake, setPartyShake] = useState(false);
  // 反撃で「予備動作中(下がって構えている)」の敵。複数体が順番に反撃しうるのでSetで管理。
  const [lungingIds, setLungingIds] = useState(() => new Set());
  // 攻撃中に「枠から飛び出している」キャラをcharacterId->boolで管理。
  const [poppedOut, setPoppedOut] = useState({});
  // ドラッグ中の見た目（指に付いてくる丸アイコン）とホバー中の敵。
  const [dragGhost, setDragGhost] = useState(null); // {charId, x, y} | null
  const [hoverTargetId, setHoverTargetId] = useState(null);
  const dragRef = useRef(null); // {charId, startX, startY, moved}
  const hoverRef = useRef(null);
  // キャラをタップしたときに一時的に出す説明（スキル発動まであと何問／発動確認）。
  const [tapInfo, setTapInfo] = useState(null); // {charId, text} | null
  const tapInfoTimeoutRef = useRef(null);
  function showTapInfo(charId, text) {
    if (tapInfoTimeoutRef.current) clearTimeout(tapInfoTimeoutRef.current);
    if (!text) {
      setTapInfo(null);
      return;
    }
    setTapInfo({ charId, text });
    tapInfoTimeoutRef.current = setTimeout(() => setTapInfo(null), 2600);
  }

  // 舞台（敵表示＋パーティ表示をまとめた1枚）と、各要素の位置を測るためのref。
  const stageRef = useRef(null);
  const enemyRefs = useRef({}); // instanceId -> DOM el
  const partyAreaRef = useRef(null);
  const portraitRefs = useRef({});

  function triggerEnemyShakeFor(ids, ms) {
    if (!ids.length) return;
    setShakingIds((prev) => new Set([...prev, ...ids]));
    setTimeout(() => {
      setShakingIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }, ms);
  }
  function triggerPartyShake(ms) {
    setPartyShake(true);
    setTimeout(() => setPartyShake(false), ms);
  }

  const isBossWave = waveIndex === encounters.length - 1;
  const aliveEnemies = enemies.filter((e) => e.hp > 0);

  // 章のステージなら章の系統に固定。大ボス戦(章なし)は、キャラ自身の得意系統で殴る。
  function subjectFor(character) {
    return chapterId ? CHAPTER_SUBJECT[chapterId] : character?.primarySubject;
  }
  const topSubjectLabel = chapterId ? SUBJECT_LABEL[CHAPTER_SUBJECT[chapterId]] : "総力戦";

  // characterId が今どの敵を狙うか（ドラッグ指定があればそれ、無ければ敵に均等に割り振る）。
  function resolveTarget(characterId, fallbackIndex) {
    if (aliveEnemies.length === 0) return null;
    const chosen = targets[characterId];
    if (chosen && aliveEnemies.some((e) => e.instanceId === chosen)) return chosen;
    return aliveEnemies[fallbackIndex % aliveEnemies.length].instanceId;
  }

  function startQuestion(diff) {
    setProblem(generateMathLaboProblem(chapterId, diff, grade));
    setPhase("question");
  }

  // 難易度ボタンを選んだ瞬間：選んだボタンを光らせ、少し間を置いてからそのまま問題へ。
  function chooseDifficulty(d) {
    if (phase !== "choose" || pickingDifficulty) return;
    setDifficulty(d);
    setPickingDifficulty(true);
    setTimeout(() => {
      setPickingDifficulty(false);
      startQuestion(d);
    }, DIFF_PICK_DELAY_MS);
  }

  // ドラッグ開始（パーティのポートレートから）。指定キャラを押した瞬間からアイコンが
  // 付いてくる。動かさずに離せばタップ＝スキルの発動予約トグル、一定以上動かして
  // 敵の上で離せば＝その敵を攻撃対象に指定。
  function handlePortraitPointerDown(e, characterId) {
    if (phase !== "choose") return;
    e.preventDefault(); // ブラウザ標準の画像ドラッグ等に奪われないようにする
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 対応していない環境では無視 */
    }
    const startX = e.clientX;
    const startY = e.clientY;
    dragRef.current = { charId: characterId, startX, startY, moved: false };
    hoverRef.current = null;
    setDragGhost({ charId: characterId, x: startX, y: startY }); // 押した瞬間からアイコンを出す

    function onMove(ev) {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) d.moved = true;
      setDragGhost({ charId: d.charId, x: ev.clientX, y: ev.clientY });
      if (!d.moved) return;

      let hovered = null;
      for (const en of enemies) {
        if (en.hp <= 0) continue;
        const el = enemyRefs.current[en.instanceId];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          hovered = en.instanceId;
          break;
        }
      }
      hoverRef.current = hovered;
      setHoverTargetId(hovered);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const d = dragRef.current;
      dragRef.current = null;
      // ホバー中の敵IDは先にローカル変数へ確定させてからsetTargetsに渡す。
      // setTargetsの更新関数の中でhoverRef.currentを直接読むと、直後の
      // 「hoverRef.current = null」とレースしてnullを拾ってしまうことがあった
      // （ドラッグしても攻撃対象が切り替わらないバグの原因）。
      const droppedTargetId = hoverRef.current;
      hoverRef.current = null;
      setDragGhost(null);
      setHoverTargetId(null);

      if (!d) return;
      if (d.moved) {
        if (droppedTargetId) {
          setTargets((t) => ({ ...t, [d.charId]: droppedTargetId }));
        }
      } else {
        // 動かさずタップ＝スキル情報の表示（満タンなら発動の予約トグルも兼ねる）。
        const c = charactersById[d.charId];
        if (c?.skill) {
          const currentGauge = gauge[d.charId] || 0;
          if (currentGauge >= SKILL_GAUGE_MAX) {
            const willArm = !skillToggle[d.charId];
            setSkillToggle((s) => ({ ...s, [d.charId]: willArm }));
            showTapInfo(
              d.charId,
              willArm ? `スキル：${c.skill.name}　次の攻撃で発動しますか？` : null
            );
          } else {
            showTapInfo(d.charId, `スキル発動まであと${SKILL_GAUGE_MAX - currentGauge}問`);
          }
        }
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // 支援スキル（回復/状態異常回復/攻撃力バフ/防御バフ）をまとめて集計する。
  // 同じ種類を複数キャラが同時に使った場合：回復%は合算、cureは和集合、
  // バフは一番強い倍率を採用（durationはそのスキルのdurationをそのまま使う）。
  function summarizeSupportActions(supportActions) {
    let healPercent = 0;
    const cures = new Set();
    let atkBuff = null;
    let guardBuff = null;
    for (const { skill } of supportActions) {
      if (skill.category === "heal") healPercent += skill.percent;
      else if (skill.category === "cure") for (const k of skill.cures) cures.add(k);
      else if (skill.category === "buffAtk") {
        if (!atkBuff || skill.multiplier > atkBuff.multiplier) {
          atkBuff = { multiplier: skill.multiplier, turnsLeft: skill.duration };
        }
      } else if (skill.category === "buffGuard") {
        if (!guardBuff || skill.multiplier < guardBuff.multiplier) {
          guardBuff = { multiplier: skill.multiplier, turnsLeft: skill.duration };
        }
      }
    }
    return { healPercent, cures: [...cures], atkBuff, guardBuff };
  }

  function tickBuff(buff) {
    if (!buff) return null;
    const turnsLeft = buff.turnsLeft - 1;
    return turnsLeft > 0 ? { ...buff, turnsLeft } : null;
  }

  // 自分たちの攻撃が出そろった後の後始末：ダメージ・支援スキル・状態異常の経過を
  // まとめて反映し、生き残った敵の頭上のカウントダウン(attackCountdown)を1減らす。
  // 0になった敵だけがこの後「下がる→引っ掻く→揺れる」の反撃シーケンスで実際に
  // 攻撃する（2026-09-17：外したときも無条件に全員が反撃してくる仕様をやめ、
  // カウントダウン任せに統一した）。全滅させた場合は反撃なしで即結果へ。
  function resolveAfterPartyAttack({ hits, supportActions, statusSnapshot }) {
    const damageByTarget = {};
    let selfDamage = 0; // 混乱で味方（パーティ自身）に向いた攻撃の合計
    for (const h of hits) {
      if (h.targetId === "PARTY_SELF") selfDamage += h.attack.damage;
      else damageByTarget[h.targetId] = (damageByTarget[h.targetId] || 0) + h.attack.damage;
    }

    let gainedExp = 0;
    let gainedCoins = 0;
    const hitIds = [];

    const updatedEnemies = enemies.map((en) => {
      const dmg = damageByTarget[en.instanceId] || 0;
      let hp = en.hp;
      if (dmg > 0) {
        hitIds.push(en.instanceId);
        hp = Math.max(0, en.hp - dmg);
        if (en.hp > 0 && hp <= 0) {
          gainedExp += isBossWave ? REWARD_EXP_BOSS : REWARD_EXP_GROUP;
          gainedCoins += isBossWave ? REWARD_COIN_BOSS : REWARD_COIN_GROUP;
          fxRef.current?.playDefeat({ to: pointOf(enemyRefs.current[en.instanceId], stageRef.current) });
        }
      }
      // 生きている敵だけ、頭上の数字を1減らす（倒した敵の数字はもう意味が無いのでそのまま）。
      const attackCountdown = hp > 0 ? en.attackCountdown - 1 : en.attackCountdown;
      return { ...en, hp, attackCountdown };
    });
    setEnemies(updatedEnemies);
    if (hitIds.length) triggerEnemyShakeFor(hitIds, hits.some((h) => h.attack.isCrit) ? 450 : 220);
    if (gainedExp || gainedCoins) {
      setTotals((t) => ({ exp: t.exp + gainedExp, coins: t.coins + gainedCoins }));
    }

    // 支援スキルの適用。
    const { healPercent, cures, atkBuff, guardBuff } = summarizeSupportActions(supportActions);
    if (atkBuff || guardBuff) {
      setPartyBuffs((prev) => ({
        atk: atkBuff || tickBuff(prev.atk),
        guard: guardBuff || tickBuff(prev.guard),
      }));
    }

    // 状態異常の経過処理（毒ダメージの算出＋継続ターンの消化）。cureがあれば続けて反映。
    const { statusByCharId: tickedStatus, poisonDamage } = tickStatusEffects(statusSnapshot, partyMaxHp);
    const nextStatus = cures.length ? cureStatusEffects(tickedStatus, cures) : tickedStatus;
    setPartyStatus(nextStatus);
    partyStatusRef.current = nextStatus;

    const healAmount = healPercent > 0 ? Math.round(partyMaxHp * healPercent) : 0;
    const netHp = Math.max(0, Math.min(partyMaxHp, partyHp - selfDamage - poisonDamage + healAmount));
    setPartyHp(netHp);

    // 石化は全員そろうと即敗北（HPが残っていても誰も動けなくなるため）。
    const partyMemberIds = partyMembers.map((c) => c.id);
    if (isPartyAllPetrified(nextStatus, partyMemberIds) || netHp <= 0) {
      setPhase("defeat");
      return;
    }

    const allDead = updatedEnemies.every((en) => en.hp <= 0);
    if (allDead) {
      setPhase("result");
      return;
    }

    const readyToAttack = updatedEnemies.filter((en) => en.hp > 0 && en.attackCountdown <= 0);
    if (!readyToAttack.length) {
      setPhase("result");
      return;
    }
    scheduleEnemyCounter(readyToAttack, netHp);
  }

  // 敵の反撃シーケンス：頭上の数字が0になった敵の数だけ、1体ずつ順番に反撃する
  // （1体なら1回、3体なら3回）。反撃は0.3秒間隔でどんどん来るテンポ。
  // 「予備動作→引っ掻く」の引っ掻いた瞬間に、被ダメージ数値・HP・パーティの
  // 揺れを即座に反映する（テキストのログ表示はもう出さない）。引っ掻きは
  // 防御バフ(partyBuffsRef.guard)があれば軽減し、命中した相手にランダムで
  // 状態異常も仕掛けてくる（2026-09-18・kazu確認済み：敵の攻撃がパーティに
  // かける方式）。引っ掻きの向きは4パターン（右上/左上/縦やや右/縦やや左）を
  // シャッフルして割り当てるので、同じターンで連続する反撃どうし向きが被らない。
  function scheduleEnemyCounter(pool, startHp) {
    if (!pool.length) {
      setPhase("result");
      return;
    }
    const variantOrder = [0, 1, 2, 3].sort(() => Math.random() - 0.5);

    function runAttack(index, hp) {
      if (index >= pool.length) {
        setPhase(hp <= 0 ? "defeat" : "result");
        return;
      }
      const attacker = pool[index];
      const variantIndex = variantOrder[index % variantOrder.length];
      const leadMs = index === 0 ? COUNTER_LEAD_MS : ENEMY_ATTACK_STEP_MS - ENEMY_STRIKE_WINDUP_MS;

      setTimeout(() => {
        setLungingIds((prev) => new Set([...prev, attacker.instanceId]));
        playEnemyAttackStartSound(); // kazu制作の実音声（発動効果音）＝敵の攻撃開始の合図

        setTimeout(() => {
          const guardMult = partyBuffsRef.current.guard?.multiplier ?? 1;
          const dmg = Math.round(resolveEnemyAttack(attacker, partyMaxHp) * guardMult);
          const newHp = Math.max(0, hp - dmg);
          setPartyHp(newHp);
          // 反撃し終えた敵は頭上の数字を引き直す（次はまたその数だけラウンドを待って反撃する）。
          // attackChargeTurnsも同じ値にしておき、次回の反撃ダメージが「今回何ターン溜めたか」を
          // 正しく参照できるようにする（resolveEnemyAttackのchargeFactor参照）。
          setEnemies((prev) =>
            prev.map((en) => {
              if (en.instanceId !== attacker.instanceId) return en;
              const charge = rollAttackCountdown();
              return { ...en, attackCountdown: charge, attackChargeTurns: charge };
            })
          );

          // 状態異常を仕掛けてくるか判定（石化していない生存メンバーからランダムに1体）。
          const eligibleIds = partyMembers
            .map((c) => c.id)
            .filter((id) => !partyStatusRef.current[id]?.petrification);
          if (eligibleIds.length) {
            const targetId = eligibleIds[Math.floor(Math.random() * eligibleIds.length)];
            const statusKey = rollEnemyInflictedStatus(charactersById[targetId]);
            if (statusKey) {
              const nextStatus = applyStatusEffect(partyStatusRef.current, targetId, statusKey);
              partyStatusRef.current = nextStatus;
              setPartyStatus(nextStatus);
              if (isPartyAllPetrified(nextStatus, partyMembers.map((c) => c.id))) {
                setPhase("defeat");
                return;
              }
            }
          }

          const partyRect = rectOf(partyAreaRef.current, stageRef.current);
          fxRef.current?.playEnemyCounter({ rect: partyRect, variantIndex, damage: dmg }); // 引っ掻き視覚＋被弾数値＋被弾音
          triggerPartyShake(260);

          setTimeout(() => {
            setLungingIds((prev) => {
              const next = new Set(prev);
              next.delete(attacker.instanceId);
              return next;
            });
          }, ENEMY_LUNGE_CLEAR_MS);

          if (newHp <= 0) {
            setPhase("defeat");
            return;
          }
          runAttack(index + 1, newHp);
        }, ENEMY_STRIKE_WINDUP_MS);
      }, leadMs);
    }

    runAttack(0, startHp);
  }

  function pickChoice(index) {
    const correct = index === problem.correctIndex;
    setPhase("resolving");
    // このラウンドの行動可否（麻痺/石化/スロー/封印/混乱）は、前のラウンドまでに
    // 蓄積した状態異常のスナップショットで判定する（今ラウンド中に敵から新しく
    // かけられる状態異常は、次のラウンドから効いてくる）。
    const statusSnapshot = partyStatus;

    // 先に正解/不正解の音を聞かせ、その後にエフェクト(たま)を出す。
    // 正解した瞬間は「正解！」の派手な演出をすぐに出す。
    if (correct) {
      playCorrectSound();
      fxRef.current?.playCorrectBurst();
    } else {
      playIncorrectSound();
    }

    const stageEl = stageRef.current;

    setTimeout(() => {
      if (!correct) {
        const firstTarget = aliveEnemies[0];
        const fromPoint = pointOf(portraitRefs.current[partyMembers[0]?.id], stageEl);
        const toPoint = firstTarget ? pointOf(enemyRefs.current[firstTarget.instanceId], stageEl) : null;
        fxRef.current?.playMiss({ subject: subjectFor(partyMembers[0]), from: fromPoint, to: toPoint });
        setTimeout(
          () => resolveAfterPartyAttack({ hits: [], supportActions: [], statusSnapshot }),
          PROJECTILE_MS.miss
        );
        return;
      }

      // 正解＝行動できるメンバー全員が同時にこうげき（麻痺/石化/スロー(今回不可)は
      // 行動そのものをスキップ）。攻撃対象は「自分が指定した敵」（ドラッグ済みなら
      // それ、未指定なら敵に均等に割り振り）。誰から見ても敵の実際の表示位置から
      // たまを撃つ。全体ダメージスキル(aoeDamage)使用時は生存中の敵全員がtargetに
      // なる（1キャラが複数ヒットを生む）。支援スキル(buffAtk/buffGuard/heal/cure)
      // 使用時はダメージを出さず、party全体への効果として別枠(supportActions)で集計する。
      const hitEntries = [];
      const supportActions = [];
      const actedCharacterIds = [];
      const atkBuffMultiplier = partyBuffs.atk?.multiplier ?? 1;
      const partySelfPoint = (() => {
        const r = rectOf(partyAreaRef.current, stageEl);
        return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
      })();

      partyMembers.forEach((c, i) => {
        const effects = statusSnapshot[c.id];
        if (!canActThisRound(effects)) return; // 麻痺・石化・スロー(今ターン不可)
        actedCharacterIds.push(c.id);

        const level = levelFromExp(save.owned[c.id]?.exp || 0, c.rarity);
        const charSubject = subjectFor(c);
        const skill = c.skill;
        const sealed = !canUseSkillThisRound(effects);
        const useSkillNow = !sealed && !!skillToggle[c.id] && (gauge[c.id] || 0) >= SKILL_GAUGE_MAX;
        const from = pointOf(portraitRefs.current[c.id], stageEl);

        if (useSkillNow && skill && ["buffAtk", "buffGuard", "heal", "cure"].includes(skill.category)) {
          supportActions.push({ character: c, skill });
          return; // 支援スキルはダメージを出さない
        }

        if (isConfusedThisRound(effects)) {
          const rawAttack = resolvePlayerAttack(c, level, charSubject, true, { atkBuffMultiplier });
          const damage = Math.max(
            1,
            Math.round(rawAttack.damage * STATUS_DEFS.confusion.damageFraction * DIFFICULTY_DAMAGE_MULTIPLIER[difficulty])
          );
          hitEntries.push({
            character: c,
            attack: { ...rawAttack, damage },
            subject: charSubject,
            useSkill: false,
            targetId: "PARTY_SELF",
            isSelfHit: true,
            charIndex: i,
            subIndex: 0,
            from,
            to: partySelfPoint,
          });
          return;
        }

        if (useSkillNow && skill?.category === "aoeDamage") {
          aliveEnemies.forEach((en, subIndex) => {
            const rawAttack = resolvePlayerAttack(c, level, charSubject, true, {
              skillMultiplier: skill.multiplier,
              atkBuffMultiplier,
            });
            const damage = Math.max(1, Math.round(rawAttack.damage * DIFFICULTY_DAMAGE_MULTIPLIER[difficulty]));
            hitEntries.push({
              character: c,
              attack: { ...rawAttack, damage },
              subject: charSubject,
              useSkill: true,
              targetId: en.instanceId,
              charIndex: i,
              subIndex,
              from,
              to: pointOf(enemyRefs.current[en.instanceId], stageEl),
            });
          });
          return;
        }

        const skillMultiplier = useSkillNow && skill?.category === "singleDamage" ? skill.multiplier : 1;
        const rawAttack = resolvePlayerAttack(c, level, charSubject, true, { skillMultiplier, atkBuffMultiplier });
        const damage = Math.max(1, Math.round(rawAttack.damage * DIFFICULTY_DAMAGE_MULTIPLIER[difficulty]));
        const targetId = resolveTarget(c.id, i);
        hitEntries.push({
          character: c,
          attack: { ...rawAttack, damage },
          subject: charSubject,
          useSkill: useSkillNow,
          targetId,
          charIndex: i,
          subIndex: 0,
          from,
          to: targetId ? pointOf(enemyRefs.current[targetId], stageEl) : null,
        });
      });

      let maxLanding = 0;
      hitEntries.forEach((h) => {
        const stagger = h.charIndex * STAGGER_MS + h.subIndex * 45 + Math.random() * STAGGER_JITTER_MS;
        const travel = h.attack.isCrit ? PROJECTILE_MS.crit : PROJECTILE_MS.normal;
        maxLanding = Math.max(maxLanding, stagger + POPUP_LEAD_MS + travel);
        const offset = {
          dx: Math.random() * 12 - 6,
          dy: Math.random() * 14 - 7,
        };

        // 枠から全体のイラストが飛び出す→少し間を置いてから、たまを撃つ。
        if (h.subIndex === 0) {
          setTimeout(() => {
            setPoppedOut((s) => ({ ...s, [h.character.id]: true }));
          }, stagger);
        }

        setTimeout(() => {
          fxRef.current?.playHit({
            damage: h.attack.damage,
            isCrit: h.attack.isCrit,
            subject: h.subject,
            from: h.from,
            to: h.to,
            offset,
          });
          setPoppedOut((s) => ({ ...s, [h.character.id]: false })); // 攻撃と同時に枠へ戻り始める
        }, stagger + POPUP_LEAD_MS);
      });

      // 支援スキル勢も、控えめに一度だけ枠から飛び出す演出を出す（専用FXはまだ無い）。
      supportActions.forEach((s, idx) => {
        const stagger = s.character.id ? partyMembers.findIndex((c) => c.id === s.character.id) * STAGGER_MS : idx * STAGGER_MS;
        maxLanding = Math.max(maxLanding, stagger + POPUP_LEAD_MS + 200);
        setTimeout(() => setPoppedOut((p) => ({ ...p, [s.character.id]: true })), stagger);
        setTimeout(() => setPoppedOut((p) => ({ ...p, [s.character.id]: false })), stagger + POPUP_LEAD_MS + 200);
      });

      // ゲージ更新：行動できたキャラは+1(上限10)、スキルを使ったキャラは0に戻る。
      setGauge((g) => {
        const next = { ...g };
        for (const id of actedCharacterIds) {
          const usedSkill =
            hitEntries.some((h) => h.character.id === id && h.useSkill) ||
            supportActions.some((s) => s.character.id === id);
          next[id] = usedSkill ? 0 : Math.min(SKILL_GAUGE_MAX, (g[id] || 0) + 1);
        }
        return next;
      });

      setTimeout(
        () => resolveAfterPartyAttack({ hits: hitEntries, supportActions, statusSnapshot }),
        maxLanding
      );
    }, ANSWER_SOUND_LEAD_MS);
  }

  function nextStep() {
    if (phase === "defeat") return;
    const allDead = enemies.every((en) => en.hp <= 0);
    if (allDead) {
      const isLast = waveIndex === encounters.length - 1;
      if (isLast) {
        finishBattle();
        return;
      }
      const nextIndex = waveIndex + 1;
      setWaveIndex(nextIndex);
      setEnemies((encounters[nextIndex] || []).map((e) => ({ ...e })));
      setTargets({});
      setPhase("choose");
      setSkillToggle({});
      setPoppedOut({});
      return;
    }
    setPhase("choose");
    setSkillToggle({});
    setPoppedOut({});
  }

  // 戦闘開始時に一度だけ「START!」を出す。BattleFXの初期化(子のuseEffect)は
  // このuseEffectより先に走るので、マウント直後でもfxRef.currentは使える。
  useEffect(() => {
    fxRef.current?.playStartBanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 攻撃結果(result)は「つぎへ」ボタンを押させず、少し見せてから自動で次のこうげきへ。
  useEffect(() => {
    if (phase !== "result") return undefined;
    const t = setTimeout(() => nextStep(), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function finishBattle() {
    for (const id of save.party.filter(Boolean)) {
      actions.addExp(id, Math.round(totals.exp / save.party.filter(Boolean).length));
    }
    actions.addCoins(totals.coins);

    let isFirstClear = false;
    if (kind === "subUnit") {
      isFirstClear = actions.markSubUnitCleared(grade, chapterId, params.subUnitId);
    } else if (kind === "chapterBoss") {
      actions.markChapterCleared(grade, chapterId);
    } else if (kind === "finalBoss") {
      actions.markFinalBossCleared(grade);
    }

    nav.go(
      "reward",
      { ...params, exp: totals.exp, coins: totals.coins, isFirstClear },
      { replace: true }
    );
  }

  if (!enemies.length) return null;

  return (
    <div className="mw-screen">
      <div className="mw-topbar">
        <span>
          {waveIndex + 1} / {encounters.length}戦目
        </span>
        <span>{topSubjectLabel}のバトル</span>
      </div>

      {/* 敵とパーティを1つの舞台にまとめる：たまが「選んだキャラの位置」から
          飛べるように、敵の攻撃がパーティの上に出せるように、両方が同じ
          座標系の上にいる必要があるため。FXのCanvasはこの舞台全体に1枚だけ重ねる。 */}
      <div className="mw-panel mw-battle-stage" ref={stageRef}>
        <BattleFX ref={fxRef} />

        <div className="mw-enemy-area">
          <div className="mw-enemy-row">
            {enemies.map((en, enIndex) => {
              const defeated = en.hp <= 0;
              return (
                <div
                  key={en.instanceId}
                  className={`mw-enemy-slot ${shakingIds.has(en.instanceId) ? "mw-shake" : ""} ${
                    lungingIds.has(en.instanceId) ? "mw-lunge" : ""
                  } ${defeated ? "mw-enemy-defeated" : ""} ${
                    hoverTargetId === en.instanceId ? "mw-enemy-drop-hover" : ""
                  }`}
                  style={{ "--bob-delay": `${enIndex * 0.35}s` }}
                  ref={(el) => {
                    enemyRefs.current[en.instanceId] = el;
                  }}
                >
                  {!defeated && (
                    <div className="mw-enemy-countdown" title="あと何ラウンドで反撃してくるか">
                      {Math.max(0, en.attackCountdown)}
                    </div>
                  )}
                  <MonsterPortrait character={en} size="full" frameless />
                  <div className="mw-enemy-name">{en.name}</div>
                  {/* 相手の正確なHPはあえて隠す（2026-09-18指示）。バーだけ残す。 */}
                  <div className="mw-hpbar" style={{ width: "90%" }}>
                    <div style={{ width: `${Math.max(0, (en.hp / en.maxHp) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`mw-party-area ${partyShake ? "mw-shake" : ""}`} ref={partyAreaRef}>
          {/* タップ直後だけ出す説明（あと何問／スキル発動確認）。2026-09-18追加。 */}
          {tapInfo && <div className="mw-tap-info-banner">{tapInfo.text}</div>}
          <div className="mw-party-row" style={{ marginBottom: 10 }}>
            {partyMembers.map((c) => {
              const hasSkill = !!c.skill;
              const g = gauge[c.id] || 0;
              const ready = hasSkill && g >= SKILL_GAUGE_MAX;
              const toggled = !!skillToggle[c.id];
              const popped = !!poppedOut[c.id];
              const statusEffects = partyStatus[c.id];
              return (
                <button
                  key={c.id}
                  className="mw-portrait-btn"
                  ref={(el) => {
                    portraitRefs.current[c.id] = el;
                  }}
                  disabled={phase !== "choose"}
                  onPointerDown={(e) => handlePortraitPointerDown(e, c.id)}
                >
                  {/* 名前は表示せず絵柄を大きく（2026-09-18指示）。満タンだと枠が光り、
                      少しホワンホワンと拡縮する（MonsterPortraitのready→mw-portrait-ready）。 */}
                  <MonsterPortrait character={c} size="small" selected={toggled} ready={ready} />
                  {statusEffects && (
                    <div className="mw-status-row mw-status-row-overlay">
                      {Object.entries(statusEffects).map(([key, state]) => (
                        <span key={key} className="mw-status-chip" title={key}>
                          {STATUS_ICON[key]}
                          {state.turnsLeft ?? ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* 攻撃の瞬間、枠から全体のイラストが縦横2倍の大きさで飛び出す */}
                  {monsterImageUrl(c, "full") && (
                    <div className={`mw-portrait-popup ${popped ? "mw-popup-show" : ""}`}>
                      <img
                        src={monsterImageUrl(c, "full")}
                        alt=""
                        style={{ filter: monsterImgFilter(c) }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mw-hpbar">
            <div style={{ width: `${Math.max(0, (partyHp / partyMaxHp) * 100)}%` }} />
          </div>
          <div className="mw-sub">
            {partyHp} / {partyMaxHp}
          </div>
          {(partyBuffs.atk || partyBuffs.guard) && (
            <div className="mw-buff-row">
              {partyBuffs.atk && (
                <span className="mw-buff-chip mw-buff-atk">
                  ⚔️×{partyBuffs.atk.multiplier}（あと{partyBuffs.atk.turnsLeft}）
                </span>
              )}
              {partyBuffs.guard && (
                <span className="mw-buff-chip mw-buff-guard">
                  🛡️×{partyBuffs.guard.multiplier}（あと{partyBuffs.guard.turnsLeft}）
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {dragGhost && (
        <div
          className="mw-drag-ghost"
          style={{ left: dragGhost.x, top: dragGhost.y }}
        >
          <MonsterPortrait character={charactersById[dragGhost.charId]} size="small" frameless />
        </div>
      )}

      {phase === "choose" && (
        <div className="mw-panel">
          <div className="mw-diff-row">
            {DIFFICULTY_KEYS.map((d) => (
              <button
                key={d}
                className={`mw-diff-btn ${difficulty === d ? "selected" : ""} ${
                  pickingDifficulty && difficulty === d ? "picked" : ""
                }`}
                disabled={pickingDifficulty}
                onClick={() => chooseDifficulty(d)}
              >
                {DIFFICULTY_LABEL[d]}
                <span className="mw-diff-mult">×{DIFFICULTY_DAMAGE_MULTIPLIER[d]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "question" && problem && (
        <div className="mw-panel">
          <div className="mw-question">{problem.question}</div>
          <div className="mw-choices">
            {problem.choices.map((choice, i) => (
              <button key={i} className="mw-choice" onClick={() => pickChoice(i)}>
                {choice}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "resolving" && (
        <div className="mw-panel mw-center" style={{ minHeight: 60 }}>
          <div className="mw-sub">…</div>
        </div>
      )}

      {phase === "defeat" && (
        <div className="mw-panel mw-center">
          <div>ぜんめつしてしまった…</div>
          <button className="mw-btn primary" onClick={() => nav.resetTo("menu")}>
            メニューにもどる
          </button>
        </div>
      )}
    </div>
  );
}
