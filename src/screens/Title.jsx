import { unlockAudio } from "../fx/sound.js";

export default function Title({ nav }) {
  function start() {
    unlockAudio(); // 最初のユーザー操作でAudioContextを解放しておく（ブラウザの自動再生制限対策）
    nav.go("menu", {}, { replace: true });
  }
  return (
    <div className="mw-center" onClick={start}>
      <div className="mw-title">math world</div>
      <div className="mw-sub">タップしてはじめる</div>
    </div>
  );
}
