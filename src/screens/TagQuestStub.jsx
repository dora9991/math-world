export default function TagQuestStub({ nav }) {
  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <button className="mw-fantasy-back" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span className="mw-fantasy-title" style={{ fontSize: "1.1rem" }}>
          タッグクエスト
        </span>
        <span style={{ width: 60 }} />
      </div>
      <div className="mw-fantasy-panel mw-center" style={{ minHeight: "50vh" }}>
        <div style={{ fontSize: "2.4rem" }}>🤝</div>
        <div style={{ color: "#ffe9b3", fontWeight: 700 }}>準備中</div>
      </div>
    </div>
  );
}
