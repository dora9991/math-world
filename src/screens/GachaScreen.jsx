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
    <div className="mw-screen">
      <div className="mw-topbar">
        <button className="mw-btn small" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span>{chapter.name}のガチャ</span>
      </div>

      <div className="mw-panel mw-center" style={{ minHeight: "40vh" }}>
        {!result && <div style={{ fontSize: "2.4rem" }}>🎰</div>}
        {result && !result.error && (
          <>
            <div style={{ fontSize: "2.4rem" }}>✨</div>
            <div className={`mw-rarity mw-rarity-${result.rarity}`}>{result.rarity}</div>
            <div className="mw-title" style={{ fontSize: "1.2rem" }}>
              {result.name}
            </div>
            <div className="mw-sub">{result.theme}</div>
            {alreadyOwned && <div className="mw-sub">（すでになかまのキャラでした）</div>}
          </>
        )}
        {result?.error && <div>{result.error}</div>}
      </div>

      {freePull && !freeUsed && (
        <button className="mw-btn primary" onClick={doFreePull}>
          🎉 無料で1回引く
        </button>
      )}

      <button className="mw-btn" onClick={doPaidPull} disabled={save.coins < PULL_COST}>
        🪙{PULL_COST} で1回引く（所持 {save.coins}）
      </button>
    </div>
  );
}
