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
  learning: LearningModeStub,
  tagquest: TagQuestStub,
  settings: Settings,
};

function useNav(initial) {
  const [stack, setStack] = useState([initial]);
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

  return { ...current, go, back, resetTo };
}

export default function App() {
  const nav = useNav({ screen: "opening", params: {} });
  const Screen = SCREENS[nav.screen] || Menu;

  return (
    <GameProvider>
      <div className="mw-app">
        <Screen params={nav.params} nav={nav} />
      </div>
    </GameProvider>
  );
}
