// ============================================================
// BattleFX.jsx — 攻撃エフェクト層（PixiJS）。
//
// 2026-09-12：「案A(PixiJS/Phaserを今のReactに追加)をとりあえず試す」の
//   実装。イラスト素材はまだ無いので、色と図形だけで作るプロシージャルな
//   パーティクル（コストゼロで作れる）で「ド派手さ」がどこまで出るかを
//   確かめるための実装。素材（スプライト）を後で足すのは簡単
//   （PIXI.Sprite に差し替えるだけで、粒子の動き自体は変えなくていい）。
//
// 使い方：Battle.jsx から ref 経由で fx.playHit({damage, isCrit}) /
//   fx.playMiss() / fx.playDefeat() を呼ぶ。HTML側のUI（敵HPバー等）は
//   一切いじらず、透明なCanvasをその上に重ねているだけ。
// ============================================================

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as PIXI from "pixi.js";

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

function spawnBurst(app, { crit }) {
  const cx = app.renderer.width / 2;
  const cy = app.renderer.height / 2;
  const colors = crit ? [0xffd166, 0xff5b6a, 0xffffff, 0xff9ecb] : [0x7fd0ff, 0xffffff, 0xbfe3ff];
  const count = crit ? 32 : 16;
  const particles = [];

  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = crit ? 5 + Math.random() * 7 : 3 + Math.random() * 4;
    const tex = makeCircleTexture(app, color, size * 2);
    const p = new PIXI.Sprite(tex);
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

  // 斬撃っぽい線（クリティカルはより長く・太く）
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
      p.vy += 0.12 * delta; // 重力
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
  const text = new PIXI.Text(crit ? `${damage}` : `${damage}`, style);
  text.anchor.set(0.5);
  text.x = app.renderer.width / 2 + (Math.random() * 40 - 20);
  text.y = app.renderer.height / 2 - 20;
  text.scale.set(0.3);
  text.life = 1;
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
    app.stage.addChild(subLabel);
  }

  let t = 0;
  const items = subLabel ? [text, subLabel] : [text];
  addTicked(app, items, (node, delta) => {
    t += delta / items.length; // 大雑把な経過管理（2要素あっても同じ速さで進む）
    const growPhase = Math.min(1, (node.__t || 0) / 6);
    node.__t = (node.__t || 0) + delta;
    node.scale.set(0.3 + growPhase * (crit ? 1.0 : 0.8));
    node.y -= 0.45 * delta;
    if (node.__t > 16) {
      node.alpha = Math.max(0, 1 - (node.__t - 16) / 14);
    }
    if (node.__t > 30) {
      node.life = 0;
    } else {
      node.life = 1;
    }
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
  addTicked(app, [g], (node, delta) => {
    node.alpha -= 0.07 * delta;
    node.life = node.alpha > 0 ? 1 : 0;
  });
}

function spawnMissPuff(app) {
  const cx = app.renderer.width / 2;
  const cy = app.renderer.height / 2;
  const particles = [];
  for (let i = 0; i < 8; i++) {
    const tex = makeCircleTexture(app, 0x8890b8, 10);
    const p = new PIXI.Sprite(tex);
    p.anchor.set(0.5);
    p.x = cx;
    p.y = cy;
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
    playHit({ damage, isCrit }) {
      const app = appRef.current;
      if (!app) return;
      spawnBurst(app, { crit: isCrit });
      spawnDamageText(app, damage, isCrit);
      if (isCrit) flashScreen(app, 0xffffff, 0.85);
    },
    playMiss() {
      const app = appRef.current;
      if (!app) return;
      spawnMissPuff(app);
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
