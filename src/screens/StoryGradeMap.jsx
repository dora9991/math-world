import { STORY_MAP } from "../data/storyMap.js";

// 2026-09-16：中2・中3の問題データ(数学ラボ2 grade2/grade3)を追加したので解放。
const PLAYABLE_GRADES = [1, 2, 3];

export default function StoryGradeMap({ nav }) {
  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <button className="mw-fantasy-back" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span className="mw-fantasy-title" style={{ fontSize: "1.1rem" }}>
          ストーリー
        </span>
        <span style={{ width: 60 }} />
      </div>
      <div className="mw-fantasy-panel">
        {STORY_MAP.map((g) => {
          const playable = PLAYABLE_GRADES.includes(g.grade);
          return (
            <button
              key={g.grade}
              className="mw-fantasy-item"
              disabled={!playable}
              onClick={() => nav.go("chapterMap", { grade: g.grade })}
            >
              <span className="mw-fantasy-icon">📖</span>
              {g.label} {playable ? "" : "（準備中）"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
