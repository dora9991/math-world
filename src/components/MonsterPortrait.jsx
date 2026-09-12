import { monsterImageUrl, monsterImgFilter } from "../data/monsterImages.js";

// 四角枠に囲まれたキャラ画像。画像が無いアート型のときは絵文字にフォールバック。
export default function MonsterPortrait({ character, size = "small", selected = false, footer }) {
  const url = character ? monsterImageUrl(character, size) : null;
  const filter = character ? monsterImgFilter(character) : "none";
  const rarity = character?.rarity;

  const frame = (
    <div
      className={`mw-portrait-frame ${rarity ? `mw-portrait-${rarity}` : ""} ${
        selected ? "mw-portrait-selected" : ""
      }`}
    >
      {url ? (
        <img src={url} alt={character.name} className="mw-portrait-img" style={{ filter }} />
      ) : (
        <div className="mw-portrait-fallback">{character ? "❓" : ""}</div>
      )}
    </div>
  );

  if (!footer) return frame;
  return (
    <div className="mw-portrait-col">
      {frame}
      <div className="mw-portrait-footer">{footer}</div>
    </div>
  );
}
