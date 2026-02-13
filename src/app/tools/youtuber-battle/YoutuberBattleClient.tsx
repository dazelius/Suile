"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Swords, Loader2, Shuffle, Trophy, RotateCcw, SkipForward, Search, Share2, Check, Link2, Youtube } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { YOUTUBERS, type YouTuberPreset } from "./youtuber-presets";
import { fetchChannelData, searchChannels, type ChannelData } from "./youtube-api";
import { getYoutuberSkill, type YouTuberSkill } from "./youtuber-skills";

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */

interface GameStats {
  hp: number; maxHp: number;
  atk: number; spd: number;
  crit: number; def: number;
  subs: number;
}

interface Fighter {
  channelId: string; name: string; thumbnailUrl: string;
  stats: GameStats;
  skill: YouTuberSkill;
  canvasColor: string; canvasBg: string;
  hp: number; alive: boolean;
  kills: number; totalDamage: number; critsLanded: number;
  deathOrder: number;
  subsLabel: string; viewsLabel: string; videosLabel: string;
}

interface Marble {
  fighter: Fighter;
  x: number; y: number; vx: number; vy: number;
  baseRadius: number; radius: number; mass: number;
  hp: number; maxHp: number; alive: boolean;
  rageMode: boolean; flashTimer: number;
  color: string; bgColor: string;
  targetId: string;
  retargetFrame: number;
  trail: { x: number; y: number }[];
  skillTimer: number; skillActivated: boolean; skillBuff: number;
  hitCounter: number; slowTimer: number;
  atkDebuffTimer: number;
}

interface FloatingText {
  x: number; y: number; text: string; color: string; life: number; size: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; color: string; size: number;
  char?: string;
}

interface Ring {
  x: number; y: number; radius: number; maxRadius: number;
  life: number; maxLife: number; color: string; lineWidth: number;
}

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

const DMG_CD_BASE = 54;
const PALETTE = [
  { color: "#60a5fa", bg: "#1e3a5f" },
  { color: "#f87171", bg: "#5f1e1e" },
  { color: "#c084fc", bg: "#3b1764" },
  { color: "#4ade80", bg: "#1a3d26" },
  { color: "#facc15", bg: "#4a3c10" },
  { color: "#f472b6", bg: "#4a1030" },
  { color: "#fb923c", bg: "#4a2810" },
  { color: "#22d3ee", bg: "#0c3a42" },
];

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */

function clamp(v: number, mn: number, mx: number) {
  return Math.max(mn, Math.min(mx, v));
}

function formatCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

/* ═══════════════════════════════════════════════
   STAT CONVERSION — YouTube data → Game stats
   ═══════════════════════════════════════════════ */

function toGameStats(d: ChannelData): GameStats {
  const subs = d.subscriberCount || 1;
  const views = d.viewCount || 1;
  const videos = d.videoCount || 1;
  const avgViews = d.avgViewsPerVideo || 1;
  const years = d.yearsActive || 1;

  const hp = Math.round(Math.max(300, Math.pow(subs, 0.35) * 5));
  const atk = Math.round(clamp(Math.pow(avgViews, 0.3) * 1.2, 25, 120));
  const spd = Math.round(clamp(Math.pow(videos, 0.2) * 2.5, 3, 20));
  const viralRatio = views / Math.max(subs, 1);
  const crit = Math.round(clamp(5 + Math.log10(Math.max(viralRatio, 1)) * 8, 5, 40));
  const def = Math.round(clamp(Math.pow(years, 0.5) * 3, 1, 25));

  return { hp, maxHp: hp, atk, spd, crit, def, subs };
}

/* ═══════════════════════════════════════════════
   THUMBNAIL PRELOADING
   ═══════════════════════════════════════════════ */

function preloadThumbnails(
  fighters: { channelId: string; thumbnailUrl: string }[]
): Promise<Map<string, HTMLImageElement>> {
  return new Promise((resolveAll) => {
    const map = new Map<string, HTMLImageElement>();
    let done = 0;
    const total = fighters.length;
    const finish = () => { if (++done >= total) resolveAll(map); };

    for (const f of fighters) {
      if (!f.thumbnailUrl) { finish(); continue; }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { map.set(f.channelId, img); finish(); };
      img.onerror = () => finish();
      img.src = f.thumbnailUrl;
      setTimeout(() => { if (!map.has(f.channelId) && done < total) { done++; if (done >= total) resolveAll(map); } }, 5000);
    }
    if (total === 0) resolveAll(map);
  });
}

/* ═══════════════════════════════════════════════
   PHYSICS + CANVAS
   ═══════════════════════════════════════════════ */

function createMarbles(fighters: Fighter[], W: number, H: number): Marble[] {
  const n = fighters.length;
  const scaleFactor = n <= 8 ? 1 : Math.max(0.35, 8 / n);
  const baseR = (Math.min(W, H) / 11) * scaleFactor;
  const cx = W / 2, cy = H / 2;
  const spread = Math.min(W, H) * Math.min(0.42, 0.25 + n * 0.01);

  const subsPows = fighters.map(f => Math.pow(Math.max(1, f.stats.subs), 0.3));
  const minSubs = Math.min(...subsPows), maxSubs = Math.max(...subsPows);
  const subsRange = maxSubs - minSubs || 1;

  return fighters.map((f, i) => {
    const subsNorm = (Math.pow(Math.max(1, f.stats.subs), 0.3) - minSubs) / subsRange;
    const sizeFactor = 0.35 + subsNorm * 1.5;
    const radius = Math.max(14, Math.round(baseR * sizeFactor));
    const angle = (i / fighters.length) * Math.PI * 2 - Math.PI / 2;
    const velAngle = Math.random() * Math.PI * 2;
    const vel = 1.5 + (f.stats.spd / 20) * 3;

    return {
      fighter: f,
      x: cx + Math.cos(angle) * spread,
      y: cy + Math.sin(angle) * spread,
      vx: Math.cos(velAngle) * vel,
      vy: Math.sin(velAngle) * vel,
      baseRadius: radius, radius, mass: f.stats.subs,
      hp: f.stats.maxHp, maxHp: f.stats.maxHp,
      alive: true, rageMode: false, flashTimer: 0,
      color: f.canvasColor, bgColor: f.canvasBg,
      targetId: "",
      retargetFrame: 0,
      trail: [],
      skillTimer: 0,
      skillActivated: false,
      skillBuff: 0,
      hitCounter: 0,
      slowTimer: 0,
      atkDebuffTimer: 0,
    };
  });
}

