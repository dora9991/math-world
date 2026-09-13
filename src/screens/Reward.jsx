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
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-panel mw-center" style={{ minHeight: "50vh" }}>
        <div style={{ fontSize: "2.4rem" }}>🎉</div>
        <div className="mw-fantasy-title" style={{ fontSize: "1.4rem" }}>
          クリア！
        </div>
        <div style={{ color: "#ffe9b3" }}>経験値 +{exp}</div>
        <div style={{ color: "#ffe9b3" }}>🪙 +{coins}</div>
        {isFirstClear && (
          <div style={{ color: "#ffe066", fontWeight: 700 }}>初回クリアボーナス：ガチャ1回無料券！</div>
        )}
      </div>

      {isFirstClear && (
        <button
          className="mw-fantasy-item"
          style={{ justifyContent: "center" }}
          onClick={() => nav.go("gacha", { grade, chapterId, freePull: true }, { replace: true })}
        >
          <span className="mw-fantasy-icon">🎰</span>
          ガチャを引く
        </button>
      )}

      <button className="mw-fantasy-item" style={{ justifyContent: "center" }} onClick={backToList}>
        つぎへ
      </button>
    </div>
  );
}
