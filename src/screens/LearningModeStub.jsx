export default function LearningModeStub({ nav }) {
  return (
    <div className="mw-screen">
      <div className="mw-topbar">
        <button className="mw-btn small" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span>学習モード</span>
      </div>
      <div className="mw-panel mw-center" style={{ minHeight: "50vh" }}>
        <div style={{ fontSize: "2.4rem" }}>📝</div>
        <div>準備中</div>
        <div className="mw-sub">
          今回の依頼はストーリーモードの骨格が中心だったため、学習モードは
          まだ画面だけの状態です（#todo 仕様を相談してから実装）。
        </div>
      </div>
    </div>
  );
}
