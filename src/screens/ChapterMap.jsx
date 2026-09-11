import { getGrade, SUBJECT_LABEL } from "../data/storyMap.js";
import { useGame, isChapterCleared } from "../context/GameContext.jsx";

const SUBJECT_ICON = { calc: "🧮", eq: "⚖️", func: "📈", geo: "📐", data: "📊" };
const SUBJECT_COLOR = {
  calc: "var(--calc)",
  eq: "var(--eq)",
  func: "var(--func)",
  geo: "var(--geo)",
  data: "var(--data)",
};

export default function ChapterMap({ nav, params }) {
  const { grade } = params;
  const { save } = useGame();
  const gradeData = getGrade(grade);
  if (!gradeData) return null;

  const allChaptersCleared = gradeData.chapters.every((c) =>
    isChapterCleared(save, grade, c.chapterId)
  );

  return (
    <div className="mw-screen">
      <div className="mw-topbar">
        <button className="mw-btn small" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span>{gradeData.label}・単元マップ</span>
      </div>
      <div className="mw-grid">
        {gradeData.chapters.map((c, i) => {
          const cleared = isChapterCleared(save, grade, c.chapterId);
          const prevCleared =
            i === 0 || isChapterCleared(save, grade, gradeData.chapters[i - 1].chapterId);
          const locked = !prevCleared;
          return (
            <div
              key={c.chapterId}
              className={`mw-stage ${locked ? "locked" : ""} ${cleared ? "cleared" : ""}`}
              style={{ background: SUBJECT_COLOR[c.subject] || "#555" }}
              onClick={() => !locked && nav.go("subUnitSelect", { grade, chapterId: c.chapterId })}
            >
              <div style={{ fontSize: "2rem" }}>{locked ? "🔒" : SUBJECT_ICON[c.subject]}</div>
              <div>
                第{i + 1}章
                <br />
                {c.name}
              </div>
              <div style={{ fontSize: "0.65rem", opacity: 0.85 }}>
                {SUBJECT_LABEL[c.subject]}系 {cleared ? "・クリア済" : ""}
              </div>
            </div>
          );
        })}
      </div>

      {gradeData.finalBoss && (
        <button
          className="mw-btn primary"
          disabled={!allChaptersCleared}
          onClick={() => nav.go("storyIntro", { grade, kind: "finalBoss" })}
        >
          {allChaptersCleared ? "👑 大ボス：" + gradeData.finalBoss.name : "🔒 全章クリアで大ボス解放"}
        </button>
      )}
    </div>
  );
}
