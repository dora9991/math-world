import { STORY_MAP } from "../data/storyMap.js";

// 今回作ったのは中1(grade1)の第7章まで。中2・中3はデータが不完全なため
// このMVPではロックしておく（#todo 中2以降のコンテンツ作成）。
const PLAYABLE_GRADES = [1];

export default function StoryGradeMap({ nav }) {
  return (
    <div className="mw-screen">
      <div className="mw-topbar">
        <button className="mw-btn small" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span>ストーリーモード</span>
      </div>
      {STORY_MAP.map((g) => {
        const playable = PLAYABLE_GRADES.includes(g.grade);
        return (
          <button
            key={g.grade}
            className="mw-btn"
            disabled={!playable}
            onClick={() => nav.go("chapterMap", { grade: g.grade })}
          >
            {g.label} {playable ? "" : "（準備中）"}
          </button>
        );
      })}
    </div>
  );
}
