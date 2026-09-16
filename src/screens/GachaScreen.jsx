// ============================================================
// GachaScreen.jsx — 2026-09-17：「ガチャの演出をめちゃくちゃ派手に」への対応。
//
// フェーズ進行：idle(タップ待ち) → capsuleFall(カプセル落下) →
//   capsuleShake(ワクワクの揺れ) → capsuleCrack(パカッと割れる) →
//   burst(光の爆発＋光条＋パーティクル) → silhouette(光の中からモンスターの
//   影が浮かぶ) → reveal(レア度バナー＋本体フルカラー表示)。
// レア度が上がるほど、揺れる時間・パーティクル数・フラッシュ回数を増やして
// 「派手さ」を段階的に強くしてある。
// ============================================================

import { useState } from "react";
import { getChapter } from "../data/storyMap.js";
import { useGame } from "../context/GameContext.jsx";
import { pullGacha } from "../engine/gacha.js";
import { monsterImageUrl, monsterImgFilter } from "../data/monsterImages.js";

const PULL_COST = 100; // #todo コインバランス調整

const RARITY_ORDER = ["N", "R", "SR", "UR"];
const RARITY_CONFIG = {
  N: { label: "ノーマル", glow: "#dfe3ff", shakeMs: 550, rays: 8, particles: 12, flashes: 1 },
  R: { label: "レア", glow: "#7fd0ff", shakeMs: 750, rays: 12, particles: 20, flashes: 1 },
  SR: { label: "スーパーレア", glow: "#ffd166", shakeMs: 950, rays: 18, particles: 32, flashes: 2 },
  UR: { label: "ウルトラレア", glow: "#ff9ecb", shakeMs: 1200, rays: 26, particles: 48, flashes: 3 },
};

const CAPSULE_FALL_MS = 500;
const CAPSULE_CRACK_MS = 320;
const BURST_MS = 550;
const SILHOUETTE_MS = 550;

function rarityConfig(rarity) {
  return RARITY_CONFIG[rarity] || RARITY_CONFIG.N;
}

function Particles({ count, glow }) {
  return (
    <div className="mw-gacha-burst-layer">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.3 - 0.15);
        const dist = 90 + Math.random() * 90;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const delay = Math.random() * 0.12;
        return (
          <span
            key={i}
            className="mw-gacha-particle"
            style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--gacha-glow": glow, animationDelay: `${delay}s` }}
          />
        );
      })}
    </div>
  );
}

function Rays({ count, glow }) {
  return (
    <div className="mw-gacha-burst-layer">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360;
        return (
          <span
            key={i}
            className="mw-gacha-ray"
            style={{ "--angle": `${angle}deg`, "--gacha-glow": glow, animationDelay: `${(i % 3) * 0.03}s` }}
          />
        );
      })}
    </div>
  );
}

function Flashes({ count }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="mw-gacha-flash" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </>
  );
}

