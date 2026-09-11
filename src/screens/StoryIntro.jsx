import { getChapter, getGrade } from "../data/storyMap.js";

// ストーリー本文はまだ書いていない（#todo）。ここは「小単元に入るとまず
// ひとこと台詞が挟まる」という型だけを確認するためのプレースホルダー。
function introText(kind, chapter, subUnit, grade) {
  if (kind === "subUnit") {
    return `「${subUnit.theme}」のエリアに、数字の仲間たちが現れた…！`;
  }
  if (kind === "chapterBoss") {
    return `${chapter.name}の主、「${chapter.chapterBoss?.name}」が立ちはだかる…！`;
  }
  if (kind === "finalBoss") {
    return `${grade.label}の旅の最後に、「${grade.finalBoss?.name}」が姿を現した…！`;
  }
  return "";
}

export default function StoryIntro({ nav, params }) {
  const { grade, chapterId, subUnitId, kind } = params;
  const gradeData = getGrade(grade);
  const chapter = chapterId ? getChapter(grade, chapterId) : null;
  const subUnit = subUnitId ? chapter?.subUnits.find((s) => s.id === subUnitId) : null;

  return (
    <div className="mw-screen">
      <div className="mw-panel mw-center" style={{ minHeight: "50vh" }}>
        <div style={{ fontSize: "2.4rem" }}>📖</div>
        <div>{introText(kind, chapter, subUnit, gradeData)}</div>
      </div>
      <button
        className="mw-btn primary"
        onClick={() => nav.go("battle", params, { replace: true })}
      >
        たたかう ▶
      </button>
      <button className="mw-btn small" onClick={() => nav.back()}>
        もどる
      </button>
    </div>
  );
}
