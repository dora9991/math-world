// ============================================================
// useSecretTap.js — 2026-09-17追加：「◯回連続タップで隠し画面へ」の共通ロジック。
//   Title.jsx・Menu.jsxの「math world」文字から使う（管理モードの入り口）。
// ============================================================

import { useEffect, useRef, useState } from "react";

const WINDOW_MS = 2000; // この時間内に指定回数タップできなければカウントをリセット

/** onTrigger: 指定回数(count)連続タップしたときに呼ばれる。 */
export function useSecretTap(count, onTrigger) {
  const [taps, setTaps] = useState(0);
  const timerRef = useRef(null);

  // onTriggerの呼び出しはuseEffect側で行う（setTapsの更新関数の中で別コンポーネントの
  // setState(nav.go内のsetStack)を呼ぶと「レンダー中に別コンポーネントを更新した」という
  // Reactの警告になるため、コミット後に安全に呼べるここへ分離した）。
  useEffect(() => {
    if (taps >= count) {
      setTaps(0);
      onTrigger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taps, count]);

  function handleTap() {
    setTaps((n) => n + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTaps(0), WINDOW_MS);
  }

  return handleTap;
}
