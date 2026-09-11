import { useEffect } from "react";

// オープニング：本来は演出（動画・ロゴアニメ等）が入る想定のプレースホルダー。
// #todo デザイン確定後に差し替え。タップでも自動でもタイトルへ進む。
export default function Opening({ nav }) {
  useEffect(() => {
    const t = setTimeout(() => nav.go("title", {}, { replace: true }), 1800);
    return () => clearTimeout(t);
  }, [nav]);

  return (
    <div className="mw-center" onClick={() => nav.go("title", {}, { replace: true })}>
      <div className="mw-title">math world</div>
      <div className="mw-sub">（仮タイトル・オープニング演出は後で作る）</div>
      <div className="mw-sub">タップでスキップ</div>
    </div>
  );
}
