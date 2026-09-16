// ============================================================
// Admin.jsx — 2026-09-17追加：管理モード（デバッグ用）。
//   「math world」の文字を5回連続タップすると入れる隠し画面。
//   コイン・パーティメンバーのレベル(EXP)をその場で直接調整できる。
//   バランス確認・動作検証用のツールで、正規のゲーム内画面ではない。
// ============================================================

import { useState } from "react";
import { useGame, PARTY_SIZE } from "../context/GameContext.jsx";
import { expProgress, expForLevel } from "../engine/expCurve.js";
import { getLevelCap } from "../data/growthCurve.js";
import MonsterPortrait from "../components/MonsterPortrait.jsx";

function CoinPanel() {
  const { save, actions } = useGame();
  const [input, setInput] = useState(String(save.coins));

  return (
    <div className="mw-fantasy-panel">
      <div className="mw-fantasy-title" style={{ fontSize: "1rem", marginBottom: 8 }}>
        🪙 コイン（所持 {save.coins}）
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          className="mw-admin-input"
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="mw-fantasy-back"
          onClick={() => {
            const n = parseInt(input, 10);
            if (Number.isFinite(n)) actions.setCoins(n);
          }}
        >
          設定
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="mw-fantasy-back" onClick={() => actions.addCoins(1000)}>
          +1000
        </button>
        <button className="mw-fantasy-back" onClick={() => actions.addCoins(10000)}>
          +10000
        </button>
        <button
          className="mw-fantasy-back"
          onClick={() => {
            actions.setCoins(300);
            setInput("300");
          }}
        >
          300にリセット
        </button>
      </div>
    </div>
  );
}

function PartyMemberRow({ character, exp }) {
  const { actions } = useGame();
  const cap = getLevelCap(character.rarity);
  const progress = expProgress(exp, character.rarity);
  const [levelInput, setLevelInput] = useState(String(progress.level));

  return (
    <div className="mw-fantasy-item" style={{ flexDirection: "column", alignItems: "stretch", cursor: "default" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ width: 44 }}>
          <MonsterPortrait character={character} size="small" />
        </div>
        <div style={{ flex: 1 }}>
          <span className={`mw-rarity mw-rarity-${character.rarity}`}>{character.rarity}</span> {character.name}
          <div style={{ opacity: 0.75, fontWeight: 600, fontSize: "0.85rem" }}>
            Lv{progress.level} / {cap}（EXP {exp}）
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <input
          className="mw-admin-input"
          type="number"
          min={1}
          max={cap}
          value={levelInput}
          onChange={(e) => setLevelInput(e.target.value)}
        />
        <button
          className="mw-fantasy-back"
          onClick={() => {
            const lv = Math.min(cap, Math.max(1, parseInt(levelInput, 10) || 1));
            actions.setExp(character.id, expForLevel(lv));
            setLevelInput(String(lv));
          }}
        >
          Lvを設定
        </button>
        <button
          className="mw-fantasy-back"
          onClick={() => {
            actions.setExp(character.id, expForLevel(cap));
            setLevelInput(String(cap));
          }}
        >
          MAXにする
        </button>
      </div>
    </div>
  );
}

export default function Admin({ nav }) {
  const { save, actions, charactersById } = useGame();

  const partyMembers = save.party
    .map((id) => (id ? charactersById[id] : null))
    .filter(Boolean);

  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <button className="mw-fantasy-back" onClick={() => nav.resetTo("menu")}>
          ← もどる
        </button>
        <span className="mw-fantasy-title" style={{ fontSize: "1.1rem" }}>
          🛠 管理モード
        </span>
        <span style={{ width: 60 }} />
      </div>

      <div className="mw-fantasy-panel" style={{ background: "#4a2020" }}>
        <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
          ⚠️ これは動作確認用の隠し画面です。コインやレベルを直接書き換えます（通常のプレイでは使いません）。
        </div>
      </div>

      <CoinPanel />

      <div className="mw-fantasy-panel">
        <div className="mw-fantasy-title" style={{ fontSize: "1rem", marginBottom: 8 }}>
          パーティのレベル調整（{partyMembers.length}/{PARTY_SIZE}）
        </div>
        {partyMembers.length > 0 && (
          <button
            className="mw-fantasy-item"
            style={{ justifyContent: "center", marginBottom: 8 }}
            onClick={() => {
              for (const c of partyMembers) {
                actions.setExp(c.id, expForLevel(getLevelCap(c.rarity)));
              }
            }}
          >
            <span className="mw-fantasy-icon">⭐</span>
            パーティ全員をLv MAXにする
          </button>
        )}
        {partyMembers.map((c) => (
          <PartyMemberRow key={c.id} character={c} exp={save.owned[c.id]?.exp || 0} />
        ))}
        {partyMembers.length === 0 && <div style={{ opacity: 0.75 }}>パーティが空です</div>}
      </div>
    </div>
  );
}
