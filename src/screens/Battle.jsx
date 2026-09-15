import { useEffect, useMemo, useRef, useState } from "react";
import { getChapter, getGrade, CHAPTER_SUBJECT, SUBJECT_LABEL } from "../data/storyMap.js";
import { useGame } from "../context/GameContext.jsx";
import {
  PARTY_MAX_HP,
  resolvePlayerAttack,
  resolveEnemyAttack,
  spawnEnemyGroup,
  spawnBoss,
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
    const wave = Array.from({ length: count }, (_, i) => spawnEnemyGroup(subUnit.enemy, i));
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
  const [partyHp, setPartyHp] = useState(PARTY_MAX_HP);
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
  const partyMembers = save.party.filter(Boolean).map((id) => charactersById[id]);
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
      setDragGhost(null);
      setHoverTargetId(null);

      if (!d) return;
      if (d.moved) {
        if (hoverRef.current) {
          setTargets((t) => ({ ...t, [d.charId]: hoverRef.current }));
        }
      } else {
        const c = charactersById[d.charId];
        if (c?.skill && (gauge[d.charId] || 0) >= 10) {
          setSkillToggle((s) => ({ ...s, [d.charId]: !s[d.charId] }));
        }
      }
      hoverRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // 自分たちの攻撃が出そろった後の後始末：生き残りがいれば「下がる→引っ掻く→揺れる」の
  // 反撃シーケンスを挟んでからダメージを反映する。全滅させた場合は反撃なしで即結果へ。
  function resolveAfterPartyAttack({ missed, hits }) {
    if (missed) {
      scheduleEnemyCounter();
      return;
    }

    const damageByTarget = {};
    for (const h of hits) {
      damageByTarget[h.targetId] = (damageByTarget[h.targetId] || 0) + h.attack.damage;
    }

    let gainedExp = 0;
    let gainedCoins = 0;
    const defeatedNames = [];
    const hitIds = [];

    const updatedEnemies = enemies.map((en) => {
      const dmg = damageByTarget[en.instanceId] || 0;
      if (dmg <= 0) return en;
      hitIds.push(en.instanceId);
      const newHp = Math.max(0, en.hp - dmg);
      if (en.hp > 0 && newHp <= 0) {
        gainedExp += isBossWave ? REWARD_EXP_BOSS : REWARD_EXP_GROUP;
        gainedCoins += isBossWave ? REWARD_COIN_BOSS : REWARD_COIN_GROUP;
        defeatedNames.push(en.name);
        fxRef.current?.playDefeat({ to: pointOf(enemyRefs.current[en.instanceId], stageRef.current) });
      }
      return { ...en, hp: newHp };
    });
    setEnemies(updatedEnemies);
    triggerEnemyShakeFor(hitIds, hits.some((h) => h.attack.isCrit) ? 450 : 220);
    if (gainedExp || gainedCoins) {
      setTotals((t) => ({ exp: t.exp + gainedExp, coins: t.coins + gainedCoins }));
    }

    const allDead = updatedEnemies.every((en) => en.hp <= 0);
    if (allDead) {
      setPhase("result");
      return;
    }

    const survivors = updatedEnemies.filter((en) => en.hp > 0);
    scheduleEnemyCounter(survivors);
  }

  // 敵の反撃シーケンス：生き残っている敵の数だけ、1体ずつ順番に反撃する
  // （敵1体なら1回、3体なら3回）。反撃は0.3秒間隔でどんどん来るテンポ。
  // 「予備動作→引っ掻く」の引っ掻いた瞬間に、被ダメージ数値・HP・パーティの
  // 揺れを即座に反映する（テキストのログ表示はもう出さない）。
  // 引っ掻きの向きは4パターン（右上/左上/縦やや右/縦やや左）をシャッフルして
  // 割り当てるので、同じターンで連続する反撃どうし向きが被らない。
  function scheduleEnemyCounter(survivors) {
    const pool = survivors && survivors.length ? survivors : enemies.filter((en) => en.hp > 0);
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
          const dmg = resolveEnemyAttack(attacker);
          const newHp = Math.max(0, hp - dmg);
          setPartyHp(newHp);
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

    runAttack(0, partyHp);
  }

  function pickChoice(index) {
    const correct = index === problem.correctIndex;
    setPhase("resolving");

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
        setTimeout(() => resolveAfterPartyAttack({ missed: true, hits: [] }), PROJECTILE_MS.miss);
        return;
      }

      // 正解＝3体同時にこうげき。攻撃対象は「自分が指定した敵」（ドラッグ済みならそれ、
      // 未指定なら敵に均等に割り振り）。誰から見ても敵の実際の表示位置からたまを撃つ。
      const hits = partyMembers.map((c, i) => {
        const level = levelFromExp(save.owned[c.id]?.exp || 0, c.rarity);
        const charSubject = subjectFor(c);
        const useSkillNow = !!skillToggle[c.id] && (gauge[c.id] || 0) >= 10;
        const rawAttack = resolvePlayerAttack(c, level, charSubject, true, useSkillNow);
        // 難易度ダメージ倍率（簡単0.8〜鬼1.5）。この問題の難しさに応じて全員分にかかる。
        const attack = {
          ...rawAttack,
          damage: Math.max(1, Math.round(rawAttack.damage * DIFFICULTY_DAMAGE_MULTIPLIER[difficulty])),
        };
        const from = pointOf(portraitRefs.current[c.id], stageEl);
        const targetId = resolveTarget(c.id, i);
        const to = targetId ? pointOf(enemyRefs.current[targetId], stageEl) : null;
        return { character: c, attack, subject: charSubject, useSkill: useSkillNow, from, to, targetId };
      });

      let maxLanding = 0;
      hits.forEach((h, i) => {
        const stagger = i * STAGGER_MS + Math.random() * STAGGER_JITTER_MS;
        const travel = h.attack.isCrit ? PROJECTILE_MS.crit : PROJECTILE_MS.normal;
        maxLanding = Math.max(maxLanding, stagger + POPUP_LEAD_MS + travel);
        const offset = {
          dx: Math.random() * 12 - 6,
          dy: Math.random() * 14 - 7,
        };

        // 枠から全体のイラストが飛び出す→少し間を置いてから、たまを撃つ。
        setTimeout(() => {
          setPoppedOut((s) => ({ ...s, [h.character.id]: true }));
        }, stagger);

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

      // ゲージ更新：攻撃を当てたキャラは+1(上限10)、スキルを使ったキャラは0に戻る。
      setGauge((g) => {
        const next = { ...g };
        for (const h of hits) {
          next[h.character.id] = h.useSkill ? 0 : Math.min(10, (g[h.character.id] || 0) + 1);
        }
        return next;
      });

      setTimeout(() => resolveAfterPartyAttack({ missed: false, hits }), maxLanding);
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
                  <MonsterPortrait character={en} size="full" frameless />
                  <div className="mw-enemy-name">{en.name}</div>
                  <div className="mw-hpbar" style={{ width: "90%" }}>
                    <div style={{ width: `${Math.max(0, (en.hp / en.maxHp) * 100)}%` }} />
                  </div>
                  <div className="mw-sub">
                    {en.hp} / {en.maxHp}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`mw-party-area ${partyShake ? "mw-shake" : ""}`} ref={partyAreaRef}>
          <div className="mw-party-row mw-party-row-small" style={{ marginBottom: 10 }}>
            {partyMembers.map((c, i) => {
              const hasSkill = !!c.skill;
              const g = gauge[c.id] || 0;
              const ready = hasSkill && g >= 10;
              const toggled = !!skillToggle[c.id];
              const popped = !!poppedOut[c.id];
              const targetId = resolveTarget(c.id, i);
              const targetIndex = aliveEnemies.findIndex((e) => e.instanceId === targetId);
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
                  <MonsterPortrait
                    character={c}
                    size="small"
                    selected={toggled}
                    ready={ready}
                    footer={
                      <>
                        {c.name}
                        {enemies.length > 1 && targetIndex >= 0 ? `→敵${targetIndex + 1}` : ""}
                        <div className="mw-gauge-row">
                          {Array.from({ length: 10 }, (_, t) => (
                            <div key={t} className={`mw-gauge-tick ${t < g ? "filled" : ""}`} />
                          ))}
                        </div>
                        {hasSkill && (
                          <span className={`mw-skill-icon ${ready ? "mw-skill-ready" : ""}`}>
                            {c.skill.icon}
                          </span>
                        )}
                      </>
                    }
                  />
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
            <div style={{ width: `${Math.max(0, (partyHp / PARTY_MAX_HP) * 100)}%` }} />
          </div>
          <div className="mw-sub">
            {partyHp} / {PARTY_MAX_HP}
          </div>
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
