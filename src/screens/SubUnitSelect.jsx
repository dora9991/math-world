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
    <div className="mw-screen">
      <div className="mw-topbar">
        <button className="mw-btn small" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span>{chapter.name}</span>
      </div>

      <button className="mw-btn small" onClick={() => nav.go("gacha", { grade, chapterId })}>
        🎰 {chapter.name}のガチャを見る
      </button>

      {chapter.subUnits.map((su) => {
        const cleared = isSubUnitCleared(save, grade, chapterId, su.id);
        return (
          <button
            key={su.id}
            className="mw-btn"
            onClick={() =>
              nav.go("storyIntro", { grade, chapterId, subUnitId: su.id, kind: "subUnit" })
            }
          >
            {cleared ? "✅ " : "▶️ "}
            {su.order}. {su.theme}
          </button>
        );
      })}

      <button
        className="mw-btn primary"
        disabled={!allSubUnitsCleared}
        onClick={() => nav.go("storyIntro", { grade, chapterId, kind: "chapterBoss" })}
      >
        {chapterCleared
          ? "🏆 章ボス撃破済み：" + chapter.chapterBoss?.name
          : allSubUnitsCleared
          ? "⚔️ 章ボス：" + chapter.chapterBoss?.name
          : "🔒 全小単元クリアで章ボス解放"}
      </button>
    </div>
  );
}
