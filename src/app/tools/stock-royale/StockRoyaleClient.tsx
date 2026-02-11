"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Swords, Loader2, Shuffle, Trophy, RotateCcw, SkipForward, Search, Share2, Check, Link2,
} from "lucide-react";
import { StockLogo } from "../stock-battle/StockLogo";
import { useI18n } from "@/components/i18n/I18nProvider";
import { getLogoUrls, getTickerColor } from "../stock-battle/stock-logos";
import { US_PRESETS, KR_PRESETS } from "../stock-battle/presets";

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */

interface GameStats {
  hp: number; maxHp: number; atk: number; spd: number;
  crit: number; def: number; drain: number;
}

interface Fighter {
  ticker: string; name: string; stats: GameStats;
  className: string; classEmoji: string; classColor: string;
  canvasColor: string; canvasBg: string;
  targetStrategy: TargetStrategy;
  hp: number; alive: boolean;
  kills: number; totalDamage: number; critsLanded: number;
  deathOrder: number;
  mcapLabel: string; betaVal: number; divYieldPct: number;
}

type TargetStrategy = "nearest" | "weakest" | "farthest";

interface Marble {
  fighter: Fighter;
  x: number; y: number; vx: number; vy: number;
  baseRadius: number; radius: number; mass: number;
  hp: number; maxHp: number; alive: boolean;
  rageMode: boolean; flashTimer: number;
  color: string; bgColor: string;
  targetTicker: string;
  targetStrategy: TargetStrategy;
  retargetFrame: number;
  trail: { x: number; y: number }[];
}

interface FloatingText {
  x: number; y: number; text: string; color: string; life: number; size: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; color: string; size: number;
  char?: string; // optional text character (e.g. "$") rendered instead of circle
}

interface Ring {
  x: number; y: number; radius: number; maxRadius: number;
  life: number; maxLife: number; color: string; lineWidth: number;
}

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

// ETF/crypto tickers to exclude (no individual stock data)
const EXCLUDE = new Set(["SPY", "QQQ", "VOO", "BTC-USD", "ETH-USD"]);
const POOL = [...US_PRESETS, ...KR_PRESETS]
  .filter(p => !EXCLUDE.has(p.ticker))
  .map(p => ({ ticker: p.ticker, name: p.name, flag: p.flag }));

const API = "https://asia-northeast3-suile-21173.cloudfunctions.net/stockScore";
const DMG_CD = 54; // frames between damage for same pair (~0.9s)

/* ═══════════════════════════════════════════════
   GAME ENGINE
   ═══════════════════════════════════════════════ */

function clamp(v: number, mn: number, mx: number) {
  return Math.max(mn, Math.min(mx, v));
}

function toGameStats(d: Record<string, unknown>): GameStats {
  const mc = (d.marketCap as number) ?? 1e9;
  // Power-law (mc^0.3): preserves market cap hierarchy far better than log10
  // e.g. $1B→600 HP, $85B(Hynix)→1900, $1.5T(Meta)→4500, $3T(Apple)→5500
  const raw = Math.pow(mc, 0.3);
  const hpBase = Math.round(clamp(raw / 5, 120, 1200));
  const hp = hpBase * 5;

  const scores = d.scores as Record<string, number> | undefined;
  const profitN = (scores?.profit ?? 15) / 30;
  const growthN = (scores?.growth ?? 12) / 25;
  const atk = Math.round(clamp(30 + (profitN + growthN) * 45, 25, 110));

  const momentum = (d.w52change as number) ?? 0;
  const spd = Math.round(clamp(8 + momentum * 20, 3, 20));

  const beta = (d.beta as number) ?? 1.0;
  const crit = Math.round(clamp(beta * 15 - 5, 5, 35));

  const healthN = (scores?.health ?? 7) / 15;
  const def = Math.round(clamp(5 + healthN * 25, 0, 30));

  const divY = ((d.divYield as number) ?? 0) * 100;
  const drain = Math.round(clamp(divY * 6, 0, 30));

  return { hp, maxHp: hp, atk, spd, crit, def, drain };
}

const CLASS_DEFS = {
  tank:      { ko: "탱커",    en: "Tank",      emoji: "🛡️", color: "text-blue-400",   cColor: "#60a5fa", cBg: "#1e3a5f", strategy: "nearest" as TargetStrategy },
  berserker: { ko: "버서커",  en: "Berserker", emoji: "🪓",  color: "text-red-400",    cColor: "#f87171", cBg: "#5f1e1e", strategy: "weakest" as TargetStrategy },
  assassin:  { ko: "암살자",  en: "Assassin",  emoji: "🗡️", color: "text-purple-400", cColor: "#c084fc", cBg: "#3b1764", strategy: "weakest" as TargetStrategy },
  ranger:    { ko: "레인저",  en: "Ranger",    emoji: "🏹",  color: "text-green-400",  cColor: "#4ade80", cBg: "#1a3d26", strategy: "farthest" as TargetStrategy },
  guardian:  { ko: "가디언",  en: "Guardian",  emoji: "⚔️",  color: "text-yellow-400", cColor: "#facc15", cBg: "#4a3c10", strategy: "nearest" as TargetStrategy },
  vampire:   { ko: "뱀파이어", en: "Vampire",   emoji: "🧛",  color: "text-pink-400",   cColor: "#f472b6", cBg: "#4a1030", strategy: "weakest" as TargetStrategy },
} as const;

function getClass(stats: GameStats, isKo: boolean) {
  const scores = [
    { key: "tank" as const,      v: stats.hp / 6000 },
    { key: "berserker" as const, v: stats.atk / 110 },
    { key: "ranger" as const,    v: stats.spd / 20 },
    { key: "assassin" as const,  v: stats.crit / 35 },
    { key: "guardian" as const,  v: stats.def / 30 },
    { key: "vampire" as const,   v: stats.drain / 30 },
  ];
  const best = scores.sort((a, b) => b.v - a.v)[0];
  const d = CLASS_DEFS[best.key];
  return { name: isKo ? d.ko : d.en, emoji: d.emoji, color: d.color, cColor: d.cColor, cBg: d.cBg, strategy: d.strategy };
}

/* ═══════════════════════════════════════════════
   LOGO PRELOADING
   ═══════════════════════════════════════════════ */

function preloadLogos(tickers: string[]): Promise<Map<string, HTMLImageElement>> {
  return new Promise((resolveAll) => {
    const map = new Map<string, HTMLImageElement>();
    let done = 0;
    const total = tickers.length;
    const finish = () => { if (++done >= total) resolveAll(map); };

    for (const ticker of tickers) {
      const urls = getLogoUrls(ticker);
      if (urls.length === 0) { finish(); continue; }
      let idx = 0;
      let resolved = false;
      const tryLoad = () => {
        if (idx >= urls.length) { if (!resolved) { resolved = true; finish(); } return; }
        const img = new Image();
        img.referrerPolicy = "no-referrer";
        img.onload = () => { map.set(ticker, img); if (!resolved) { resolved = true; finish(); } };
        img.onerror = () => { idx++; tryLoad(); };
        img.src = urls[idx];
      };
      tryLoad();
      setTimeout(() => { if (!resolved) { resolved = true; finish(); } }, 5000);
    }
  });
}

/* ═══════════════════════════════════════════════
   PHYSICS + CANVAS
   ═══════════════════════════════════════════════ */

