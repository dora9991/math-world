// ============================================================
// BattleFX.jsx — 攻撃エフェクト層（PixiJS）。
//
// 2026-09-12：「案A(PixiJS/Phaser)をとりあえず試す」の実装。
// 2026-09-12（2回目）：「たま」の発射→着弾の2段階に。
// 2026-09-12（4回目）：座標バグ修正(renderer.width→screen.width)、
//   クリティカルの「ザシュッ」を標準仕様に格上げ、効果音を追加。
//
// 2026-09-12（5回目）：フィードバックを反映。
//   - 「ただの丸でダサい」→ 粒子・たまを、Canvas2Dのradial gradientで
//     作ったソフトな発光テクスチャ(makeGlowTexture)に差し替え。
//     追加で、着弾時に「もわっと」広がる煙玉風のブロブ(spawnPoof)を追加。
//   - 「たまは選んだ3体それぞれから飛ばしたい」→ startPoint(from)を
//     呼び出し側(Battle.jsx)から渡せるようにした。渡さない場合は
//     旧来の左下からの発射にフォールバック。
//   - 「敵の反撃：敵が少し下がって、パーティの上に引っ掻き、少し揺れる」
//     → playEnemyCounter()を追加。敵の下がる動き自体はCSS側(Battle.jsx)
//     が担当し、ここでは「パーティの上に出す引っ掻きの線」を描く。
// ============================================================

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as PIXI from "pixi.js";
import {
  playLaunchSound,
  playImpactSound,
  playMissSound,
  playDefeatSound,
  playEnemyHitSound,
} from "./sound.js";

// 系統ごとの色（App.cssの --calc/--eq/--func/--geo/--data と同じ値）
const SUBJECT_COLOR = {
  calc: 0x4488ff,
  eq: 0xa259ff,
  func: 0x22c1a1,
  geo: 0xff8a4d,
  data: 0xff5bb0,
};

// 着弾の既定位置（呼び出し側がtoを渡さないときのフォールバック）。
const IMPACT_POINT = { xRatio: 0.5, yRatio: 0.4 };

// React側でログ表示・シェイクのタイミングを合わせるための近似値(ms)。
export const PROJECTILE_MS = { normal: 400, crit: 500, miss: 300 };

// ---- ソフトな発光テクスチャ（Canvas2DのradialGradientで作る。ハードな丸をやめた） ----
const glowTextureCache = new Map();
function hexToRgb(hex) {
  return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}
