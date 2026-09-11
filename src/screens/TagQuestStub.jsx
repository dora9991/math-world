export default function TagQuestStub({ nav }) {
  return (
    <div className="mw-screen">
      <div className="mw-topbar">
        <button className="mw-btn small" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span>タッグクエスト</span>
      </div>
      <div className="mw-panel mw-center" style={{ minHeight: "50vh" }}>
        <div style={{ fontSize: "2.4rem" }}>🤝</div>
        <div>準備中</div>
        <div className="mw-sub">
          タッグクエストの中身（誰と誰が組む？対戦？協力？）はまだ相談していません。
          #todo 次回、仕様を決めてから実装する。
        </div>
      </div>
    </div>
  );
}