function createMarbles(fighters: Fighter[], W: number, H: number): Marble[] {
  const baseR = Math.min(W, H) / 11;
  const cx = W / 2, cy = H / 2;
  const spread = Math.min(W, H) * 0.32;

  return fighters.map((f, i) => {
    // Dramatic size: small-cap = tiny, mega-cap = HUGE
    // HP range ~600-6000 → hpFactor ~0.2-1.7
    const hpFactor = 0.2 + Math.max(0, (f.stats.maxHp - 600) / 5400) * 1.5;
    const radius = Math.max(16, Math.round(baseR * hpFactor));
    const angle = (i / fighters.length) * Math.PI * 2 - Math.PI / 2;
    const velAngle = Math.random() * Math.PI * 2;
    const vel = 1.5 + (f.stats.spd / 20) * 3;

    return {
      fighter: f,
      x: cx + Math.cos(angle) * spread,
      y: cy + Math.sin(angle) * spread,
      vx: Math.cos(velAngle) * vel,
      vy: Math.sin(velAngle) * vel,
      baseRadius: radius, radius, mass: f.stats.maxHp,
      hp: f.stats.maxHp, maxHp: f.stats.maxHp,
      alive: true, rageMode: false, flashTimer: 0,
      color: f.canvasColor, bgColor: f.canvasBg,
      targetTicker: "", targetStrategy: f.targetStrategy,
      retargetFrame: 0,
      trail: [],
    };
  });
}

/* ─── Pick target based on class strategy + small-cap aggro ─── */
function pickTarget(m: Marble, alive: Marble[]): string {
  const targets = alive.filter(t => t.fighter.ticker !== m.fighter.ticker);
  if (targets.length === 0) return "";

  // Small-cap aggression: smaller marbles gang up on the biggest
  const maxTargetHp = Math.max(...targets.map(t => t.maxHp));
  const sizeRatio = m.maxHp / maxTargetHp; // <1 = I'm smaller
  if (sizeRatio < 0.85 && Math.random() < 0.55) {
    let biggest = targets[0];
    for (const t of targets) { if (t.maxHp > biggest.maxHp) biggest = t; }
    return biggest.fighter.ticker;
  }

  let best = targets[0];
  switch (m.targetStrategy) {
    case "nearest":
      for (const t of targets) {
        if ((t.x - m.x) ** 2 + (t.y - m.y) ** 2 < (best.x - m.x) ** 2 + (best.y - m.y) ** 2) best = t;
      }
      break;
    case "weakest":
      for (const t of targets) {
        if (t.hp / t.maxHp < best.hp / best.maxHp) best = t;
      }
      break;
    case "farthest":
      for (const t of targets) {
        if ((t.x - m.x) ** 2 + (t.y - m.y) ** 2 > (best.x - m.x) ** 2 + (best.y - m.y) ** 2) best = t;
      }
      break;
  }
  return best.fighter.ticker;
}

