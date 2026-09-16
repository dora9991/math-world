import { useState } from "react";
import { useGame, PARTY_SIZE } from "../context/GameContext.jsx";
import { SUBJECT_LABEL } from "../data/storyMap.js";
import { expProgress } from "../engine/expCurve.js";
import MonsterPortrait from "../components/MonsterPortrait.jsx";

const PARTY_SLOTS = Array.from({ length: PARTY_SIZE }, (_, i) => i);

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
        <div className="mw-party-row" style={{ marginBottom: 12 }}>
          {PARTY_SLOTS.map((slot) => {
            const c = save.party[slot] ? charactersById[save.party[slot]] : null;
            return (
              <button key={slot} className="mw-portrait-btn" onClick={() => setPickingSlot(slot)}>
                <MonsterPortrait character={c} size="small" footer={c ? c.name : "（空き枠）"} />
              </button>
            );
          })}
        </div>
        {PARTY_SLOTS.map((slot) => {
          const c = save.party[slot] ? charactersById[save.party[slot]] : null;
          return (
            <div key={slot} className="mw-fantasy-item" style={{ cursor: "default" }}>
              <div style={{ flex: 1 }}>
                {c ? (
                  <>
                    <span className={`mw-rarity mw-rarity-${c.rarity}`}>{c.rarity}</span>{" "}
                    <strong>{c.name}</strong>
                    <div style={{ opacity: 0.75, fontWeight: 600 }}>
                      Lv{expProgress(save.owned[c.id]?.exp || 0, c.rarity).level}
                    </div>
                  </>
                ) : (
                  <span style={{ opacity: 0.75 }}>（空き枠）</span>
                )}
              </div>
              <button className="mw-fantasy-back" onClick={() => setPickingSlot(slot)}>
                変更
              </button>
            </div>
          );
        })}
      </div>

      {pickingSlot !== null && (
        <div className="mw-fantasy-panel">
          {ownedList.map((c) => (
            <button
              key={c.id}
              className="mw-fantasy-item"
              style={{ flexDirection: "column", alignItems: "stretch" }}
              onClick={() => {
                actions.setPartySlot(pickingSlot, c.id);
                setPickingSlot(null);
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 44 }}>
                  <MonsterPortrait character={c} size="small" />
                </div>
                <div style={{ flex: 1 }}>
                  <span className={`mw-rarity mw-rarity-${c.rarity}`}>{c.rarity}</span> {c.name}
                  <div style={{ opacity: 0.75, fontWeight: 600 }}>{c.theme}</div>
                </div>
              </div>
              <StatBars character={c} />
            </button>
          ))}
          <button className="mw-fantasy-back" onClick={() => setPickingSlot(null)}>
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
