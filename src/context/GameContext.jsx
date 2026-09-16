// ============================================================
// GameContext.jsx — セーブデータ（localStorage）とゲーム内アクションを
//   まとめて配る React Context。画面コンポーネントはここから
//   state と actions を取り出して使う。
// ============================================================

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { GACHA_ROSTER } from "../data/gachaRoster.js";
import { SPECIALIST_ROSTER } from "../data/specialistRoster.js";

const SAVE_KEY = "math-world-save-v1";

const STARTER_IDS = ["sample_intro", "m_c1_u1", "m_c1_u2"];
// 2026-09-17：パーティを3→5体に拡張。仲間の合計数（PartyFormation.jsx等と共有）。
export const PARTY_SIZE = 5;
// 単元特化キャラ(specialistRoster.js)は今回「ゲーム性に特化」の検証用に、
// ガチャを挟まず最初から全員仲間になっている（#todo 将来ガチャ経由の入手にするか検討）。
const SPECIALIST_IDS = SPECIALIST_ROSTER.map((c) => c.id);

function loadSave() {
  let save = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) save = JSON.parse(raw);
  } catch (e) {
    console.warn("セーブデータの読み込みに失敗:", e);
  }
  if (!save) {
    const owned = {};
    for (const id of STARTER_IDS) owned[id] = { exp: 0 };
    save = {
      coins: 300,
      owned,
      party: [STARTER_IDS[0], STARTER_IDS[1], STARTER_IDS[2], null, null],
      clearedSubUnits: {},
      clearedChapters: {},
      clearedFinalBoss: {},
    };
  }
  // 既存セーブにも単元特化キャラを後付けで全員仲間入りさせる（自己修復マージ）。
  for (const id of SPECIALIST_IDS) {
    if (!save.owned[id]) save.owned[id] = { exp: 0 };
  }
  // パーティ配列がPARTY_SIZEより短い古いセーブは空き枠で埋める。
  while (save.party.length < PARTY_SIZE) save.party.push(null);
  return save;
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
    // specialistRoster.jsはgrade/chapterIdを持たないのでSTORY_MAP(gachaRoster.js)には
    // 混ぜず、キャラ検索用のこのmapにだけ追加する。
    for (const c of SPECIALIST_ROSTER) map[c.id] = c;
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
