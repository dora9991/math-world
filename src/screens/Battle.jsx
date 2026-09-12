import { useMemo, useRef, useState } from "react";
import { getChapter, getGrade, CHAPTER_SUBJECT, SUBJECT_LABEL } from "../data/storyMap.js";
import { useGame } from "../context/GameContext.jsx";
import {
  PARTY_MAX_HP,
  resolvePlayerAttack,
  resolveEnemyAttack,
  spawnEnemyGroup,
  spawnBoss,
} from "../engine/battleEngine.js";
import { generateProblem } from "../engine/problemGenerators.js";
import { levelFromExp } from "../engine/expCurve.js";
import BattleFX, { PROJECTILE_MS } from "../fx/BattleFX.jsx";
import { playCorrectSound, playIncorrectSound } from "../fx/sound.js";
import MonsterPortrait from "../components/MonsterPortrait.jsx";

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

function buildEncounters(params, chapter, gradeData) {
  const { kind, subUnitId } = params;
  if (kind === "subUnit") {
    const subUnit = chapter.subUnits.find((s) => s.id === subUnitId);
    const numGroups = 1 + Math.floor(Math.random() * 3); // 1〜3組
    const groups = Array.from({ length: numGroups }, (_, i) =>
      spawnEnemyGroup(subUnit.enemy, i)
    );
    return [...groups, spawnBoss(subUnit.boss)];
  }
  if (kind === "chapterBoss") {
    return [spawnBoss(chapter.chapterBoss)];
  }
  if (kind === "finalBoss") {
    return [spawnBoss(gradeData.finalBoss)];
  }
  return [];
}

