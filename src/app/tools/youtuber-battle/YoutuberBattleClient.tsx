"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Swords, Loader2, Trophy, RotateCcw, SkipForward, Search, Share2, Check, Link2, Youtube } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fetchChannelData, searchChannels, type ChannelData } from "./youtube-api";
import { getYoutuberSkill, getYoutuberSkills, type YouTuberSkill, getChannelElement, getElementAdvantage, ELEMENT_INFO, type ElementType } from "./youtuber-skills";

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
  skill: YouTuberSkill;       // primary skill (display)
  skills: YouTuberSkill[];    // all skills (1~2)
  element: ElementType;       // channel attribute
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
  bpCount: number;
  ultGauge: number;
  ultFired: boolean;
  ultEffectPending: boolean;
  isClone: boolean;        // shadow-clone
  cloneLife: number;       // frames until auto-death
  ultBuffTimer: number;    // frames of rage-burst etc.
  phaseTimer: number;      // frames of collision pass-through (flash-slash)
  freezeTimer: number;     // deep freeze (frost-field): near-zero speed + blue tint
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

interface KillEvent {
  killerName: string;
  victimName: string;
  killerThumb: string;
  victimThumb: string;
  frame: number;
}

interface Projectile {
  x: number; y: number; vx: number; vy: number;
  targetId: string; ownerId: string;
  damage: number; life: number;
  color: string; size: number;
  type: "missile" | "lightning" | "bullet";
}

interface SlashLine {
  x1: number; y1: number;   // start
  x2: number; y2: number;   // end
  life: number; maxLife: number;
  color: string; width: number;
}

interface CutIn {
  name: string;
  skillName: string;
  skillColor: string;
  channelId: string;          // for thumbnail lookup
  startFrame: number;
  duration: number;           // total frames
}

interface Camera {
  x: number; y: number;
  targetX: number; targetY: number;
  zoom: number; targetZoom: number;
  slowMo: number;
  killEvents: KillEvent[];
  cutIn: CutIn | null;        // active cut-in
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

  // ── HP ← 구독자 (로그 스케일, 격차 압축) ──
  // 1만→1000, 10만→1200, 100만→1400, 1000만→1600, 1억→1800
  const hp = Math.round(clamp(Math.log10(Math.max(subs, 1000)) * 350 - 400, 800, 2000));

  // ── ATK ← 영상당 평균 조회수 (로그, 범위 압축) ──
  // 100뷰→30, 1만뷰→40, 10만뷰→45, 100만뷰→50, 1억뷰→60
  const atk = Math.round(clamp(10 + Math.log10(Math.max(avgViews, 10)) * 10, 25, 65));

  // ── SPD ← 업로드 빈도 (videos / years) ──
  const uploadsPerYear = videos / Math.max(years, 0.5);
  const spd = Math.round(clamp(3 + Math.log10(Math.max(uploadsPerYear, 1)) * 5, 3, 18));

  // ── CRIT ← 바이럴 계수 (조회수/구독자 비율) ──
  const viralRatio = views / Math.max(subs, 1);
  const crit = Math.round(clamp(5 + Math.log10(Math.max(viralRatio, 1)) * 6, 5, 30));

