// ============================================================
// BattleFX.jsx — 攻撃エフェクト層（PixiJS）。
//
// 2026-09-12：「案A(PixiJS/Phaser)をとりあえず試す」の実装。
//   イラスト素材はまだ無いので、色と図形だけで作るプロシージャルな
//   パーティクル（コストゼロで作れる）で「ド派手さ」を確認するための
//   実装。素材（スプライト）を後で足すのは簡単（PIXI.Sprite の
//   テクスチャを差し替えるだけで、動き自体は変えなくていい）。
//
// 2026-09-12（同日・2回目）：「黒猫のウィズみたいに、たまが敵に飛んでいく」
//   演出を追加。攻撃は 発射(spawnProjectile) → 着弾(バースト/テキスト/
//   フラッシュ) の2段階。
//
// 2026-09-12（同日・4回目）：フィードバックを反映。
//   - バグ修正：座標計算に app.renderer.width/height（＝解像度込みの
//     実ピクセル数。Retinaだと画面の2倍）を使っていたため、「中央」の
//     つもりが実際には画面の端(右下寄り)にずれていた。ダメージ表記が
//     右で見切れる・たまが見えない、の両方の原因がこれ。
//     app.screen.width/height（＝論理サイズ、CSSピクセルと一致）に修正。
//   - クリティカルの「ザシュッ」演出（大きめバースト＋斬撃線）を
//     通常ヒットの標準仕様に格上げ（クリティカルはそこからさらに一段強く）。
//   - 着弾位置を画面中央でなく「敵モンスターの近く」（本体表示のやや上寄り）
//     に固定し、ダメージ表記もその周辺に出す。
//   - 3体同時攻撃に対応：各ヒットに小さなオフセット(offset)を持たせ、
//     3つの弾・3つのダメージ数字が重なりすぎないようにした。
// ============================================================

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as PIXI from "pixi.js";
import { playLaunchSound, playImpactSound, playMissSound, playDefeatSound } from "./sound.js";

// 系統ごとの色（App.cssの --calc/--eq/--func/--geo/--data と同じ値）
const SUBJECT_COLOR = {
  calc: 0x4488ff,
  eq: 0xa259ff,
  func: 0x22c1a1,
  geo: 0xff8a4d,
  data: 0xff5bb0,
};

// 着弾（バースト・ダメージ数字）の基準点＝画面中央でなく敵の絵に近い位置。
// enemy画像は panel 上部寄りに表示されているため、yはやや上に寄せる。
const IMPACT_POINT = { xRatio: 0.5, yRatio: 0.4 };

// React側でログ表示・シェイクのタイミングを合わせるための近似値(ms)。
// frames(下の関数群)を60fpsとして概算した値——プロトタイプとして十分な精度。
export const PROJECTILE_MS = { normal: 400, crit: 500, miss: 300 };

function makeCircleTexture(app, color, size = 16) {
  const g = new PIXI.Graphics();
  g.beginFill(color);
  g.drawCircle(size / 2, size / 2, size / 2);
  g.endFill();
  const texture = app.renderer.generateTexture(g);
  g.destroy();
  return texture;
}

function addTicked(app, particles, update) {
  const ticker = (delta) => {
    let alive = false;
    for (const p of particles) {
      if (p.life === undefined || p.life <= 0) continue;
      alive = true;
      update(p, delta);
    }
    if (!alive) {
      app.ticker.remove(ticker);
      for (const p of particles) {
        app.stage.removeChild(p);
        p.destroy();
      }
    }
  };
  app.ticker.add(ticker);
}

function impactPoint(app, offset = { dx: 0, dy: 0 }) {
  return {
    x: app.screen.width * IMPACT_POINT.xRatio + offset.dx,
    y: app.screen.height * IMPACT_POINT.yRatio + offset.dy,
  };
}

