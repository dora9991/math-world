import { useState } from "react";
import { getChapter } from "../data/storyMap.js";
import { useGame } from "../context/GameContext.jsx";
import { pullGacha } from "../engine/gacha.js";

const PULL_COST = 100; // #todo コインバランス調整

export default function GachaScreen({ nav, params }) {
  const { grade, chapterId, freePull } = params;
  const { save, actions } = useGame();
  const chapter = getChapter(grade, chapterId);
  const [result, setResult] = useState(null);
  const [freeUsed, setFreeUsed] = useState(false);

  function doFreePull() {
    const c = pullGacha(grade, chapterId);
    if (!c) return;
    actions.obtainCharacter(c);
    setResult(c);
    setFreeUsed(true);
  }

  function doPaidPull() {
    if (!actions.spendCoins(PULL_COST)) {
      setResult({ error: "コインが足りません" });
      return;
    }
    const c = pullGacha(grade, chapterId);
    if (!c) return;
    actions.obtainCharacter(c);
    setResult(c);
  }

  if (!chapter) return null;
  const alreadyOwned = result && !result.error && !!save.owned[result.id];

  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <button className="mw-fantasy-back" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span className="mw-fantasy-title" style={{ fontSize: "1.1rem" }}>
          {chapter.name}のガチャ
        </span>
        <span style={{ width: 60 }} />
      </div>

      <div className="mw-fantasy-panel mw-center" style={{ minHeight: "40vh" }}>
        {!result && <div style={{ fontSize: "2.4rem" }}>🎰</div>}
        {result && !result.error && (
          <>
            <div style={{ fontSize: "2.4rem" }}>✨</div>
            <div className={`mw-rarity mw-rarity-${result.rarity}`}>{result.rarity}</div>
            <div className="mw-fantasy-title" style={{ fontSize: "1.2rem" }}>
              {result.name}
            </div>
            <div style={{ color: "#ffe9b3", opacity: 0.8 }}>{result.theme}</div>
            {alreadyOwned && (
              <div style={{ color: "#ffe9b3", opacity: 0.8 }}>（すでになかまのキャラでした）</div>
            )}
          </>
        )}
        {result?.error && <div style={{ color: "#ffe9b3" }}>{result.error}</div>}
      </div>

      {freePull && !freeUsed && (
        <button className="mw-fantasy-item" style={{ justifyContent: "center" }} onClick={doFreePull}>
          <span className="mw-fantasy-icon">🎉</span>
          無料で1回引く
        </button>
      )}

      <button
        className="mw-fantasy-item"
        style={{ justifyContent: "center" }}
        onClick={doPaidPull}
        disabled={save.coins < PULL_COST}
      >
        <span className="mw-fantasy-icon">🪙</span>
        {PULL_COST}で1回引く（所持 {save.coins}）
      </button>
    </div>
  );
}