function makeGlowTexture(color, px = 128) {
  const key = `${color}_${px}`;
  if (glowTextureCache.has(key)) return glowTextureCache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  const r = px / 2;
  const { r: cr, g: cg, b: cb } = hexToRgb(color);
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
  grad.addColorStop(0.35, `rgba(${cr},${cg},${cb},0.85)`);
  grad.addColorStop(0.75, `rgba(${cr},${cg},${cb},0.25)`);
  grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  const tex = PIXI.Texture.from(canvas);
  glowTextureCache.set(key, tex);
  return tex;
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

function defaultImpactPoint(app) {
  return { x: app.screen.width * IMPACT_POINT.xRatio, y: app.screen.height * IMPACT_POINT.yRatio };
}

// 「たま」が発射地点(from・省略時は左下)から着弾地点(to・省略時は中央やや上)へ飛ぶ。
// targetRatio=1なら着弾まで、<1なら途中で消える（ミス用）。
function spawnProjectile(app, { color, size = 15, frames = 24, targetRatio = 1, from, to, offset, onArrive }) {
  const off = offset || { dx: 0, dy: 0 };
  const start = from ?? { x: app.screen.width * 0.1, y: app.screen.height * 0.92 };
  const rawGoal = to ?? defaultImpactPoint(app);
  const goal = { x: rawGoal.x + off.dx, y: rawGoal.y + off.dy };
  const goalX = start.x + (goal.x - start.x) * targetRatio;
  const goalY = start.y + (goal.y - start.y) * targetRatio;

  const glowTex = makeGlowTexture(color, 128);
  const coreTex = makeGlowTexture(0xffffff, 96);

  const orb = new PIXI.Sprite(glowTex);
  orb.anchor.set(0.5);
  orb.width = orb.height = size * 2.4;
  orb.x = start.x;
  orb.y = start.y;
  orb.blendMode = PIXI.BLEND_MODES.ADD;
  app.stage.addChild(orb);

  const core = new PIXI.Sprite(coreTex);
  core.anchor.set(0.5);
  core.width = core.height = size * 1.1;
  core.alpha = 0.9;
  core.blendMode = PIXI.BLEND_MODES.ADD;
  app.stage.addChild(core);

  const trail = [];
  let t = 0;

  const ticker = (delta) => {
    t += delta;
    const progress = Math.min(1, t / frames);
    const eased = progress * progress; // ease-in：発射直後はゆっくり、着弾直前は速く
    const x = start.x + (goalX - start.x) * eased;
    const y = start.y + (goalY - start.y) * eased;
    orb.x = x;
    orb.y = y;
    core.x = x;
    core.y = y;
    const pulse = 1 + Math.sin(t * 0.6) * 0.15;
    orb.width = orb.height = size * 2.4 * pulse;

    // ふわっとしたトレイルを毎フレーム残す
    const tp = new PIXI.Sprite(glowTex);
    tp.anchor.set(0.5);
    tp.width = tp.height = size * 1.8;
    tp.x = x;
    tp.y = y;
    tp.life = 1;
    tp.blendMode = PIXI.BLEND_MODES.ADD;
    app.stage.addChild(tp);
    trail.push(tp);

    for (const tp2 of trail) {
      if (tp2.life <= 0) continue;
      tp2.life -= 0.13 * delta;
      tp2.alpha = Math.max(0, tp2.life * 0.5);
      const s = Math.max(0.15, tp2.life) * size * 1.8;
      tp2.width = tp2.height = s;
    }

    if (progress >= 1) {
      app.ticker.remove(ticker);
      app.stage.removeChild(orb);
      orb.destroy();
      app.stage.removeChild(core);
      core.destroy();
      for (const tp2 of trail) {
        if (tp2.parent) app.stage.removeChild(tp2);
        tp2.destroy();
      }
      onArrive?.(goalX, goalY);
    }
  };
  app.ticker.add(ticker);
}

// クリティカルの「ザシュッ」演出（大きめバースト＋斬撃線）を標準仕様に。
// クリティカルはそこからさらに一段強い。粒子はソフトな発光テクスチャに変更。
function spawnBurst(app, { crit, x, y }) {
  const cx = x ?? app.screen.width / 2;
  const cy = y ?? app.screen.height / 2;
  const colors = crit
    ? [0xffd166, 0xff5b6a, 0xffffff, 0xff9ecb]
    : [0x7fd0ff, 0xffffff, 0xbfe3ff, 0xffe08a];
  const count = crit ? 30 : 22;
  const particles = [];

  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = (crit ? 14 : 11) + Math.random() * (crit ? 14 : 10);
    const p = new PIXI.Sprite(makeGlowTexture(color, 96));
    p.anchor.set(0.5);
    p.width = p.height = size;
    p.x = cx;
    p.y = cy;
    const angle = Math.random() * Math.PI * 2;
    const speed = (crit ? 7.5 : 6) + Math.random() * (crit ? 7 : 5.5);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 1;
    p.__size = size;
    p.blendMode = PIXI.BLEND_MODES.ADD;
    app.stage.addChild(p);
    particles.push(p);
  }

  // 斬撃っぽい線（ザシュッ、好評だったのでそのまま残す）
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
      const s = Math.max(0.05, p.life) * (p.__size ?? 1);
      if (p.__size) p.width = p.height = s;
      else p.scale.set(Math.max(0.05, p.life));
    }
    p.alpha = Math.max(0, p.life);
  });

  spawnPoof(app, { x: cx, y: cy, crit });
}