// 「たま」が自陣（左下＝パーティ側のつもり）から敵（中央やや上）へ飛んでいく演出。
// targetRatio=1なら着弾まで、<1なら途中で消える（ミス用）。
function spawnProjectile(app, { color, size = 14, frames = 24, targetRatio = 1, offset, onArrive }) {
  const goal = impactPoint(app, offset);
  const startX = app.screen.width * 0.08;
  const startY = app.screen.height * 0.95;
  const goalX = startX + (goal.x - startX) * targetRatio;
  const goalY = startY + (goal.y - startY) * targetRatio;

  const orb = new PIXI.Sprite(makeCircleTexture(app, color, size * 2));
  orb.anchor.set(0.5);
  orb.x = startX;
  orb.y = startY;
  orb.blendMode = PIXI.BLEND_MODES.ADD;
  app.stage.addChild(orb);

  const glow = new PIXI.Sprite(makeCircleTexture(app, 0xffffff, size * 3.6));
  glow.anchor.set(0.5);
  glow.alpha = 0.5;
  glow.blendMode = PIXI.BLEND_MODES.ADD;
  app.stage.addChild(glow);

  const trail = [];
  let t = 0;

  const ticker = (delta) => {
    t += delta;
    const progress = Math.min(1, t / frames);
    const eased = progress * progress; // ease-in：発射直後はゆっくり、着弾直前は速く
    const x = startX + (goalX - startX) * eased;
    const y = startY + (goalY - startY) * eased;
    orb.x = x;
    orb.y = y;
    glow.x = x;
    glow.y = y;
    glow.scale.set(1 + Math.sin(t * 0.6) * 0.15);

    // 毎フレーム、尾を引くトレイル粒子を残す
    const tp = new PIXI.Sprite(makeCircleTexture(app, color, size * 1.5));
    tp.anchor.set(0.5);
    tp.x = x;
    tp.y = y;
    tp.life = 1;
    tp.blendMode = PIXI.BLEND_MODES.ADD;
    app.stage.addChild(tp);
    trail.push(tp);

    for (const tp2 of trail) {
      if (tp2.life <= 0) continue;
      tp2.life -= 0.14 * delta;
      tp2.alpha = Math.max(0, tp2.life * 0.6);
      tp2.scale.set(Math.max(0.15, tp2.life));
    }

    if (progress >= 1) {
      app.ticker.remove(ticker);
      app.stage.removeChild(orb);
      orb.destroy();
      app.stage.removeChild(glow);
      glow.destroy();
      for (const tp2 of trail) {
        if (tp2.parent) app.stage.removeChild(tp2);
        tp2.destroy();
      }
      onArrive?.(goalX, goalY);
    }
  };
  app.ticker.add(ticker);
}

// クリティカルだった「ザシュッ」演出を標準仕様に格上げ。critはそこからさらに一段強い。
function spawnBurst(app, { crit, x, y }) {
  const cx = x ?? app.screen.width / 2;
  const cy = y ?? app.screen.height / 2;
  const colors = crit
    ? [0xffd166, 0xff5b6a, 0xffffff, 0xff9ecb]
    : [0x7fd0ff, 0xffffff, 0xbfe3ff, 0xffe08a];
  const count = crit ? 36 : 26;
  const particles = [];

  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = crit ? 5 + Math.random() * 7 : 4 + Math.random() * 6;
    const p = new PIXI.Sprite(makeCircleTexture(app, color, size * 2));
    p.anchor.set(0.5);
    p.x = cx;
    p.y = cy;
    const angle = Math.random() * Math.PI * 2;
    const speed = (crit ? 7.5 : 6) + Math.random() * (crit ? 7 : 5.5);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 1;
    p.blendMode = PIXI.BLEND_MODES.ADD;
    app.stage.addChild(p);
    particles.push(p);
  }

  // 斬撃っぽい線（ザシュッ）
  const streaks = crit ? 10 : 7;
  for (let i = 0; i < streaks; i++) {
    const g = new PIXI.Graphics();
    const angle = Math.random() * Math.PI * 2;
    const len = (crit ? 75 : 60) + Math.random() * 45;
    g.lineStyle(crit ? 6 : 5, crit ? 0xffffff : 0xdfeeff, 0.95);
    g.moveTo(-Math.cos(angle) * len * 0.3, -Math.sin(angle) * len * 0.3);
    g.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
    g.x = cx;
    g.y = cy;
    g.life = 1;
    g.blendMode = PIXI.BLEND_MODES.ADD;
    app.stage.addChild(g);
    particles.push(g);
  }

  addTicked(app, particles, (p, delta) => {
    p.life -= 0.035 * delta;
    if (p.vx !== undefined) {
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 0.12 * delta;
      p.scale.set(Math.max(0.05, p.life));
    }
    p.alpha = Math.max(0, p.life);
  });
}

