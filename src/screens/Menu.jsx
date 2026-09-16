import { useGame } from "../context/GameContext.jsx";

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
  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <span className="mw-fantasy-title" style={{ fontSize: "1.3rem" }}>
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
