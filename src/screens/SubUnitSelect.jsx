import { getChapter } from "../data/storyMap.js";
import { useGame, isSubUnitCleared, isChapterCleared } from "../context/GameContext.jsx";

export default function SubUnitSelect({ nav, params }) {
  const { grade, chapterId } = params;
  const { save } = useGame();
  const chapter = getChapter(grade, chapterId);
  if (!chapter) return null;

  const allSubUnitsCleared = chapter.subUnits.every((su) =>
    isSubUnitCleared(save, grade, chapterId, su.id)
  );
  const chapterCleared = isChapterCleared(save, grade, chapterId);

  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <button className="mw-fantasy-back" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span className="mw-fantasy-title" style={{ fontSize: "1.1rem" }}>
          {chapter.name}
        </span>
        <span style={{ width: 60 }} />
      </div>

      <div className="mw-fantasy-panel">
        <button className="mw-fantasy-item" onClick={() => nav.go("gacha", { grade, chapterId })}>
          <span className="mw-fantasy-icon">🎰</span>
          ガチャを見る
        </button>

        {chapter.subUnits.map((su) => {
          const cleared = isSubUnitCleared(save, grade, chapterId, su.id);
          return (
            <button
              key={su.id}
              className="mw-fantasy-item"
              onClick={() =>
                nav.go("storyIntro", { grade, chapterId, subUnitId: su.id, kind: "subUnit" })
              }
            >
              <span className="mw-fantasy-icon">{cleared ? "✅" : "▶️"}</span>
              {su.order}. {su.theme}
            </button>
          );
        })}

        <button
          className="mw-fantasy-item"
          disabled={!allSubUnitsCleared}
          onClick={() => nav.go("storyIntro", { grade, chapterId, kind: "chapterBoss" })}
        >
          <span className="mw-fantasy-icon">{chapterCleared ? "🏆" : allSubUnitsCleared ? "⚔️" : "🔒"}</span>
          {chapterCleared
            ? "撃破済み：" + chapter.chapterBoss?.name
            : allSubUnitsCleared
            ? "章ボス：" + chapter.chapterBoss?.name
            : "全小単元クリアで解放"}
        </button>
      </div>
    </div>
  );
}