function spawnDamageText(app, damage, crit, x, y) {
  const style = new PIXI.TextStyle({
    fontFamily: "system-ui, sans-serif",
    fontSize: crit ? 50 : 34,
    fontWeight: "800",
    fill: crit ? 0xffd166 : 0xffffff,
    stroke: 0x14172b,
    strokeThickness: 7,
  });
  const text = new PIXI.Text(`${damage}`, style);
  text.anchor.set(0.5);
  // 敵の近くに出す。画面端で見切れないよう、テキスト幅ぶんの余白でクランプする。
  const margin = 40;
  text.x = Math.min(app.screen.width - margin, Math.max(margin, x));
  text.y = Math.max(24, y);
  text.scale.set(0.3);
  text.life = 1;
  text.__t = 0;
  app.stage.addChild(text);

  let subLabel = null;
  if (crit) {
    subLabel = new PIXI.Text("CRITICAL!", {
      fontFamily: "system-ui, sans-serif",
      fontSize: 20,
      fontWeight: "800",
      fill: 0xffffff,
      stroke: 0xc94848,
      strokeThickness: 4,
    });
    subLabel.anchor.set(0.5);
    subLabel.x = text.x;
    subLabel.y = text.y - 46;
    subLabel.scale.set(0.2);
    subLabel.life = 1;
    subLabel.__t = 0;
    app.stage.addChild(subLabel);
  }

  const items = subLabel ? [text, subLabel] : [text];
  addTicked(app, items, (node, delta) => {
    node.__t += delta;
    const growPhase = Math.min(1, node.__t / 6);
    node.scale.set(0.3 + growPhase * (crit ? 1.0 : 0.8));
    node.y -= 0.45 * delta;
    if (node.__t > 16) node.alpha = Math.max(0, 1 - (node.__t - 16) / 14);
    node.life = node.__t > 30 ? 0 : 1;
  });
}

function flashScreen(app, color = 0xffffff, peak = 0.8) {
  const g = new PIXI.Graphics();
  g.beginFill(color);
  g.drawRect(0, 0, app.screen.width, app.screen.height);
  g.endFill();
  g.alpha = peak;
  g.life = 1;
  app.stage.addChild(g);
  addTicked(app, [g], (node) => {
    node.alpha -= 0.07;
    node.life = node.alpha > 0 ? 1 : 0;
  });
}

function spawnMissPuff(app, x, y) {
  const particles = [];
  const px = x ?? app.screen.width / 2;
  const py = y ?? app.screen.height / 2;
  for (let i = 0; i < 8; i++) {
    const p = new PIXI.Sprite(makeCircleTexture(app, 0x8890b8, 10));
    p.anchor.set(0.5);
    p.x = px;
    p.y = py;
    const angle = Math.random() * Math.PI * 2;
    p.vx = Math.cos(angle) * 1.5;
    p.vy = Math.sin(angle) * 1.5 - 1;
    p.life = 1;
    app.stage.addChild(p);
    particles.push(p);
  }
  addTicked(app, particles, (p, delta) => {
    p.life -= 0.03 * delta;
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.alpha = Math.max(0, p.life);
  });
}

const BattleFX = forwardRef(function BattleFX(_props, ref) {
  const containerRef = useRef(null);
  const appRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const app = new PIXI.Application({
      resizeTo: el,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    el.appendChild(app.view);
    appRef.current = app;
    return () => {
      app.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    // offset: {dx,dy} を渡すと、3体同時攻撃などで複数の弾が完全に重ならないようにできる。
    playHit({ damage, isCrit, subject, offset = { dx: 0, dy: 0 } }) {
      const app = appRef.current;
      if (!app) return;
      const color = SUBJECT_COLOR[subject] ?? 0xffffff;
      playLaunchSound({ crit: isCrit });
      spawnProjectile(app, {
        color,
        size: isCrit ? 17 : 13,
        frames: isCrit ? 30 : 24,
        offset,
        onArrive: (x, y) => {
          spawnBurst(app, { crit: isCrit, x, y });
          spawnDamageText(app, damage, isCrit, x, y);
          playImpactSound({ crit: isCrit });
          if (isCrit) flashScreen(app, 0xffffff, 0.85);
        },
      });
    },
    playMiss({ subject } = {}) {
      const app = appRef.current;
      if (!app) return;
      const color = SUBJECT_COLOR[subject] ?? 0x8890b8;
      playLaunchSound({ crit: false });
      spawnProjectile(app, {
        color,
        size: 10,
        frames: 18,
        targetRatio: 0.55, // 敵の手前で失速して消える＝「届かなかった」
        onArrive: (x, y) => {
          spawnMissPuff(app, x, y);
          playMissSound();
        },
      });
    },
    playDefeat() {
      const app = appRef.current;
      if (!app) return;
      const { x, y } = impactPoint(app);
      spawnBurst(app, { crit: true, x, y });
      spawnBurst(app, { crit: true, x, y });
      flashScreen(app, 0xffd166, 0.6);
      playDefeatSound();
    },
  }));

  return <div ref={containerRef} className="mw-fx-overlay" />;
});

export default BattleFX;