/* ─── Physics step ─── */
function physicsStep(
  marbles: Marble[], W: number, H: number,
  cooldowns: Map<string, number>,
  texts: FloatingText[], particles: Particle[], rings: Ring[],
  logs: string[], isKo: boolean, frame: number,
  shake: { value: number },
) {
  const alive = marbles.filter(m => m.alive);

  // Decay shake
  if (shake.value > 0) shake.value *= 0.88;
  if (shake.value < 0.3) shake.value = 0;

  // 0. Dynamic radius: marble shrinks as HP drops (market cap shrinking)
  for (const m of alive) {
    const hpRatio = Math.max(0.05, m.hp / m.maxHp);
    m.radius = m.baseRadius * (0.3 + hpRatio * 0.7);
  }

  // 1. Targeting + homing + move
  for (const m of alive) {
    // Trail (store every 2 frames)
    if (frame % 2 === 0) {
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 8) m.trail.shift();
    }

    // Re-target periodically
    if (frame >= m.retargetFrame) {
      m.retargetFrame = frame + 60 + Math.floor(Math.random() * 40);
      m.targetTicker = pickTarget(m, alive);
    }
    const tgt = alive.find(t => t.fighter.ticker === m.targetTicker);
    if (!tgt) m.targetTicker = pickTarget(m, alive);

    // Homing force toward target (stronger + rage boost)
    const target = alive.find(t => t.fighter.ticker === m.targetTicker);
    if (target) {
      const dx = target.x - m.x, dy = target.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const baseForce = 0.045 + (m.fighter.stats.atk / 110) * 0.05;
        const force = m.rageMode ? baseForce * 1.8 : baseForce;
        m.vx += (dx / dist) * force;
        m.vy += (dy / dist) * force;
      }
    }

    // Organic jitter
    m.vx += (Math.random() - 0.5) * 0.08;
    m.vy += (Math.random() - 0.5) * 0.08;

    // Speed cap
    const maxSpd = 2.2 + (m.fighter.stats.spd / 20) * 4.0;
    const rageSpd = m.rageMode ? maxSpd * 1.3 : maxSpd;
    const curSpd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
    if (curSpd > rageSpd) { const s = rageSpd / curSpd; m.vx *= s; m.vy *= s; }

    // Move
    m.x += m.vx; m.y += m.vy;

    // Wall bounce with sparks
    const bounce = 1.05;
    if (m.x - m.radius < 0) {
      m.x = m.radius; m.vx = Math.abs(m.vx) * bounce;
      for (let k = 0; k < 4; k++) particles.push({ x: m.radius, y: m.y + (Math.random() - 0.5) * m.radius, vx: 1 + Math.random() * 2, vy: (Math.random() - 0.5) * 3, life: 10 + Math.random() * 8, color: m.color, size: 1.5 + Math.random() });
    }
    if (m.x + m.radius > W) {
      m.x = W - m.radius; m.vx = -Math.abs(m.vx) * bounce;
      for (let k = 0; k < 4; k++) particles.push({ x: W - m.radius, y: m.y + (Math.random() - 0.5) * m.radius, vx: -(1 + Math.random() * 2), vy: (Math.random() - 0.5) * 3, life: 10 + Math.random() * 8, color: m.color, size: 1.5 + Math.random() });
    }
    if (m.y - m.radius < 0) {
      m.y = m.radius; m.vy = Math.abs(m.vy) * bounce;
      for (let k = 0; k < 4; k++) particles.push({ x: m.x + (Math.random() - 0.5) * m.radius, y: m.radius, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, life: 10 + Math.random() * 8, color: m.color, size: 1.5 + Math.random() });
    }
    if (m.y + m.radius > H) {
      m.y = H - m.radius; m.vy = -Math.abs(m.vy) * bounce;
      for (let k = 0; k < 4; k++) particles.push({ x: m.x + (Math.random() - 0.5) * m.radius, y: H - m.radius, vx: (Math.random() - 0.5) * 3, vy: -(1 + Math.random() * 2), life: 10 + Math.random() * 8, color: m.color, size: 1.5 + Math.random() });
    }

    if (m.flashTimer > 0) m.flashTimer--;
  }

  // 2. Marble-marble collisions
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.radius + b.radius;
      if (dist >= minDist || dist === 0) continue;

      // Separate overlapping marbles
      const nx = dx / dist, ny = dy / dist;
      const overlap = minDist - dist;
      const totalMass = a.mass + b.mass;
      a.x -= nx * overlap * (b.mass / totalMass);
      a.y -= ny * overlap * (b.mass / totalMass);
      b.x += nx * overlap * (a.mass / totalMass);
      b.y += ny * overlap * (a.mass / totalMass);

      // Elastic collision (extra bouncy)
      const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
      const dvn = dvx * nx + dvy * ny;
      if (dvn > 0) {
        const restitution = 1.15;
        const imp = (restitution * dvn) / totalMass;
        a.vx -= imp * b.mass * nx; a.vy -= imp * b.mass * ny;
        b.vx += imp * a.mass * nx; b.vy += imp * a.mass * ny;
      }

      // Impact ring at collision point (always)
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      rings.push({ x: mx, y: my, radius: 3, maxRadius: (a.radius + b.radius) * 0.5, life: 14, maxLife: 14, color: "#ffffff", lineWidth: 2 });

      // Damage (cooldown gated)
      const key = a.fighter.ticker < b.fighter.ticker
        ? `${a.fighter.ticker}-${b.fighter.ticker}`
        : `${b.fighter.ticker}-${a.fighter.ticker}`;
      if (frame - (cooldowns.get(key) ?? -999) < DMG_CD) continue;
      cooldowns.set(key, frame);

      const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy);
      const spdF = Math.max(0.4, relSpeed / 5);

      const critA = Math.random() * 100 < a.fighter.stats.crit;
      let dmgA = a.fighter.stats.atk * spdF * (0.8 + Math.random() * 0.4);
      if (a.rageMode) dmgA *= 1.4;
      if (critA) dmgA *= 2.0;
      dmgA = Math.max(1, Math.round(dmgA - b.fighter.stats.def * 0.5));

      const critB = Math.random() * 100 < b.fighter.stats.crit;
      let dmgB = b.fighter.stats.atk * spdF * (0.8 + Math.random() * 0.4);
      if (b.rageMode) dmgB *= 1.4;
      if (critB) dmgB *= 2.0;
      dmgB = Math.max(1, Math.round(dmgB - a.fighter.stats.def * 0.5));

      b.hp -= dmgA; a.hp -= dmgB;
      a.fighter.totalDamage += dmgA; b.fighter.totalDamage += dmgB;
      if (critA) a.fighter.critsLanded++;
      if (critB) b.fighter.critsLanded++;

      // Dollar particles flying out on hit (market cap bleeding)
      const dollarCntA = Math.min(5, Math.ceil(dmgB / 60));
      const dollarCntB = Math.min(5, Math.ceil(dmgA / 60));
      for (let k = 0; k < dollarCntA; k++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 1.2 + Math.random() * 2.5;
        particles.push({ x: a.x, y: a.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5, life: 28 + Math.random() * 16, color: "#4ade80", size: 6 + Math.random() * 3, char: "$" });
      }
      for (let k = 0; k < dollarCntB; k++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 1.2 + Math.random() * 2.5;
        particles.push({ x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5, life: 28 + Math.random() * 16, color: "#4ade80", size: 6 + Math.random() * 3, char: "$" });
      }

      // Crit knockback + screen shake + big ring
      if (critA) {
        const knockF = 3 + dmgA / 50;
        b.vx += nx * knockF; b.vy += ny * knockF;
        shake.value = Math.max(shake.value, 7);
        rings.push({ x: mx, y: my, radius: 5, maxRadius: (a.radius + b.radius) * 1.0, life: 22, maxLife: 22, color: "#fbbf24", lineWidth: 3 });
      }
      if (critB) {
        const knockF = 3 + dmgB / 50;
        a.vx -= nx * knockF; a.vy -= ny * knockF;
        shake.value = Math.max(shake.value, 7);
        rings.push({ x: mx, y: my, radius: 5, maxRadius: (a.radius + b.radius) * 1.0, life: 22, maxLife: 22, color: "#fbbf24", lineWidth: 3 });
      }

      // Drain (dividend income) — shows dividend yield connection
      if (a.fighter.stats.drain > 0) {
        const h = Math.round(dmgA * a.fighter.stats.drain / 100);
        if (h > 0) {
          a.hp = Math.min(a.maxHp, a.hp + h);
          texts.push({ x: a.x + (Math.random() - 0.5) * 10, y: a.y - a.radius - 14, text: `+$${h}B`, color: "#4ade80", life: 35, size: 14 });
          if (h >= 10) logs.push(isKo ? L.ko.evDrain(a.fighter.ticker, h, a.fighter.divYieldPct.toFixed(1)) : L.en.evDrain(a.fighter.ticker, h, a.fighter.divYieldPct.toFixed(1)));
        }
      }
      if (b.fighter.stats.drain > 0) {
        const h = Math.round(dmgB * b.fighter.stats.drain / 100);
        if (h > 0) {
          b.hp = Math.min(b.maxHp, b.hp + h);
          texts.push({ x: b.x + (Math.random() - 0.5) * 10, y: b.y - b.radius - 14, text: `+$${h}B`, color: "#4ade80", life: 35, size: 14 });
          if (h >= 10) logs.push(isKo ? L.ko.evDrain(b.fighter.ticker, h, b.fighter.divYieldPct.toFixed(1)) : L.en.evDrain(b.fighter.ticker, h, b.fighter.divYieldPct.toFixed(1)));
        }
      }

      a.flashTimer = 10; b.flashTimer = 10;

      // Collision sparks (more for crits)
      const isCrit = critA || critB;
      const sparkCount = isCrit ? 16 : 7;
      for (let k = 0; k < sparkCount; k++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * (isCrit ? 5.5 : 3);
        particles.push({
          x: mx + (Math.random() - 0.5) * 8, y: my + (Math.random() - 0.5) * 8,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          life: 16 + Math.floor(Math.random() * 14),
          color: isCrit ? (Math.random() > 0.4 ? "#fbbf24" : "#f97316") : (Math.random() > 0.5 ? "#ffffff" : "#d4d4d8"),
          size: 1.5 + Math.random() * (isCrit ? 3.5 : 2),
        });
      }

      // Floating damage texts (bigger for crits) — styled as market cap loss
      texts.push(
        { x: b.x + (Math.random() - 0.5) * 20, y: b.y - b.radius - 10, text: critA ? `-$${dmgA}B!` : `-$${dmgA}B`, color: critA ? "#fbbf24" : "#f87171", life: 55, size: critA ? 22 : 14 },
        { x: a.x + (Math.random() - 0.5) * 20, y: a.y - a.radius - 10, text: critB ? `-$${dmgB}B!` : `-$${dmgB}B`, color: critB ? "#fbbf24" : "#f87171", life: 55, size: critB ? 22 : 14 },
      );

      // Rage check
      if (!a.rageMode && a.hp > 0 && a.hp < a.maxHp * 0.25) {
        a.rageMode = true;
        logs.push(isKo ? L.ko.evRage(a.fighter.ticker) : L.en.evRage(a.fighter.ticker));
        shake.value = Math.max(shake.value, 5);
        rings.push({ x: a.x, y: a.y, radius: a.radius, maxRadius: a.radius * 3, life: 25, maxLife: 25, color: "#ef4444", lineWidth: 3 });
      }
      if (!b.rageMode && b.hp > 0 && b.hp < b.maxHp * 0.25) {
        b.rageMode = true;
        logs.push(isKo ? L.ko.evRage(b.fighter.ticker) : L.en.evRage(b.fighter.ticker));
        shake.value = Math.max(shake.value, 5);
        rings.push({ x: b.x, y: b.y, radius: b.radius, maxRadius: b.radius * 3, life: 25, maxLife: 25, color: "#ef4444", lineWidth: 3 });
      }

      // Log (market-style commentary with stock stat references)
      if (critA) {
        const betaTag = ` [β${a.fighter.betaVal.toFixed(1)}]`;
        logs.push((isKo ? L.ko.evCrit(a.fighter.ticker, b.fighter.ticker, dmgA) : L.en.evCrit(a.fighter.ticker, b.fighter.ticker, dmgA)) + betaTag);
      }
      if (critB) {
        const betaTag = ` [β${b.fighter.betaVal.toFixed(1)}]`;
        logs.push((isKo ? L.ko.evCrit(b.fighter.ticker, a.fighter.ticker, dmgB) : L.en.evCrit(b.fighter.ticker, a.fighter.ticker, dmgB)) + betaTag);
      }
      if (!critA && !critB) logs.push(isKo ? L.ko.evClash(a.fighter.ticker, b.fighter.ticker, dmgA, dmgB) : L.en.evClash(a.fighter.ticker, b.fighter.ticker, dmgA, dmgB));

      // Eliminate
      const spawnDeath = (m: Marble, killer: Marble) => {
        m.alive = false; m.hp = 0;
        killer.fighter.kills++;
        m.fighter.deathOrder = frame;
        shake.value = Math.max(shake.value, 14);

        // ── Market cap absorption (M&A) ──
        const absorbHp = Math.round(m.maxHp * 0.2);
        const oldMaxHp = killer.maxHp;
        killer.maxHp += absorbHp;
        killer.hp = Math.min(killer.maxHp, killer.hp + absorbHp);
        killer.baseRadius *= (killer.maxHp / oldMaxHp);
        killer.mass = killer.maxHp;

        // Absorption heal text
        texts.push({ x: killer.x, y: killer.y - killer.baseRadius - 16, text: `+$${absorbHp}B M&A`, color: "#22d3ee", life: 65, size: 19 });

        // Absorption ring on killer (cyan glow = money in)
        rings.push({ x: killer.x, y: killer.y, radius: killer.baseRadius * 0.3, maxRadius: killer.baseRadius * 2.2, life: 24, maxLife: 24, color: "#22d3ee", lineWidth: 3 });

        // $ particles flowing toward killer (acquisition)
        for (let k = 0; k < 8; k++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 0.8 + Math.random() * 2;
          particles.push({
            x: killer.x + (Math.random() - 0.5) * killer.baseRadius * 2,
            y: killer.y + (Math.random() - 0.5) * killer.baseRadius * 2,
            vx: Math.cos(ang) * sp * -0.3, vy: -1.5 - Math.random() * 2,
            life: 35 + Math.random() * 20, color: "#22d3ee",
            size: 8 + Math.random() * 4, char: "$",
          });
        }

        // Absorption log (M&A)
        logs.push(isKo
          ? L.ko.evMna(killer.fighter.ticker, m.fighter.ticker, absorbHp)
          : L.en.evMna(killer.fighter.ticker, m.fighter.ticker, absorbHp));

        // ── Death explosion on victim ──
        for (let k = 0; k < 30; k++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 7;
          particles.push({
            x: m.x + (Math.random() - 0.5) * m.baseRadius,
            y: m.y + (Math.random() - 0.5) * m.baseRadius,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            life: 35 + Math.floor(Math.random() * 30),
            color: Math.random() > 0.4 ? m.color : (Math.random() > 0.5 ? "#ffffff" : "#ef4444"),
            size: 2.5 + Math.random() * 5,
          });
        }
        // Death dollar shower (market cap evaporates)
        for (let k = 0; k < 10; k++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 1.5 + Math.random() * 4;
          particles.push({
            x: m.x + (Math.random() - 0.5) * m.baseRadius,
            y: m.y + (Math.random() - 0.5) * m.baseRadius,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2,
            life: 40 + Math.random() * 25, color: "#4ade80",
            size: 8 + Math.random() * 4, char: "$",
          });
        }
        // Death shockwave rings
        rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.5, maxRadius: m.baseRadius * 4.5, life: 30, maxLife: 30, color: m.color, lineWidth: 4 });
        rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.3, maxRadius: m.baseRadius * 2.5, life: 20, maxLife: 20, color: "#ef4444", lineWidth: 2 });
        const left = marbles.filter(mm => mm.alive).length;
        logs.push(isKo ? L.ko.evKill(m.fighter.ticker, killer.fighter.ticker, left) : L.en.evKill(m.fighter.ticker, killer.fighter.ticker, left));
      };
      if (b.hp <= 0 && b.alive) spawnDeath(b, a);
      if (a.hp <= 0 && a.alive) spawnDeath(a, b);
    }
  }

  // 3. Update texts
  for (let i = texts.length - 1; i >= 0; i--) {
    texts[i].y -= 0.9; texts[i].life--;
    if (texts[i].life <= 0) texts.splice(i, 1);
  }
  // 4. Update particles (gravity + friction)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.08; p.vx *= 0.98;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
  // 5. Update rings
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].life--;
    if (rings[i].life <= 0) rings.splice(i, 1);
  }
}