  // ── DEF ← 활동 기간 (오래 버틴 채널 = 내구도) ──
  const def = Math.round(clamp(Math.pow(years, 0.45) * 5, 3, 25));

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
    const vel = 1.0 + (f.stats.spd / 20) * 2;

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
      bpCount: 0,
      ultGauge: 0,
      ultFired: false,
      ultEffectPending: false,
      isClone: false,
      cloneLife: 0,
      ultBuffTimer: 0,
      phaseTimer: 0,
      freezeTimer: 0,
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
  projectiles: Projectile[], slashLines: SlashLine[],
  logs: string[], isKo: boolean, frame: number,
  shake: { value: number },
  camera: Camera,
) {
  const alive = marbles.filter(m => m.alive);
  let DMG_CD = alive.length > 16 ? Math.round(DMG_CD_BASE * 0.5) : alive.length > 10 ? Math.round(DMG_CD_BASE * 0.7) : DMG_CD_BASE;
  const cdTimeScale = Math.max(0.5, 1 - frame * 0.00008);
  DMG_CD = Math.max(8, Math.round(DMG_CD * cdTimeScale));

  if (shake.value > 0) shake.value *= 0.88;
  if (shake.value < 0.3) shake.value = 0;

  // ── Post-cutIn: activate R skill effects ──
  if (!camera.cutIn) {
    for (const m of alive) {
      if (!m.ultEffectPending) continue;
      m.ultEffectPending = false;
      const rSk = m.fighter.skills.find(s => s.slot === "R");
      if (!rSk) continue;
      const col = rSk.color;
      const skName = isKo ? rSk.nameKo : rSk.nameEn;
      texts.push({ x: m.x, y: m.y - m.baseRadius - 35, text: `★ ${skName} ★`, color: col, life: 100, size: 26 });
      rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.3, maxRadius: m.baseRadius * 5, life: 35, maxLife: 35, color: col, lineWidth: 5 });
      rings.push({ x: m.x, y: m.y, radius: m.baseRadius, maxRadius: m.baseRadius * 3, life: 22, maxLife: 22, color: "#ffffff", lineWidth: 2 });
      shake.value = Math.max(shake.value, 14);

      const others = alive.filter(o => o !== m && !o.isClone);

      switch (rSk.id) {
        // ═══ 1. 분신술 — 2 clones (same thumbnail as original) ═══
        case "shadow-clone": {
          const cloneCount = 2;
          for (let c = 0; c < cloneCount; c++) {
            const ang = (c / cloneCount) * Math.PI * 2 + Math.random() * 0.5;
            const spawnDist = m.baseRadius * 2.5;
            const cloneR = Math.max(10, m.baseRadius * 0.6);
            const cloneHp = Math.round(m.maxHp * 0.3);
            const clone: Marble = {
              // Keep original channelId so thumbnail lookup works, use _clone suffix only for internal ID
              fighter: { ...m.fighter, channelId: m.fighter.channelId, name: `${m.fighter.name}(분신)`, kills: 0, totalDamage: 0, critsLanded: 0, deathOrder: 0 },
              x: m.x + Math.cos(ang) * spawnDist, y: m.y + Math.sin(ang) * spawnDist,
              vx: Math.cos(ang) * 4, vy: Math.sin(ang) * 4,
              baseRadius: cloneR, radius: cloneR, mass: cloneHp,
              hp: cloneHp, maxHp: cloneHp, alive: true,
              rageMode: false, flashTimer: 0,
              color: m.color, bgColor: m.bgColor,
              targetId: "", retargetFrame: 0, trail: [],
              skillTimer: 0, skillActivated: false, skillBuff: 0,
              hitCounter: 0, slowTimer: 0, atkDebuffTimer: 0, bpCount: 0,
              ultGauge: 0, ultFired: true, ultEffectPending: false,
              isClone: true, cloneLife: 360, ultBuffTimer: 0, phaseTimer: 0, freezeTimer: 0,
            };
            marbles.push(clone);
            for (let k = 0; k < 8; k++) { const a2 = Math.random() * Math.PI * 2; particles.push({ x: clone.x, y: clone.y, vx: Math.cos(a2) * 3, vy: Math.sin(a2) * 3, life: 18, color: col, size: 2 + Math.random() * 3 }); }
          }
          logs.push(isKo ? `${m.fighter.name} 분신술! ${cloneCount}마리 소환!` : `${m.fighter.name} Shadow Clone! ${cloneCount} clones!`);
          break;
        }
        // ═══ 2. 일섬 — line dash + slash line ═══
        case "flash-slash": {
          const target = others.reduce((a, b) => {
            const da = (a.x - m.x) ** 2 + (a.y - m.y) ** 2;
            const db = (b.x - m.x) ** 2 + (b.y - m.y) ** 2;
            return da < db ? a : b;
          }, others[0]);
          if (target) {
            const startX = m.x, startY = m.y;
            const dx = target.x - m.x, dy = target.y - m.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / dist, ny = dy / dist;
            // Dash all the way to the edge of the field
            const diag = Math.sqrt(W * W + H * H);
            const dashDist = diag;
            // Damage everything in the line
            for (const o of others) {
              const ox = o.x - m.x, oy = o.y - m.y;
              const proj = ox * nx + oy * ny;
              if (proj < 0 || proj > dashDist) continue;
              const perpDist = Math.abs(ox * ny - oy * nx);
              if (perpDist < o.radius + 40) {
                const dmg = Math.round(m.fighter.stats.atk * 2.5);
                o.hp -= dmg;
                o.vx += nx * 12; o.vy += ny * 12; // knockback
                texts.push({ x: o.x, y: o.y - o.baseRadius - 14, text: `-${dmg}`, color: col, life: 50, size: 20 });
                rings.push({ x: o.x, y: o.y, radius: 5, maxRadius: o.baseRadius * 2, life: 18, maxLife: 18, color: col, lineWidth: 3 });
                o.flashTimer = 15;
              }
            }
            // ── Slash line visual — full screen pierce ──
            const endX = startX + nx * dashDist;
            const endY = startY + ny * dashDist;
            slashLines.push({ x1: startX, y1: startY, x2: endX, y2: endY, life: 50, maxLife: 50, color: col, width: 10 });
            // Second thinner cross-slash for style
            slashLines.push({ x1: startX + ny * 30, y1: startY - nx * 30, x2: endX - ny * 30, y2: endY + nx * 30, life: 45, maxLife: 45, color: "#ffffff", width: 3 });
            camera.slowMo = Math.max(camera.slowMo, 45);
            // Slash trail particles (more, along full path)
            for (let k = 0; k < 45; k++) {
              const t = Math.random() * dashDist;
              particles.push({ x: startX + nx * t + (Math.random() - 0.5) * 20, y: startY + ny * t + (Math.random() - 0.5) * 20, vx: ny * (Math.random() - 0.5) * 4, vy: -nx * (Math.random() - 0.5) * 4, life: 25 + Math.random() * 15, color: Math.random() > 0.5 ? col : "#ffffff", size: 2 + Math.random() * 4 });
            }
            // Teleport user to far end — phase through all collisions
            m.x += nx * dashDist;
            m.y += ny * dashDist;
            m.x = clamp(m.x, m.radius, W - m.radius);
            m.y = clamp(m.y, m.radius, H - m.radius);
            m.phaseTimer = 25; // pass through marbles after dash
          }
          logs.push(isKo ? `${m.fighter.name} 일섬! 경로 전원 타격!` : `${m.fighter.name} Flash Slash!`);
          break;
        }
        // ═══ 3. 다연발 미사일 — 8 homing missiles ═══
        case "missile-barrage": {
          const targets = [...others].sort((a, b) => {
            const da = (a.x - m.x) ** 2 + (a.y - m.y) ** 2;
            const db = (b.x - m.x) ** 2 + (b.y - m.y) ** 2;
            return da - db;
          });
          for (let mi = 0; mi < 8; mi++) {
            const tgt = targets[mi % targets.length];
            if (!tgt) break;
            const ang = (mi / 8) * Math.PI * 2;
            projectiles.push({
              x: m.x + Math.cos(ang) * m.baseRadius * 1.5,
              y: m.y + Math.sin(ang) * m.baseRadius * 1.5,
              vx: Math.cos(ang) * 5, vy: Math.sin(ang) * 5,
              targetId: tgt.fighter.channelId,
              ownerId: m.fighter.channelId,
              damage: Math.round(m.fighter.stats.atk * 1.5),
              life: 180, color: col, size: 6,
              type: "missile",
            });
          }
          logs.push(isKo ? `${m.fighter.name} 미사일 8발 발사!` : `${m.fighter.name} Missile Barrage! 8 missiles!`);
          break;
        }
        // ═══ 4. 거대화 — size + HP up ═══
        case "gigantify": {
          const hpBonus = Math.round(m.maxHp * 0.5);
          m.maxHp += hpBonus;
          m.hp += hpBonus;
          m.baseRadius *= 1.5;
          m.mass = m.maxHp;
          m.fighter.stats.atk = Math.round(m.fighter.stats.atk * 1.3);
          texts.push({ x: m.x, y: m.y - m.baseRadius - 50, text: `+${hpBonus} HP`, color: "#22d3ee", life: 60, size: 22 });
          for (let k = 0; k < 20; k++) { const a2 = Math.random() * Math.PI * 2; const sp = 2 + Math.random() * 4; particles.push({ x: m.x, y: m.y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp, life: 30, color: col, size: 4 + Math.random() * 5 }); }
          logs.push(isKo ? `${m.fighter.name} 거대화! HP +${hpBonus}!` : `${m.fighter.name} Gigantify! HP +${hpBonus}!`);
          break;
        }
        // ═══ 5. 블랙홀 — pull + AoE ═══
        case "black-hole": {
          const bRadius = 200;
          for (const o of others) {
            const dx = m.x - o.x, dy = m.y - o.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bRadius && dist > 1) {
              const pull = 8 / Math.max(1, dist / 50);
              o.vx += (dx / dist) * pull;
              o.vy += (dy / dist) * pull;
              const dmg = Math.round(m.fighter.stats.atk * 2);
              o.hp -= dmg;
              texts.push({ x: o.x, y: o.y - o.baseRadius - 10, text: `-${dmg}`, color: col, life: 40, size: 16 });
            }
          }
          // Visual: expanding dark ring
          rings.push({ x: m.x, y: m.y, radius: 10, maxRadius: bRadius, life: 40, maxLife: 40, color: "#7c3aed", lineWidth: 8 });
          rings.push({ x: m.x, y: m.y, radius: bRadius, maxRadius: bRadius * 0.3, life: 30, maxLife: 30, color: "#c084fc", lineWidth: 3 }); // contracting ring
          for (let k = 0; k < 25; k++) { const a2 = Math.random() * Math.PI * 2; const r = Math.random() * bRadius; particles.push({ x: m.x + Math.cos(a2) * r, y: m.y + Math.sin(a2) * r, vx: -Math.cos(a2) * 3, vy: -Math.sin(a2) * 3, life: 30, color: Math.random() > 0.5 ? "#7c3aed" : "#c084fc", size: 2 + Math.random() * 4 }); }
          logs.push(isKo ? `${m.fighter.name} 블랙홀! 적 흡입!` : `${m.fighter.name} Black Hole!`);
          break;
        }
        // ═══ 6. 번개 폭풍 — initial burst + sustained lightning aura ═══
        case "thunder-storm": {
          // Initial 5 strikes
          const strikeTargets = [...others].sort(() => Math.random() - 0.5).slice(0, Math.min(5, others.length));
          for (const o of strikeTargets) {
            const dmg = Math.round(m.fighter.stats.atk * 2.5);
            o.hp -= dmg;
            const knockAng = Math.atan2(o.y - m.y, o.x - m.x);
            o.vx += Math.cos(knockAng) * 8; o.vy += Math.sin(knockAng) * 8;
            texts.push({ x: o.x, y: o.y - o.baseRadius - 18, text: `-${dmg}`, color: "#38bdf8", life: 50, size: 20 });
            for (let k = 0; k < 12; k++) { particles.push({ x: o.x + (Math.random() - 0.5) * 15, y: o.y - k * 15 + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 2, life: 18, color: Math.random() > 0.3 ? "#38bdf8" : "#ffffff", size: 2 + Math.random() * 4 }); }
            rings.push({ x: o.x, y: o.y, radius: 5, maxRadius: o.baseRadius * 3, life: 18, maxLife: 18, color: "#38bdf8", lineWidth: 4 });
            o.flashTimer = 20;
          }
          // Activate sustained lightning aura for 5 seconds
          m.ultBuffTimer = 300;
          logs.push(isKo ? `${m.fighter.name} 번개 폭풍! ${strikeTargets.length}회 낙뢰 + 번개 오라!` : `${m.fighter.name} Thunder Storm! ${strikeTargets.length} strikes + lightning aura!`);
          break;
        }
        // ═══ 7. 불사조 — heal + fire AoE ═══
        case "phoenix": {
          const heal = Math.round(m.maxHp * 0.4);
          m.hp = Math.min(m.maxHp, m.hp + heal);
          texts.push({ x: m.x, y: m.y - m.baseRadius - 50, text: `+${heal} HP`, color: "#4ade80", life: 60, size: 22 });
          const fireR = 180;
          for (const o of others) {
            const dx = o.x - m.x, dy = o.y - m.y;
            if (dx * dx + dy * dy < fireR * fireR) {
              const dmg = Math.round(m.fighter.stats.atk * 2);
              o.hp -= dmg;
              texts.push({ x: o.x, y: o.y - o.baseRadius - 10, text: `-${dmg}`, color: "#f97316", life: 40, size: 16 });
            }
          }
          rings.push({ x: m.x, y: m.y, radius: 10, maxRadius: fireR, life: 30, maxLife: 30, color: "#f97316", lineWidth: 6 });
          for (let k = 0; k < 30; k++) { const a2 = Math.random() * Math.PI * 2; const sp = 2 + Math.random() * 5; particles.push({ x: m.x, y: m.y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp - 2, life: 30 + Math.random() * 20, color: Math.random() > 0.3 ? "#f97316" : "#fbbf24", size: 3 + Math.random() * 5 }); }
          logs.push(isKo ? `${m.fighter.name} 불사조! HP +${heal} + 화염 폭발!` : `${m.fighter.name} Phoenix! +${heal} HP + fire!`);
          break;
        }
        // ═══ 8. 메테오 — fly into strongest enemy, AoE impact + stun ═══
        case "meteor": {
          const strongest = others.reduce((a, b) => a.hp > b.hp ? a : b, others[0]);
          if (strongest) {
            const startX = m.x, startY = m.y;
            const dx = strongest.x - m.x, dy = strongest.y - m.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / dist, ny = dy / dist;
            // Teleport to target (meteor charge) — phase through collisions
            m.x = strongest.x - nx * (m.radius + strongest.radius + 5);
            m.y = strongest.y - ny * (m.radius + strongest.radius + 5);
            m.x = clamp(m.x, m.radius, W - m.radius);
            m.y = clamp(m.y, m.radius, H - m.radius);
            m.phaseTimer = 15; // pass through after meteor impact
            // Slash line showing flight path
            slashLines.push({ x1: startX, y1: startY, x2: m.x, y2: m.y, life: 35, maxLife: 35, color: "#dc2626", width: 10 });
            slashLines.push({ x1: startX, y1: startY, x2: m.x, y2: m.y, life: 30, maxLife: 30, color: "#f97316", width: 4 });
            // AoE impact on landing — damage + stun everyone in radius
            const impactR = 160;
            for (const o of others) {
              const odx = o.x - m.x, ody = o.y - m.y;
              const odist2 = odx * odx + ody * ody;
              if (odist2 < impactR * impactR) {
                const closeness = 1 - Math.sqrt(odist2) / impactR; // 1 at center, 0 at edge
                const dmg = Math.round(m.fighter.stats.atk * (3 + closeness * 2)); // 3x~5x based on proximity
                o.hp -= dmg;
                // Knockback away from impact
                const kAng = Math.atan2(ody, odx);
                o.vx += Math.cos(kAng) * (8 + closeness * 6);
                o.vy += Math.sin(kAng) * (8 + closeness * 6);
                // Stun (slow)
                o.slowTimer = Math.max(o.slowTimer, 180); // 3 seconds
                o.flashTimer = 20;
                texts.push({ x: o.x, y: o.y - o.baseRadius - 18, text: `-${dmg}`, color: "#dc2626", life: 60, size: 22 });
              }
            }
            // Impact visuals
            rings.push({ x: m.x, y: m.y, radius: 5, maxRadius: impactR, life: 30, maxLife: 30, color: "#dc2626", lineWidth: 7 });
            rings.push({ x: m.x, y: m.y, radius: 10, maxRadius: impactR * 0.6, life: 22, maxLife: 22, color: "#f97316", lineWidth: 4 });
            rings.push({ x: m.x, y: m.y, radius: 3, maxRadius: impactR * 0.4, life: 16, maxLife: 16, color: "#fbbf24", lineWidth: 2 });
            shake.value = Math.max(shake.value, 25);
            camera.slowMo = Math.max(camera.slowMo, 45);
            // Explosion particles
            for (let k = 0; k < 30; k++) { const a2 = Math.random() * Math.PI * 2; const sp = 3 + Math.random() * 6; particles.push({ x: m.x, y: m.y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp, life: 25 + Math.random() * 15, color: ["#dc2626", "#f97316", "#fbbf24"][Math.floor(Math.random() * 3)], size: 3 + Math.random() * 5 }); }
            // Fire trail along flight path
            for (let k = 0; k < 20; k++) {
              const t = Math.random();
              const fx = startX + (m.x - startX) * t + (Math.random() - 0.5) * 20;
              const fy = startY + (m.y - startY) * t + (Math.random() - 0.5) * 20;
              particles.push({ x: fx, y: fy, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, life: 20 + Math.random() * 10, color: Math.random() > 0.5 ? "#f97316" : "#dc2626", size: 2 + Math.random() * 4 });
            }
          }
          logs.push(isKo ? `${m.fighter.name} 메테오 돌진! ${strongest?.fighter.name} 착지 충격!` : `${m.fighter.name} Meteor Charge! Impact on ${strongest?.fighter.name}!`);
          break;
        }
        // ═══ 9. 빙결장 — deep freeze all enemies ═══
        case "frost-field": {
          const freezeR = W * 0.55;
          // Flash freeze all enemies
          for (const o of others) {
            o.freezeTimer = Math.max(o.freezeTimer, 360); // 6s deep freeze
            o.slowTimer = Math.max(o.slowTimer, 360);
            const dmg = Math.round(m.fighter.stats.atk * 1.5);
            o.hp -= dmg;
            o.vx *= 0.05; o.vy *= 0.05; // instantly near-stop
            texts.push({ x: o.x, y: o.y - o.baseRadius - 14, text: `-${dmg}`, color: "#22d3ee", life: 50, size: 18 });
            o.flashTimer = 25;
            // Ice encasing burst per enemy
            for (let k = 0; k < 10; k++) {
              const a2 = Math.random() * Math.PI * 2;
              const sp = 1 + Math.random() * 3;
              particles.push({ x: o.x, y: o.y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp, life: 35, color: Math.random() > 0.4 ? "#67e8f9" : "#cffafe", size: 2 + Math.random() * 4 });
            }
            // Ice shard ring on each enemy
            rings.push({ x: o.x, y: o.y, radius: 5, maxRadius: o.baseRadius * 2.5, life: 22, maxLife: 22, color: "#22d3ee", lineWidth: 3 });
          }
          // Expanding freeze wave from caster — multiple rings
          rings.push({ x: m.x, y: m.y, radius: 10, maxRadius: freezeR, life: 35, maxLife: 35, color: "#22d3ee", lineWidth: 6 });
          rings.push({ x: m.x, y: m.y, radius: 10, maxRadius: freezeR * 0.7, life: 28, maxLife: 28, color: "#67e8f9", lineWidth: 3 });
          rings.push({ x: m.x, y: m.y, radius: 10, maxRadius: freezeR * 0.4, life: 20, maxLife: 20, color: "#cffafe", lineWidth: 2 });
          // Snowflake particles spread across field
          for (let k = 0; k < 50; k++) {
            const a2 = Math.random() * Math.PI * 2;
            const r = Math.random() * freezeR;
            particles.push({ x: m.x + Math.cos(a2) * r, y: m.y + Math.sin(a2) * r, vx: (Math.random() - 0.5) * 1, vy: -0.5 - Math.random(), life: 50 + Math.random() * 20, color: Math.random() > 0.3 ? "#67e8f9" : "#ffffff", size: 2 + Math.random() * 4, char: Math.random() > 0.6 ? "❄" : undefined });
          }
          // Ground frost sparkle particles
          for (let k = 0; k < 30; k++) {
            const a2 = Math.random() * Math.PI * 2;
            const r = Math.random() * freezeR * 0.8;
            particles.push({ x: m.x + Math.cos(a2) * r, y: m.y + Math.sin(a2) * r, vx: 0, vy: 0, life: 40 + Math.random() * 20, color: "#e0f2fe", size: 1 + Math.random() * 2 });
          }
          // Activate sustained freeze aura
          m.ultBuffTimer = Math.max(m.ultBuffTimer, 360);
          camera.slowMo = Math.max(camera.slowMo, 30);
          shake.value = Math.max(shake.value, 8);
          logs.push(isKo ? `${m.fighter.name} 빙결장! 전원 빙결!` : `${m.fighter.name} Frost Field! All frozen!`);
          break;
        }
        // ═══ 10. 분노 폭발 — ATK x3 + hyper speed ═══
        case "rage-burst": {
          m.fighter.stats.atk = Math.round(m.fighter.stats.atk * 3);
          m.ultBuffTimer = 300; // 5 seconds
          m.rageMode = true;
          for (let k = 0; k < 25; k++) { const a2 = Math.random() * Math.PI * 2; const sp = 2 + Math.random() * 5; particles.push({ x: m.x, y: m.y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp, life: 30, color: Math.random() > 0.5 ? "#ef4444" : "#fbbf24", size: 3 + Math.random() * 5 }); }
          texts.push({ x: m.x, y: m.y - m.baseRadius - 50, text: "ATK ×3!", color: "#ef4444", life: 80, size: 24 });
          logs.push(isKo ? `${m.fighter.name} 분노 폭발! ATK 3배!` : `${m.fighter.name} Rage Burst! ATK x3!`);
          break;
        }
        // ═══ 11. 머신건 — 20 rapid-fire bullets ═══
        case "machine-gun": {
          const closest = others.reduce((a, b) => {
            const da = (a.x - m.x) ** 2 + (a.y - m.y) ** 2;
            const db = (b.x - m.x) ** 2 + (b.y - m.y) ** 2;
            return da < db ? a : b;
          }, others[0]);
          if (closest) {
            const dx = closest.x - m.x, dy = closest.y - m.y;
            const baseDist = Math.sqrt(dx * dx + dy * dy) || 1;
            const baseAng = Math.atan2(dy, dx);
            const bulletDmg = Math.round(m.fighter.stats.atk * 0.8);
            // Fire 20 bullets in a cone spread
            for (let bi = 0; bi < 20; bi++) {
              const spreadAng = baseAng + (bi - 10) * 0.04 + (Math.random() - 0.5) * 0.08;
              const bulletSpd = 10 + Math.random() * 2;
              projectiles.push({
                x: m.x + Math.cos(baseAng) * m.baseRadius * 1.2,
                y: m.y + Math.sin(baseAng) * m.baseRadius * 1.2,
                vx: Math.cos(spreadAng) * bulletSpd,
                vy: Math.sin(spreadAng) * bulletSpd,
                targetId: closest.fighter.channelId,
                ownerId: m.fighter.channelId,
                damage: bulletDmg,
                life: 60 + bi * 3, // staggered: later bullets live slightly longer
                color: col, size: 3,
                type: "bullet",
              });
            }
            // Muzzle flash particles
            for (let k = 0; k < 15; k++) {
              const a2 = baseAng + (Math.random() - 0.5) * 0.6;
              const sp = 3 + Math.random() * 4;
              particles.push({ x: m.x + Math.cos(baseAng) * m.baseRadius, y: m.y + Math.sin(baseAng) * m.baseRadius, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp, life: 12, color: Math.random() > 0.5 ? "#facc15" : "#ffffff", size: 2 + Math.random() * 3 });
            }
            camera.slowMo = Math.max(camera.slowMo, 35);
          }
          logs.push(isKo ? `${m.fighter.name} 머신건! 20발 연사!` : `${m.fighter.name} Machine Gun! 20 bullets!`);
          break;
        }
      }
    }
  }

  // ── Clone lifespan + ultBuffTimer decay ──
  for (const m of marbles) {
    if (m.isClone && m.alive) {
      m.cloneLife--;
      if (m.cloneLife <= 0) { m.alive = false; m.hp = 0; for (let k = 0; k < 5; k++) { const a = Math.random() * Math.PI * 2; particles.push({ x: m.x, y: m.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, life: 12, color: "#c084fc", size: 2 }); } }
    }
    if (m.ultBuffTimer > 0) {
      m.ultBuffTimer--;

      // ── Thunder Storm: sustained lightning aura tick ──
      const hasThunder = m.fighter.skills.some(s => s.id === "thunder-storm");
      if (hasThunder && m.alive) {
        const thunderRadius = 160;
        // ── Rotating lightning orbs every 2 frames (fast, dense) ──
        if (m.ultBuffTimer % 2 === 0) {
          const orbCount = 6;
          const baseAng = (frame * 0.25) % (Math.PI * 2);
          for (let k = 0; k < orbCount; k++) {
            const a2 = baseAng + (k / orbCount) * Math.PI * 2;
            const wobble = Math.sin(frame * 0.15 + k * 1.7) * 25;
            const r = thunderRadius * 0.55 + wobble;
            const px = m.x + Math.cos(a2) * r;
            const py = m.y + Math.sin(a2) * r;
            particles.push({ x: px, y: py, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 14, color: Math.random() > 0.3 ? "#38bdf8" : "#e0f2fe", size: 3 + Math.random() * 4 });
          }
          // Inner crackle sparks
          for (let k = 0; k < 3; k++) {
            const a2 = Math.random() * Math.PI * 2;
            const r2 = Math.random() * thunderRadius * 0.4;
            particles.push({ x: m.x + Math.cos(a2) * r2, y: m.y + Math.sin(a2) * r2, vx: Math.cos(a2) * (2 + Math.random() * 3), vy: Math.sin(a2) * (2 + Math.random() * 3), life: 8 + Math.random() * 6, color: "#ffffff", size: 1.5 + Math.random() * 2 });
          }
        }
        // ── Zigzag lightning arcs every 8 frames ──
        if (m.ultBuffTimer % 8 === 0) {
          const arcCount = 3;
          for (let k = 0; k < arcCount; k++) {
            const a2 = Math.random() * Math.PI * 2;
            const dist = thunderRadius * (0.3 + Math.random() * 0.7);
            // Create chain of particles forming a lightning bolt shape
            const segments = 4 + Math.floor(Math.random() * 3);
            for (let s = 0; s < segments; s++) {
              const t = s / segments;
              const jitter = (1 - t) * 12;
              const px = m.x + Math.cos(a2) * dist * t + (Math.random() - 0.5) * jitter;
              const py = m.y + Math.sin(a2) * dist * t + (Math.random() - 0.5) * jitter;
              particles.push({ x: px, y: py, vx: Math.cos(a2) * 1, vy: Math.sin(a2) * 1, life: 10 + Math.random() * 5, color: Math.random() > 0.5 ? "#38bdf8" : "#ffffff", size: 2.5 + Math.random() * 3 });
            }
          }
        }
        // ── Expanding ring pulse every 15 frames ──
        if (m.ultBuffTimer % 15 === 0) {
          rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.8, maxRadius: thunderRadius, life: 18, maxLife: 18, color: "#38bdf8", lineWidth: 3 });
          // Secondary thinner ring slightly delayed
          rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.5, maxRadius: thunderRadius * 0.7, life: 14, maxLife: 14, color: "#7dd3fc", lineWidth: 1.5 });
        }
        // ── Continuous glow ring (constant visual presence) every 3 frames ──
        if (m.ultBuffTimer % 3 === 0) {
          rings.push({ x: m.x, y: m.y, radius: thunderRadius * 0.85, maxRadius: thunderRadius, life: 5, maxLife: 5, color: "rgba(56,189,248,0.35)", lineWidth: 2 });
        }
        // Damage tick every 30 frames (~0.5s)
        if (m.ultBuffTimer % 30 === 0) {
          const nearby = alive.filter(o => o !== m && !o.isClone);
          for (const o of nearby) {
            const dx = o.x - m.x, dy = o.y - m.y;
            if (dx * dx + dy * dy < thunderRadius * thunderRadius) {
              const dmg = Math.round(m.fighter.stats.atk * 0.8);
              o.hp -= dmg;
              o.flashTimer = 10;
              texts.push({ x: o.x, y: o.y - o.baseRadius - 10, text: `-${dmg}`, color: "#38bdf8", life: 30, size: 16 });
              // Lightning strike from caster to target
              const sDx = o.x - m.x, sDy = o.y - m.y;
              const sDist = Math.sqrt(sDx * sDx + sDy * sDy) || 1;
              const sNx = sDx / sDist, sNy = sDy / sDist;
              for (let k = 0; k < 8; k++) {
                const t = k / 8;
                const jx = (Math.random() - 0.5) * 18;
                const jy = (Math.random() - 0.5) * 18;
                particles.push({ x: m.x + sNx * sDist * t + jx, y: m.y + sNy * sDist * t + jy, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 14, color: Math.random() > 0.4 ? "#38bdf8" : "#ffffff", size: 3 + Math.random() * 3 });
              }
              // Impact burst on target
              for (let k = 0; k < 6; k++) { const ang = Math.random() * Math.PI * 2; particles.push({ x: o.x, y: o.y, vx: Math.cos(ang) * 4, vy: Math.sin(ang) * 4, life: 15, color: "#38bdf8", size: 3 + Math.random() * 3 }); }
              rings.push({ x: o.x, y: o.y, radius: 5, maxRadius: o.baseRadius * 2.5, life: 14, maxLife: 14, color: "#38bdf8", lineWidth: 3 });
            }
          }
        }
        // Mild shake to feel the electricity (reduced from normal shake)
        if (m.ultBuffTimer % 10 === 0) {
          shake.value = Math.max(shake.value, 2);
        }
      }

      // ── Frost Field: sustained freeze aura tick ──
      const hasFrost = m.fighter.skills.some(s => s.id === "frost-field");
      if (hasFrost && m.alive) {
        const frostRadius = 180;
        // Re-apply freeze to anyone who enters range
        if (m.ultBuffTimer % 30 === 0) {
          for (const o of alive) {
            if (o === m || o.isClone) continue;
            const dx = o.x - m.x, dy = o.y - m.y;
            if (dx * dx + dy * dy < frostRadius * frostRadius) {
              o.freezeTimer = Math.max(o.freezeTimer, 90);
              o.slowTimer = Math.max(o.slowTimer, 90);
              const dmg = Math.round(m.fighter.stats.atk * 0.5);
              o.hp -= dmg;
              o.flashTimer = 6;
              texts.push({ x: o.x, y: o.y - o.baseRadius - 10, text: `-${dmg}`, color: "#22d3ee", life: 25, size: 13 });
              // Ice shard particles on hit
              for (let k = 0; k < 4; k++) {
                const a2 = Math.random() * Math.PI * 2;
                particles.push({ x: o.x, y: o.y, vx: Math.cos(a2) * 2, vy: Math.sin(a2) * 2 - 1, life: 18, color: Math.random() > 0.5 ? "#67e8f9" : "#ffffff", size: 2 + Math.random() * 3 });
              }
            }
          }
        }
        // Frost particles swirling around caster
        if (m.ultBuffTimer % 3 === 0) {
          const orbCount = 4;
          const baseAng = (frame * 0.12) % (Math.PI * 2);
          for (let k = 0; k < orbCount; k++) {
            const a2 = baseAng + (k / orbCount) * Math.PI * 2;
            const r = frostRadius * 0.5 + Math.sin(frame * 0.08 + k * 2) * 20;
            particles.push({ x: m.x + Math.cos(a2) * r, y: m.y + Math.sin(a2) * r, vx: 0, vy: -0.5, life: 16, color: Math.random() > 0.3 ? "#67e8f9" : "#cffafe", size: 2 + Math.random() * 3 });
          }
        }
        // Frost ring pulse
        if (m.ultBuffTimer % 18 === 0) {
          rings.push({ x: m.x, y: m.y, radius: m.baseRadius, maxRadius: frostRadius, life: 16, maxLife: 16, color: "#22d3ee", lineWidth: 2 });
        }
        // Falling snowflakes
        if (m.ultBuffTimer % 8 === 0) {
          for (let k = 0; k < 3; k++) {
            const a2 = Math.random() * Math.PI * 2;
            const r = Math.random() * frostRadius;
            particles.push({ x: m.x + Math.cos(a2) * r, y: m.y + Math.sin(a2) * r - 20, vx: (Math.random() - 0.5) * 0.5, vy: 0.5 + Math.random() * 0.5, life: 30, color: "#e0f2fe", size: 2 + Math.random() * 2, char: Math.random() > 0.5 ? "❄" : undefined });
          }
        }
      }

      if (m.ultBuffTimer === 0) {
        const hasRage = m.fighter.skills.some(s => s.id === "rage-burst");
        if (hasRage) {
          // Revert rage-burst
          m.fighter.stats.atk = Math.round(m.fighter.stats.atk / 3);
          m.rageMode = false;
        }
        texts.push({ x: m.x, y: m.y - m.baseRadius - 20, text: isKo ? "버프 종료" : "Buff end", color: "#71717a", life: 40, size: 12 });
      }
    }
  }

  // ── Skill: E (periodic) & R (threshold/onKill) processing ──
  for (const m of alive) {
    m.skillTimer++;
    if (m.skillBuff > 0) m.skillBuff--;
    if (m.slowTimer > 0) m.slowTimer--;
    if (m.atkDebuffTimer > 0) m.atkDebuffTimer--;

    // ── Ult gauge: passive regen over time (1 per 60 frames ≈ 1/sec) ──
    if (!m.ultFired && !m.isClone && frame % 60 === 0) {
      m.ultGauge = Math.min(100, m.ultGauge + 1);
    }

    const hpPct = m.hp / m.maxHp;

    for (const sk of m.fighter.skills) {
      // ── E: Periodic skills ──
      if (sk.type === "periodic" && sk.interval && m.skillTimer >= sk.interval) {
        m.skillTimer = 0;
        const sName = isKo ? sk.nameKo : sk.nameEn;
        switch (sk.id) {
          case "regen": case "heal-burst": {
            const rate = sk.id === "heal-burst" ? 0.05 : 0.03;
            const heal = Math.round(m.maxHp * rate);
            m.hp = Math.min(m.maxHp, m.hp + heal);
            texts.push({ x: m.x, y: m.y - m.baseRadius - 18, text: `[E] +${heal}`, color: sk.color, life: 40, size: 14 });
            // Green sparkle
            for (let k = 0; k < 6; k++) { const ang = Math.random() * Math.PI * 2; particles.push({ x: m.x, y: m.y, vx: Math.cos(ang) * 2, vy: Math.sin(ang) * 2 - 1, life: 20, color: sk.color, size: 3 + Math.random() * 2 }); }
            break;
          }
          case "power-up": case "bloodlust": {
            m.fighter.stats.atk = Math.min(Math.round(m.fighter.stats.atk * 1.04), 95);
            if (sk.id === "bloodlust") m.fighter.stats.spd = Math.min(m.fighter.stats.spd + 1, 25);
            texts.push({ x: m.x, y: m.y - m.baseRadius - 18, text: `[E] ATK UP`, color: sk.color, life: 40, size: 14 });
            rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.5, maxRadius: m.baseRadius * 1.8, life: 18, maxLife: 18, color: sk.color, lineWidth: 2 });
            break;
          }
          case "fortify": {
            m.fighter.stats.def = Math.min(m.fighter.stats.def + 1, 40);
            texts.push({ x: m.x, y: m.y - m.baseRadius - 18, text: `[E] DEF +1`, color: sk.color, life: 40, size: 14 });
            // Blue shield flash
            rings.push({ x: m.x, y: m.y, radius: m.baseRadius, maxRadius: m.baseRadius * 1.5, life: 15, maxLife: 15, color: "#60a5fa", lineWidth: 3 });
            break;
          }
          case "war-cry": {
            for (const other of alive) {
              if (other === m) continue;
              const dx = other.x - m.x, dy = other.y - m.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 160) { other.atkDebuffTimer = Math.max(other.atkDebuffTimer, 100); }
            }
            texts.push({ x: m.x, y: m.y - m.baseRadius - 24, text: `[E] ${sName}`, color: sk.color, life: 50, size: 16 });
            rings.push({ x: m.x, y: m.y, radius: m.baseRadius, maxRadius: 160, life: 22, maxLife: 22, color: sk.color, lineWidth: 3 });
            for (let k = 0; k < 10; k++) { const ang = Math.random() * Math.PI * 2; const sp = 2 + Math.random() * 3; particles.push({ x: m.x, y: m.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 25, color: sk.color, size: 2 + Math.random() * 3 }); }
            break;
          }
          case "mana-burn": {
            let nearest: Marble | null = null, nearDist = Infinity;
            for (const other of alive) {
              if (other === m) continue;
              const dx = other.x - m.x, dy = other.y - m.y;
              const d = dx * dx + dy * dy;
              if (d < nearDist) { nearDist = d; nearest = other; }
            }
            if (nearest) {
              const burn = Math.round(nearest.maxHp * 0.02);
              nearest.hp -= burn;
              texts.push({ x: nearest.x, y: nearest.y - nearest.baseRadius - 14, text: `-${burn}`, color: sk.color, life: 35, size: 13 });
              // Purple line from m to nearest
              for (let k = 0; k < 4; k++) { const t2 = Math.random(); particles.push({ x: m.x + (nearest.x - m.x) * t2, y: m.y + (nearest.y - m.y) * t2, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 12, color: sk.color, size: 2 + Math.random() * 2 }); }
            }
            break;
          }
          case "aura-of-speed": break; // passive, handled in movement
          default: break;
        }
      }

      // (R is gauge-based now, processed separately below)
    }

    // ── R: Ultimate gauge check — fire when gauge reaches 100 ──
    if (!m.ultFired && m.ultGauge >= 100) {
      const rSkill = m.fighter.skills.find(s => s.slot === "R");
      if (rSkill) {
        m.ultFired = true;
        m.ultGauge = 100;
        m.skillActivated = true;
        m.skillBuff = 99999;
        const skillName = isKo ? rSkill.nameKo : rSkill.nameEn;

        // ── R activation (text deferred to post-cutIn) ──
        logs.push(isKo
          ? `[궁극기] ${m.fighter.name} — ${skillName} 발동!`
          : `[ULTIMATE] ${m.fighter.name} — ${skillName} activated!`);

        // ── FREEZE + camera zoom + CUT-IN for R (no shake!) ──
        camera.targetX = m.x;
        camera.targetY = m.y;
        camera.targetZoom = 1.8;
        camera.slowMo = Math.max(camera.slowMo, 90);
        camera.cutIn = {
          name: m.fighter.name,
          skillName: skillName,
          skillColor: rSkill.color,
          channelId: m.fighter.channelId,
          startFrame: frame,
          duration: 80,
        };
        m.ultEffectPending = true; // explosion + R effects deferred to after cut-in
      }
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
        const baseForce = 0.03 + (m.fighter.stats.atk / 110) * 0.035;
        const force = m.rageMode ? baseForce * 1.6 : baseForce;
        m.vx += (dx / dist) * force;
        m.vy += (dy / dist) * force;
      }
    }

    const chaos = 1 + frame * 0.0003;
    m.vx += (Math.random() - 0.5) * 0.08 * chaos;
    m.vy += (Math.random() - 0.5) * 0.08 * chaos;

    let maxSpd = 1.6 + (m.fighter.stats.spd / 20) * 2.8;
    maxSpd *= (1 + frame * 0.0002);
    const mHas = (id: string) => m.fighter.skills.some(s => s.id === id);
    if (mHas("aura-of-speed")) maxSpd *= 1.3;
    if (mHas("adrenaline") && m.skillBuff > 0) maxSpd *= 1.5;
    if (m.ultBuffTimer > 0 && m.fighter.skills.some(s => s.id === "rage-burst")) maxSpd *= 2;
    if (m.freezeTimer > 0) maxSpd *= 0.12;       // deep freeze: nearly immobile
    else if (m.slowTimer > 0) maxSpd *= 0.6;
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
    if (m.phaseTimer > 0) m.phaseTimer--;
    if (m.freezeTimer > 0) m.freezeTimer--;
  }

  // Collisions
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (!a.alive || !b.alive) continue;
      // Skip collision if either marble is phasing (flash-slash dash)
      if (a.phaseTimer > 0 || b.phaseTimer > 0) continue;
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
      const spdF = clamp(0.6 + relSpeed / 8, 0.6, 1.8);
      const timeScale = 1 + frame * 0.00008;

      let atkA = a.fighter.stats.atk, atkB = b.fighter.stats.atk;
      if (a.atkDebuffTimer > 0) atkA = Math.round(atkA * 0.9);
      if (b.atkDebuffTimer > 0) atkB = Math.round(atkB * 0.9);
      let defA = a.fighter.stats.def, defB = b.fighter.stats.def;
      let critChanceA = a.fighter.stats.crit, critChanceB = b.fighter.stats.crit;
      const hpPctA = a.hp / a.maxHp, hpPctB = b.hp / b.maxHp;

      // ── Generic skill modifiers (all skills for each fighter) ──
      const skillsA = a.fighter.skills, skillsB = b.fighter.skills;
      const hasSkillA = (id: string) => skillsA.some(s => s.id === id);
      const hasSkillB = (id: string) => skillsB.some(s => s.id === id);

      // Threshold ATK buffs (moderate — E-slot handled)
      if (a.skillBuff > 0) {
        if (hasSkillA("adrenaline")) { /* handled in speed section */ }
        else atkA = Math.round(atkA * 1.15);
      }
      if (b.skillBuff > 0) {
        if (hasSkillB("adrenaline")) { /* handled in speed section */ }
        else atkB = Math.round(atkB * 1.15);
      }

      // ── Q: onAttack crit modifiers ──
      if (hasSkillA("critical-eye")) critChanceA *= 2;
      if (hasSkillB("critical-eye")) critChanceB *= 2;

      // Q: armor break
      if (hasSkillA("armor-break")) defB = 0;
      if (hasSkillB("armor-break")) defA = 0;

      const critA = Math.random() * 100 < critChanceA;
      let dmgA = atkA * spdF * (0.85 + Math.random() * 0.3);
      if (a.rageMode) dmgA *= 1.25;
      if (critA) dmgA *= 1.6;
      // Q: attack skills for A (additive bonus, not multiplicative)
      let bonusA = 0;
      if (hasSkillA("power-strike") && Math.random() < 0.25) { bonusA += dmgA * 0.5; texts.push({ x: a.x, y: a.y - a.baseRadius - 30, text: "[Q] POWER!", color: "#ef4444", life: 35, size: 16 }); }
      if (hasSkillA("chaos-strike")) { const good = Math.random() < 0.5; bonusA += good ? dmgA * 0.4 : -dmgA * 0.2; if (good) texts.push({ x: a.x, y: a.y - a.baseRadius - 28, text: "[Q] CHAOS!", color: "#f97316", life: 30, size: 14 }); }
      if (hasSkillA("double-tap") && Math.random() < 0.2) { bonusA += dmgA * 0.5; texts.push({ x: a.x, y: a.y - a.baseRadius - 28, text: "[Q] x2!", color: "#fb923c", life: 30, size: 14 }); }
      if (hasSkillA("execute") && hpPctB < 0.3) { bonusA += dmgA * 0.6; texts.push({ x: b.x, y: b.y - b.baseRadius - 30, text: "[Q] EXECUTE!", color: "#7f1d1d", life: 40, size: 18 }); rings.push({ x: b.x, y: b.y, radius: b.baseRadius, maxRadius: b.baseRadius * 2.5, life: 18, maxLife: 18, color: "#7f1d1d", lineWidth: 3 }); }
      if (hasSkillA("chain-lightning") && Math.random() < 0.1) { bonusA += dmgA * 1.0; texts.push({ x: a.x, y: a.y - a.baseRadius - 30, text: "[Q] THUNDER!", color: "#38bdf8", life: 40, size: 18 }); shake.value = Math.max(shake.value, 6); for (let k = 0; k < 8; k++) { const ang2 = Math.random() * Math.PI * 2; particles.push({ x: b.x, y: b.y, vx: Math.cos(ang2) * 4, vy: Math.sin(ang2) * 4, life: 20, color: "#38bdf8", size: 3 + Math.random() * 3 }); } }
      if (hasSkillA("blaze")) bonusA += 15;
      dmgA += bonusA;
      // DEF: 비율 감소 (DEF 25 → 약 33% 감소)
      const defReductionB = 1 - (defB / (defB + 50));
      dmgA = Math.max(1, Math.round(dmgA * defReductionB));

      const critB = Math.random() * 100 < critChanceB;
      let dmgB = atkB * spdF * (0.85 + Math.random() * 0.3);
      if (b.rageMode) dmgB *= 1.25;
      if (critB) dmgB *= 1.6;
      let bonusB = 0;
      if (hasSkillB("power-strike") && Math.random() < 0.25) { bonusB += dmgB * 0.5; texts.push({ x: b.x, y: b.y - b.baseRadius - 30, text: "[Q] POWER!", color: "#ef4444", life: 35, size: 16 }); }
      if (hasSkillB("chaos-strike")) { const good = Math.random() < 0.5; bonusB += good ? dmgB * 0.4 : -dmgB * 0.2; if (good) texts.push({ x: b.x, y: b.y - b.baseRadius - 28, text: "[Q] CHAOS!", color: "#f97316", life: 30, size: 14 }); }
      if (hasSkillB("double-tap") && Math.random() < 0.2) { bonusB += dmgB * 0.5; texts.push({ x: b.x, y: b.y - b.baseRadius - 28, text: "[Q] x2!", color: "#fb923c", life: 30, size: 14 }); }
      if (hasSkillB("execute") && hpPctA < 0.3) { bonusB += dmgB * 0.6; texts.push({ x: a.x, y: a.y - a.baseRadius - 30, text: "[Q] EXECUTE!", color: "#7f1d1d", life: 40, size: 18 }); rings.push({ x: a.x, y: a.y, radius: a.baseRadius, maxRadius: a.baseRadius * 2.5, life: 18, maxLife: 18, color: "#7f1d1d", lineWidth: 3 }); }
      if (hasSkillB("chain-lightning") && Math.random() < 0.1) { bonusB += dmgB * 1.0; texts.push({ x: b.x, y: b.y - b.baseRadius - 30, text: "[Q] THUNDER!", color: "#38bdf8", life: 40, size: 18 }); shake.value = Math.max(shake.value, 6); for (let k = 0; k < 8; k++) { const ang2 = Math.random() * Math.PI * 2; particles.push({ x: a.x, y: a.y, vx: Math.cos(ang2) * 4, vy: Math.sin(ang2) * 4, life: 20, color: "#38bdf8", size: 3 + Math.random() * 3 }); } }
      if (hasSkillB("blaze")) bonusB += 15;
      dmgB += bonusB;
      const defReductionA = 1 - (defA / (defA + 50));
      dmgB = Math.max(1, Math.round(dmgB * defReductionA));

      // ── Element advantage ──
      const elemMulA = getElementAdvantage(a.fighter.element, b.fighter.element);
      const elemMulB = getElementAdvantage(b.fighter.element, a.fighter.element);
      if (elemMulA !== 1.0) {
        dmgA = Math.max(1, Math.round(dmgA * elemMulA));
        const eInfo = ELEMENT_INFO[a.fighter.element];
        if (elemMulA > 1) {
          texts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 20, text: `${eInfo.icon} 속성 유리!`, color: eInfo.color, life: 40, size: 15 });
          for (let k = 0; k < 5; k++) { const ang2 = Math.random() * Math.PI * 2; particles.push({ x: b.x, y: b.y, vx: Math.cos(ang2) * 3, vy: Math.sin(ang2) * 3, life: 18, color: eInfo.color, size: 2 + Math.random() * 3 }); }
        } else {
          texts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 20, text: "속성 불리...", color: "#9ca3af", life: 35, size: 13 });
        }
      }
      if (elemMulB !== 1.0) {
        dmgB = Math.max(1, Math.round(dmgB * elemMulB));
        const eInfo = ELEMENT_INFO[b.fighter.element];
        if (elemMulB > 1) {
          texts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 10, text: `${eInfo.icon} 속성 유리!`, color: eInfo.color, life: 40, size: 15 });
          for (let k = 0; k < 5; k++) { const ang2 = Math.random() * Math.PI * 2; particles.push({ x: a.x, y: a.y, vx: Math.cos(ang2) * 3, vy: Math.sin(ang2) * 3, life: 18, color: eInfo.color, size: 2 + Math.random() * 3 }); }
        } else {
          texts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 10, text: "속성 불리...", color: "#9ca3af", life: 35, size: 13 });
        }
      }

      // ── W: onDamaged modifiers ──
      let dodgedA = false, dodgedB = false;
      for (const sk of skillsB) {
        if (sk.id === "iron-wall") dmgA = Math.round(dmgA * 0.8);
        if (sk.id === "rubber-body") { dmgA = Math.round(dmgA * 0.85); a.hp -= Math.round(dmgA * 0.1); }
        if (sk.id === "thick-skin" && critA) dmgA = Math.round(dmgA * 0.5);
        if (sk.id === "dodge-master" && Math.random() < 0.15) { dmgA = 0; dodgedB = true; texts.push({ x: b.x, y: b.y - b.baseRadius - 28, text: "[W] DODGE!", color: "#c084fc", life: 35, size: 16 }); }
        if (sk.id === "counter") { const ref = Math.round(dmgA * 0.25); a.hp -= ref; if (ref > 0) texts.push({ x: a.x, y: a.y - a.baseRadius - 20, text: `[W] -${ref}`, color: "#f472b6", life: 30, size: 13 }); }
        if (sk.id === "bone-plate") { b.bpCount++; if (b.bpCount % 4 === 0) { dmgA = 0; texts.push({ x: b.x, y: b.y - b.baseRadius - 28, text: "[W] BLOCK!", color: "#a3a3a3", life: 35, size: 16 }); rings.push({ x: b.x, y: b.y, radius: b.baseRadius, maxRadius: b.baseRadius * 1.5, life: 12, maxLife: 12, color: "#a3a3a3", lineWidth: 3 }); } }
        if (sk.id === "thorn-mail") { const ref2 = Math.round(dmgA * 0.2); a.hp -= ref2; a.slowTimer = Math.max(a.slowTimer, 60); if (ref2 > 0) { texts.push({ x: a.x, y: a.y - a.baseRadius - 20, text: `[W] -${ref2}`, color: "#65a30d", life: 30, size: 13 }); for (let k = 0; k < 4; k++) { const ang2 = Math.random() * Math.PI * 2; particles.push({ x: a.x, y: a.y, vx: Math.cos(ang2) * 2, vy: Math.sin(ang2) * 2, life: 15, color: "#65a30d", size: 2 + Math.random() * 2 }); } } }
        if (sk.id === "spirit-shield" && hpPctB < 0.5) dmgA = Math.round(dmgA * 0.7);
      }
      for (const sk of skillsA) {
        if (sk.id === "iron-wall") dmgB = Math.round(dmgB * 0.8);
        if (sk.id === "rubber-body") { dmgB = Math.round(dmgB * 0.85); b.hp -= Math.round(dmgB * 0.1); }
        if (sk.id === "thick-skin" && critB) dmgB = Math.round(dmgB * 0.5);
        if (sk.id === "dodge-master" && Math.random() < 0.15) { dmgB = 0; dodgedA = true; texts.push({ x: a.x, y: a.y - a.baseRadius - 28, text: "[W] DODGE!", color: "#c084fc", life: 35, size: 16 }); }
        if (sk.id === "counter") { const ref = Math.round(dmgB * 0.25); b.hp -= ref; if (ref > 0) texts.push({ x: b.x, y: b.y - b.baseRadius - 20, text: `[W] -${ref}`, color: "#f472b6", life: 30, size: 13 }); }
        if (sk.id === "bone-plate") { a.bpCount++; if (a.bpCount % 4 === 0) { dmgB = 0; texts.push({ x: a.x, y: a.y - a.baseRadius - 28, text: "[W] BLOCK!", color: "#a3a3a3", life: 35, size: 16 }); rings.push({ x: a.x, y: a.y, radius: a.baseRadius, maxRadius: a.baseRadius * 1.5, life: 12, maxLife: 12, color: "#a3a3a3", lineWidth: 3 }); } }
        if (sk.id === "thorn-mail") { const ref2 = Math.round(dmgB * 0.2); b.hp -= ref2; b.slowTimer = Math.max(b.slowTimer, 60); if (ref2 > 0) { texts.push({ x: b.x, y: b.y - b.baseRadius - 20, text: `[W] -${ref2}`, color: "#65a30d", life: 30, size: 13 }); for (let k = 0; k < 4; k++) { const ang2 = Math.random() * Math.PI * 2; particles.push({ x: b.x, y: b.y, vx: Math.cos(ang2) * 2, vy: Math.sin(ang2) * 2, life: 15, color: "#65a30d", size: 2 + Math.random() * 2 }); } } }
        if (sk.id === "spirit-shield" && hpPctA < 0.5) dmgB = Math.round(dmgB * 0.7);
      }

      // Q: slow/venom
      if (hasSkillA("venom") && dmgA > 0 && !dodgedB) { b.slowTimer = 120; for (let k = 0; k < 4; k++) { const ang2 = Math.random() * Math.PI * 2; particles.push({ x: b.x, y: b.y, vx: Math.cos(ang2) * 1.5, vy: Math.sin(ang2) * 1.5, life: 25, color: "#a855f7", size: 2 + Math.random() * 2 }); } }
      if (hasSkillB("venom") && dmgB > 0 && !dodgedA) { a.slowTimer = 120; for (let k = 0; k < 4; k++) { const ang2 = Math.random() * Math.PI * 2; particles.push({ x: a.x, y: a.y, vx: Math.cos(ang2) * 1.5, vy: Math.sin(ang2) * 1.5, life: 25, color: "#a855f7", size: 2 + Math.random() * 2 }); } }

      // Q: life steal
      if (hasSkillA("life-steal") && dmgA > 0) { const lsHeal = Math.round(dmgA * 0.15); a.hp = Math.min(a.maxHp, a.hp + lsHeal); texts.push({ x: a.x, y: a.y - a.baseRadius - 22, text: `[Q] +${lsHeal}`, color: "#e11d48", life: 30, size: 12 }); }
      if (hasSkillB("life-steal") && dmgB > 0) { const lsHeal = Math.round(dmgB * 0.15); b.hp = Math.min(b.maxHp, b.hp + lsHeal); texts.push({ x: b.x, y: b.y - b.baseRadius - 22, text: `[Q] +${lsHeal}`, color: "#e11d48", life: 30, size: 12 }); }

      dmgA = Math.round(dmgA * timeScale);
      dmgB = Math.round(dmgB * timeScale);

      b.hp -= dmgA; a.hp -= dmgB;
      a.fighter.totalDamage += dmgA; b.fighter.totalDamage += dmgB;
      if (critA) a.fighter.critsLanded++;
      if (critB) b.fighter.critsLanded++;

      // ── Ult gauge charge on hit ──
      if (!a.ultFired) {
        let chg = 4 + Math.min(3, Math.round(dmgA / 40));
        if (critA) chg += 3;
        a.ultGauge = Math.min(100, a.ultGauge + chg);
      }
      if (!b.ultFired) {
        let chg = 4 + Math.min(3, Math.round(dmgB / 40));
        if (critB) chg += 3;
        b.ultGauge = Math.min(100, b.ultGauge + chg);
      }

      for (let k = 0; k < Math.min(5, Math.ceil(dmgB / 60)); k++) {
        const ang = Math.random() * Math.PI * 2;
        particles.push({ x: a.x, y: a.y, vx: Math.cos(ang) * (1.2 + Math.random() * 2.5), vy: Math.sin(ang) * (1.2 + Math.random() * 2.5) - 1.5, life: 28 + Math.random() * 16, color: "#f87171", size: 6 + Math.random() * 3 });
      }
      for (let k = 0; k < Math.min(5, Math.ceil(dmgA / 60)); k++) {
        const ang = Math.random() * Math.PI * 2;
        particles.push({ x: b.x, y: b.y, vx: Math.cos(ang) * (1.2 + Math.random() * 2.5), vy: Math.sin(ang) * (1.2 + Math.random() * 2.5) - 1.5, life: 28 + Math.random() * 16, color: "#f87171", size: 6 + Math.random() * 3 });
      }

      const knockA = 1, knockB = 1;

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
        if (m.isClone) return; // clones just disappear silently
        killer.fighter.kills++;
        m.fighter.deathOrder = frame;
        shake.value = Math.max(shake.value, 14);

        // ── Kill banner (NO slow-mo, slow-mo is only for R) ──
        camera.killEvents.push({
          killerName: killer.fighter.name,
          victimName: m.fighter.name,
          killerThumb: killer.fighter.thumbnailUrl,
          victimThumb: m.fighter.thumbnailUrl,
          frame,
        });

        // ── Ult gauge: big charge on kill (+30) ──
        if (!killer.ultFired) {
          killer.ultGauge = Math.min(100, killer.ultGauge + 15);
        }

        const absorbRate = 0.2;

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

  // ── Projectile homing + collision ──
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life--;
    if (p.life <= 0) { projectiles.splice(i, 1); continue; }

    // Homing: steer toward target (skip for bullets — they fly straight)
    if (p.type !== "bullet") {
      const tgt = alive.find(m => m.fighter.channelId === p.targetId);
      if (tgt) {
        const dx = tgt.x - p.x, dy = tgt.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          const steer = 0.35;
          p.vx += (dx / dist) * steer;
          p.vy += (dy / dist) * steer;
        }
        // Hit detection
        if (dist < tgt.radius + p.size) {
          tgt.hp -= p.damage;
          tgt.flashTimer = 12;
          texts.push({ x: tgt.x, y: tgt.y - tgt.baseRadius - 12, text: `-${p.damage}`, color: p.color, life: 40, size: 16 });
          rings.push({ x: p.x, y: p.y, radius: 3, maxRadius: p.size * 4, life: 14, maxLife: 14, color: p.color, lineWidth: 3 });
          for (let k = 0; k < 6; k++) { const a = Math.random() * Math.PI * 2; particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 15, color: p.color, size: 2 + Math.random() * 2 }); }
          shake.value = Math.max(shake.value, 4);
          projectiles.splice(i, 1);
          continue;
        }
      }
    } else {
      // Bullet: straight-line collision with ANY enemy
      for (const tgt of alive) {
        if (tgt.fighter.channelId === p.ownerId) continue;
        const dx = tgt.x - p.x, dy = tgt.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < tgt.radius + p.size) {
          tgt.hp -= p.damage;
          tgt.flashTimer = 8;
          texts.push({ x: tgt.x, y: tgt.y - tgt.baseRadius - 12, text: `-${p.damage}`, color: p.color, life: 35, size: 14 });
          for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2; particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, life: 10, color: "#fff", size: 1.5 + Math.random() * 1.5 }); }
          shake.value = Math.max(shake.value, 2);
          projectiles.splice(i, 1);
          break;
        }
      }
      if (!projectiles[i] || projectiles[i] !== p) continue; // was spliced
    }

    // Speed cap (higher for bullets)
    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const maxPSpd = p.type === "bullet" ? 14 : 6;
    if (spd > maxPSpd) { p.vx = (p.vx / spd) * maxPSpd; p.vy = (p.vy / spd) * maxPSpd; }

    p.x += p.vx; p.y += p.vy;
    // Trail particle
    if (frame % 2 === 0) particles.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 10, color: p.color, size: p.size * 0.5 });
  }

  // ── SlashLine life countdown ──
  for (let i = slashLines.length - 1; i >= 0; i--) {
    slashLines[i].life--;
    if (slashLines[i].life <= 0) slashLines.splice(i, 1);
  }
}

