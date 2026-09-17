// ============================================================
// PartyFormation.jsx — パーティ編成画面。
// 2026-09-17：「変更」ボタンの一覧をやめ、ドラッグ＆ドロップでの入れ替えに変更。
//   ・上段：パーティ5枠（絵＋名前、半分サイズ）
//   ・下段：ガチャで手に入れた全キャラを絵柄だけで並べたグリッド（控え）
//   ・控え→パーティ枠へドラッグ＝そのキャラを編成する
//   ・パーティ枠→下の控えエリアへドラッグ＝パーティから外す
//   ・動かさずタップ＝そのキャラの強さのポップアップを表示
// ============================================================
import { useRef, useState } from "react";
import { useGame, PARTY_SIZE } from "../context/GameContext.jsx";
import MonsterPortrait from "../components/MonsterPortrait.jsx";
import CharacterPopup from "../components/CharacterPopup.jsx";

const PARTY_SLOTS = Array.from({ length: PARTY_SIZE }, (_, i) => i);
const DRAG_THRESHOLD_PX = 10;

export default function PartyFormation({ nav }) {
  const { save, actions, charactersById } = useGame();
  const [popupCharId, setPopupCharId] = useState(null);
  const [dragGhost, setDragGhost] = useState(null); // {charId, x, y} | null
  const [hoverSlot, setHoverSlot] = useState(null); // 控え→パーティへドラッグ中、指の下にある枠
  const [benchHover, setBenchHover] = useState(false); // パーティ→控えへドラッグ中、控えエリアの上にいるか

  // pointermove/pointerupはドラッグ中ずっと同じリスナーを使い回すので、
  // 判定にReactのstateをそのまま読むと古い値を掴んでしまう（Battle.jsxの
  // ドラッグ実装と同じ理由）。判定用にはrefを、見た目の更新にはstateを使う。
  const dragRef = useRef(null); // {origin:'bench'|'party', charId, slotIndex, startX, startY, moved}
  const hoverSlotRef = useRef(null);
  const benchHoverRef = useRef(false);
  const slotRefs = useRef({}); // slot index -> el
  const benchAreaRef = useRef(null);

  const ownedList = Object.keys(save.owned)
    .map((id) => charactersById[id])
    .filter(Boolean);

  function startDrag(e, origin, charId, slotIndex) {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 対応していない環境では無視 */
    }
    const startX = e.clientX;
    const startY = e.clientY;
    dragRef.current = { origin, charId, slotIndex, startX, startY, moved: false };
    setDragGhost({ charId, x: startX, y: startY });

    function onMove(ev) {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) d.moved = true;
      setDragGhost({ charId: d.charId, x: ev.clientX, y: ev.clientY });
      if (!d.moved) return;

      if (d.origin === "bench") {
        let hovered = null;
        for (const slot of PARTY_SLOTS) {
          const el = slotRefs.current[slot];
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
            hovered = slot;
            break;
          }
        }
        hoverSlotRef.current = hovered;
        setHoverSlot(hovered);
      } else {
        const el = benchAreaRef.current;
        let inside = false;
        if (el) {
          const r = el.getBoundingClientRect();
          inside =
            ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
        }
        benchHoverRef.current = inside;
        setBenchHover(inside);
      }
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const d = dragRef.current;
      dragRef.current = null;
      const dropSlot = hoverSlotRef.current;
      const dropOnBench = benchHoverRef.current;
      hoverSlotRef.current = null;
      benchHoverRef.current = false;
      setDragGhost(null);
      setHoverSlot(null);
      setBenchHover(false);

      if (!d) return;
      if (!d.moved) {
        setPopupCharId(d.charId); // 動かさずに離した＝タップ＝ポップアップ表示
        return;
      }
      if (d.origin === "bench" && dropSlot !== null) {
        actions.setPartySlot(dropSlot, d.charId);
      } else if (d.origin === "party" && dropOnBench) {
        actions.setPartySlot(d.slotIndex, null);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const popupChar = popupCharId ? charactersById[popupCharId] : null;

  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <button className="mw-fantasy-back" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span className="mw-fantasy-title" style={{ fontSize: "1.1rem" }}>
          パーティ編成
        </span>
        <span style={{ width: 60 }} />
      </div>

      <div className="mw-fantasy-panel">
        <div className="mw-party-row mw-party-row-small">
          {PARTY_SLOTS.map((slot) => {
            const c = save.party[slot] ? charactersById[save.party[slot]] : null;
            return (
              <button
                key={slot}
                className={`mw-portrait-btn ${hoverSlot === slot ? "mw-slot-drop-hover" : ""}`}
                ref={(el) => {
                  slotRefs.current[slot] = el;
                }}
                onPointerDown={(e) => c && startDrag(e, "party", c.id, slot)}
              >
                <MonsterPortrait character={c} size="small" footer={c ? c.name : "（空き枠）"} />
              </button>
            );
          })}
        </div>
      </div>

      <div className={`mw-fantasy-panel ${benchHover ? "mw-bench-drop-hover" : ""}`} ref={benchAreaRef}>
        <div className="mw-bench-title">控えメンバー（タップで詳細／ドラッグで上のパーティ枠へ）</div>
        <div className="mw-bench-grid">
          {ownedList.map((c) => (
            <button key={c.id} className="mw-portrait-btn mw-bench-item" onPointerDown={(e) => startDrag(e, "bench", c.id, null)}>
              <MonsterPortrait character={c} size="small" />
            </button>
          ))}
        </div>
      </div>

      {dragGhost && (
        <div className="mw-drag-ghost" style={{ left: dragGhost.x, top: dragGhost.y }}>
          <MonsterPortrait character={charactersById[dragGhost.charId]} size="small" frameless />
        </div>
      )}

      {popupChar && <CharacterPopup character={popupChar} save={save} onClose={() => setPopupCharId(null)} />}
    </div>
  );
}
