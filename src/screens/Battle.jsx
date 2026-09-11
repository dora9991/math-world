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
import { getStatsAtLevel } from "../data/growthCurve.js";
import { levelFromExp } from "../engine/expCurve.js";
import BattleFX from "../fx/BattleFX.jsx";

const REWARD_EXP_GROUP = 12;
const REWARD_EXP_BOSS = 40;
const REWARD_COIN_GROUP = 8;
const REWARD_COIN_BOSS = 30;

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
  const [phase, setPhase] = useState("choose"); // choose | question | result | victory | defeat
  const [selectedCharId, setSelectedCharId] = useState(save.party[0] || null);
  const [useSkill, setUseSkill] = useState(false);
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

  const subject = chapterId
    ? CHAPTER_SUBJECT[chapterId]
    : charactersById[selectedCharId]?.primarySubject;

  function startQuestion() {
    setProblem(generateProblem(chapterId || "c1"));
    setPhase("question");
  }

  function pickChoice(index) {
    const character = charactersById[selectedCharId];
    const level = levelFromExp(save.owned[selectedCharId]?.exp || 0, character.rarity);
    const correct = index === problem.correctIndex;
    const attack = resolvePlayerAttack(character, level, subject, correct, useSkill);

    let message;
    if (!correct) {
      message = `${character.name} の攻撃は届かなかった…（不正解）`;
      fxRef.current?.playMiss();
    } else if (attack.isCrit) {
      message = `会心の一撃！ ${character.name} の攻撃、${attack.damage}ダメージ！`;
      fxRef.current?.playHit({ damage: attack.damage, isCrit: true });
      triggerShake(400);
    } else {
      message = `${character.name} の攻撃、${attack.damage}ダメージ。`;
      fxRef.current?.playHit({ damage: attack.damage, isCrit: false });
      triggerShake(180);
    }

    const newEnemyHp = Math.max(0, enemyHp - attack.damage);
    setEnemyHp(newEnemyHp);
    if (useSkill) setSkillUsed((s) => ({ ...s, [selectedCharId]: true }));

    if (newEnemyHp <= 0) {
      const isBoss = encounterIndex === encounters.length - 1;
      const gainedExp = isBoss ? REWARD_EXP_BOSS : REWARD_EXP_GROUP;
      const gainedCoins = isBoss ? REWARD_COIN_BOSS : REWARD_COIN_GROUP;
      setTotals((t) => ({ exp: t.exp + gainedExp, coins: t.coins + gainedCoins }));
      setLog(`${message}\n${enemy.name} をたおした！`);
      setPhase("result");
      fxRef.current?.playDefeat();
      triggerShake(500);
      return;
    }

    // 敵の反撃
    const dmg = resolveEnemyAttack(enemy);
    const newPartyHp = Math.max(0, partyHp - dmg);
    setPartyHp(newPartyHp);
    setLog(`${message}\n${enemy.name} の反撃、${dmg}ダメージ！`);
    setPhase("result");

    if (newPartyHp <= 0) {
      setPhase("defeat");
    }
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
      setUseSkill(false);
      setLog("");
      return;
    }
    setPhase("choose");
    setUseSkill(false);
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
        <span>{SUBJECT_LABEL[subject] || ""}のバトル</span>
      </div>

      <div className={`mw-panel mw-enemy ${shake ? "mw-shake" : ""}`}>
        <BattleFX ref={fxRef} />
        <div className="mw-enemy-emoji">{isBossTurn ? "👹" : "👾"}</div>
        <div style={{ fontWeight: 700 }}>{enemy.name}</div>
        <div className="mw-hpbar" style={{ margin: "8px 0" }}>
          <div style={{ width: `${Math.max(0, (enemyHp / enemy.maxHp) * 100)}%` }} />
        </div>
        <div className="mw-sub">
          {enemyHp} / {enemy.maxHp}
        </div>
      </div>

      <div className="mw-panel">
        <div className="mw-sub">パーティHP</div>
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
            だれで攻撃する？
          </div>
          <div className="mw-row" style={{ flexWrap: "wrap" }}>
            {partyMembers.map((c) => (
              <button
                key={c.id}
                className="mw-btn small"
                style={{
                  outline: selectedCharId === c.id ? "3px solid var(--accent)" : "none",
                }}
                onClick={() => setSelectedCharId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {charactersById[selectedCharId]?.skill && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
              <input
                type="checkbox"
                checked={useSkill}
                disabled={!!skillUsed[selectedCharId]}
                onChange={(e) => setUseSkill(e.target.checked)}
              />
              {charactersById[selectedCharId].skill.icon} {charactersById[selectedCharId].skill.name}
              を使う（1回きり・威力1.5倍）
              {skillUsed[selectedCharId] && "（使用済）"}
            </label>
          )}
          <button className="mw-btn primary" style={{ marginTop: 12 }} onClick={startQuestion}>
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
