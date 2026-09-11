import { useGame } from "../context/GameContext.jsx";

const ITEMS = [
  { key: "storyGradeMap", label: "📖 ストーリー" },
  { key: "learning", label: "📝 学習モード" },
  { key: "party", label: "🧑‍🤝‍🧑 パーティ編成" },
  { key: "tagquest", label: "🤝 タッグクエスト" },
  { key: "settings", label: "⚙️ 設定" },
];

export default function Menu({ nav }) {
  const { save } = useGame();
  return (
    <div className="mw-screen">
      <div className="mw-topbar">
        <span>math world</span>
        <span>🪙 {save.coins}</span>
      </div>
      <div className="mw-title" style={{ textAlign: "center", margin: "12px 0" }}>
        メニュー
      </div>
      {ITEMS.map((item) => (
        <button key={item.key} className="mw-btn" onClick={() => nav.go(item.key)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