/* ─── FX helpers ─── */
function drawLightningBolt(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, width: number, segments: number = 6, jitter: number = 18
) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / dist, ny = dy / dist;
  // perpendicular
  const px = -ny, py = nx;
  const points: { x: number; y: number }[] = [{ x: x1, y: y1 }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const mx = x1 + dx * t;
    const my = y1 + dy * t;
    const offset = (Math.random() - 0.5) * jitter * 2;
    points.push({ x: mx + px * offset, y: my + py * offset });
  }
  points.push({ x: x2, y: y2 });
  // Wide glow layer
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.strokeStyle = color;
  ctx.lineWidth = width * 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
  // Color core
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
  // White-hot center
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, width * 0.35);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
  // Branch off (small fork near midpoint)
  if (segments >= 4 && jitter > 10) {
    const bi = Math.floor(segments * 0.4) + Math.floor(Math.random() * 2);
    if (bi < points.length) {
      const bp = points[bi];
      const forkAng = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.2;
      const forkLen = dist * (0.2 + Math.random() * 0.15);
      const fx = bp.x + Math.cos(forkAng) * forkLen;
      const fy = bp.y + Math.sin(forkAng) * forkLen;
      drawLightningBolt(ctx, bp.x, bp.y, fx, fy, color, width * 0.5, 3, jitter * 0.5);
    }
  }
}

