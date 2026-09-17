import { useState } from "react";
import { GameProvider } from "./context/GameContext.jsx";
import { playUiTapSound } from "./fx/sound.js";

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
import Admin from "./screens/Admin.jsx";

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
  admin: Admin,
};

// ホワイトアウトの時間（フェードイン→裏で画面切替→フェードアウト）
const FLASH_IN_MS = 280;
const FLASH_SETTLE_MS = 60;

function useNav(initial) {
  const [stack, setStack] = useState([initial]);
  const [flashOpacity, setFlashOpacity] = useState(0);
  // 2026-09-18：「操作性・楽しさ」の検証で、戦闘以外の画面遷移が全部
  // 瞬間切り替え（無音・無演出）で、アプリというよりただのページ切り替えに
  // 見えることが分かった。navKeyを画面遷移のたびに更新し、App側で
  // それをkeyにして毎回フェードイン(.mw-screen-enter)させる。
  const [navKey, setNavKey] = useState(0);
  const current = stack[stack.length - 1];

  function go(screen, params = {}, { replace = false } = {}) {
    playUiTapSound();
    setNavKey((k) => k + 1);
    setStack((s) => {
      const next = replace ? s.slice(0, -1) : s;
      return [...next, { screen, params }];
    });
  }

  function back() {
    playUiTapSound();
    setNavKey((k) => k + 1);
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  function resetTo(screen, params = {}) {
    setNavKey((k) => k + 1);
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

  return { ...current, go, back, resetTo, flashTo, flashOpacity, navKey };
}

export default function App() {
  const nav = useNav({ screen: "opening", params: {} });
  const Screen = SCREENS[nav.screen] || Menu;

  return (
    <GameProvider>
      <div className="mw-app">
        <div key={nav.navKey} className="mw-screen-enter">
          <Screen params={nav.params} nav={nav} />
        </div>
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