// 「もわっと」広がる煙玉風のブロブ。ソフトな発光テクスチャを大きく・ゆっくり広げて消す。
function spawnPoof(app, { x, y, crit }) {
  const colors = crit ? [0xffd166, 0xff8a4d, 0xffffff] : [0x9fd8ff, 0xffffff, 0xc9e8ff];
  const count = crit ? 6 : 4;
  const blobs = [];
  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const targetSize = (crit ? 90 : 64) + Math.random() * (crit ? 50 : 36);
    const sp = new PIXI.Sprite(makeGlowTexture(color, 128));
    sp.anchor.set(0.5);
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (crit ? 24 : 16);
    sp.x = x + Math.cos(angle) * dist;
    sp.y = y + Math.sin(angle) * dist;
    sp.width = sp.height = targetSize * 0.2;
    sp.alpha = 0.7;
    sp.blendMode = PIXI.BLEND_MODES.ADD;
    sp.life = 1;
    sp.__target = targetSize;
    app.stage.addChild(sp);
    blobs.push(sp);
  }
  addTicked(app, blobs, (b, delta) => {
    b.life -= 0.045 * delta;
    const grown = 1 - Math.max(0, b.life);
    const size = b.__target * (0.2 + grown * 1.0);
    b.width = b.height = size;
    b.alpha = Math.max(0, b.life * 0.65);
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
  const px = x ?? app.screen.width / 2;
  const py = y ?? app.screen.height / 2;
  const particles = [];
  for (let i = 0; i < 7; i++) {
    const p = new PIXI.Sprite(makeGlowTexture(0x9aa0c8, 80));
    p.anchor.set(0.5);
    p.width = p.height = 14 + Math.random() * 10;
    p.x = px;
    p.y = py;
    const angle = Math.random() * Math.PI * 2;
    p.vx = Math.cos(angle) * 1.4;
    p.vy = Math.sin(angle) * 1.4 - 1;
    p.life = 1;
    app.stage.addChild(p);
    particles.push(p);
  }
  addTicked(app, particles, (p, delta) => {
    p.life -= 0.028 * delta;
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.alpha = Math.max(0, p.life * 0.7);
  });
}

// 敵の反撃：パーティの上に引っ掻き線を出す。rect はパーティ表示エリアの
// {x,y,width,height}（舞台=stage基準の座標）。
function spawnClawSlash(app, rect) {
  const cx = rect ? rect.x + rect.width / 2 : app.screen.width / 2;
  const cy = rect ? rect.y + rect.height / 2 : app.screen.height / 2;
  const spanW = rect?.width ?? app.screen.width * 0.7;
  const spanH = rect?.height ?? 80;

  const streaks = [];
  const count = 3;
  for (let i = 0; i < count; i++) {
    const g = new PIXI.Graphics();
    const laneOffset = (i - (count - 1) / 2) * (spanW * 0.24);
    const len = Math.max(spanH * 1.6, 70);
    const angle = (-30 + Math.random() * 14) * (Math.PI / 180);
    g.lineStyle(9, 0xff3b3b, 0.92);
    g.moveTo((-Math.cos(angle) * len) / 2, (-Math.sin(angle) * len) / 2);
    g.lineTo((Math.cos(angle) * len) / 2, (Math.sin(angle) * len) / 2);
    // 薄い白フチを内側にもう1本重ねて「爪痕」の質感を出す
    g.lineStyle(3, 0xffffff, 0.5);
    g.moveTo((-Math.cos(angle) * len) / 2, (-Math.sin(angle) * len) / 2);
    g.lineTo((Math.cos(angle) * len) / 2, (Math.sin(angle) * len) / 2);
    g.x = cx + laneOffset;
    g.y = cy;
    g.alpha = 0;
    g.life = 1;
    g.__t = 0;
    app.stage.addChild(g);
    streaks.push(g);
  }

  addTicked(app, streaks, (s, delta) => {
    s.__t += delta;
    if (s.__t < 3) s.alpha = Math.min(1, s.__t / 3);
    else s.alpha = Math.max(0, 1 - (s.__t - 3) / 11);
    s.life = s.__t > 15 ? 0 : 1;
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
    // from/to: {x,y}（舞台=stage基準のCSSピクセル座標）。渡さなければ既定位置にフォールバック。
    // offset: {dx,dy} 複数ヒットが完全に重ならないようにする微調整。
    playHit({ damage, isCrit, subject, from, to, offset = { dx: 0, dy: 0 } }) {
      const app = appRef.current;
      if (!app) return;
      const color = SUBJECT_COLOR[subject] ?? 0xffffff;
      playLaunchSound({ crit: isCrit });
      spawnProjectile(app, {
        color,
        size: isCrit ? 18 : 14,
        frames: isCrit ? 30 : 24,
        from,
        to,
        offset,
        onArrive: (x, y) => {
          spawnBurst(app, { crit: isCrit, x, y });
          spawnDamageText(app, damage, isCrit, x, y);
          playImpactSound({ crit: isCrit });
          if (isCrit) flashScreen(app, 0xffffff, 0.85);
        },
      });
    },
    playMiss({ subject, from, to } = {}) {
      const app = appRef.current;
      if (!app) return;
      const color = SUBJECT_COLOR[subject] ?? 0x8890b8;
      playLaunchSound({ crit: false });
      spawnProjectile(app, {
        color,
        size: 11,
        frames: 18,
        targetRatio: 0.55, // 敵の手前で失速して消える＝「届かなかった」
        from,
        to,
        onArrive: (x, y) => {
          spawnMissPuff(app, x, y);
          playMissSound();
        },
      });
    },
    playDefeat({ to } = {}) {
      const app = appRef.current;
      if (!app) return;
      const point = to ?? defaultImpactPoint(app);
      spawnBurst(app, { crit: true, x: point.x, y: point.y });
      spawnBurst(app, { crit: true, x: point.x, y: point.y });
      flashScreen(app, 0xffd166, 0.6);
      playDefeatSound();
    },
    // rect: パーティ表示エリアの{x,y,width,height}（舞台基準）。
    playEnemyCounter({ rect } = {}) {
      const app = appRef.current;
      if (!app) return;
      spawnClawSlash(app, rect);
      playEnemyHitSound();
    },
  }));

  return <div ref={containerRef} className="mw-fx-overlay" />;
});

export default BattleFX;