export default function Battle({ nav, params }) {
  const { grade, chapterId, kind } = params;
  const { save, actions, charactersById } = useGame();
  const gradeData = getGrade(grade);
  const chapter = chapterId ? getChapter(grade, chapterId) : null;

  const encounters = useMemo(() => buildEncounters(params, chapter, gradeData), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [encounterIndex, setEncounterIndex] = useState(0);
  const [enemyHp, setEnemyHp] = useState(encounters[0]?.hp ?? 0);
  const [partyHp, setPartyHp] = useState(PARTY_MAX_HP);
  const [phase, setPhase] = useState("choose"); // choose | question | resolving | result | defeat
  // スキルは「発動予約」をキャラごとにトグル。同じキャラは1バトルで1回だけ(skillUsedで管理)。
  const [skillToggle, setSkillToggle] = useState({});
  const [skillUsed, setSkillUsed] = useState({});
  const [problem, setProblem] = useState(null);
  const [log, setLog] = useState("");
  const [totals, setTotals] = useState({ exp: 0, coins: 0 });
  const fxRef = useRef(null);
  const [shake, setShake] = useState(false);

  function triggerShake(ms) {
    setShake(true);
    setTimeout(() => setShake(false), ms);
  }

  const enemy = encounters[encounterIndex];
  const isBossTurn = encounterIndex === encounters.length - 1;
  const partyMembers = save.party.filter(Boolean).map((id) => charactersById[id]);

  // 章のステージなら章の系統に固定。大ボス戦(章なし)は、キャラ自身の得意系統で殴る。
  function subjectFor(character) {
    return chapterId ? CHAPTER_SUBJECT[chapterId] : character?.primarySubject;
  }
  const topSubjectLabel = chapterId ? SUBJECT_LABEL[CHAPTER_SUBJECT[chapterId]] : "総力戦";

  function startQuestion() {
    setProblem(generateProblem(chapterId || "c1"));
    setPhase("question");
  }

  // 3体分の攻撃(またはミス)が出そろった後にまとめて呼ぶ。HPバー・ログ・シェイクは
  // ここで一括更新＝見た目の着弾とゲーム状態の更新を同期させる。
  function applyPartyImpact({ missed, hits }) {
    const totalDamage = missed ? 0 : hits.reduce((s, h) => s + h.attack.damage, 0);
    const anyCrit = !missed && hits.some((h) => h.attack.isCrit);
    if (!missed) triggerShake(anyCrit ? 450 : 220);

    const headline = missed
      ? "パーティの攻撃は届かなかった…（不正解）"
      : `${hits
          .map((h) => `${h.character.name}:${h.attack.damage}${h.attack.isCrit ? "(会心!)" : ""}`)
          .join(" / ")}\n合計${totalDamage}ダメージ！`;

    const newEnemyHp = Math.max(0, enemyHp - totalDamage);
    setEnemyHp(newEnemyHp);

    if (!missed && newEnemyHp <= 0) {
      const isBoss = encounterIndex === encounters.length - 1;
      const gainedExp = isBoss ? REWARD_EXP_BOSS : REWARD_EXP_GROUP;
      const gainedCoins = isBoss ? REWARD_COIN_BOSS : REWARD_COIN_GROUP;
      setTotals((t) => ({ exp: t.exp + gainedExp, coins: t.coins + gainedCoins }));
      setLog(`${headline}\n${enemy.name} をたおした！`);
      setPhase("result");
      fxRef.current?.playDefeat();
      triggerShake(500);
      return;
    }

    const dmg = resolveEnemyAttack(enemy);
    const newPartyHp = Math.max(0, partyHp - dmg);
    setPartyHp(newPartyHp);
    setLog(`${headline}\n${enemy.name} の反撃、${dmg}ダメージ！`);
    setPhase(newPartyHp <= 0 ? "defeat" : "result");
  }

  function pickChoice(index) {
    const correct = index === problem.correctIndex;
    setPhase("resolving");

    // 先に正解/不正解の音を聞かせ、その後にエフェクト(たま)を出す。
    if (correct) playCorrectSound();
    else playIncorrectSound();

    setTimeout(() => {
      if (!correct) {
        fxRef.current?.playMiss({ subject: subjectFor(partyMembers[0]) });
        setTimeout(
          () => applyPartyImpact({ missed: true, hits: [] }),
          PROJECTILE_MS.miss
        );
        return;
      }

      // 正解＝3体同時にこうげき。誰かを選ぶのではなく全員が殴る。
      const hits = partyMembers.map((c) => {
        const level = levelFromExp(save.owned[c.id]?.exp || 0, c.rarity);
        const charSubject = subjectFor(c);
        const useSkillNow = !!skillToggle[c.id] && !skillUsed[c.id];
        const attack = resolvePlayerAttack(c, level, charSubject, true, useSkillNow);
        return { character: c, attack, subject: charSubject, useSkill: useSkillNow };
      });

      let maxLanding = 0;
      hits.forEach((h, i) => {
        const stagger = i * STAGGER_MS + Math.random() * STAGGER_JITTER_MS;
        const travel = h.attack.isCrit ? PROJECTILE_MS.crit : PROJECTILE_MS.normal;
        maxLanding = Math.max(maxLanding, stagger + travel);
        const offset = {
          dx: (i - 1) * OFFSET_SPREAD + (Math.random() * 12 - 6),
          dy: Math.random() * 14 - 7,
        };
        setTimeout(() => {
          fxRef.current?.playHit({
            damage: h.attack.damage,
            isCrit: h.attack.isCrit,
            subject: h.subject,
            offset,
          });
        }, stagger);
      });

      const usedIds = hits.filter((h) => h.useSkill).map((h) => h.character.id);
      if (usedIds.length) {
        setSkillUsed((s) => {
          const next = { ...s };
          for (const id of usedIds) next[id] = true;
          return next;
        });
      }

      setTimeout(() => applyPartyImpact({ missed: false, hits }), maxLanding);
    }, ANSWER_SOUND_LEAD_MS);
  }

  function nextStep() {
    if (phase === "defeat") return;
    if (enemyHp <= 0) {
      const isLast = encounterIndex === encounters.length - 1;
      if (isLast) {
        finishBattle();
        return;
      }
      const nextIndex = encounterIndex + 1;
      setEncounterIndex(nextIndex);
      setEnemyHp(encounters[nextIndex].hp);
      setPhase("choose");
      setSkillToggle({});
      setLog("");
      return;
    }
    setPhase("choose");
    setSkillToggle({});
    setLog("");
  }

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

  if (!enemy) return null;

  return (
    <div className="mw-screen">
      <div className="mw-topbar">
        <span>
          {encounterIndex + 1} / {encounters.length}戦目
        </span>
        <span>{topSubjectLabel}のバトル</span>
      </div>

      <div className={`mw-panel mw-enemy ${shake ? "mw-shake" : ""}`}>
        <BattleFX ref={fxRef} />
        <div className="mw-enemy-portrait">
          <MonsterPortrait character={enemy} size="full" />
        </div>
        <div style={{ fontWeight: 700 }}>{enemy.name}</div>
        <div className="mw-hpbar" style={{ margin: "8px 0" }}>
          <div style={{ width: `${Math.max(0, (enemyHp / enemy.maxHp) * 100)}%` }} />
        </div>
        <div className="mw-sub">
          {enemyHp} / {enemy.maxHp}
        </div>
      </div>

      <div className="mw-panel">
        <div className="mw-sub" style={{ marginBottom: 8 }}>
          パーティ（HPは3体合算・スキルはポートレートをタップで発動予約）
        </div>
        <div className="mw-party-row" style={{ marginBottom: 10 }}>
          {partyMembers.map((c) => {
            const hasSkill = !!c.skill;
            const used = !!skillUsed[c.id];
            const toggled = !!skillToggle[c.id];
            return (
              <button
                key={c.id}
                className="mw-portrait-btn"
                disabled={phase !== "choose" || !hasSkill || used}
                onClick={() => setSkillToggle((s) => ({ ...s, [c.id]: !s[c.id] }))}
              >
                <MonsterPortrait
                  character={c}
                  size="small"
                  selected={toggled}
                  footer={
                    <>
                      {c.name}
                      {hasSkill && (
                        <div style={{ color: toggled ? "var(--accent)" : "var(--text-dim)" }}>
                          {used
                            ? "スキル使用済"
                            : toggled
                            ? `${c.skill.icon}発動予約`
                            : `${c.skill.icon}タップで発動`}
                        </div>
                      )}
                    </>
                  }
                />
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

      {phase === "choose" && (
        <div className="mw-panel">
          <div className="mw-sub" style={{ marginBottom: 8 }}>
            3体同時にこうげきする
          </div>
          <button className="mw-btn primary" onClick={startQuestion}>
            こうげき！
          </button>
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
          <div className="mw-sub">たまが飛んでいく…</div>
        </div>
      )}

      {phase === "result" && (
        <div className="mw-panel">
          <div className="mw-log" style={{ whiteSpace: "pre-line" }}>
            {log}
          </div>
          <button className="mw-btn primary" style={{ marginTop: 10 }} onClick={nextStep}>
            つぎへ ▶
          </button>
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