export default function GachaScreen({ nav, params }) {
  const { grade, chapterId, freePull } = params;
  const { save, actions } = useGame();
  const chapter = getChapter(grade, chapterId);
  const [phase, setPhase] = useState("idle"); // idle | capsuleFall | capsuleShake | capsuleCrack | burst | silhouette | reveal
  const [result, setResult] = useState(null);
  const [freeUsed, setFreeUsed] = useState(false);
  const [error, setError] = useState(null);

  const busy = phase !== "idle" && phase !== "reveal";
  const cfg = result ? rarityConfig(result.rarity) : RARITY_CONFIG.N;

  function runSequence(character) {
    setError(null);
    setResult(character);
    setPhase("capsuleFall");
    const c = rarityConfig(character.rarity);
    const tShake = CAPSULE_FALL_MS;
    const tCrack = tShake + c.shakeMs;
    const tBurst = tCrack + CAPSULE_CRACK_MS;
    const tSilhouette = tBurst + BURST_MS;
    const tReveal = tSilhouette + SILHOUETTE_MS;
    setTimeout(() => setPhase("capsuleShake"), tShake);
    setTimeout(() => setPhase("capsuleCrack"), tCrack);
    setTimeout(() => setPhase("burst"), tBurst);
    setTimeout(() => setPhase("silhouette"), tSilhouette);
    setTimeout(() => {
      setPhase("reveal");
      actions.obtainCharacter(character);
    }, tReveal);
  }

  function doFreePull() {
    if (busy) return;
    const c = pullGacha(grade, chapterId);
    if (!c) return;
    setFreeUsed(true);
    runSequence(c);
  }

  function doPaidPull() {
    if (busy) return;
    if (!actions.spendCoins(PULL_COST)) {
      setError("コインが足りません");
      return;
    }
    const c = pullGacha(grade, chapterId);
    if (!c) return;
    runSequence(c);
  }

  if (!chapter) return null;
  const isRevealed = phase === "reveal";

  return (
    <div className="mw-fantasy-screen">
      <div className="mw-fantasy-topbar">
        <button className="mw-fantasy-back" onClick={() => nav.back()} disabled={busy}>
          ← もどる
        </button>
        <span className="mw-fantasy-title" style={{ fontSize: "1.1rem" }}>
          {chapter.name}のガチャ
        </span>
        <span style={{ width: 60 }} />
      </div>

      <div
        className="mw-fantasy-panel mw-gacha-stage"
        style={{ "--gacha-glow": cfg.glow }}
      >
        {phase === "idle" && (
          <div className="mw-gacha-idle">
            <div className="mw-gacha-machine">🎰</div>
            <div className="mw-gacha-tap-hint">タップして！</div>
          </div>
        )}

        {phase !== "idle" && (
          <div className="mw-gacha-capsule-area">
            {(phase === "burst" || phase === "silhouette" || phase === "reveal") && (
              <>
                <Rays count={cfg.rays} glow={cfg.glow} />
                <Particles count={cfg.particles} glow={cfg.glow} />
              </>
            )}
            {phase === "burst" && <Flashes count={cfg.flashes} />}

            {(phase === "capsuleFall" || phase === "capsuleShake" || phase === "capsuleCrack") && (
              <div className={`mw-gacha-capsule phase-${phase === "capsuleFall" ? "fall" : phase === "capsuleShake" ? "shake" : "crack"}`}>
                <div className="mw-gacha-capsule-top" />
                <div className="mw-gacha-capsule-bottom" />
              </div>
            )}

            {(phase === "silhouette" || phase === "reveal") && result && (
              <div className="mw-gacha-reveal-col">
                {monsterImageUrl(result, "full") ? (
                  <img
                    src={monsterImageUrl(result, "full")}
                    alt=""
                    className={`mw-gacha-silhouette-img ${isRevealed ? "revealed" : ""}`}
                    style={{ filter: isRevealed ? monsterImgFilter(result) : undefined }}
                  />
                ) : (
                  <div className={`mw-gacha-silhouette-fallback ${isRevealed ? "revealed" : ""}`}>❓</div>
                )}
                {isRevealed && (
                  <>
                    <div className={`mw-gacha-rarity-banner mw-rarity-banner-${result.rarity}`}>
                      {cfg.label}
                      {(result.rarity === "SR" || result.rarity === "UR") ? "！！" : "！"}
                    </div>
                    <div className={`mw-rarity mw-rarity-${result.rarity}`}>{result.rarity}</div>
                    <div className="mw-fantasy-title" style={{ fontSize: "1.15rem" }}>
                      {result.name}
                    </div>
                    <div style={{ color: "#ffe9b3", opacity: 0.85 }}>{result.theme}</div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {error && <div style={{ color: "#ffe9b3", marginTop: 8 }}>{error}</div>}
      </div>

      {phase === "idle" && (
        <>
          {freePull && !freeUsed && (
            <button className="mw-fantasy-item" style={{ justifyContent: "center" }} onClick={doFreePull}>
              <span className="mw-fantasy-icon">🎉</span>
              無料で1回引く
            </button>
          )}

          <button
            className="mw-fantasy-item"
            style={{ justifyContent: "center" }}
            onClick={doPaidPull}
            disabled={save.coins < PULL_COST}
          >
            <span className="mw-fantasy-icon">🪙</span>
            {PULL_COST}で1回引く（所持 {save.coins}）
          </button>
        </>
      )}

      {isRevealed && (
        <button className="mw-fantasy-item" style={{ justifyContent: "center" }} onClick={() => setPhase("idle")}>
          <span className="mw-fantasy-icon">🔄</span>
          もう一度ガチャを見る
        </button>
      )}
    </div>
  );
}