/* ─── Canvas draw ─── */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  marbles: Marble[], texts: FloatingText[], particles: Particle[], rings: Ring[],
  projectiles: Projectile[], slashLines: SlashLine[],
  W: number, H: number, frame: number,
  thumbMap: Map<string, HTMLImageElement>,
  shake: number,
  camera: Camera,
) {
  ctx.save();

  // ── Camera: smooth follow + zoom ──
  const lerpSpd = 0.06;
  camera.x += (camera.targetX - camera.x) * lerpSpd;
  camera.y += (camera.targetY - camera.y) * lerpSpd;
  camera.zoom += (camera.targetZoom - camera.zoom) * lerpSpd;

  // When slow-mo ends, ease back to full view
  if (camera.slowMo <= 0) {
    camera.targetX = W / 2;
    camera.targetY = H / 2;
    camera.targetZoom = 1;
  }

  const zoom = camera.zoom;
  const camX = camera.x;
  const camY = camera.y;

  // Apply camera transform
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  if (shake > 0.3) {
    // Divide by zoom so shake amplitude stays constant regardless of zoom level
    const sx = (Math.random() - 0.5) * shake * 2.5 / zoom;
    const sy = (Math.random() - 0.5) * shake * 2.5 / zoom;
    ctx.translate(sx, sy);
  }

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(-W, -H, W * 3, H * 3);

  const gridAlpha = 0.12 + Math.sin(frame * 0.01) * 0.04;
  ctx.strokeStyle = `rgba(63, 63, 70, ${gridAlpha})`;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  ctx.strokeStyle = "rgba(239, 68, 68, 0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  const alive = marbles.filter(m => m.alive);

  // ── Ring FX: glow + gradient fade ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const r of rings) {
    const progress = 1 - r.life / r.maxLife;
    const currentR = r.radius + (r.maxRadius - r.radius) * progress;
    const fadeAlpha = (1 - progress) * 0.6;
    const lw = r.lineWidth * (1 - progress * 0.5);
    // Outer glow layer (wide, soft)
    ctx.save();
    ctx.globalAlpha = fadeAlpha * 0.35;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(r.x, r.y, currentR, 0, Math.PI * 2);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = lw * 3;
    ctx.stroke();
    ctx.restore();
    // Core ring (sharp, bright)
    ctx.globalAlpha = fadeAlpha;
    ctx.beginPath();
    ctx.arc(r.x, r.y, currentR, 0, Math.PI * 2);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = lw;
    ctx.stroke();
    // Inner white highlight
    ctx.globalAlpha = fadeAlpha * 0.4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, currentR, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(0.5, lw * 0.3);
    ctx.stroke();
  }
  ctx.restore();
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

  // ── Trail FX: gradient ribbons with glow ──
  for (const m of alive) {
    if (m.trail.length >= 2) {
      // Draw connected gradient trail
      const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      const spdAlpha = Math.min(1, spd / 4); // Only show trail when moving
      if (spdAlpha > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 1; i < m.trail.length; i++) {
          const t0 = m.trail[i - 1];
          const t1 = m.trail[i];
          const frac = (i + 1) / m.trail.length;
          const alpha = frac * 0.22 * spdAlpha;
          const sz = m.radius * frac * 0.5;
          // Gradient orb at trail point
          const grad = ctx.createRadialGradient(t1.x, t1.y, 0, t1.x, t1.y, sz);
          grad.addColorStop(0, m.color);
          grad.addColorStop(0.6, m.color + "80");
          grad.addColorStop(1, "transparent");
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(t1.x, t1.y, sz, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          // Connecting line segment
          if (i > 0) {
            ctx.globalAlpha = alpha * 0.6;
            ctx.beginPath();
            ctx.moveTo(t0.x, t0.y);
            ctx.lineTo(t1.x, t1.y);
            ctx.strokeStyle = m.color;
            ctx.lineWidth = sz * 0.5;
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }
        ctx.restore();
      }
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

    // ── Frost Field aura glow ──
    if (m.ultBuffTimer > 0 && m.fighter.skills.some(s => s.id === "frost-field")) {
      const fPulse = 0.4 + Math.sin(frame * 0.1) * 0.2;
      const fAuraR = displayR + 22 + Math.sin(frame * 0.08) * 5;
      ctx.save();
      ctx.globalAlpha = fPulse * 0.5;
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(m.x, m.y, fAuraR, 0, Math.PI * 2);
      ctx.strokeStyle = "#67e8f9";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = fPulse * 0.25;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "#cffafe";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // ── Thunder Storm aura glow + lightning arcs ──
    if (m.ultBuffTimer > 0 && m.fighter.skills.some(s => s.id === "thunder-storm")) {
      const tPulse = 0.5 + Math.sin(frame * 0.18) * 0.3;
      const auraR = displayR + 22 + Math.sin(frame * 0.12) * 6;
      // Outer electric glow ring
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = tPulse * 0.5;
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(m.x, m.y, auraR, 0, Math.PI * 2);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4;
      ctx.stroke();
      // Inner bright ring
      ctx.globalAlpha = tPulse * 0.3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      // Actual zigzag lightning arcs radiating out (2-3 random arcs)
      if (frame % 3 === 0) {
        const arcCount = 2 + Math.floor(Math.random() * 2);
        for (let la = 0; la < arcCount; la++) {
          const ang = Math.random() * Math.PI * 2;
          const len = auraR * (0.6 + Math.random() * 0.5);
          drawLightningBolt(
            ctx, m.x, m.y,
            m.x + Math.cos(ang) * len, m.y + Math.sin(ang) * len,
            "#38bdf8", 2, 5, 15
          );
        }
      }
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

    // ── Freeze overlay: blue tint when frozen ──
    if (m.freezeTimer > 0) {
      const fAlpha = Math.min(0.55, m.freezeTimer / 120);
      ctx.save();
      ctx.globalAlpha = fAlpha;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR, 0, Math.PI * 2);
      ctx.fillStyle = "#0ea5e9";
      ctx.fill();
      ctx.restore();
      // Ice crystal shimmer
      if (frame % 6 === 0) {
        const iceAng = Math.random() * Math.PI * 2;
        const iceR = displayR * (0.5 + Math.random() * 0.5);
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#e0f2fe";
        ctx.font = `${Math.max(6, Math.round(displayR * 0.3))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("❄", m.x + Math.cos(iceAng) * iceR, m.y + Math.sin(iceAng) * iceR);
        ctx.restore();
      }
    }

    // ── Marble border: multi-layer glow ──
    {
      const borderCol = flash ? "#fca5a5" : (m.freezeTimer > 0 ? "#22d3ee" : m.color);
      // Layer 1: Wide outer glow (soft bloom)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = flash ? 0.5 : 0.2;
      ctx.shadowColor = borderCol;
      ctx.shadowBlur = flash ? 30 : 15;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 2, 0, Math.PI * 2);
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = flash ? 8 : 5;
      ctx.stroke();
      ctx.restore();
      // Layer 2: Core border
      ctx.save();
      ctx.shadowColor = borderCol;
      ctx.shadowBlur = flash ? 20 : 8;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR, 0, Math.PI * 2);
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      // Flash hit: white burst overlay
      if (flash) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(0.5, m.flashTimer / 10);
        ctx.beginPath();
        ctx.arc(m.x, m.y, displayR + 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();
      }
    }

    // ── Element glow ring ──
    if (m.fighter.element !== "neutral") {
      const eInfo = ELEMENT_INFO[m.fighter.element];
      const elPulse = 0.2 + Math.sin(frame * 0.08 + m.fighter.channelId.charCodeAt(1)) * 0.1;
      ctx.save();
      ctx.globalAlpha = elPulse;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 3, 0, Math.PI * 2);
      ctx.strokeStyle = eInfo.glow;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // ── Element badge on forehead ──
      const badgeR = Math.max(7, Math.round(displayR * 0.32));
      const badgeX = m.x;
      const badgeY = m.y - displayR + badgeR * 0.3;
      // Colored circle background
      ctx.save();
      ctx.shadowColor = eInfo.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = eInfo.color;
      ctx.fill();
      // Dark inner border
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR - 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      // Korean character label (불/물/풍/땅/빛/암)
      const badgeFontSize = Math.max(8, Math.round(badgeR * 1.2));
      ctx.font = `bold ${badgeFontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(eInfo.nameKo, badgeX, badgeY + 1);
    }

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

    // ── R Gauge bar (below HP bar) ──
    const ultH = 3;
    const ultY = barY + barH + 2;
    if (!m.ultFired) {
      const ultPct = Math.min(1, m.ultGauge / 100);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(barX - 1, ultY - 0.5, barW + 2, ultH + 1);
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(barX, ultY, barW, ultH);
      if (ultPct > 0) {
        const ultGrad = ctx.createLinearGradient(barX, ultY, barX + barW * ultPct, ultY);
        ultGrad.addColorStop(0, "#fbbf24");
        ultGrad.addColorStop(1, "#f97316");
        ctx.fillStyle = ultGrad;
        ctx.fillRect(barX, ultY, barW * ultPct, ultH);
      }
      // "R" label on right end
      if (ultPct >= 0.95) {
        // Pulsing glow when almost full
        const pulse2 = 0.5 + Math.sin(frame * 0.3) * 0.5;
        ctx.save();
        ctx.globalAlpha = pulse2;
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(barX, ultY, barW, ultH);
        ctx.restore();
      }
      ctx.font = "bold 7px system-ui, sans-serif";
      ctx.fillStyle = ultPct >= 0.95 ? "#fbbf24" : "#71717a";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("R", barX + barW + 8, ultY + ultH / 2);
    } else {
      // R fired — show "R" icon with color
      const rSkill2 = m.fighter.skills.find(s => s.slot === "R");
      ctx.font = "bold 8px system-ui, sans-serif";
      ctx.fillStyle = rSkill2 ? rSkill2.color : "#fbbf24";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★R", barX + barW / 2, ultY + ultH / 2 + 1);
    }

    const nameY = ultY + ultH + 2;
    const fSize = Math.max(9, Math.round(displayR * 0.35));
    ctx.font = `bold ${fSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillText(m.fighter.name, m.x + 0.5, nameY + 0.5);
    ctx.fillStyle = "#d4d4d8";
    ctx.fillText(m.fighter.name, m.x, nameY);

    if (m.skillBuff > 0) {
      // Draw glowing ring for each active skill
      const rSkill = m.fighter.skills.find(s => s.slot === "R");
      const ringColor = rSkill ? rSkill.color : "#fbbf24";
      const pulse = 0.4 + Math.sin(frame * 0.2) * 0.25;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 10 + Math.sin(frame * 0.12) * 4, 0, Math.PI * 2);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 4;
      ctx.stroke();
      // Inner ring
      ctx.globalAlpha = pulse * 0.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
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
    // (Skill indicators removed — R gauge bar + floating text for Q/W/E are enough)
  }

  // ── Render projectiles (missiles / bullets) with glow ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const pj of projectiles) {
    ctx.save();
    const pAlpha = Math.min(1, pj.life / 20);
    ctx.globalAlpha = pAlpha;
    const ang = Math.atan2(pj.vy, pj.vx);
    ctx.translate(pj.x, pj.y);
    ctx.rotate(ang);
    if (pj.type === "bullet") {
      // Bullet: elongated tracer with gradient glow
      const bLen = pj.size * 2.5;
      const bW = pj.size * 0.6;
      // Outer glow
      ctx.shadowColor = pj.color;
      ctx.shadowBlur = 10;
      const bGrad = ctx.createLinearGradient(-bLen, 0, bLen, 0);
      bGrad.addColorStop(0, "transparent");
      bGrad.addColorStop(0.3, pj.color + "66");
      bGrad.addColorStop(0.6, pj.color);
      bGrad.addColorStop(1, "#ffffff");
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, bLen, bW, 0, 0, Math.PI * 2);
      ctx.fill();
      // White-hot tip
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(pj.size * 0.8, 0, pj.size * 0.6, pj.size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Missile: body with exhaust trail gradient
      ctx.shadowColor = pj.color;
      ctx.shadowBlur = 16;
      // Exhaust glow behind
      const exGrad = ctx.createLinearGradient(-pj.size * 2.5, 0, pj.size, 0);
      exGrad.addColorStop(0, "transparent");
      exGrad.addColorStop(0.4, pj.color + "44");
      exGrad.addColorStop(0.8, pj.color);
      exGrad.addColorStop(1, "#ffffff");
      ctx.fillStyle = exGrad;
      ctx.beginPath();
      ctx.ellipse(-pj.size * 0.5, 0, pj.size * 2, pj.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Core body
      ctx.fillStyle = pj.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, pj.size, pj.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // White nose
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(pj.size * 0.4, 0, pj.size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();

  // ── Render slash lines: multi-layer glow + additive bloom ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const sl of slashLines) {
    const progress = 1 - sl.life / sl.maxLife; // 0→1
    const drawPct = Math.min(1, progress * 3);  // line draws in first 1/3
    const fadeAlpha = sl.life < sl.maxLife * 0.4 ? sl.life / (sl.maxLife * 0.4) : 1;
    const cx = sl.x1 + (sl.x2 - sl.x1) * drawPct;
    const cy = sl.y1 + (sl.y2 - sl.y1) * drawPct;
    ctx.lineCap = "round";
    // Layer 1: Wide soft glow (bloom halo)
    ctx.save();
    ctx.globalAlpha = fadeAlpha * 0.25;
    ctx.shadowColor = sl.color;
    ctx.shadowBlur = 35;
    ctx.strokeStyle = sl.color;
    ctx.lineWidth = sl.width * 5;
    ctx.beginPath();
    ctx.moveTo(sl.x1, sl.y1);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.restore();
    // Layer 2: Medium color glow
    ctx.save();
    ctx.globalAlpha = fadeAlpha * 0.6;
    ctx.shadowColor = sl.color;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = sl.color;
    ctx.lineWidth = sl.width * 2;
    ctx.beginPath();
    ctx.moveTo(sl.x1, sl.y1);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.restore();
    // Layer 3: Core bright line
    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    ctx.strokeStyle = sl.color;
    ctx.lineWidth = sl.width;
    ctx.beginPath();
    ctx.moveTo(sl.x1, sl.y1);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.restore();
    // Layer 4: White-hot center
    ctx.save();
    ctx.globalAlpha = fadeAlpha * 0.9;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.5, sl.width * 0.4);
    ctx.beginPath();
    ctx.moveTo(sl.x1, sl.y1);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // ── Particle FX: radial gradient + additive blending ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    const alpha = Math.max(0, Math.min(1, p.life / 20));
    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.char) {
      ctx.globalCompositeOperation = "source-over"; // text uses normal blending
      const sz = Math.max(6, p.size * Math.min(1, p.life / 18));
      ctx.font = `bold ${Math.round(sz)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = p.color;
      ctx.fillText(p.char, p.x, p.y);
    } else {
      const sz = Math.max(0.5, p.size * Math.min(1, p.life / 15));
      // Radial gradient: bright center → color → transparent
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 1.8);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.2, p.color);
      grad.addColorStop(0.7, p.color + "88");
      grad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();

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

  // ── Cut-in darkness: dim everything except the R-user ──
  if (camera.cutIn) {
    const ci = camera.cutIn;
    const ciAge = frame - ci.startFrame;
    const ciProgress = ciAge / ci.duration;
    const darkAlpha = ciProgress < 0.15 ? ciProgress / 0.15 * 0.8 : ciProgress > 0.8 ? (1 - ciProgress) / 0.2 * 0.8 : 0.8;

    // Find the R-user marble (still in world-space coords)
    const ultMarble = marbles.find(m2 => m2.fighter.channelId === ci.channelId && m2.alive);

    // Dark overlay with spotlight cutout
    ctx.save();
    ctx.globalAlpha = darkAlpha;
    ctx.fillStyle = "#000000";
    ctx.fillRect(-W, -H, W * 3, H * 3);

    if (ultMarble) {
      // Punch out a bright circle around the R-user
      ctx.globalCompositeOperation = "destination-out";
      const spotR = ultMarble.baseRadius * 3.5;
      const spotGrad = ctx.createRadialGradient(ultMarble.x, ultMarble.y, ultMarble.baseRadius * 0.5, ultMarble.x, ultMarble.y, spotR);
      spotGrad.addColorStop(0, "rgba(0,0,0,1)");
      spotGrad.addColorStop(0.7, "rgba(0,0,0,0.8)");
      spotGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spotGrad;
      ctx.fillRect(ultMarble.x - spotR, ultMarble.y - spotR, spotR * 2, spotR * 2);
      ctx.globalCompositeOperation = "source-over";

      // Colored glow ring around the R-user
      ctx.globalAlpha = 0.4 + Math.sin(ciAge * 0.15) * 0.2;
      ctx.beginPath();
      ctx.arc(ultMarble.x, ultMarble.y, ultMarble.baseRadius * 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = ci.skillColor;
      ctx.lineWidth = 4;
      ctx.shadowColor = ci.skillColor;
      ctx.shadowBlur = 30;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // End of world-space drawing
  ctx.restore();

  // ── Kill Banner (screen-space, outside camera transform) ──
  const now = frame;
  const bannerDuration = 120; // frames to show banner
  const activeBanners = camera.killEvents.filter(ke => now - ke.frame < bannerDuration);
  // Keep only recent 5
  while (camera.killEvents.length > 5) camera.killEvents.shift();

  for (let bi = 0; bi < activeBanners.length; bi++) {
    const ke = activeBanners[bi];
    const age = now - ke.frame;
    const fadeIn = Math.min(1, age / 12);
    const fadeOut = age > bannerDuration - 20 ? Math.max(0, (bannerDuration - age) / 20) : 1;
    const alpha = fadeIn * fadeOut;

    // Slide in from right
    const slideX = (1 - fadeIn) * 100;

    const bx = W - 210 - slideX;
    const by = 12 + bi * 52;

    ctx.save();
    ctx.globalAlpha = alpha * 0.92;

    // Banner background
    ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
    ctx.beginPath();
    ctx.roundRect(bx, by, 200, 44, 8);
    ctx.fill();

    // Red accent line on left
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.roundRect(bx, by, 4, 44, [8, 0, 0, 8]);
    ctx.fill();

    // Killer name
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(ke.killerName.slice(0, 10), bx + 12, by + 14);

    // Sword icon
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚔", bx + 100, by + 22);

    // Victim name
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#71717a";
    ctx.fillText(ke.victimName.slice(0, 10), bx + 192, by + 14);

    // "ELIMINATED" text
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ef4444";
    ctx.fillText("ELIMINATED", bx + 100, by + 38);

    ctx.restore();
  }

  // ── Slow-mo vignette + cinematic bars ──
  if (camera.slowMo > 0) {
    const vigT = Math.min(1, camera.slowMo / 60);
    const vigAlpha = vigT * 0.4;
    // Radial vignette
    const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.15, W / 2, H / 2, W * 0.65);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.7, `rgba(0,0,0,${vigAlpha * 0.5})`);
    grad.addColorStop(1, `rgba(0,0,0,${vigAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Cinematic letterbox bars (subtle)
    const barH = Math.round(H * 0.035 * vigT);
    if (barH > 1) {
      ctx.fillStyle = `rgba(0,0,0,${vigT * 0.7})`;
      ctx.fillRect(0, 0, W, barH);
      ctx.fillRect(0, H - barH, W, barH);
    }
    // Subtle chromatic edge tint
    ctx.save();
    ctx.globalAlpha = vigT * 0.08;
    ctx.globalCompositeOperation = "lighter";
    const chromGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
    chromGrad.addColorStop(0, "transparent");
    chromGrad.addColorStop(0.8, "#1e3a5f");
    chromGrad.addColorStop(1, "#0c1929");
    ctx.fillStyle = chromGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── CUT-IN: anime-style profile + skill name ──
  if (camera.cutIn) {
    const ci = camera.cutIn;
    const age = frame - ci.startFrame;
    if (age > ci.duration) {
      camera.cutIn = null;
    } else {
      const progress = age / ci.duration; // 0→1

      // Phase timings
      const slideInEnd = 0.15;   // 0~15% slide in
      const holdEnd = 0.75;      // 15~75% hold
      // 75~100% slide out

      let slideT: number; // 0=off-screen, 1=in-position
      if (progress < slideInEnd) {
        // Ease out (fast start, slow end)
        const t = progress / slideInEnd;
        slideT = 1 - Math.pow(1 - t, 3);
      } else if (progress < holdEnd) {
        slideT = 1;
      } else {
        // Ease in (slow start, fast end)
        const t = (progress - holdEnd) / (1 - holdEnd);
        slideT = 1 - Math.pow(t, 2);
      }

      const alpha = progress < slideInEnd
        ? Math.min(1, (progress / slideInEnd) * 2)
        : progress > holdEnd
          ? Math.max(0, 1 - ((progress - holdEnd) / (1 - holdEnd)) * 2)
          : 1;

      ctx.save();
      ctx.globalAlpha = alpha;

      // ── Dark cinematic bars (top + bottom) ──
      const barH2 = H * 0.12;
      const barAlpha = alpha * 0.85;
      ctx.fillStyle = `rgba(0, 0, 0, ${barAlpha})`;
      ctx.fillRect(0, 0, W, barH2);
      ctx.fillRect(0, H - barH2, W, barH2);

      // ── Diagonal slash background ──
      const slashX = W * 0.38;
      const skewPx = H * 0.15;
      ctx.fillStyle = ci.skillColor + "30";
      ctx.beginPath();
      ctx.moveTo(slashX - skewPx + (1 - slideT) * -W, 0);
      ctx.lineTo(slashX + W * 0.35 - skewPx + (1 - slideT) * -W, 0);
      ctx.lineTo(slashX + W * 0.35 + skewPx + (1 - slideT) * -W, H);
      ctx.lineTo(slashX + skewPx + (1 - slideT) * -W, H);
      ctx.closePath();
      ctx.fill();

      // ── Accent line ──
      ctx.strokeStyle = ci.skillColor;
      ctx.lineWidth = 3;
      ctx.globalAlpha = alpha * 0.8;
      ctx.beginPath();
      const lineX = slashX - skewPx + (1 - slideT) * -W;
      ctx.moveTo(lineX, 0);
      ctx.lineTo(lineX + skewPx * 2, H);
      ctx.stroke();
      ctx.globalAlpha = alpha;

      // ── Profile thumbnail (large, clipped to circle) ──
      const thumbSize = Math.min(W * 0.22, H * 0.4);
      const thumbCx = W * 0.2 + (1 - slideT) * -W * 0.5;
      const thumbCy = H * 0.5;

      // Glow behind thumbnail
      ctx.save();
      ctx.shadowColor = ci.skillColor;
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(thumbCx, thumbCy, thumbSize / 2 + 4, 0, Math.PI * 2);
      ctx.fillStyle = ci.skillColor + "40";
      ctx.fill();
      ctx.restore();

      // Thumbnail circle
      const thumb2 = thumbMap.get(ci.channelId);
      ctx.save();
      ctx.beginPath();
      ctx.arc(thumbCx, thumbCy, thumbSize / 2, 0, Math.PI * 2);
      ctx.clip();
      if (thumb2 && thumb2.complete && thumb2.naturalWidth > 0) {
        try {
          ctx.drawImage(thumb2, thumbCx - thumbSize / 2, thumbCy - thumbSize / 2, thumbSize, thumbSize);
        } catch { /* ignore */ }
      } else {
        ctx.fillStyle = "#27272a";
        ctx.fill();
      }
      ctx.restore();

      // Circle border
      ctx.beginPath();
      ctx.arc(thumbCx, thumbCy, thumbSize / 2, 0, Math.PI * 2);
      ctx.strokeStyle = ci.skillColor;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Channel name ──
      const textX = W * 0.42 + (1 - slideT) * -W * 0.3;
      const nameSize = Math.min(28, W * 0.045);
      ctx.font = `bold ${nameSize}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillText(ci.name, textX + 2, H * 0.4 + 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(ci.name, textX, H * 0.4);

      // ── "ULTIMATE" label ──
      const labelSize = Math.min(11, W * 0.018);
      ctx.font = `bold ${labelSize}px system-ui, sans-serif`;
      ctx.fillStyle = ci.skillColor;
      ctx.letterSpacing = "3px";
      ctx.fillText("U L T I M A T E", textX, H * 0.4 - nameSize * 0.9);
      ctx.letterSpacing = "0px";

      // ── Skill name (big, colored) ──
      const skillSize = Math.min(38, W * 0.06);
      ctx.font = `900 ${skillSize}px system-ui, sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillText(ci.skillName, textX + 2, H * 0.4 + nameSize * 1.1 + 2);
      ctx.fillStyle = ci.skillColor;
      ctx.shadowColor = ci.skillColor;
      ctx.shadowBlur = 15;
      ctx.fillText(ci.skillName, textX, H * 0.4 + nameSize * 1.1);
      ctx.shadowBlur = 0;

      // ── Decorative sparkle particles along slash ──
      if (progress > slideInEnd && progress < holdEnd) {
        for (let k = 0; k < 3; k++) {
          const py = Math.random() * H;
          const px = lineX + skewPx * (py / H) + Math.random() * 20 - 10;
          ctx.beginPath();
          ctx.arc(px, py, 1.5 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.globalAlpha = alpha * (0.3 + Math.random() * 0.5);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }
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

  interface SelectedChannel { name: string; thumbnailUrl: string; element?: ElementType }

  const [phase, setPhase] = useState<"lobby" | "loading" | "battle" | "victory">("lobby");
  const [selected, setSelected] = useState<Map<string, SelectedChannel>>(new Map());
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [speed, setSpeedState] = useState(1);
  const [introPhase, setIntroPhase] = useState<"none" | "cards" | "fight">("none");
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const [aliveCnt, setAliveCnt] = useState(0);
  const [lobbyQuery, setLobbyQuery] = useState("");
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
  const projectilesRef = useRef<Projectile[]>([]);
  const slashLinesRef = useRef<SlashLine[]>([]);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const shakeRef = useRef({ value: 0 });
  const cameraRef = useRef<Camera>({ x: 0, y: 0, targetX: 0, targetY: 0, zoom: 1, targetZoom: 1, slowMo: 0, killEvents: [], cutIn: null });
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

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { isKoRef.current = isKo; }, [isKo]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [battleLogs.length]);

  const toggleChannel = useCallback((channelId: string, name: string, thumbnailUrl: string) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else if (next.size < 20) {
        next.set(channelId, { name, thumbnailUrl });
        // Fetch element in background
        fetchChannelData([channelId]).then(map => {
          const d = map.get(channelId);
          if (d) {
            const elem = getChannelElement(d.topicIds);
            setSelected(p => {
              const n = new Map(p);
              const existing = n.get(channelId);
              if (existing) n.set(channelId, { ...existing, element: elem });
              return n;
            });
          }
        }).catch(() => {});
      }
      return next;
    });
  }, []);

  const removeChannel = useCallback((channelId: string) => {
    setSelected(prev => {
      const next = new Map(prev);
      next.delete(channelId);
      return next;
    });
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
      physicsStep(marblesRef.current, w, h, cooldownRef.current, textsRef.current, particlesRef.current, ringsRef.current, projectilesRef.current, slashLinesRef.current, pendingLogsRef.current, ko, frameRef.current, shakeRef.current, cameraRef.current);
      safety++;
    }
    finishBattle();
  }, [finishBattle]);

  const startBattle = useCallback(async () => {
    if (selected.size < 2) return;
    setPhase("loading");
    try {
      const channelIds = Array.from(selected.keys());
      const channelDataMap = await fetchChannelData(channelIds);
      const thumbFighters = channelIds.map(id => {
        const d = channelDataMap.get(id);
        const sel = selected.get(id);
        return { channelId: id, thumbnailUrl: d?.thumbnailUrl ?? sel?.thumbnailUrl ?? "" };
      });
      const thumbMap = await preloadThumbnails(thumbFighters);

      const loaded: Fighter[] = [];
      for (let i = 0; i < channelIds.length; i++) {
        const id = channelIds[i];
        const data = channelDataMap.get(id);
        const sel = selected.get(id);
        if (!data) continue;

        const stats = toGameStats(data);
        const palette = PALETTE[i % PALETTE.length];
        const skills = getYoutuberSkills(id);
        const element = getChannelElement(data.topicIds);

        loaded.push({
          channelId: id,
          name: data.name,
          thumbnailUrl: data.thumbnailUrl || sel?.thumbnailUrl || "",
          stats,
          skill: skills[0],
          skills,
          element,
          canvasColor: palette.color,
          canvasBg: palette.bg,
          hp: stats.maxHp,
          alive: true,
          kills: 0,
          totalDamage: 0,
          critsLanded: 0,
          deathOrder: 0,
          subsLabel: formatCount(data.subscriberCount),
          viewsLabel: formatCount(data.viewCount),
          videosLabel: formatCount(data.videoCount),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    projectilesRef.current = [];
    slashLinesRef.current = [];
    cooldownRef.current = new Map();
    shakeRef.current = { value: 0 };
    cameraRef.current = { x: w / 2, y: h / 2, targetX: w / 2, targetY: h / 2, zoom: 1, targetZoom: 1, slowMo: 0, killEvents: [], cutIn: null };
    frameRef.current = 0;
    pendingLogsRef.current = [];

    const loop = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || doneRef.current) return;

      const cam = cameraRef.current;
      const isCutIn = cam.cutIn !== null;

      // ── During cut-in: FULL FREEZE (no physics, no shake) ──
      // ── During slow-mo (no cut-in): reduced tick rate ──
      let ticksThisFrame = speedRef.current;
      if (isCutIn) {
        ticksThisFrame = 0; // complete freeze
        shakeRef.current.value = 0; // no shake during cut-in
      } else if (cam.slowMo > 0) {
        cam.slowMo--;
        ticksThisFrame = frameRef.current % 3 === 0 ? 1 : 0;
      }

      for (let s = 0; s < ticksThisFrame; s++) {
        frameRef.current++;
        physicsStep(marblesRef.current, w, h, cooldownRef.current, textsRef.current, particlesRef.current, ringsRef.current, projectilesRef.current, slashLinesRef.current, pendingLogsRef.current, isKoRef.current, frameRef.current, shakeRef.current, cam);
      }

      // Cut-in advances by real frames (not game frames)
      if (isCutIn) {
        // Advance cut-in timer using a real-time counter
        cam.cutIn!.startFrame--; // trick: decrement startFrame to simulate passage
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      drawFrame(ctx, marblesRef.current, textsRef.current, particlesRef.current, ringsRef.current, projectilesRef.current, slashLinesRef.current, w, h, frameRef.current, thumbMapRef.current, isCutIn ? 0 : shakeRef.current.value, cam);
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
    setSelected(new Map());
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
    const map = new Map<string, SelectedChannel>();
    for (const f of fighters) map.set(f.channelId, { name: f.name, thumbnailUrl: f.thumbnailUrl, element: f.element });
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
    setSelected(map);
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-3xl w-full">
                {fighters.map((f) => (
                  <div key={f.channelId} className="bg-zinc-900/90 rounded-xl p-2.5 border border-zinc-700/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <img src={f.thumbnailUrl || undefined} alt="" width={36} height={36} className="rounded-full object-cover bg-zinc-800 border-2 border-zinc-700" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-white text-xs font-bold block truncate">{f.name}</span>
                          {f.element !== "neutral" && (() => {
                            const ei = ELEMENT_INFO[f.element];
                            return <span className="text-[9px] px-1 rounded font-bold shrink-0" style={{ backgroundColor: ei.color + "25", color: ei.color }}>{ei.icon} {ei.nameKo}</span>;
                          })()}
                        </div>
                        <div className="flex gap-2 text-[9px]">
                          <span className="text-zinc-500">HP <span className="text-white font-bold">{f.stats.maxHp}</span></span>
                          <span className="text-zinc-500">ATK <span className="text-red-400 font-bold">{f.stats.atk}</span></span>
                          <span className="text-zinc-500">SPD <span className="text-green-400 font-bold">{f.stats.spd}</span></span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {f.skills.map((sk) => (
                        <div key={sk.id} className="flex items-center gap-1">
                          <span className="text-[9px] font-black w-3 shrink-0" style={{ color: sk.slot === "R" ? "#fbbf24" : sk.color }}>{sk.slot}</span>
                          <span className="text-[9px] font-bold" style={{ color: sk.color }}>{isKo ? sk.nameKo : sk.nameEn}</span>
                          <span className="text-[8px] text-zinc-500 truncate flex-1">{isKo ? sk.descKo : sk.descEn}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-3xl w-full">
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[...fighters].sort((a, b) => b.stats.maxHp - a.stats.maxHp).map((f) => (
                    <div key={f.channelId} className="bg-zinc-900/80 rounded-lg px-2 py-1.5 border border-zinc-700/40 flex items-center gap-1.5">
                      <img src={f.thumbnailUrl || undefined} alt="" width={24} height={24} className="rounded-full object-cover bg-zinc-800" />
                      <span className="text-white text-[10px] font-bold">{f.name}</span>
                      {f.element !== "neutral" && (
                        <span className="text-[8px]" title={ELEMENT_INFO[f.element].nameKo}>{ELEMENT_INFO[f.element].icon}</span>
                      )}
                      <span className="text-zinc-500 text-[9px]">HP<span className="text-zinc-300 font-bold ml-0.5">{f.stats.maxHp}</span></span>
                      <div className="flex gap-0.5">
                        {f.skills.map(sk => (
                          <span key={sk.id} className="text-[7px] font-black px-1 rounded" style={{ backgroundColor: sk.color + "30", color: sk.color }}>{sk.slot}</span>
                        ))}
                      </div>
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
            <div className="flex items-center gap-2">
              <p className="text-2xl font-black text-white">{winner?.name}</p>
              {winner && winner.element !== "neutral" && (() => {
                const ei = ELEMENT_INFO[winner.element];
                return <span className="text-sm px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: ei.color + "25", color: ei.color }}>{ei.icon} {ei.nameKo}</span>;
              })()}
            </div>
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
                        {f.element !== "neutral" && (
                          <span className="text-[9px]" title={ELEMENT_INFO[f.element].nameKo}>{ELEMENT_INFO[f.element].icon}</span>
                        )}
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

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input type="text" value={lobbyQuery} onChange={e => setLobbyQuery(e.target.value)}
          placeholder={t.search}
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400 shadow-sm"
        />
        {searchLoading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-400" />}
      </div>

      {/* Search Results */}
      {lobbyQuery.trim().length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-2">{t.searchResult}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[35vh] overflow-y-auto pr-1">
            {searchLoading ? (
              <div className="col-span-full flex justify-center py-6">
                <Loader2 size={24} className="animate-spin text-zinc-400" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="col-span-full text-center text-zinc-400 text-sm py-6">{isKo ? "결과 없음" : "No results"}</p>
            ) : (
              searchResults.map((item) => {
                const sel = selected.has(item.channelId);
                const itemSkills = getYoutuberSkills(item.channelId);
                return (
                  <button key={item.channelId} onClick={() => toggleChannel(item.channelId, item.name, item.thumbnailUrl)}
                    className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all text-left ${
                      sel ? "border-red-500 bg-red-50 dark:bg-red-950/40 ring-2 ring-red-300"
                          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={item.thumbnailUrl || undefined} alt="" width={40} height={40} className="shrink-0 rounded-full object-cover bg-zinc-800" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{item.name}</p>
                      </div>
                      {sel ? <Check size={16} className="text-red-600 shrink-0" /> : <span className="text-zinc-400 text-xs">+</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {itemSkills.map(sk => (
                        <span key={sk.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: sk.color + "20", color: sk.color, border: `1px solid ${sk.color}40` }}>
                          {sk.slot} {isKo ? sk.nameKo : sk.nameEn}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {lobbyQuery.trim().length === 0 && selected.size === 0 && (
        <div className="text-center py-12 text-zinc-400">
          <Youtube size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{isKo ? "유튜버를 검색해서 출전시키세요!" : "Search for YouTubers to add them!"}</p>
          <p className="text-xs mt-1 text-zinc-500">{isKo ? "2~20명 선택 가능" : "Select 2-20 channels"}</p>
        </div>
      )}

      {/* Selected channels */}
      {selected.size > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-500">{isKo ? "출전 목록" : "Selected"}</p>
            <span className="text-sm font-bold text-red-600">{t.selected(selected.size)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(selected.entries()).map(([id, ch]) => {
              const eInfo = ch.element ? ELEMENT_INFO[ch.element] : null;
              return (
                <div key={id} className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-full pl-1 pr-2 py-1">
                  <img src={ch.thumbnailUrl || undefined} alt="" width={24} height={24} className="rounded-full object-cover bg-zinc-800" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-white max-w-[100px] truncate">{ch.name}</span>
                  {eInfo && eInfo.type !== "neutral" && (
                    <span className="text-xs px-1 rounded" style={{ backgroundColor: eInfo.color + "22", color: eInfo.color }}
                      title={`${eInfo.icon} ${eInfo.nameKo} (${eInfo.nameEn})`}>
                      {eInfo.icon}
                    </span>
                  )}
                  <button onClick={() => removeChannel(id)} className="text-red-400 hover:text-red-600 ml-0.5 text-xs font-bold">&times;</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button disabled={!canStart || phase === "loading"} onClick={startBattle}
        className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition sticky bottom-4 ${
          canStart ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-red-900/30"
                   : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
        }`}
      >
        {phase === "loading" ? (<><Loader2 size={18} className="animate-spin" />{t.loading}</>)
        : canStart ? (<><Swords size={18} />{t.start}</>)
        : t.need(2 - selected.size)}
      </button>
    </div>
  );
}
