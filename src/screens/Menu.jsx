import { useGame } from "../context/GameContext.jsx";
import { useSecretTap } from "../hooks/useSecretTap.js";

const ITEMS = [
  { key: "storyGradeMap", icon: "📖", label: "ストーリー" },
  { key: "learning", icon: "📝", label: "学習モード" },
  { key: "party", icon: "🧑‍🤝‍🧑", label: "パーティ編成" },
  { key: "dex", icon: "📚", label: "図鑑" },
  { key: "tagquest", icon: "🤝", label: "タッグクエスト" },
  { key: "settings", icon: "⚙️", label: "設定" },
];

export default function Menu({ nav }) {
  const { save } = useGame();
  // 「math world」の文字を5回連続タップすると管理モードへ（隠しコマンド）。
  const handleTitleTap = useSecretTap(5, () => nav.go("admin"));
  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <span
          className="mw-fantasy-title"
          style={{ fontSize: "1.3rem", cursor: "pointer" }}
          onClick={handleTitleTap}
        >
          math world
        </span>
        <span className="mw-fantasy-coin">🪙 {save.coins}</span>
      </div>
      <div className="mw-fantasy-panel">
        {ITEMS.map((item) => (
          <button key={item.key} className="mw-fantasy-item" onClick={() => nav.go(item.key)}>
            <span className="mw-fantasy-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
