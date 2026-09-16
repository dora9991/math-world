// ============================================================
// Dex.jsx — 単元特化ロースター(specialistRoster.js)の図鑑。2026-09-17追加。
//   「図鑑一覧を作成し、レベル最大の時の強さとスキルと能力をあげてほしい」への対応。
//   specialistRoster.jsのhp/atk/subjectsは元々レベルMAX値として保存されている
//   （growthCurve.jsの前提）ので、レベル計算をせずそのまま表示すればよい。
// ============================================================

import { useState } from "react";
import { useGame } from "../context/GameContext.jsx";
import { SUBJECT_LABEL } from "../data/storyMap.js";
import { SPECIALIST_ROSTER } from "../data/specialistRoster.js";
import MonsterPortrait from "../components/MonsterPortrait.jsx";

const SUBJECT_COLOR = {
  calc: "var(--calc)",
  eq: "var(--eq)",
  func: "var(--func)",
  geo: "var(--geo)",
  data: "var(--data)",
};

const STATUS_LABEL = {
  poison: "毒",
  paralysis: "麻痺",
  seal: "封印",
  slow: "スロー",
  confusion: "混乱",
  petrification: "石化",
};

const RARITIES = ["N", "R", "SR", "UR"];
const SUBJECT_FILTERS = [
  { key: "all", label: "すべて" },
  { key: "calc", label: SUBJECT_LABEL.calc },
  { key: "eq", label: SUBJECT_LABEL.eq },
  { key: "func", label: SUBJECT_LABEL.func },
  { key: "geo", label: SUBJECT_LABEL.geo },
  { key: "data", label: SUBJECT_LABEL.data },
  { key: "dual", label: "複合特化" },
];

function StatBars({ subjects }) {
  return (
    <div style={{ marginTop: 8 }}>
      {Object.entries(subjects).map(([key, value]) => (
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

function ResistRow({ resistances }) {
  return (
    <div className="mw-dex-resist-row">
      {Object.entries(STATUS_LABEL).map(([key, label]) => (
        <div className="mw-dex-resist-chip" key={key}>
          <span className="mw-dex-resist-label">{label}</span>
          <span className="mw-dex-resist-value">{resistances[key]}</span>
        </div>
      ))}
    </div>
  );
}

function DexCard({ character }) {
  const c = character;
  return (
    <div className="mw-fantasy-item mw-dex-card" style={{ flexDirection: "column", alignItems: "stretch", cursor: "default" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ width: 52 }}>
          <MonsterPortrait character={c} size="small" />
        </div>
        <div style={{ flex: 1 }}>
          <span className={`mw-rarity mw-rarity-${c.rarity}`}>{c.rarity}</span> <strong>{c.name}</strong>
          <div style={{ opacity: 0.75, fontWeight: 600, fontSize: "0.85rem" }}>{c.theme}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
          <div>HP {c.hp}</div>
          <div>ATK {c.atk}</div>
        </div>
      </div>

      <StatBars subjects={c.subjects} />

      <div className="mw-dex-skill">
        <span className="mw-dex-skill-icon">{c.skill.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{c.skill.name}</div>
          <div style={{ opacity: 0.8, fontSize: "0.8rem" }}>{c.skill.desc}</div>
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <div className="mw-dex-resist-title">耐性（毒/麻痺/封印/スロー/混乱/石化）</div>
        <ResistRow resistances={c.resistances} />
      </div>
    </div>
  );
}

export default function Dex({ nav }) {
  const { save } = useGame();
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");

  const list = SPECIALIST_ROSTER.filter((c) => {
    if (subjectFilter === "dual" && !c.id.startsWith("sp2_")) return false;
    if (subjectFilter !== "all" && subjectFilter !== "dual" && c.primarySubject !== subjectFilter) return false;
    if (rarityFilter !== "all" && c.rarity !== rarityFilter) return false;
    return true;
  });

  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <button className="mw-fantasy-back" onClick={() => nav.back()}>
          ← もどる
        </button>
        <span className="mw-fantasy-title" style={{ fontSize: "1.1rem" }}>
          図鑑（{list.length}/{SPECIALIST_ROSTER.length}）
        </span>
        <span style={{ width: 60 }} />
      </div>

      <div className="mw-fantasy-panel">
        <div className="mw-diff-row" style={{ flexWrap: "wrap" }}>
          {SUBJECT_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`mw-diff-btn ${subjectFilter === f.key ? "selected" : ""}`}
              style={{ flex: "1 1 30%", marginBottom: 6 }}
              onClick={() => setSubjectFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mw-diff-row">
          {["all", ...RARITIES].map((r) => (
            <button
              key={r}
              className={`mw-diff-btn ${rarityFilter === r ? "selected" : ""}`}
              onClick={() => setRarityFilter(r)}
            >
              {r === "all" ? "全レア度" : r}
            </button>
          ))}
        </div>
      </div>

      <div className="mw-fantasy-panel">
        {list.map((c) => (
          <DexCard key={c.id} character={c} ownedInfo={save.owned[c.id]} />
        ))}
        {list.length === 0 && <div style={{ opacity: 0.75, textAlign: "center" }}>該当するキャラがいません</div>}
      </div>
    </div>
  );
}
