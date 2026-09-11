export default function Reward({ nav, params }) {
  const { grade, chapterId, subUnitId, kind, exp, coins, isFirstClear } = params;

  function backToList() {
    if (kind === "subUnit" || kind === "chapterBoss") {
      nav.resetTo("subUnitSelect", { grade, chapterId });
    } else {
      nav.resetTo("chapterMap", { grade });
    }
  }

  return (
    <div className="mw-screen">
      <div className="mw-panel mw-center" style={{ minHeight: "50vh" }}>
        <div style={{ fontSize: "2.4rem" }}>🎉</div>
        <div className="mw-title" style={{ fontSize: "1.4rem" }}>
          クリア！
        </div>
        <div>経験値 +{exp}</div>
        <div>🪙 +{coins}</div>
        {isFirstClear && <div style={{ color: "var(--accent)" }}>初回クリアボーナス：ガチャ1回無料券！</div>}
      </div>

      {isFirstClear && (
        <button
          className="mw-btn primary"
          onClick={() => nav.go("gacha", { grade, chapterId, freePull: true }, { replace: true })}
        >
          🎰 ガチャを引く
        </button>
      )}

      <button className="mw-btn" onClick={backToList}>
        つぎへ
      </button>
    </div>
  );
}
