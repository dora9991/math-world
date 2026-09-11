import { useGame } from "../context/GameContext.jsx";

export default function Settings({ nav }) {
  const { actions } = useGame();

  return (
    <div className="mw-screen">
      <div className="mw-topbar">
        <button className="mw-btn small" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span>設定</span>
      </div>
      <div className="mw-panel">
        <div className="mw-sub" style={{ marginBottom: 10 }}>
          セーブデータはこの端末のブラウザ内（localStorage）にのみ保存されています。
        </div>
        <button
          className="mw-btn"
          onClick={() => {
            if (confirm("セーブデータを消してはじめからにしますか？")) {
              actions.resetSave();
              nav.resetTo("title");
            }
          }}
        >
          🗑 セーブデータをリセット
        </button>
      </div>
    </div>
  );
}
