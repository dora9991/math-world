import { useState } from "react";
import { useGame } from "../context/GameContext.jsx";
import { SUBJECT_LABEL } from "../data/storyMap.js";
import { expProgress } from "../engine/expCurve.js";

const SUBJECT_COLOR = {
  calc: "var(--calc)",
  eq: "var(--eq)",
  func: "var(--func)",
  geo: "var(--geo)",
  data: "var(--data)",
};

function StatBars({ character }) {
  return (
    <div style={{ marginTop: 8 }}>
      {Object.entries(character.subjects).map(([key, value]) => (
        <div className="mw-bar-row" key={key}>
          <div className="mw-bar-label">{SUBJECT_LABEL[key]}</div>
          <div className="mw-bar-track">
            <div
              className="mw-bar-fill"
              style={{ width: `${Math.min(100, value)}%`, background: SUBJECT_COLOR[key] }}
            />
          </div>
          <div style={{ width: "2.4em", textAlign: "right" }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export default function PartyFormation({ nav }) {
  const { save, actions, charactersById } = useGame();
  const [pickingSlot, setPickingSlot] = useState(null);

  const ownedList = Object.keys(save.owned)
    .map((id) => charactersById[id])
    .filter(Boolean);

  return (
    <div className="mw-screen">
      <div className="mw-topbar">
        <button className="mw-btn small" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span>パーティ編成</span>
      </div>

      <div className="mw-panel">
        <div className="mw-sub" style={{ marginBottom: 8 }}>
          出撃する3体
        </div>
        {[0, 1, 2].map((slot) => {
          const c = save.party[slot] ? charactersById[save.party[slot]] : null;
          return (
            <div key={slot} className="mw-party-slot" style={{ marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                {c ? (
                  <>
                    <span className={`mw-rarity mw-rarity-${c.rarity}`}>{c.rarity}</span>{" "}
                    <strong>{c.name}</strong>
                    <div className="mw-sub">
                      Lv{expProgress(save.owned[c.id]?.exp || 0, c.rarity).level}
                    </div>
                  </>
                ) : (
                  <span className="mw-sub">（空き枠）</span>
                )}
              </div>
              <button className="mw-btn small" onClick={() => setPickingSlot(slot)}>
                変更
              </button>
            </div>
          );
        })}
      </div>

      {pickingSlot !== null && (
        <div className="mw-panel">
          <div className="mw-sub" style={{ marginBottom: 8 }}>
            {pickingSlot + 1}枠目に入れるキャラを選ぶ
          </div>
          {ownedList.map((c) => (
            <button
              key={c.id}
              className="mw-btn"
              onClick={() => {
                actions.setPartySlot(pickingSlot, c.id);
                setPickingSlot(null);
              }}
            >
              <span className={`mw-rarity mw-rarity-${c.rarity}`}>{c.rarity}</span> {c.name}
              <div className="mw-sub">{c.theme}</div>
              <StatBars character={c} />
            </button>
          ))}
          <button className="mw-btn small" onClick={() => setPickingSlot(null)}>
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
