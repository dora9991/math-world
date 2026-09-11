// ============================================================
// GameContext.jsx — セーブデータ（localStorage）とゲーム内アクションを
//   まとめて配る React Context。画面コンポーネントはここから
//   state と actions を取り出して使う。
// ============================================================

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { GACHA_ROSTER } from "../data/gachaRoster.js";

const SAVE_KEY = "math-world-save-v1";

const STARTER_IDS = ["sample_intro", "m_c1_u1", "m_c1_u2"];

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("セーブデータの読み込みに失敗:", e);
  }
  const owned = {};
  for (const id of STARTER_IDS) owned[id] = { exp: 0 };
  return {
    coins: 300,
    owned,
    party: [STARTER_IDS[0], STARTER_IDS[1], STARTER_IDS[2]],
    clearedSubUnits: {},
    clearedChapters: {},
    clearedFinalBoss: {},
  };
}

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [save, setSave] = useState(loadSave);

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
      console.warn("セーブデータの保存に失敗:", e);
    }
  }, [save]);

  const charactersById = useMemo(() => {
    const map = {};
    for (const c of GACHA_ROSTER) map[c.id] = c;
    return map;
  }, []);

  const actions = useMemo(
    () => ({
      addCoins(amount) {
        setSave((s) => ({ ...s, coins: s.coins + amount }));
      },
      spendCoins(amount) {
        let ok = false;
        setSave((s) => {
          if (s.coins < amount) {
            ok = false;
            return s;
          }
          ok = true;
          return { ...s, coins: s.coins - amount };
        });
        return ok;
      },
      addExp(characterId, amount) {
        setSave((s) => {
          const prev = s.owned[characterId] || { exp: 0 };
          return {
            ...s,
            owned: {
              ...s.owned,
              [characterId]: { ...prev, exp: prev.exp + amount },
            },
          };
        });
      },
      obtainCharacter(character) {
        setSave((s) => {
          if (s.owned[character.id]) return s; // 既に仲間。重複入手は今は特に何もしない
          return {
            ...s,
            owned: { ...s.owned, [character.id]: { exp: 0 } },
          };
        });
      },
      setPartySlot(slot, characterId) {
        setSave((s) => {
          const party = [...s.party];
          party[slot] = characterId;
          return { ...s, party };
        });
      },
      markSubUnitCleared(grade, chapterId, subUnitId) {
        const key = `${grade}:${chapterId}:${subUnitId}`;
        let isFirstClear = false;
        setSave((s) => {
          isFirstClear = !s.clearedSubUnits[key];
          return {
            ...s,
            clearedSubUnits: { ...s.clearedSubUnits, [key]: true },
          };
        });
        return isFirstClear;
      },
      markChapterCleared(grade, chapterId) {
        const key = `${grade}:${chapterId}`;
        setSave((s) => ({
          ...s,
          clearedChapters: { ...s.clearedChapters, [key]: true },
        }));
      },
      markFinalBossCleared(grade) {
        setSave((s) => ({
          ...s,
          clearedFinalBoss: { ...s.clearedFinalBoss, [grade]: true },
        }));
      },
      resetSave() {
        localStorage.removeItem(SAVE_KEY);
        setSave(loadSave());
      },
    }),
    []
  );

  const value = { save, actions, charactersById };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame は GameProvider の内側で使ってください");
  return ctx;
}

export function isSubUnitCleared(save, grade, chapterId, subUnitId) {
  return !!save.clearedSubUnits[`${grade}:${chapterId}:${subUnitId}`];
}

export function isChapterCleared(save, grade, chapterId) {
  return !!save.clearedChapters[`${grade}:${chapterId}`];
}
