import { useEffect } from "react";
import { playCorrectSound } from "../fx/sound.js";

export default function Reward({ nav, params }) {
  const { grade, chapterId, subUnitId, kind, exp, coins, isFirstClear } = params;

  // 2026-09-18：「楽しさ」の検証で、勝利画面が数字が並ぶだけで無音・無演出
  // だったことが分かった。勝利のファンファーレ代わりに正解音を1回鳴らし、
  // 各行を少し間を置いてポンポンと弾ませて出す。
  useEffect(() => {
    playCorrectSound();
  }, []);

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
        <div className="mw-reward-pop" style={{ fontSize: "2.8rem", animationDelay: "0s" }}>
          🎉
        </div>
        <div
          className="mw-fantasy-title mw-reward-pop"
          style={{ fontSize: "1.4rem", animationDelay: "0.08s" }}
        >
          クリア！
        </div>
        <div className="mw-reward-pop" style={{ color: "#ffe9b3", animationDelay: "0.2s" }}>
          経験値 +{exp}
        </div>
        <div className="mw-reward-pop" style={{ color: "#ffe9b3", animationDelay: "0.3s" }}>
          🪙 +{coins}
        </div>
        {isFirstClear && (
          <div
            className="mw-reward-pop"
            style={{ color: "#ffe066", fontWeight: 700, animationDelay: "0.42s" }}
          >
            初回クリアボーナス：ガチャ1回無料券！
          </div>
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
