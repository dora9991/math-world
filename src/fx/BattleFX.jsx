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
//   演出を追加。攻撃は 発射(spawnProjectile) → 着弾(既存のバースト/
//   テキスト/フラッシュ) の2段階になった。玉の色は攻撃した系統
//   （計算/方程式/関数/図形/データ）に合わせて変える。
//
// 使い方：Battle.jsx から ref 経由で
//   fx.playHit({damage, isCrit, subject}) / fx.playMiss() / fx.playDefeat()
//   を呼ぶ。着弾のタイミングは PROJECTILE_MS（このファイルからexport）に
//   合わせて、呼び出し側（React）でログ表示・画面シェイクのタイミングを
//   ずらすこと（フレーム単位の内部タイマーとReact側のms换算は厳密には
//   一致しない近似値——プロトタイプとして十分な精度、という判断）。
// ============================================================

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as PIXI from "pixi.js";

// 系統ごとの色（App.cssの --calc/--eq/--func/--geo/--data と同じ値）
const SUBJECT_COLOR = {
  calc: 0x4488ff,
  eq: 0xa259ff,
  func: 0x22c1a1,
  geo: 0xff8a4d,
  data: 0xff5bb0,
};

// React側でログ表示・シェイクのタイミングを合わせるための近似値(ms)。
// 内部のフレーム単位アニメーションと厳密一致ではないが、体感で十分揃う。
export const PROJECTILE_MS = { normal: 330, crit: 430, miss: 260 };

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

// 「たま」が自陣（左下＝パーティ側のつもり）から敵（中央）へ飛んでいく演出。
// targetRatio=1なら着弾まで、<1なら途中で消える（ミス用）。
function spawnProjectile(app, { color, size = 12, frames = 22, targetRatio = 1, onArrive }) {
  const startX = app.renderer.width * 0.1;
  const startY = app.renderer.height * 0.9;
  const endX = app.renderer.width / 2;
  const endY = app.renderer.height / 2;
  const goalX = startX + (endX - startX) * targetRatio;
  const goalY = startY + (endY - startY) * targetRatio;

  const orb = new PIXI.Sprite(makeCircleTexture(app, color, size * 2));
  orb.anchor.set(0.5);
  orb.x = startX;
  orb.y = startY;
  orb.blendMode = PIXI.BLEND_MODES.ADD;
  app.stage.addChild(orb);

  const glow = new PIXI.Sprite(makeCircleTexture(app, 0xffffff, size * 3.4));
  glow.anchor.set(0.5);
  glow.alpha = 0.45;
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

    if (Math.floor(t) % 2 === 0) {
      const tp = new PIXI.Sprite(makeCircleTexture(app, color, size * 1.3));
      tp.anchor.set(0.5);
      tp.x = x;
      tp.y = y;
      tp.life = 1;
      tp.blendMode = PIXI.BLEND_MODES.ADD;
      app.stage.addChild(tp);
      trail.push(tp);
    }
    for (const tp of trail) {
      if (tp.life <= 0) continue;
      tp.life -= 0.1 * delta;
      tp.alpha = Math.max(0, tp.life * 0.5);
      tp.scale.set(Math.max(0.15, tp.life));
    }

    if (progress >= 1) {
      app.ticker.remove(ticker);
      app.stage.removeChild(orb);
      orb.destroy();
      app.stage.removeChild(glow);
      glow.destroy();
      for (const tp of trail) {
        if (tp.parent) app.stage.removeChild(tp);
        tp.destroy();
      }
      onArrive?.(goalX, goalY);
    }
  };
  app.ticker.add(ticker);
}

function spawnBurst(app, { crit }) {
  const cx = app.renderer.width / 2;
  const cy = app.renderer.height / 2;
  const colors = crit ? [0xffd166, 0xff5b6a, 0xffffff, 0xff9ecb] : [0x7fd0ff, 0xffffff, 0xbfe3ff];
  const count = crit ? 32 : 16;
  const particles = [];

  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = crit ? 5 + Math.random() * 7 : 3 + Math.random() * 4;
    const p = new PIXI.Sprite(makeCircleTexture(app, color, size * 2));
    p.anchor.set(0.5);
    p.x = cx;
    p.y = cy;
    const angle = Math.random() * Math.PI * 2;
    const speed = (crit ? 7 : 3.8) + Math.random() * (crit ? 7 : 3.5);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 1;
    p.blendMode = PIXI.BLEND_MODES.ADD;
    app.stage.addChild(p);
    particles.push(p);
  }

  const streaks = crit ? 8 : 4;
  for (let i = 0; i < streaks; i++) {
    const g = new PIXI.Graphics();
    const angle = Math.random() * Math.PI * 2;
    const len = (crit ? 70 : 45) + Math.random() * 40;
    g.lineStyle(crit ? 6 : 4, crit ? 0xffffff : 0xdfeeff, 0.95);
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

function spawnDamageText(app, damage, crit) {
  const style = new PIXI.TextStyle({
    fontFamily: "system-ui, sans-serif",
    fontSize: crit ? 50 : 32,
    fontWeight: "800",
    fill: crit ? 0xffd166 : 0xffffff,
    stroke: 0x14172b,
    strokeThickness: 7,
  });
  const text = new PIXI.Text(`${damage}`, style);
  text.anchor.set(0.5);
  text.x = app.renderer.width / 2 + (Math.random() * 40 - 20);
  text.y = app.renderer.height / 2 - 20;
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
  g.drawRect(0, 0, app.renderer.width, app.renderer.height);
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
  for (let i = 0; i < 8; i++) {
    const p = new PIXI.Sprite(makeCircleTexture(app, 0x8890b8, 10));
    p.anchor.set(0.5);
    p.x = x ?? app.renderer.width / 2;
    p.y = y ?? app.renderer.height / 2;
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
    playHit({ damage, isCrit, subject }) {
      const app = appRef.current;
      if (!app) return;
      const color = SUBJECT_COLOR[subject] ?? 0xffffff;
      spawnProjectile(app, {
        color,
        size: isCrit ? 15 : 10,
        frames: isCrit ? 26 : 20,
        onArrive: () => {
          spawnBurst(app, { crit: isCrit });
          spawnDamageText(app, damage, isCrit);
          if (isCrit) flashScreen(app, 0xffffff, 0.85);
        },
      });
    },
    playMiss({ subject } = {}) {
      const app = appRef.current;
      if (!app) return;
      const color = SUBJECT_COLOR[subject] ?? 0x8890b8;
      spawnProjectile(app, {
        color,
        size: 8,
        frames: 16,
        targetRatio: 0.55, // 敵の手前で失速して消える＝「届かなかった」
        onArrive: (x, y) => spawnMissPuff(app, x, y),
      });
    },
    playDefeat() {
      const app = appRef.current;
      if (!app) return;
      spawnBurst(app, { crit: true });
      spawnBurst(app, { crit: true });
      flashScreen(app, 0xffd166, 0.6);
    },
  }));

  return <div ref={containerRef} className="mw-fx-overlay" />;
});

export default BattleFX;
