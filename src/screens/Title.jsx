import { unlockAudio } from "../fx/sound.js";
import { useSecretTap } from "../hooks/useSecretTap.js";

export default function Title({ nav }) {
  function start() {
    unlockAudio(); // 最初のユーザー操作でAudioContextを解放しておく（ブラウザの自動再生制限対策）
    nav.go("menu", {}, { replace: true });
  }
  // 「math world」の文字を5回連続タップすると管理モードへ（隠しコマンド）。
  // 画面全体のタップ(start)に奪われないよう、タイトル文字自身でstopPropagationする。
  const handleTitleTap = useSecretTap(5, () => nav.go("admin"));
  return (
    <div className="mw-fantasy-screen" onClick={start} style={{ justifyContent: "center" }}>
      <div
        className="mw-fantasy-title"
        style={{ fontSize: "2.6rem" }}
        onClick={(e) => {
          e.stopPropagation();
          handleTitleTap();
        }}
      >
        math world
      </div>
      <div className="mw-fantasy-panel mw-fantasy-pulse" style={{ alignItems: "center", margin: "0 auto" }}>
        <span style={{ color: "#ffe9b3", fontWeight: 800 }}>タップしてはじめる</span>
      </div>
    </div>
  );
}