function pickTarget(m: Marble, alive: Marble[]): string {
  const others = alive.filter(t => t.fighter.channelId !== m.fighter.channelId);
  if (others.length === 0) return m.fighter.channelId;

  const hpRatioSelf = m.hp / m.maxHp;
  if (hpRatioSelf < 0.5 && Math.random() < 0.4) {
    const biggest = others.reduce((a, b) => a.maxHp > b.maxHp ? a : b);
    return biggest.fighter.channelId;
  }

  let best = others[0];
  let bestDist = Infinity;
  for (const t of others) {
    const dx = t.x - m.x, dy = t.y - m.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best.fighter.channelId;
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
  let DMG_CD = alive.length > 16 ? Math.round(DMG_CD_BASE * 0.5) : alive.length > 10 ? Math.round(DMG_CD_BASE * 0.7) : DMG_CD_BASE;
  const cdTimeScale = Math.max(0.5, 1 - frame * 0.00008);
  DMG_CD = Math.max(8, Math.round(DMG_CD * cdTimeScale));

  if (shake.value > 0) shake.value *= 0.88;
  if (shake.value < 0.3) shake.value = 0;

  // ── Skill: periodic & threshold processing ──
  for (const m of alive) {
    m.skillTimer++;
    if (m.skillBuff > 0) m.skillBuff--;
    if (m.slowTimer > 0) m.slowTimer--;
    if (m.atkDebuffTimer > 0) m.atkDebuffTimer--;
    const sk = m.fighter.skill;
    const hpPct = m.hp / m.maxHp;

    // Periodic skills
    if (sk.type === "periodic" && sk.interval && m.skillTimer >= sk.interval) {
      m.skillTimer = 0;
      switch (sk.id) {
        case "mukbang":
        case "nursery":
        case "army-power": {
          const rate = sk.id === "nursery" ? 0.04 : sk.id === "army-power" ? 0.025 : 0.03;
          const heal = Math.round(m.maxHp * rate);
          m.hp = Math.min(m.maxHp, m.hp + heal);
          texts.push({ x: m.x, y: m.y - m.baseRadius - 14, text: `+${heal}`, color: sk.color, life: 35, size: 12 });
          break;
        }
        case "investing": {
          const heal = Math.round(m.maxHp * 0.02);
          m.hp = Math.min(m.maxHp, m.hp + heal);
          m.fighter.stats.atk = Math.round(m.fighter.stats.atk * 1.03);
          texts.push({ x: m.x, y: m.y - m.baseRadius - 14, text: `+${heal}`, color: sk.color, life: 35, size: 12 });
          break;
        }
        case "workman": {
          m.fighter.stats.atk = Math.min(Math.round(m.fighter.stats.atk * 1.05), 150);
          texts.push({ x: m.x, y: m.y - m.baseRadius - 14, text: "ATK UP", color: sk.color, life: 35, size: 11 });
          break;
        }
        case "minecraft": {
          m.fighter.stats.def = Math.min(Math.round(m.fighter.stats.def * 1.05), 35);
          break;
        }
        case "serenade": {
          for (const other of alive) {
            if (other === m) continue;
            const dx = other.x - m.x, dy = other.y - m.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) other.atkDebuffTimer = Math.max(other.atkDebuffTimer, 90);
          }
          texts.push({ x: m.x, y: m.y - m.baseRadius - 20, text: isKo ? "ATK 감소!" : "ATK Down!", color: sk.color, life: 45, size: 12 });
          break;
        }
        default: break;
      }
    }

    // shape-of-you: 1% HP regen per second (onDamaged type but has regen)
    if (sk.id === "shape-of-you" && m.skillTimer >= 60) {
      m.skillTimer = 0;
      const heal = Math.round(m.maxHp * 0.01);
      m.hp = Math.min(m.maxHp, m.hp + heal);
    }

    // Threshold skills
    if (sk.type === "threshold" && !m.skillActivated && sk.hpThreshold && hpPct <= sk.hpThreshold) {
      m.skillActivated = true;
      m.skillBuff = 99999;
      const skillName = isKo ? sk.nameKo : sk.nameEn;
      texts.push({ x: m.x, y: m.y - m.baseRadius - 24, text: skillName, color: sk.color, life: 60, size: 14 });
      logs.push(isKo ? `${m.fighter.name} [${skillName}] 발동!` : `${m.fighter.name} [${skillName}] activated!`);
      rings.push({ x: m.x, y: m.y, radius: m.baseRadius, maxRadius: m.baseRadius * 3, life: 25, maxLife: 25, color: sk.color, lineWidth: 3 });
    }
  }

  // Dynamic radius
  for (const m of alive) {
    const hpRatio = Math.max(0.05, m.hp / m.maxHp);
    m.radius = m.baseRadius * (0.3 + hpRatio * 0.7);
  }

  // Targeting + homing + move
  for (const m of alive) {
    if (frame % 2 === 0) {
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 8) m.trail.shift();
    }

    if (frame >= m.retargetFrame) {
      m.retargetFrame = frame + 60 + Math.floor(Math.random() * 40);
      m.targetId = pickTarget(m, alive);
    }
    let target = alive.find(t => t.fighter.channelId === m.targetId);
    if (!target) { m.targetId = pickTarget(m, alive); target = alive.find(t => t.fighter.channelId === m.targetId); }

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

    const chaos = 1 + frame * 0.0003;
    m.vx += (Math.random() - 0.5) * 0.08 * chaos;
    m.vy += (Math.random() - 0.5) * 0.08 * chaos;

    let maxSpd = 2.2 + (m.fighter.stats.spd / 20) * 4.0;
    maxSpd *= (1 + frame * 0.00025);
    const mSk = m.fighter.skill;
    if (mSk.id === "traveler" || mSk.id === "dance-power" || mSk.id === "speedrun") maxSpd *= 1.35;
    if (mSk.id === "legend" && m.skillBuff > 0) maxSpd *= 1.3;
    if (m.slowTimer > 0) maxSpd *= 0.6;
    const rageSpd = m.rageMode ? maxSpd * 1.3 : maxSpd;
    const curSpd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
    if (curSpd > rageSpd) { const s = rageSpd / curSpd; m.vx *= s; m.vy *= s; }

    m.x += m.vx; m.y += m.vy;

    const bounce = Math.min(1.25, 1.05 + frame * 0.00003);
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

  // Collisions
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.radius + b.radius;
      if (dist >= minDist || dist === 0) continue;

      const nx = dx / dist, ny = dy / dist;
      const overlap = minDist - dist;
      const totalMass = a.mass + b.mass;
      a.x -= nx * overlap * (b.mass / totalMass);
      a.y -= ny * overlap * (b.mass / totalMass);
      b.x += nx * overlap * (a.mass / totalMass);
      b.y += ny * overlap * (a.mass / totalMass);

      const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
      const dvn = dvx * nx + dvy * ny;
      if (dvn > 0) {
        const restitution = Math.min(1.6, 1.15 + frame * 0.00006);
        const imp = (restitution * dvn) / totalMass;
        a.vx -= imp * b.mass * nx; a.vy -= imp * b.mass * ny;
        b.vx += imp * a.mass * nx; b.vy += imp * a.mass * ny;
      }

      const pushForce = frame * 0.00004;
      if (pushForce > 0.01) {
        a.vx -= nx * pushForce * b.mass / totalMass * 60;
        a.vy -= ny * pushForce * b.mass / totalMass * 60;
        b.vx += nx * pushForce * a.mass / totalMass * 60;
        b.vy += ny * pushForce * a.mass / totalMass * 60;
      }

      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ringScale = Math.min(2, 1 + frame * 0.0001);
      rings.push({ x: mx, y: my, radius: 3, maxRadius: (a.radius + b.radius) * 0.5 * ringScale, life: 14, maxLife: 14, color: "#ffffff", lineWidth: Math.min(4, 2 * ringScale) });

      const key = a.fighter.channelId < b.fighter.channelId
        ? `${a.fighter.channelId}-${b.fighter.channelId}`
        : `${b.fighter.channelId}-${a.fighter.channelId}`;
      if (frame - (cooldowns.get(key) ?? -999) < DMG_CD) continue;
      cooldowns.set(key, frame);

      const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy);
      const spdF = Math.max(0.4, relSpeed / 5);
      const timeScale = 1 + frame * 0.00015;

      let atkA = a.fighter.stats.atk, atkB = b.fighter.stats.atk;
      if (a.atkDebuffTimer > 0) atkA = Math.round(atkA * 0.9);
      if (b.atkDebuffTimer > 0) atkB = Math.round(atkB * 0.9);
      let defA = a.fighter.stats.def, defB = b.fighter.stats.def;
      let critChanceA = a.fighter.stats.crit, critChanceB = b.fighter.stats.crit;
      const hpPctA = a.hp / a.maxHp, hpPctB = b.hp / b.maxHp;

      // Skill: onAttack / threshold modifiers
      const skA = a.fighter.skill, skB = b.fighter.skill;
      if (skA.type === "threshold" && a.skillBuff > 0) atkA = Math.round(atkA * 1.25);
      if (skB.type === "threshold" && b.skillBuff > 0) atkB = Math.round(atkB * 1.25);
      if (skA.id === "bollywood" && a.skillBuff > 0) atkA = Math.round(atkA * 1.5);
      if (skB.id === "bollywood" && b.skillBuff > 0) atkB = Math.round(atkB * 1.5);
      if (skA.id === "horror" && a.skillBuff > 0) atkA = Math.round(atkA * 1.4);
      if (skB.id === "horror" && b.skillBuff > 0) atkB = Math.round(atkB * 1.4);
      if (skA.id === "legend" && a.skillBuff > 0) { atkA = Math.round(atkA * 1.3); }
      if (skB.id === "legend" && b.skillBuff > 0) { atkB = Math.round(atkB * 1.3); }

      if (skA.id === "analysis") critChanceA *= 2;
      if (skB.id === "analysis") critChanceB *= 2;
      if (skA.id === "meme-lord") { critChanceA *= 2; }
      if (skB.id === "meme-lord") { critChanceB *= 2; }

      const critA = Math.random() * 100 < critChanceA;
      let dmgA = atkA * spdF * (0.8 + Math.random() * 0.4);
      if (a.rageMode) dmgA *= 1.4;
      if (critA) dmgA *= 2.0;
      if (critA && skA.id === "meme-lord") dmgA *= 1.5;
      if (skA.id === "comedy" && Math.random() < 0.3) dmgA *= 2;
      if (skA.id === "trick-shot" && Math.random() < 0.1) dmgA *= 3;
      if (skA.id === "nerd" && hpPctA > 0.7) dmgA *= 2;
      if (skA.id === "chaos") dmgA *= Math.random() < 0.5 ? 1.8 : 0.7;
      dmgA = Math.max(1, Math.round(dmgA - defB * 0.5));

      const critB = Math.random() * 100 < critChanceB;
      let dmgB = atkB * spdF * (0.8 + Math.random() * 0.4);
      if (b.rageMode) dmgB *= 1.4;
      if (critB) dmgB *= 2.0;
      if (critB && skB.id === "meme-lord") dmgB *= 1.5;
      if (skB.id === "comedy" && Math.random() < 0.3) dmgB *= 2;
      if (skB.id === "trick-shot" && Math.random() < 0.1) dmgB *= 3;
      if (skB.id === "nerd" && hpPctB > 0.7) dmgB *= 2;
      if (skB.id === "chaos") dmgB *= Math.random() < 0.5 ? 1.8 : 0.7;
      dmgB = Math.max(1, Math.round(dmgB - defA * 0.5));

      // onDamaged modifiers
      if (skB.id === "calm-power" || skB.id === "kids-power") dmgA = Math.round(dmgA * 0.8);
      if (skA.id === "calm-power" || skA.id === "kids-power") dmgB = Math.round(dmgB * 0.8);
      if (skB.id === "kids-power") dmgA = Math.round(dmgA * 0.75);
      if (skA.id === "kids-power") dmgB = Math.round(dmgB * 0.75);
      if (skB.id === "science") dmgA = Math.round(dmgA * (1 - defB * 0.003));
      if (skA.id === "science") dmgB = Math.round(dmgB * (1 - defA * 0.003));
      if (skB.id === "truth") dmgA = Math.round(dmgA * 0.6);
      if (skA.id === "truth") dmgB = Math.round(dmgB * 0.6);
      if (skB.id === "shape-of-you") dmgA = Math.round(dmgA * 0.85);
      if (skA.id === "shape-of-you") dmgB = Math.round(dmgB * 0.85);
      if (skB.id === "british" && critA) dmgA = Math.round(dmgA * 0.5);
      if (skA.id === "british" && critB) dmgB = Math.round(dmgB * 0.5);
      if (skB.id === "scream" && dmgB > 0) a.slowTimer = 120;
      if (skA.id === "scream" && dmgA > 0) b.slowTimer = 120;
      if (skB.id === "blue-fire" && dmgB > 0) a.slowTimer = 120;
      if (skA.id === "blue-fire" && dmgA > 0) b.slowTimer = 120;

      dmgA = Math.round(dmgA * timeScale);
      dmgB = Math.round(dmgB * timeScale);

      b.hp -= dmgA; a.hp -= dmgB;
      a.fighter.totalDamage += dmgA; b.fighter.totalDamage += dmgB;
      if (critA) a.fighter.critsLanded++;
      if (critB) b.fighter.critsLanded++;

      for (let k = 0; k < Math.min(5, Math.ceil(dmgB / 60)); k++) {
        const ang = Math.random() * Math.PI * 2;
        particles.push({ x: a.x, y: a.y, vx: Math.cos(ang) * (1.2 + Math.random() * 2.5), vy: Math.sin(ang) * (1.2 + Math.random() * 2.5) - 1.5, life: 28 + Math.random() * 16, color: "#f87171", size: 6 + Math.random() * 3 });
      }
      for (let k = 0; k < Math.min(5, Math.ceil(dmgA / 60)); k++) {
        const ang = Math.random() * Math.PI * 2;
        particles.push({ x: b.x, y: b.y, vx: Math.cos(ang) * (1.2 + Math.random() * 2.5), vy: Math.sin(ang) * (1.2 + Math.random() * 2.5) - 1.5, life: 28 + Math.random() * 16, color: "#f87171", size: 6 + Math.random() * 3 });
      }

      let knockA = 1, knockB = 1;
      if (skA.id === "wrestling") knockA = 2;
      if (skB.id === "wrestling") knockB = 2;

      if (critA) {
        const knockF = (3 + dmgA / 50) * timeScale * knockA;
        b.vx += nx * knockF; b.vy += ny * knockF;
        shake.value = Math.max(shake.value, 7 * Math.min(2, timeScale));
        rings.push({ x: mx, y: my, radius: 5, maxRadius: (a.radius + b.radius) * 1.0, life: 22, maxLife: 22, color: "#fbbf24", lineWidth: 3 });
      }
      if (critB) {
        const knockF = (3 + dmgB / 50) * timeScale * knockB;
        a.vx -= nx * knockF; a.vy -= ny * knockF;
        shake.value = Math.max(shake.value, 7 * Math.min(2, timeScale));
        rings.push({ x: mx, y: my, radius: 5, maxRadius: (a.radius + b.radius) * 1.0, life: 22, maxLife: 22, color: "#fbbf24", lineWidth: 3 });
      }

      a.flashTimer = 10; b.flashTimer = 10;

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

      texts.push(
        { x: b.x + (Math.random() - 0.5) * 20, y: b.y - b.radius - 10, text: critA ? `-${dmgA}!` : `-${dmgA}`, color: critA ? "#fbbf24" : "#f87171", life: 55, size: critA ? 22 : 14 },
        { x: a.x + (Math.random() - 0.5) * 20, y: a.y - a.radius - 10, text: critB ? `-${dmgB}!` : `-${dmgB}`, color: critB ? "#fbbf24" : "#f87171", life: 55, size: critB ? 22 : 14 },
      );

      if (!a.rageMode && a.hp > 0 && a.hp < a.maxHp * 0.25) {
        a.rageMode = true;
        logs.push(isKo ? `${a.fighter.name} 위기! 패닉 모드` : `${a.fighter.name} crisis! Panic mode`);
        shake.value = Math.max(shake.value, 5);
        rings.push({ x: a.x, y: a.y, radius: a.radius, maxRadius: a.radius * 3, life: 25, maxLife: 25, color: "#ef4444", lineWidth: 3 });
      }
      if (!b.rageMode && b.hp > 0 && b.hp < b.maxHp * 0.25) {
        b.rageMode = true;
        logs.push(isKo ? `${b.fighter.name} 위기! 패닉 모드` : `${b.fighter.name} crisis! Panic mode`);
        shake.value = Math.max(shake.value, 5);
        rings.push({ x: b.x, y: b.y, radius: b.radius, maxRadius: b.radius * 3, life: 25, maxLife: 25, color: "#ef4444", lineWidth: 3 });
      }

      if (critA) logs.push(isKo ? `${a.fighter.name} → ${b.fighter.name} 크리! -${dmgA}` : `${a.fighter.name} crits ${b.fighter.name}! -${dmgA}`);
      if (critB) logs.push(isKo ? `${b.fighter.name} → ${a.fighter.name} 크리! -${dmgB}` : `${b.fighter.name} crits ${a.fighter.name}! -${dmgB}`);
      if (!critA && !critB) logs.push(isKo ? `충돌 — ${a.fighter.name} -${dmgB} / ${b.fighter.name} -${dmgA}` : `Clash — ${a.fighter.name} -${dmgB} / ${b.fighter.name} -${dmgA}`);

      const spawnDeath = (m: Marble, killer: Marble) => {
        m.alive = false; m.hp = 0;
        killer.fighter.kills++;
        m.fighter.deathOrder = frame;
        shake.value = Math.max(shake.value, 14);

        let absorbRate = 0.2;
        if (killer.fighter.skill.id === "feast" || killer.fighter.skill.id === "money-challenge") absorbRate = 0.6;
        if (killer.fighter.skill.id === "hustle" || killer.fighter.skill.id === "jyp-nation") absorbRate = 0.4;
        if (killer.fighter.skill.id === "challenge") killer.fighter.stats.atk = Math.round(killer.fighter.stats.atk * 1.15);
        if (killer.fighter.skill.id === "hustle") killer.fighter.stats.atk = Math.round(killer.fighter.stats.atk * 1.1);

        const absorbHp = Math.round(m.maxHp * absorbRate);
        const oldMaxHp = killer.maxHp;
        killer.maxHp += absorbHp;
        killer.hp = Math.min(killer.maxHp, killer.hp + absorbHp);
        killer.baseRadius *= (killer.maxHp / oldMaxHp);
        killer.mass = killer.maxHp;

        texts.push({ x: killer.x, y: killer.y - killer.baseRadius - 16, text: `+${absorbHp} HP`, color: "#22d3ee", life: 65, size: 19 });
        rings.push({ x: killer.x, y: killer.y, radius: killer.baseRadius * 0.3, maxRadius: killer.baseRadius * 2.2, life: 24, maxLife: 24, color: "#22d3ee", lineWidth: 3 });

        for (let k = 0; k < 30; k++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 7;
          particles.push({ x: m.x + (Math.random() - 0.5) * m.baseRadius, y: m.y + (Math.random() - 0.5) * m.baseRadius, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 35 + Math.floor(Math.random() * 30), color: Math.random() > 0.4 ? m.color : (Math.random() > 0.5 ? "#ffffff" : "#ef4444"), size: 2.5 + Math.random() * 5 });
        }
        rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.5, maxRadius: m.baseRadius * 4.5, life: 30, maxLife: 30, color: m.color, lineWidth: 4 });
        rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.3, maxRadius: m.baseRadius * 2.5, life: 20, maxLife: 20, color: "#ef4444", lineWidth: 2 });

        logs.push(isKo ? `[속보] ${m.fighter.name} 탈락! ${killer.fighter.name}에 흡수 — HP +${absorbHp}` : `[BREAKING] ${m.fighter.name} eliminated! Absorbed by ${killer.fighter.name} — HP +${absorbHp}`);
      };
      if (b.hp <= 0 && b.alive) spawnDeath(b, a);
      if (a.hp <= 0 && a.alive) spawnDeath(a, b);
    }
  }

  for (let i = texts.length - 1; i >= 0; i--) {
    texts[i].y -= 0.9; texts[i].life--;
    if (texts[i].life <= 0) texts.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.08; p.vx *= 0.98;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
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
  thumbMap: Map<string, HTMLImageElement>,
  shake: number,
) {
  ctx.save();

  if (shake > 0.3) {
    const sx = (Math.random() - 0.5) * shake * 2.5;
    const sy = (Math.random() - 0.5) * shake * 2.5;
    ctx.translate(sx, sy);
  }

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(-10, -10, W + 20, H + 20);

  const gridAlpha = 0.12 + Math.sin(frame * 0.01) * 0.04;
  ctx.strokeStyle = `rgba(63, 63, 70, ${gridAlpha})`;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  ctx.strokeStyle = "rgba(239, 68, 68, 0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  const alive = marbles.filter(m => m.alive);

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

  for (const m of alive) {
    const tgt = marbles.find(t => t.fighter.channelId === m.targetId && t.alive);
    if (tgt) {
      const dx = tgt.x - m.x, dy = tgt.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < m.radius + 20) continue;
      const nxx = dx / dist, nyy = dy / dist;
      const startX = m.x + nxx * (m.radius + 4), startY = m.y + nyy * (m.radius + 4);
      const endX = m.x + nxx * (m.radius + 18), endY = m.y + nyy * (m.radius + 18);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = m.color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.stroke();
      const aLen = 5;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - aLen * nxx + aLen * 0.5 * nyy, endY - aLen * nyy - aLen * 0.5 * nxx);
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - aLen * nxx - aLen * 0.5 * nyy, endY - aLen * nyy + aLen * 0.5 * nxx);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

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

  for (const m of alive) {
    if (m.trail.length >= 2) {
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
  }

  for (const m of alive) {
    const flash = m.flashTimer > 0;
    const breathe = 1 + Math.sin(frame * 0.06 + m.fighter.channelId.charCodeAt(0)) * 0.015;
    const displayR = (m.rageMode ? m.radius * 1.1 : m.radius) * breathe;

    if (m.rageMode) {
      const a1 = 0.4 + Math.sin(frame * 0.2) * 0.25;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 8 + Math.sin(frame * 0.15) * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${a1})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

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

    ctx.beginPath();
    ctx.arc(m.x, m.y, displayR - 1, 0, Math.PI * 2);
    ctx.fillStyle = flash ? "#dc2626" : "#ffffff";
    ctx.fill();

    if (!flash) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR - 2, 0, Math.PI * 2);
      ctx.clip();
      const thumb = thumbMap.get(m.fighter.channelId);
      if (thumb && thumb.complete && thumb.naturalWidth > 0) {
        const imgW = thumb.naturalWidth;
        const imgH = thumb.naturalHeight;
        const circleD = (displayR - 2) * 2;
        const scale = circleD / Math.min(imgW, imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        try { ctx.drawImage(thumb, m.x - drawW / 2, m.y - drawH / 2, drawW, drawH); } catch { /* ignore */ }
      } else {
        const fGrad = ctx.createRadialGradient(m.x - displayR * 0.3, m.y - displayR * 0.3, 0, m.x, m.y, displayR);
        fGrad.addColorStop(0, m.color);
        fGrad.addColorStop(1, m.bgColor);
        ctx.fillStyle = fGrad;
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.max(14, Math.round(displayR * 0.8))}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\u25B6", m.x, m.y);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = flash ? "#fca5a5" : m.color;
    ctx.shadowBlur = flash ? 16 : 10;
    ctx.beginPath();
    ctx.arc(m.x, m.y, displayR, 0, Math.PI * 2);
    ctx.strokeStyle = flash ? "#fca5a5" : m.color;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    const barW = Math.max(displayR * 2, 30);
    const barH = 5;
    const barX = m.x - barW / 2;
    const barY = m.y + displayR + 7;
    const hpPct = Math.max(0, m.hp / m.maxHp);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = "#27272a";
    ctx.fillRect(barX, barY, barW, barH);
    if (hpPct > 0) {
      const barGrad = ctx.createLinearGradient(barX, barY, barX + barW * hpPct, barY);
      if (hpPct > 0.5) { barGrad.addColorStop(0, "#22c55e"); barGrad.addColorStop(1, "#4ade80"); }
      else if (hpPct > 0.25) { barGrad.addColorStop(0, "#ca8a04"); barGrad.addColorStop(1, "#eab308"); }
      else { barGrad.addColorStop(0, "#dc2626"); barGrad.addColorStop(1, "#ef4444"); }
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX, barY, barW * hpPct, barH);
    }

    const fSize = Math.max(9, Math.round(displayR * 0.35));
    ctx.font = `bold ${fSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillText(m.fighter.name, m.x + 0.5, barY + barH + 3.5);
    ctx.fillStyle = "#d4d4d8";
    ctx.fillText(m.fighter.name, m.x, barY + barH + 3);

    if (m.skillBuff > 0) {
      const sk = m.fighter.skill;
      const pulse = 0.35 + Math.sin(frame * 0.2) * 0.2;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.shadowColor = sk.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 8 + Math.sin(frame * 0.12) * 3, 0, Math.PI * 2);
      ctx.strokeStyle = sk.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    if (m.slowTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 2, 0, Math.PI * 2);
      ctx.fillStyle = "#93c5fd";
      ctx.fill();
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const p of particles) {
    const alpha = Math.max(0, Math.min(1, p.life / 20));
    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.char) {
      const sz = Math.max(6, p.size * Math.min(1, p.life / 18));
      ctx.font = `bold ${Math.round(sz)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeText(p.char, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.char, p.x, p.y);
    } else {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * Math.min(1, p.life / 15)), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.restore();
  }

  for (const ft of texts) {
    const alpha = Math.min(1, ft.life / 15);
    const size = ft.size || 13;
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ═══════════════════════════════════════════════
   LOCALIZATION
   ═══════════════════════════════════════════════ */

const L = {
  ko: {
    title: "유튜버 배틀로얄",
    subtitle: "구독자가 체력, 조회수가 화력! 최후의 1인은?",
    pick: "유튜버를 선택하세요",
    selected: (n: number) => `${n}명 선택`,
    search: "유튜버 검색...",
    start: "배틀 시작!",
    loading: "데이터 로딩 중...",
    need: (n: number) => `${n}명 더 선택하세요`,
    random: "랜덤 8명",
    fighters: "출전 유튜버",
    fight: "FIGHT!",
    alive: (n: number) => `${n}명 생존`,
    speed: (s: number) => `${s}x`,
    skip: "스킵",
    champion: "CHAMPION",
    statsTitle: "배틀 결과",
    dmg: "총 데미지",
    kills: "킬",
    crits: "크리티컬",
    share: "결과 공유",
    copied: "복사됨!",
    rematch: "재대결",
    again: "처음으로",
    notEnough: "2명 이상 선택해주세요",
    statNote: "* 구독자 = HP, 평균 조회수 = ATK, 업로드 수 = SPD",
    evWin: (name: string) => `[속보] ${name} 최종 우승!`,
    shareText: (winner: string, names: string[]) => `유튜버 배틀로얄! ${names.join(" vs ")}\n우승: ${winner}`,
    all: "전체", "kr-ent": "한국", "kr-edu": "교육", global: "글로벌", gaming: "게임", music: "음악",
    subsLabel: "구독자", viewsLabel: "조회수", videosLabel: "동영상",
    searchResult: "검색 결과",
    country: "유튜버",
  },
  en: {
    title: "YouTuber Battle Royale",
    subtitle: "Subscribers = HP, Views = Power! Who survives?",
    pick: "Select YouTubers",
    selected: (n: number) => `${n} selected`,
    search: "Search YouTubers...",
    start: "Start Battle!",
    loading: "Loading data...",
    need: (n: number) => `Select ${n} more`,
    random: "Random 8",
    fighters: "Contenders",
    fight: "FIGHT!",
    alive: (n: number) => `${n} alive`,
    speed: (s: number) => `${s}x`,
    skip: "Skip",
    champion: "CHAMPION",
    statsTitle: "Battle Results",
    dmg: "Total Damage",
    kills: "Kills",
    crits: "Criticals",
    share: "Share Results",
    copied: "Copied!",
    rematch: "Rematch",
    again: "Reset",
    notEnough: "Select at least 2",
    statNote: "* Subscribers = HP, Avg Views = ATK, Videos = SPD",
    evWin: (name: string) => `[BREAKING] ${name} wins!`,
    shareText: (winner: string, names: string[]) => `YouTuber Battle Royale! ${names.join(" vs ")}\nWinner: ${winner}`,
    all: "All", "kr-ent": "Korea", "kr-edu": "Education", global: "Global", gaming: "Gaming", music: "Music",
    subsLabel: "Subs", viewsLabel: "Views", videosLabel: "Videos",
    searchResult: "Search Results",
    country: "YouTuber",
  },
} as const;

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function YoutuberBattleClient() {
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
  const [lobbyTab, setLobbyTab] = useState<"all" | "kr-ent" | "kr-edu" | "global" | "gaming" | "music">("all");
  const [searchResults, setSearchResults] = useState<{ channelId: string; name: string; thumbnailUrl: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
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
  const thumbMapRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const filteredPool = useMemo(() => {
    let list = [...YOUTUBERS];
    if (lobbyTab !== "all") list = list.filter(c => c.category === lobbyTab);
    if (lobbyQuery.trim()) {
      const q = lobbyQuery.trim().toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.channelId.toLowerCase().includes(q)
      );
    }
    return list;
  }, [lobbyQuery, lobbyTab]);

  useEffect(() => {
    const sParam = searchParams.get("s");
    if (sParam && phase === "lobby") {
      const codes = sParam.split(",").map(c => c.trim()).filter(Boolean);
      if (codes.length >= 2) setSelected(new Set(codes.slice(0, 20)));
    }
  }, [searchParams, phase]);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { isKoRef.current = isKo; }, [isKo]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [battleLogs.length]);

  const toggle = useCallback((channelId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else if (next.size < 20) next.add(channelId);
      return next;
    });
  }, []);

  const randomPick = useCallback((count = 8) => {
    const shuffled = [...YOUTUBERS].sort(() => Math.random() - 0.5);
    setSelected(new Set(shuffled.slice(0, count).map(c => c.channelId)));
  }, []);

  const finishBattle = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(animRef.current);
    clearInterval(logSyncRef.current);
    const winner = marblesRef.current.find(m => m.alive);
    const ko = isKoRef.current;
    if (winner) pendingLogsRef.current.push(ko ? L.ko.evWin(winner.fighter.name) : L.en.evWin(winner.fighter.name));
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
    if (selected.size < 2) return;
    setPhase("loading");
    try {
      const channelIds = Array.from(selected);
      const presetMap = new Map(YOUTUBERS.map(p => [p.channelId, p]));
      const channelDataMap = await fetchChannelData(channelIds);
      const thumbFighters = channelIds.map(id => {
        const d = channelDataMap.get(id);
        return { channelId: id, thumbnailUrl: d?.thumbnailUrl ?? "" };
      });
      const thumbMap = await preloadThumbnails(thumbFighters);

      const loaded: Fighter[] = [];
      for (let i = 0; i < channelIds.length; i++) {
        const id = channelIds[i];
        const data = channelDataMap.get(id);
        const preset = presetMap.get(id);
        if (!data && !preset) continue;

        const cd = data ?? {
          channelId: id,
          name: preset!.name,
          thumbnailUrl: "",
          publishedAt: "2020-01-01",
          subscriberCount: 1000000,
          viewCount: 100000000,
          videoCount: 100,
          avgViewsPerVideo: 1000000,
          yearsActive: 5,
        };
        const stats = toGameStats(cd);
        const palette = PALETTE[i % PALETTE.length];

        loaded.push({
          channelId: id,
          name: cd.name,
          thumbnailUrl: cd.thumbnailUrl,
          stats,
          skill: getYoutuberSkill(id),
          canvasColor: palette.color,
          canvasBg: palette.bg,
          hp: stats.maxHp,
          alive: true,
          kills: 0,
          totalDamage: 0,
          critsLanded: 0,
          deathOrder: 0,
          subsLabel: formatCount(cd.subscriberCount),
          viewsLabel: formatCount(cd.viewCount),
          videosLabel: formatCount(cd.videoCount),
        });
      }

      thumbMapRef.current = thumbMap;

      if (loaded.length < 2) {
        alert(t.notEnough);
        setPhase("lobby");
        return;
      }

      fightersRef.current = loaded;
      setFighters(loaded);
      setBattleLogs([]);
      setAliveCnt(loaded.length);
      doneRef.current = false;
      setIntroPhase("cards");
      setPhase("battle");
      setTimeout(() => setIntroPhase("fight"), 3000);
      setTimeout(() => setIntroPhase("none"), 4200);
    } catch (err) {
      console.error(err);
      setPhase("lobby");
    }
  }, [selected, t.notEnough]);

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
      drawFrame(ctx, marblesRef.current, textsRef.current, particlesRef.current, ringsRef.current, w, h, frameRef.current, thumbMapRef.current, shakeRef.current.value);
      ctx.restore();

      if (marblesRef.current.filter(m => m.alive).length <= 1) {
        finishBattle();
        return;
      }
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
    setSearchResults([]);
  }, []);

  const buildShareUrl = useCallback(() => {
    const codes = fighters.map(f => f.channelId).join(",");
    const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    return `${base}?s=${encodeURIComponent(codes)}`;
  }, [fighters]);

  const handleShare = useCallback(async () => {
    const winner = fighters.find(f => f.alive);
    const names = fighters.map(f => f.name);
    const url = buildShareUrl();
    const text = t.shareText(winner?.name ?? "?", names);

    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: t.title, text, url }); return; } catch { /* fallthrough */ }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  }, [fighters, buildShareUrl, t]);

  const rematch = useCallback(() => {
    const codes = fighters.map(f => f.channelId);
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
    setSelected(new Set(codes));
  }, [fighters]);

  useEffect(() => {
    if (!lobbyQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const results = await searchChannels(lobbyQuery, 8);
      setSearchResults(results);
      setSearchLoading(false);
    }, 500);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [lobbyQuery]);

  if (phase === "battle") {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-hidden">
        {introPhase === "cards" && fighters.length > 0 && (
          <div className="absolute inset-0 z-50 bg-black/92 flex flex-col items-center justify-center p-3 overflow-auto animate-in fade-in duration-300">
            <h2 className="text-red-500 font-black text-lg sm:text-xl mb-3 tracking-widest flex items-center gap-2">
              <Youtube size={20} /> {t.fighters} ({fighters.length}) <Youtube size={20} />
            </h2>
            {fighters.length <= 10 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl w-full">
                {fighters.map((f) => (
                  <div key={f.channelId} className="bg-zinc-900/90 rounded-xl p-2.5 border border-zinc-700/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <img src={f.thumbnailUrl || undefined} alt="" width={32} height={32} className="rounded-full object-cover bg-zinc-800" />
                      <div className="min-w-0">
                        <span className="text-white text-xs font-bold block truncate">{f.name}</span>
                        <span className="text-[9px] font-medium block truncate" style={{ color: f.skill.color }}>{isKo ? f.skill.nameKo : f.skill.nameEn}</span>
                      </div>
                    </div>
                    <div className="text-[8px] text-zinc-500 mb-1" style={{ color: f.skill.color + "99" }}>
                      {isKo ? f.skill.descKo : f.skill.descEn}
                    </div>
                    <div className="grid grid-cols-4 gap-x-1 gap-y-0.5 text-[10px]">
                      <span className="text-zinc-500">HP <span className="text-white font-bold">{f.stats.maxHp}</span></span>
                      <span className="text-zinc-500">ATK <span className="text-red-400 font-bold">{f.stats.atk}</span></span>
                      <span className="text-zinc-500">SPD <span className="text-green-400 font-bold">{f.stats.spd}</span></span>
                      <span className="text-zinc-500">CRT <span className="text-purple-400 font-bold">{f.stats.crit}%</span></span>
                      <span className="text-zinc-500">DEF <span className="text-yellow-400 font-bold">{f.stats.def}</span></span>
                      <span className="text-zinc-500">{t.subsLabel} <span className="text-cyan-400 font-bold">{f.subsLabel}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-2xl w-full">
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[...fighters].sort((a, b) => b.stats.maxHp - a.stats.maxHp).map((f) => (
                    <div key={f.channelId} className="bg-zinc-900/80 rounded-lg px-2 py-1.5 border border-zinc-700/40 flex items-center gap-1.5">
                      <img src={f.thumbnailUrl || undefined} alt="" width={24} height={24} className="rounded-full object-cover bg-zinc-800" />
                      <span className="text-white text-[10px] font-bold">{f.name}</span>
                      <span className="text-zinc-500 text-[9px]">HP<span className="text-zinc-300 font-bold ml-0.5">{f.stats.maxHp}</span></span>
                      <span className="text-[8px] font-medium" style={{ color: f.skill.color }}>{isKo ? f.skill.nameKo : f.skill.nameEn}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-zinc-600 text-[10px] mt-3">{t.statNote}</p>
          </div>
        )}
        {introPhase === "fight" && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 animate-in zoom-in duration-200">
            <span className="text-6xl sm:text-8xl font-black text-white tracking-[0.2em] animate-pulse">{t.fight}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-red-500 text-xs font-bold animate-pulse">LIVE</span>
            <span className="text-zinc-400 text-xs">{t.alive(aliveCnt)}</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map(s => (
              <button key={s} onClick={() => setSpeedState(s)}
                className={`px-2 py-0.5 rounded text-xs font-bold transition ${speed === s ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
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
              line.includes("[속보]") || line.includes("[BREAKING]") ? "text-red-400 font-bold"
              : line.includes("크리") || line.includes("crits") ? "text-orange-300"
              : line.includes("위기") || line.includes("crisis") ? "text-orange-400 font-bold"
              : line.includes("HP") ? "text-cyan-400 font-bold"
              : "text-zinc-400"
            }`}>{line}</p>
          ))}
        </div>
      </div>
    );
  }

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
          <Trophy className="text-red-500 mb-3" size={48} />
          <div className="bg-gradient-to-br from-red-900/30 to-zinc-900 border border-red-600/40 rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl shadow-red-500/10">
            <img src={winner?.thumbnailUrl || undefined} alt="" width={96} height={96} className="rounded-full object-cover bg-zinc-800 border-4 border-red-500/50 shadow-lg" />
            <p className="text-2xl font-black text-white">{winner?.name}</p>
            <span className="text-red-500 text-sm font-bold tracking-widest uppercase">{t.champion}</span>
          </div>
        </div>
        <div className="px-3 pb-8 max-w-lg mx-auto w-full">
          <h3 className="text-white font-bold text-sm mb-2">{t.statsTitle}</h3>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-900 text-zinc-400">
                  <th className="px-2 py-1.5 text-left">#</th>
                  <th className="px-2 py-1.5 text-left">{t.country}</th>
                  <th className="px-2 py-1.5 text-right">{t.dmg}</th>
                  <th className="px-2 py-1.5 text-right">{t.kills}</th>
                  <th className="px-2 py-1.5 text-right">{t.crits}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((f, i) => (
                  <tr key={f.channelId} className={`border-t border-zinc-800 ${i === 0 ? "bg-red-900/10" : ""}`}>
                    <td className="px-2 py-1.5 text-zinc-500 font-bold">{i === 0 ? "🏆" : `#${i + 1}`}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <img src={f.thumbnailUrl || undefined} alt="" width={24} height={24} className="rounded-full object-cover bg-zinc-800" />
                        <span className="text-white font-bold">{f.name}</span>
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
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={handleShare}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
                copied ? "bg-green-600 text-white" : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white"
              }`}
            >
              {copied ? <><Check size={16} /> {t.copied}</> : <><Share2 size={16} /> {t.share}</>}
            </button>
            <button onClick={rematch} className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition">
              <Link2 size={16} /> {t.rematch}
            </button>
            <button onClick={reset} className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm flex items-center justify-center gap-2 transition">
              <RotateCcw size={16} /> {t.again}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const canStart = selected.size >= 2;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-20">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs font-bold mb-3">
          <Youtube size={14} /> {t.title}
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">{t.title}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t.subtitle}</p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.pick}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-red-600">{t.selected(selected.size)}</span>
          <button onClick={() => randomPick(8)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition">
            <Shuffle size={14} /> {t.random}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="text" value={lobbyQuery} onChange={e => setLobbyQuery(e.target.value)}
            placeholder={t.search}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          {searchLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-400" />}
        </div>
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0">
          {(["all", "kr-ent", "kr-edu", "global", "gaming", "music"] as const).map(tab => (
            <button key={tab} onClick={() => setLobbyTab(tab)}
              className={`px-2 py-2 text-xs font-bold transition ${lobbyTab === tab ? "bg-red-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >{t[tab]}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 max-h-[40vh] overflow-y-auto pr-1">
        {filteredPool.map((item) => {
          const channelId = item.channelId;
          const name = item.name;
          const sel = selected.has(channelId);
          return (
            <button key={channelId} onClick={() => toggle(channelId)}
              className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${
                sel ? "border-red-500 bg-red-50 dark:bg-red-950/40 ring-2 ring-red-300 shadow-sm"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm"
              }`}
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                <Youtube size={16} className="text-zinc-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{name}</p>
                <p className="text-[10px] truncate" style={{ color: getYoutuberSkill(channelId).color }}>
                  {isKo ? getYoutuberSkill(channelId).nameKo : getYoutuberSkill(channelId).nameEn}
                </p>
              </div>
              {sel && <Check size={14} className="text-red-600 shrink-0" />}
            </button>
          );
        })}
      </div>

      {lobbyQuery.trim().length > 0 && (
        <>
          <p className="text-xs text-zinc-500 mb-2">{t.searchResult}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 max-h-[30vh] overflow-y-auto pr-1">
            {searchLoading ? (
              <div className="col-span-full flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-zinc-400" />
              </div>
            ) : (
              searchResults.map((item) => {
                const channelId = item.channelId;
                const name = item.name;
                const thumbUrl = item.thumbnailUrl;
                const sel = selected.has(channelId);
                return (
                  <button key={channelId} onClick={() => toggle(channelId)}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${
                      sel ? "border-red-500 bg-red-50 dark:bg-red-950/40 ring-2 ring-red-300 shadow-sm"
                          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm"
                    }`}
                  >
                    <img src={thumbUrl || undefined} alt="" width={32} height={32} className="shrink-0 rounded-full object-cover bg-zinc-800" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{name}</p>
                      <p className="text-[10px] truncate" style={{ color: getYoutuberSkill(channelId).color }}>
                        {isKo ? getYoutuberSkill(channelId).nameKo : getYoutuberSkill(channelId).nameEn}
                      </p>
                    </div>
                    {sel && <Check size={14} className="text-red-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {lobbyQuery.trim().length === 0 && <div className="mb-6" />}

      <button disabled={!canStart || phase === "loading"} onClick={startBattle}
        className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition sticky bottom-4 ${
          canStart ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-red-900/30"
                   : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
        }`}
      >
        {phase === "loading" ? (<><Loader2 size={18} className="animate-spin" />{t.loading}</>)
        : canStart ? (<><Swords size={18} />{t.start}</>)
        : selected.size < 2 ? t.notEnough : t.need(2 - selected.size)}
      </button>
    </div>
  );
}