/* ─── Canvas draw ─── */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  marbles: Marble[], texts: FloatingText[], particles: Particle[], rings: Ring[],
  W: number, H: number, frame: number,
  logoMap: Map<string, HTMLImageElement>,
  shake: number,
) {
  ctx.save();

  // Screen shake
  if (shake > 0.3) {
    const sx = (Math.random() - 0.5) * shake * 2.5;
    const sy = (Math.random() - 0.5) * shake * 2.5;
    ctx.translate(sx, sy);
  }

  // Background: radial gradient
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, "#141418");
  grad.addColorStop(1, "#09090b");
  ctx.fillStyle = grad;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // Animated grid
  const gridAlpha = 0.12 + Math.sin(frame * 0.01) * 0.04;
  ctx.strokeStyle = `rgba(63, 63, 70, ${gridAlpha})`;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Arena border glow
  ctx.strokeStyle = "rgba(124, 58, 237, 0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  const alive = marbles.filter(m => m.alive);

  // Impact rings (behind everything)
  for (const r of rings) {
    const progress = 1 - r.life / r.maxLife;
    const currentR = r.radius + (r.maxRadius - r.radius) * progress;
    ctx.beginPath();
    ctx.arc(r.x, r.y, currentR, 0, Math.PI * 2);
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = (1 - progress) * 0.55;
    ctx.lineWidth = r.lineWidth * (1 - progress * 0.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Target lines (dashed arrow indicators)
  for (const m of alive) {
    const tgt = marbles.find(t => t.fighter.ticker === m.targetTicker && t.alive);
    if (!tgt) continue;
    const dx = tgt.x - m.x, dy = tgt.y - m.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < m.radius + 20) continue;
    const nx = dx / dist, ny = dy / dist;
    const startX = m.x + nx * (m.radius + 4), startY = m.y + ny * (m.radius + 4);
    const endX = m.x + nx * (m.radius + 18), endY = m.y + ny * (m.radius + 18);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = m.color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Arrowhead
    const aLen = 5;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - aLen * nx + aLen * 0.5 * ny, endY - aLen * ny - aLen * 0.5 * nx);
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - aLen * nx - aLen * 0.5 * ny, endY - aLen * ny + aLen * 0.5 * nx);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Dead marbles (ghost + skull)
  for (const m of marbles) {
    if (m.alive) continue;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "#52525b";
    ctx.fill();
    ctx.fillStyle = "#71717a";
    ctx.font = `${Math.max(8, Math.round(m.radius * 0.3))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u2620", m.x, m.y);
    ctx.globalAlpha = 1;
  }

  // Motion trails for alive marbles
  for (const m of alive) {
    if (m.trail.length < 2) continue;
    for (let i = 0; i < m.trail.length; i++) {
      const t = m.trail[i];
      const alpha = ((i + 1) / m.trail.length) * 0.18;
      const sz = m.radius * ((i + 1) / m.trail.length) * 0.55;
      ctx.beginPath();
      ctx.arc(t.x, t.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = m.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Alive marbles
  for (const m of alive) {
    const flash = m.flashTimer > 0;
    const breathe = 1 + Math.sin(frame * 0.06 + m.fighter.ticker.charCodeAt(0)) * 0.015;
    const displayR = (m.rageMode ? m.radius * 1.1 : m.radius) * breathe;

    // Rage aura (pulsing double ring + glow)
    if (m.rageMode) {
      const a1 = 0.4 + Math.sin(frame * 0.2) * 0.25;
      const a2 = 0.25 + Math.cos(frame * 0.15) * 0.15;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 8 + Math.sin(frame * 0.15) * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${a1})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(249, 115, 22, ${a2})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Rage glow
      ctx.save();
      ctx.shadowColor = "rgba(239, 68, 68, 0.6)";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.01)";
      ctx.stroke();
      ctx.restore();
    }

    // Drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, displayR, 0, Math.PI * 2);
    ctx.fillStyle = flash ? "#dc2626" : "#ffffff";
    ctx.fill();
    ctx.restore();

    // White base circle
    ctx.beginPath();
    ctx.arc(m.x, m.y, displayR - 1, 0, Math.PI * 2);
    ctx.fillStyle = flash ? "#dc2626" : "#ffffff";
    ctx.fill();

    // Logo or fallback (clipped to circle)
    if (!flash) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR - 2, 0, Math.PI * 2);
      ctx.clip();
      const logo = logoMap.get(m.fighter.ticker);
      if (logo && logo.complete && logo.naturalWidth > 0) {
        const imgW = logo.naturalWidth;
        const imgH = logo.naturalHeight;
        const circleD = (displayR - 2) * 2;
        const scale = circleD / Math.min(imgW, imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        try { ctx.drawImage(logo, m.x - drawW / 2, m.y - drawH / 2, drawW, drawH); } catch { /* ignore */ }
      } else {
        // Fallback: gradient bg + bold initial
        const fGrad = ctx.createRadialGradient(m.x - displayR * 0.3, m.y - displayR * 0.3, 0, m.x, m.y, displayR);
        fGrad.addColorStop(0, m.color);
        fGrad.addColorStop(1, m.bgColor);
        ctx.fillStyle = fGrad;
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(14, Math.round(displayR * 0.8))}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(m.fighter.ticker.charAt(0), m.x, m.y);
      }
      ctx.restore();
    }

    // Class-colored border ring with glow
    ctx.save();
    ctx.shadowColor = flash ? "#fca5a5" : m.color;
    ctx.shadowBlur = flash ? 16 : 10;
    ctx.beginPath();
    ctx.arc(m.x, m.y, displayR, 0, Math.PI * 2);
    ctx.strokeStyle = flash ? "#fca5a5" : m.color;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    // HP bar (thicker, with background)
    const barW = Math.max(displayR * 2, 30);
    const barH = 5;
    const barX = m.x - barW / 2;
    const barY = m.y + displayR + 7;
    const hpPct = Math.max(0, m.hp / m.maxHp);
    // Bar bg
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = "#27272a";
    ctx.fillRect(barX, barY, barW, barH);
    // Bar fill with gradient
    if (hpPct > 0) {
      const barGrad = ctx.createLinearGradient(barX, barY, barX + barW * hpPct, barY);
      if (hpPct > 0.5) { barGrad.addColorStop(0, "#22c55e"); barGrad.addColorStop(1, "#4ade80"); }
      else if (hpPct > 0.25) { barGrad.addColorStop(0, "#ca8a04"); barGrad.addColorStop(1, "#eab308"); }
      else { barGrad.addColorStop(0, "#dc2626"); barGrad.addColorStop(1, "#ef4444"); }
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX, barY, barW * hpPct, barH);
    }

    // Ticker label with shadow
    const fSize = Math.max(9, Math.round(displayR * 0.4));
    ctx.font = `bold ${fSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillText(m.fighter.ticker, m.x + 0.5, barY + barH + 3.5);
    ctx.fillStyle = "#d4d4d8";
    ctx.fillText(m.fighter.ticker, m.x, barY + barH + 3);
  }

  // Particles (round glowing + dollar text)
  for (const p of particles) {
    const alpha = Math.max(0, Math.min(1, p.life / 20));
    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.char) {
      // Text particle (dollar signs, etc.)
      const sz = Math.max(6, p.size * Math.min(1, p.life / 18));
      ctx.font = `bold ${Math.round(sz)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.strokeText(p.char, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.char, p.x, p.y);
    } else {
      // Circle particle
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * Math.min(1, p.life / 15)), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.restore();
  }

  // Floating texts (outlined for readability)
  for (const ft of texts) {
    const alpha = Math.min(1, ft.life / 15);
    const size = ft.size || 13;
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${size}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    // Dark outline
    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeText(ft.text, ft.x, ft.y);
    // Fill
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore(); // restore shake translate
}

/* ═══════════════════════════════════════════════
   LOCALIZATION
   ═══════════════════════════════════════════════ */

const L = {
  ko: {
    title: "주식 배틀로얄",
    subtitle: "8개 종목이 최후의 1인을 가린다!",
    pick: "참전 종목을 고르세요",
    selected: (n: number) => `${n} / 8`,
    random: "랜덤 뽑기",
    start: "배틀 시작!",
    need: (n: number) => `${n}개 더 선택하세요`,
    loading: "시장 데이터 로딩 중…",
    alive: (n: number) => `생존 ${n}`,
    evClash: (a: string, b: string, d1: number, d2: number) =>
      `📊 ${a}·${b} 시장 충돌 — 시총 각각 -$${d1}B / -$${d2}B 하락`,
    evCrit: (a: string, d: string, dmg: number) =>
      `🚨 ${a}, ${d}에 공매도 폭격! -$${dmg}B 급락`,
    evRage: (a: string) => `⚠️ ${a} 시장 패닉 — 투매 모드 진입`,
    evKill: (e: string, by: string, n: number) =>
      `📉 [속보] ${e} 상장폐지! ${by}에 의한 적대적 인수 — 잔여 ${n}개 종목`,
    evWin: (w: string) => `🔔 [마감] ${w}, 시장을 독점하다! 최종 생존 종목 확정`,
    evDrain: (tk: string, h: number, divPct: string) =>
      `💰 ${tk} 배당금 수입 +$${h}B (배당률 ${divPct}%)`,
    evMna: (killer: string, target: string, hp: number) =>
      `📈 [속보] ${killer}, ${target} 인수합병 완료 — 시총 +$${hp}B 증가`,
    champion: "시장 독점자",
    statsTitle: "시장 리포트",
    dmg: "시총 피해",
    kills: "인수합병",
    crits: "공매도",
    again: "다시 하기",
    speed: (x: number) => `${x}x`,
    skip: "스킵",
    fight: "개장!",
    fighters: "상장 종목",
    introMcap: "시총",
    introBeta: "변동성",
    introDiv: "배당",
    search: "종목 검색...",
    all: "전체",
    notEnough: "종목을 4개 이상 로딩하지 못했습니다. 다시 시도해주세요.",
    share: "결과 공유",
    copied: "링크 복사됨!",
    rematch: "같은 종목 재경기",
    shareText: (winner: string, tickers: string[]) =>
      `🔔 주식 배틀로얄 결과\n\n🏆 시장 독점자: ${winner}\n📊 참전 종목: ${tickers.join(", ")}\n\n같은 종목으로 배틀해보세요!`,
  },
  en: {
    title: "Stock Battle Royale",
    subtitle: "8 stocks fight to be the last one standing!",
    pick: "Pick your fighters",
    selected: (n: number) => `${n} / 8`,
    random: "Random 8",
    start: "Start Battle!",
    need: (n: number) => `Pick ${n} more`,
    loading: "Loading market data…",
    alive: (n: number) => `${n} alive`,
    evClash: (a: string, b: string, d1: number, d2: number) =>
      `📊 ${a} · ${b} market collision — MCap -$${d1}B / -$${d2}B`,
    evCrit: (a: string, d: string, dmg: number) =>
      `🚨 ${a} short-sells ${d}! -$${dmg}B crash`,
    evRage: (a: string) => `⚠️ ${a} panic selling — fire sale mode`,
    evKill: (e: string, by: string, n: number) =>
      `📉 [BREAKING] ${e} delisted! Hostile takeover by ${by} — ${n} left`,
    evWin: (w: string) => `🔔 [CLOSE] ${w} achieves market monopoly! Final survivor confirmed`,
    evDrain: (tk: string, h: number, divPct: string) =>
      `💰 ${tk} dividend income +$${h}B (yield ${divPct}%)`,
    evMna: (killer: string, target: string, hp: number) =>
      `📈 [BREAKING] ${killer} completes M&A of ${target} — MCap +$${hp}B`,
    champion: "Market Monopolist",
    statsTitle: "Market Report",
    dmg: "MCap Damage",
    kills: "M&A",
    crits: "Short Sells",
    again: "Play Again",
    speed: (x: number) => `${x}x`,
    skip: "Skip",
    fight: "OPEN!",
    fighters: "LISTED",
    introMcap: "MCap",
    introBeta: "Beta",
    introDiv: "Div",
    search: "Search stocks...",
    all: "All",
    notEnough: "Could not load enough stocks. Please try again.",
    share: "Share Results",
    copied: "Link copied!",
    rematch: "Rematch",
    shareText: (winner: string, tickers: string[]) =>
      `🔔 Stock Battle Royale\n\n🏆 Market Monopolist: ${winner}\n📊 Contenders: ${tickers.join(", ")}\n\nTry battling with the same stocks!`,
  },
} as const;

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function StockRoyaleClient() {
  const { locale } = useI18n();
  const isKo = locale === "ko";
  const t = isKo ? L.ko : L.en;
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<"lobby" | "loading" | "battle" | "victory">("lobby");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [speed, setSpeedState] = useState(1);
  const [introPhase, setIntroPhase] = useState<"none" | "cards" | "fight">("none");
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const [aliveCnt, setAliveCnt] = useState(0);
  const [lobbyQuery, setLobbyQuery] = useState("");
  const [lobbyTab, setLobbyTab] = useState<"all" | "us" | "kr">("all");
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const marblesRef = useRef<Marble[]>([]);
  const textsRef = useRef<FloatingText[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const ringsRef = useRef<Ring[]>([]);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const shakeRef = useRef({ value: 0 });
  const pendingLogsRef = useRef<string[]>([]);
  const frameRef = useRef(0);
  const animRef = useRef(0);
  const logSyncRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const speedRef = useRef(1);
  const isKoRef = useRef(isKo);
  const dimRef = useRef({ w: 0, h: 0 });
  const dprRef = useRef(1);
  const doneRef = useRef(false);
  const fightersRef = useRef<Fighter[]>([]);
  const logoMapRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const filteredPool = useMemo(() => {
    let list = POOL;
    if (lobbyTab === "us") list = list.filter(s => s.flag === "🇺🇸" || s.flag === "🇹🇼" || s.flag === "🇳🇱" || s.flag === "🇨🇳");
    else if (lobbyTab === "kr") list = list.filter(s => s.flag === "🇰🇷");
    if (lobbyQuery.trim()) {
      const q = lobbyQuery.trim().toLowerCase();
      list = list.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    return list;
  }, [lobbyQuery, lobbyTab]);

  // Auto-select stocks from URL params (?s=AAPL,MSFT,TSLA,...)
  useEffect(() => {
    const sParam = searchParams.get("s");
    if (sParam && phase === "lobby") {
      const tickers = sParam.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
      const validTickers = tickers.filter(tk => POOL.some(p => p.ticker.toUpperCase() === tk));
      if (validTickers.length >= 2) {
        setSelected(new Set(validTickers.slice(0, 8).map(tk => {
          const found = POOL.find(p => p.ticker.toUpperCase() === tk);
          return found ? found.ticker : tk;
        })));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { isKoRef.current = isKo; }, [isKo]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [battleLogs.length]);

  const toggle = useCallback((ticker: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else if (next.size < 8) next.add(ticker);
      return next;
    });
  }, []);

  const randomPick = useCallback(() => {
    const shuffled = [...POOL].sort(() => Math.random() - 0.5);
    setSelected(new Set(shuffled.slice(0, 8).map(s => s.ticker)));
  }, []);

  const finishBattle = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(animRef.current);
    clearInterval(logSyncRef.current);

    const winner = marblesRef.current.find(m => m.alive);
    const ko = isKoRef.current;
    if (winner) pendingLogsRef.current.push(ko ? L.ko.evWin(winner.fighter.ticker) : L.en.evWin(winner.fighter.ticker));

    const batch = [...pendingLogsRef.current];
    pendingLogsRef.current = [];
    setBattleLogs(prev => [...prev, ...batch]);
    setAliveCnt(marblesRef.current.filter(m => m.alive).length);

    const final = marblesRef.current.map(m => ({ ...m.fighter, hp: m.hp, alive: m.alive }));
    setTimeout(() => { setFighters(final); setPhase("victory"); }, 1200);
  }, []);

  const skipToEnd = useCallback(() => {
    if (doneRef.current) return;
    cancelAnimationFrame(animRef.current);
    const { w, h } = dimRef.current;
    const ko = isKoRef.current;
    let safety = 0;
    while (marblesRef.current.filter(m => m.alive).length > 1 && safety < 100000) {
      frameRef.current++;
      physicsStep(marblesRef.current, w, h, cooldownRef.current, textsRef.current, particlesRef.current, ringsRef.current, pendingLogsRef.current, ko, frameRef.current, shakeRef.current);
      safety++;
    }
    finishBattle();
  }, [finishBattle]);

  const startBattle = useCallback(async () => {
    if (selected.size !== 8) return;
    setPhase("loading");
    try {
      const tickers = Array.from(selected);
      // Fetch data + logos in parallel
      const [results, logoMap] = await Promise.all([
        Promise.allSettled(tickers.map(tk => fetch(`${API}?ticker=${tk}`).then(r => r.json()))),
        preloadLogos(tickers),
      ]);
      logoMapRef.current = logoMap;

      const loaded: Fighter[] = [];
      for (let i = 0; i < tickers.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled" && r.value) {
          const d = r.value as Record<string, unknown>;
          const stats = toGameStats(d);
          const cls = getClass(stats, isKo);
          const mcap = (d.marketCap as number) ?? 0;
          const mcapLabel = mcap >= 1e12 ? `$${(mcap / 1e12).toFixed(1)}T` : mcap >= 1e9 ? `$${(mcap / 1e9).toFixed(0)}B` : `$${(mcap / 1e6).toFixed(0)}M`;
          const betaVal = (d.beta as number) ?? 1.0;
          const divYieldPct = ((d.divYield as number) ?? 0) * 100;
          loaded.push({
            ticker: (d.ticker as string) ?? tickers[i],
            name: (d.name as string) ?? tickers[i],
            stats, className: cls.name, classEmoji: cls.emoji, classColor: cls.color,
            canvasColor: cls.cColor, canvasBg: cls.cBg, targetStrategy: cls.strategy,
            hp: stats.hp, alive: true,
            kills: 0, totalDamage: 0, critsLanded: 0, deathOrder: 0,
            mcapLabel, betaVal, divYieldPct,
          });
        }
      }
      if (loaded.length < 4) { alert(t.notEnough); setPhase("lobby"); return; }

      fightersRef.current = loaded;
      setFighters(loaded);
      setBattleLogs([]);
      setAliveCnt(loaded.length);
      doneRef.current = false;
      setIntroPhase("cards");
      setPhase("battle");
      setTimeout(() => setIntroPhase("fight"), 3000);
      setTimeout(() => setIntroPhase("none"), 4200);
    } catch { setPhase("lobby"); }
  }, [selected, isKo, t.notEnough]);

  /* ─── Game loop ─── */
  useEffect(() => {
    if (phase !== "battle" || introPhase !== "none") return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || fightersRef.current.length === 0) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    dimRef.current = { w, h };
    dprRef.current = dpr;

    marblesRef.current = createMarbles(fightersRef.current, w, h);
    textsRef.current = [];
    particlesRef.current = [];
    ringsRef.current = [];
    cooldownRef.current = new Map();
    shakeRef.current = { value: 0 };
    frameRef.current = 0;
    pendingLogsRef.current = [];

    const loop = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || doneRef.current) return;

      for (let s = 0; s < speedRef.current; s++) {
        frameRef.current++;
        physicsStep(marblesRef.current, w, h, cooldownRef.current, textsRef.current, particlesRef.current, ringsRef.current, pendingLogsRef.current, isKoRef.current, frameRef.current, shakeRef.current);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      drawFrame(ctx, marblesRef.current, textsRef.current, particlesRef.current, ringsRef.current, w, h, frameRef.current, logoMapRef.current, shakeRef.current.value);
      ctx.restore();

      if (marblesRef.current.filter(m => m.alive).length <= 1) { finishBattle(); return; }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    const syncId = setInterval(() => {
      if (pendingLogsRef.current.length > 0) {
        const batch = [...pendingLogsRef.current];
        pendingLogsRef.current = [];
        setBattleLogs(prev => [...prev, ...batch]);
      }
      setAliveCnt(marblesRef.current.filter(m => m.alive).length);
    }, 200);
    logSyncRef.current = syncId;

    return () => { cancelAnimationFrame(animRef.current); clearInterval(syncId); };
  }, [phase, introPhase, finishBattle]);

  const reset = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    clearInterval(logSyncRef.current);
    setPhase("lobby");
    setFighters([]);
    setBattleLogs([]);
    setAliveCnt(0);
    setSpeedState(1);
    setIntroPhase("none");
    doneRef.current = false;
    fightersRef.current = [];
    marblesRef.current = [];
  }, []);

  /* ─── Share helpers ─── */
  const buildShareUrl = useCallback(() => {
    const tickers = fighters.map(f => f.ticker).join(",");
    const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    return `${base}?s=${encodeURIComponent(tickers)}`;
  }, [fighters]);

  const handleShare = useCallback(async () => {
    const winner = fighters.find(f => f.alive);
    const tickers = fighters.map(f => f.ticker);
    const url = buildShareUrl();
    const text = t.shareText(winner?.ticker ?? "?", tickers);

    // Try native share first (mobile)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t.title, text, url });
        return;
      } catch { /* user cancelled or not supported, fall through to clipboard */ }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard not available */ }
  }, [fighters, buildShareUrl, t]);

  const rematch = useCallback(() => {
    // Keep same selected set, just reset and go to lobby
    const tickers = fighters.map(f => f.ticker);
    cancelAnimationFrame(animRef.current);
    clearInterval(logSyncRef.current);
    setPhase("lobby");
    setFighters([]);
    setBattleLogs([]);
    setAliveCnt(0);
    setSpeedState(1);
    setIntroPhase("none");
    doneRef.current = false;
    fightersRef.current = [];
    marblesRef.current = [];
    setCopied(false);
    setSelected(new Set(tickers));
  }, [fighters]);

  /* ═══════════════════════════════════════════════
     RENDER — BATTLE
     ═══════════════════════════════════════════════ */
  if (phase === "battle") {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-hidden">
        {/* Fighter Intro Cards */}
        {introPhase === "cards" && fighters.length > 0 && (
          <div className="absolute inset-0 z-50 bg-black/92 flex flex-col items-center justify-center p-3 overflow-auto animate-in fade-in duration-300">
            <h2 className="text-yellow-400 font-black text-lg sm:text-xl mb-3 tracking-widest flex items-center gap-2">
              <Swords size={20} /> {t.fighters} <Swords size={20} />
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl w-full">
              {fighters.map(f => (
                <div key={f.ticker} className="bg-zinc-900/90 rounded-xl p-2.5 border border-zinc-700/50 hover:border-zinc-600/50 transition">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <StockLogo ticker={f.ticker} name={f.name} size={26} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-white text-xs font-bold">{f.ticker}</span>
                        <span className={`text-[10px] ${f.classColor}`}>{f.classEmoji}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${f.classColor}`}>{f.className}</span>
                    </div>
                  </div>
                  <div className="text-[9px] text-zinc-500 mb-1.5 flex gap-1.5 flex-wrap">
                    <span>{t.introMcap} {f.mcapLabel}</span>
                    <span>{t.introBeta} {f.betaVal.toFixed(1)}</span>
                    <span>{t.introDiv} {f.divYieldPct.toFixed(1)}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-1.5 gap-y-0.5 text-[10px]">
                    <span className="text-zinc-500">HP <span className="text-white font-bold">{f.stats.maxHp}</span></span>
                    <span className="text-zinc-500">ATK <span className="text-red-400 font-bold">{f.stats.atk}</span></span>
                    <span className="text-zinc-500">SPD <span className="text-green-400 font-bold">{f.stats.spd}</span></span>
                    <span className="text-zinc-500">CRT <span className="text-purple-400 font-bold">{f.stats.crit}%</span></span>
                    <span className="text-zinc-500">DEF <span className="text-yellow-400 font-bold">{f.stats.def}</span></span>
                    <span className="text-zinc-500">DRN <span className="text-pink-400 font-bold">{f.stats.drain}</span></span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-zinc-600 text-[10px] mt-3">{isKo ? "시총→HP  수익+성장→ATK  모멘텀→SPD  베타→CRIT  건전성→DEF  배당→DRAIN" : "MCap→HP  Profit+Growth→ATK  Momentum→SPD  Beta→CRIT  Health→DEF  Dividend→DRAIN"}</p>
          </div>
        )}
        {/* FIGHT! Flash */}
        {introPhase === "fight" && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 animate-in zoom-in duration-200">
            <span className="text-6xl sm:text-8xl font-black text-white tracking-[0.2em] animate-pulse">{t.fight}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-red-500 text-xs font-bold animate-pulse">● LIVE</span>
            <span className="text-zinc-400 text-xs">{t.alive(aliveCnt)}</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map(s => (
              <button key={s} onClick={() => setSpeedState(s)}
                className={`px-2 py-0.5 rounded text-xs font-bold transition ${speed === s ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
              >{t.speed(s)}</button>
            ))}
            <button onClick={skipToEnd} className="ml-1 px-2 py-0.5 rounded text-xs font-bold bg-zinc-800 text-zinc-400 hover:bg-zinc-700 flex items-center gap-1">
              <SkipForward size={12} /> {t.skip}
            </button>
          </div>
        </div>
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          <canvas ref={canvasRef} className="block" />
        </div>
        <div ref={logRef} className="h-28 sm:h-36 border-t border-zinc-800 overflow-y-auto px-3 py-2 space-y-0.5 shrink-0">
          {battleLogs.map((line, i) => (
            <p key={i} className={`text-xs font-mono ${
              line.includes("📉") ? "text-red-400 font-bold"
              : line.includes("🔔") ? "text-yellow-400 font-bold"
              : line.includes("🚨") ? "text-orange-300"
              : line.includes("⚠️") ? "text-orange-400 font-bold"
              : line.includes("📈") ? "text-cyan-400 font-bold"
              : line.includes("💰") ? "text-green-400"
              : "text-zinc-400"
            }`}>{line}</p>
          ))}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     RENDER — VICTORY
     ═══════════════════════════════════════════════ */
  if (phase === "victory" && fighters.length > 0) {
    const winner = fighters.find(f => f.alive);
    const ranked = [...fighters].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (a.deathOrder !== b.deathOrder) return b.deathOrder - a.deathOrder;
      return b.totalDamage - a.totalDamage;
    });

    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-auto">
        <div className="flex flex-col items-center pt-10 pb-6 px-4">
          <Trophy className="text-yellow-400 mb-3" size={48} />
          <div className="bg-gradient-to-br from-yellow-900/30 to-zinc-900 border border-yellow-600/40 rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl shadow-yellow-500/10">
            <StockLogo ticker={winner?.ticker ?? ""} name={winner?.name ?? ""} size={64} />
            <p className="text-2xl font-black text-white">{winner?.ticker}</p>
            <p className="text-sm text-zinc-400">{winner?.name}</p>
            <span className={`text-sm font-bold ${winner?.classColor}`}>{winner?.classEmoji} {winner?.className}</span>
            <span className="text-yellow-400 text-sm font-bold tracking-widest uppercase">{t.champion}</span>
          </div>
        </div>
        <div className="px-3 pb-8 max-w-lg mx-auto w-full">
          <h3 className="text-white font-bold text-sm mb-2">{t.statsTitle}</h3>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-900 text-zinc-400">
                  <th className="px-2 py-1.5 text-left">#</th>
                  <th className="px-2 py-1.5 text-left">Ticker</th>
                  <th className="px-2 py-1.5 text-right">{t.dmg}</th>
                  <th className="px-2 py-1.5 text-right">{t.kills}</th>
                  <th className="px-2 py-1.5 text-right">{t.crits}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((f, i) => (
                  <tr key={f.ticker} className={`border-t border-zinc-800 ${i === 0 ? "bg-yellow-900/10" : ""}`}>
                    <td className="px-2 py-1.5 text-zinc-500 font-bold">{i === 0 ? "🏆" : `#${i + 1}`}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <StockLogo ticker={f.ticker} name={f.name} size={20} />
                        <span className="text-white font-bold">{f.ticker}</span>
                        <span className={`text-[10px] ${f.classColor}`}>{f.classEmoji}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right text-zinc-300 font-mono">{f.totalDamage.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right text-zinc-300 font-mono">{f.kills}</td>
                    <td className="px-2 py-1.5 text-right text-zinc-300 font-mono">{f.critsLanded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Share + Rematch + New Game buttons */}
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleShare}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white"
              }`}
            >
              {copied ? <><Check size={16} /> {t.copied}</> : <><Share2 size={16} /> {t.share}</>}
            </button>
            <button
              onClick={rematch}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
            >
              <Link2 size={16} /> {t.rematch}
            </button>
            <button
              onClick={reset}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm flex items-center justify-center gap-2 transition"
            >
              <RotateCcw size={16} /> {t.again}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     RENDER — LOBBY
     ═══════════════════════════════════════════════ */
  const gap = 8 - selected.size;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-20">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold mb-3">
          <Swords size={14} /> {t.title}
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">{t.title}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t.subtitle}</p>
      </div>

      {/* Controls: selected count + random + search */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.pick}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-violet-600">{t.selected(selected.size)}</span>
          <button onClick={randomPick} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition">
            <Shuffle size={14} /> {t.random}
          </button>
        </div>
      </div>

      {/* Search + tabs */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text" value={lobbyQuery} onChange={e => setLobbyQuery(e.target.value)}
            placeholder={t.search}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0">
          {(["all", "us", "kr"] as const).map(tab => (
            <button key={tab} onClick={() => setLobbyTab(tab)}
              className={`px-2.5 py-2 text-xs font-bold transition ${lobbyTab === tab ? "bg-violet-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >{tab === "all" ? t.all : tab === "us" ? "🇺🇸" : "🇰🇷"}</button>
          ))}
        </div>
      </div>

      {/* Stock grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 max-h-[50vh] overflow-y-auto pr-1">
        {filteredPool.map(stock => {
          const sel = selected.has(stock.ticker);
          return (
            <button key={stock.ticker} onClick={() => toggle(stock.ticker)}
              className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${
                sel ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-2 ring-violet-300 shadow-sm"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm"
              }`}
            >
              <StockLogo ticker={stock.ticker} name={stock.name} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">{stock.flag}</span>
                  <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{stock.ticker}</p>
                </div>
                <p className="text-[10px] text-zinc-500 truncate">{stock.name}</p>
              </div>
              {sel && <span className="text-violet-600 font-bold text-sm">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Start button */}
      <button disabled={selected.size !== 8 || phase === "loading"} onClick={startBattle}
        className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition sticky bottom-4 ${
          selected.size === 8 ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/30"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
        }`}
      >
        {phase === "loading" ? (<><Loader2 size={18} className="animate-spin" />{t.loading}</>)
        : selected.size === 8 ? (<><Swords size={18} />{t.start}</>)
        : t.need(gap)}
      </button>
    </div>
  );
}
