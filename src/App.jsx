import { useState } from "react";
import { GameProvider } from "./context/GameContext.jsx";

import Opening from "./screens/Opening.jsx";
import Title from "./screens/Title.jsx";
import Menu from "./screens/Menu.jsx";
import StoryGradeMap from "./screens/StoryGradeMap.jsx";
import ChapterMap from "./screens/ChapterMap.jsx";
import SubUnitSelect from "./screens/SubUnitSelect.jsx";
import StoryIntro from "./screens/StoryIntro.jsx";
import Battle from "./screens/Battle.jsx";
import Reward from "./screens/Reward.jsx";
import GachaScreen from "./screens/GachaScreen.jsx";
import PartyFormation from "./screens/PartyFormation.jsx";
import Dex from "./screens/Dex.jsx";
import LearningModeStub from "./screens/LearningModeStub.jsx";
import TagQuestStub from "./screens/TagQuestStub.jsx";
import Settings from "./screens/Settings.jsx";

const SCREENS = {
  opening: Opening,
  title: Title,
  menu: Menu,
  storyGradeMap: StoryGradeMap,
  chapterMap: ChapterMap,
  subUnitSelect: SubUnitSelect,
  storyIntro: StoryIntro,
  battle: Battle,
  reward: Reward,
  gacha: GachaScreen,
  party: PartyFormation,
  dex: Dex,
  learning: LearningModeStub,
  tagquest: TagQuestStub,
  settings: Settings,
};

// ホワイトアウトの時間（フェードイン→裏で画面切替→フェードアウト）
const FLASH_IN_MS = 280;
const FLASH_SETTLE_MS = 60;

function useNav(initial) {
  const [stack, setStack] = useState([initial]);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const current = stack[stack.length - 1];

  function go(screen, params = {}, { replace = false } = {}) {
    setStack((s) => {
      const next = replace ? s.slice(0, -1) : s;
      return [...next, { screen, params }];
    });
  }

  function back() {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  function resetTo(screen, params = {}) {
    setStack([{ screen, params }]);
  }

  // 画面が白く覆われている間に裏で切り替え、そこから新しい画面へフェードアウトする。
  function flashTo(screen, params = {}, opts = {}) {
    setFlashOpacity(1);
    setTimeout(() => {
      go(screen, params, opts);
      setTimeout(() => setFlashOpacity(0), FLASH_SETTLE_MS);
    }, FLASH_IN_MS);
  }

  return { ...current, go, back, resetTo, flashTo, flashOpacity };
}

export default function App() {
  const nav = useNav({ screen: "opening", params: {} });
  const Screen = SCREENS[nav.screen] || Menu;

  return (
    <GameProvider>
      <div className="mw-app">
        <Screen params={nav.params} nav={nav} />
        <div
          className="mw-whiteout"
          style={{
            opacity: nav.flashOpacity,
            pointerEvents: nav.flashOpacity > 0 ? "auto" : "none",
          }}
        />
      </div>
    </GameProvider>
  );
}
