import { useGame } from "../context/GameContext.jsx";

export default function Settings({ nav }) {
  const { actions } = useGame();

  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <button className="mw-fantasy-back" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span className="mw-fantasy-title" style={{ fontSize: "1.1rem" }}>
          設定
        </span>
        <span style={{ width: 60 }} />
      </div>
      <div className="mw-fantasy-panel">
        <button
          className="mw-fantasy-item"
          onClick={() => {
            if (confirm("セーブデータを消してはじめからにしますか？")) {
              actions.resetSave();
              nav.resetTo("title");
            }
          }}
        >
          <span className="mw-fantasy-icon">🗑</span>
          セーブデータをリセット
        </button>
      </div>
    </div>
  );
}
