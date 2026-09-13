import { STORY_MAP } from "../data/storyMap.js";

// 今回作ったのは中1(grade1)の第7章まで。中2・中3はデータが不完全なため
// このMVPではロックしておく（#todo 中2以降のコンテンツ作成）。
const PLAYABLE_GRADES = [1];

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
