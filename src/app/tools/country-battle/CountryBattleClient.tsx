"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Swords, Loader2, Shuffle, Trophy, RotateCcw, SkipForward, Search, Share2, Check, Link2,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { COUNTRIES, type CountryPreset } from "./country-presets";
import { fetchAllCountryData, fetchTimeSeriesData, getYears, type CountryData } from "./world-bank-api";
import { getSkill, type CountrySkill } from "./country-skills";

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */

interface GameStats {
  hp: number; maxHp: number;
  atk: number; spd: number;
  crit: number; def: number; drain: number;
  pop: number;   // population → marble size/mass
  debt: number;  // debt debuff multiplier
}

interface Fighter {
  iso3: string; name: string; flag: string; iso2: string;
  stats: GameStats;
  skill: CountrySkill;
  canvasColor: string; canvasBg: string;
  hp: number; alive: boolean;
  kills: number; totalDamage: number; critsLanded: number;
  deathOrder: number;
  // Display-only economic values
  gdpLabel: string; growthPct: string; popLabel: string; debtPct: string; gdppcLabel: string;
}

interface Marble {
  fighter: Fighter;
  x: number; y: number; vx: number; vy: number;
  baseRadius: number; radius: number; mass: number;
  hp: number; maxHp: number; alive: boolean;
  rageMode: boolean; flashTimer: number;
  color: string; bgColor: string;
  targetIso: string;
  retargetFrame: number;
  trail: { x: number; y: number }[];
  // Skill state
  skillTimer: number;
  skillActivated: boolean;
  skillBuff: number;
  hitCounter: number;
  slowTimer: number;
  yearBonusAtk: number;
  yearBonusDef: number;
  // Special move state
  specialCD: number;        // frames until next special
  specialActive: number;    // frames remaining of active special
  dashDx: number;           // dash direction
  dashDy: number;
  afterImages: { x: number; y: number; r: number; alpha: number }[];  // for dash trail
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

const DMG_CD_BASE = 54; // frames between damage for same pair (scaled down for large battles)

// Color palette for countries (mapped by index)
const PALETTE = [
  { color: "#60a5fa", bg: "#1e3a5f" }, // blue
  { color: "#f87171", bg: "#5f1e1e" }, // red
  { color: "#c084fc", bg: "#3b1764" }, // purple
  { color: "#4ade80", bg: "#1a3d26" }, // green
  { color: "#facc15", bg: "#4a3c10" }, // yellow
  { color: "#f472b6", bg: "#4a1030" }, // pink
  { color: "#fb923c", bg: "#4a2810" }, // orange
  { color: "#22d3ee", bg: "#0c3a42" }, // cyan
];

/* ═══════════════════════════════════════════════
   STAT CONVERSION — Economic data → Game stats
   ═══════════════════════════════════════════════ */

function clamp(v: number, mn: number, mx: number) {
  return Math.max(mn, Math.min(mx, v));
}

function toGameStats(d: CountryData): GameStats {
  const gdp = d.gdp ?? 1e9;
  const popVal = d.population ?? 50_000_000;

  // ── HP ← 인구 (사람 수 = 체력, 중국/인도가 최강 탱커) ──
  // pop^0.4: 중국 1.4B → ~9000, 미국 330M → ~5100, 한국 52M → ~2400, 싱가포르 6M → ~1000
  const hpRaw = Math.pow(popVal, 0.4);
  const hpBase = Math.round(clamp(hpRaw / 2.5, 100, 2000));
  const hp = hpBase * 5; // 500 ~ 10000

  // 1인당 GDP (방어력 산출용)
  const gdppc = popVal > 0 ? gdp / popVal : 10000;

  // ── ATK ← GDP (경제력 = 화력) + 성장률 보너스 ──
  // gdp^0.3: 미국 ~83, 중국 ~73, 일본 ~47, 한국 ~36, 싱가포르 ~25
  const growth = d.gdpGrowth ?? 2;
  const atkBase = Math.pow(gdp, 0.3) / 130;
  const atk = Math.round(clamp(atkBase + growth * 3, 25, 110));

  // ── SPD ← 수출/GDP 비율 (무역 개방도 = 기동력) ──
  // 싱가포르 ~180% → 매우 빠름, 미국 ~12% → 느림
  const exportRatio = gdp > 0 ? ((d.exports ?? 0) / gdp) * 100 : 30;
  const spd = Math.round(clamp(4 + exportRatio * 0.12, 3, 20));

  // ── CRIT ← 인플레이션율 (경제 불안정 = 치명타) ──
  const inflation = d.inflation ?? 3;
  const crit = Math.round(clamp(5 + inflation * 2, 5, 35));

  // ── DEF ← 1인당 GDP (부유한 나라 = 기술력/방어력) ──
  // log10(gdppc): 싱가포르 100K → 30, 미국 80K → 28, 한국 33K → 23, 중국 13K → 17, 인도 2.6K → 6
  const def = Math.round(clamp((Math.log10(Math.max(gdppc, 500)) - 3) * 15, 0, 30));

  // ── DRAIN ← FDI/GDP 비율 (외자 유입 = 회복력) ──
  const fdiRatio = gdp > 0 ? ((d.fdi ?? 0) / gdp) * 100 : 1;
  const drain = Math.round(clamp(fdiRatio * 6, 0, 30));

  // ── POP ← 인구 (구슬 크기/질량) ──
  const pop = popVal;

  // ── DEBT ← 국가부채/GDP(%) — 디버프 ──
  // 부채 100% → 데미지 1.25x
  const debtRatio = d.debt ?? 40;
  const debt = Math.round(clamp(debtRatio, 0, 250));

  return { hp, maxHp: hp, atk, spd, crit, def, drain, pop, debt };
}

/* ═══════════════════════════════════════════════
   FLAG PRELOADING
   ═══════════════════════════════════════════════ */

function preloadFlags(iso2List: string[]): Promise<Map<string, HTMLImageElement>> {
  return new Promise((resolveAll) => {
    const map = new Map<string, HTMLImageElement>();
    let done = 0;
    const total = iso2List.length;
    const finish = () => { if (++done >= total) resolveAll(map); };

    for (const iso2 of iso2List) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { map.set(iso2, img); finish(); };
      img.onerror = () => finish();
      img.src = `https://flagcdn.com/w160/${iso2}.png`;
      setTimeout(() => { if (!map.has(iso2) && done < total) { done++; if (done >= total) resolveAll(map); } }, 5000);
    }
  });
}

/* ═══════════════════════════════════════════════
   YEAR PROGRESSION — Update marbles when year advances
   ═══════════════════════════════════════════════ */

function applyYearUpdate(
  marbles: Marble[],
  ts: Map<string, Map<number, CountryData>>,
  year: number,
  texts: FloatingText[],
  particles: Particle[],
  isKo: boolean,
) {
  for (const m of marbles) {
    if (!m.alive) continue;
    const yearData = ts.get(m.fighter.iso3)?.get(year);
    if (!yearData) continue;

    const oldStats = { ...m.fighter.stats };
    const newStats = toGameStats(yearData);

    // Calculate deltas
    const hpDelta = newStats.maxHp - oldStats.maxHp;
    const atkDelta = newStats.atk - oldStats.atk;

    // Apply new stats
    m.fighter.stats = newStats;

    // Scale HP proportionally: keep current HP ratio, apply to new maxHp
    const hpRatio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
    m.maxHp = newStats.maxHp;
    m.hp = Math.round(hpRatio * newStats.maxHp);
    if (m.hp > m.maxHp) m.hp = m.maxHp;

    // Scale marble size (pop-based)
    const oldPop = oldStats.pop;
    const newPop = newStats.pop;
    if (oldPop > 0 && newPop > 0) {
      const popScale = Math.pow(newPop, 0.3) / Math.pow(oldPop, 0.3);
      m.baseRadius = Math.max(14, Math.round(m.baseRadius * popScale));
    }
    m.mass = newPop;

    // Skill: yearChange bonuses
    const sk = m.fighter.skill;
    if (sk.type === "yearChange") {
      switch (sk.id) {
        case "miracle": case "celtic-tiger":  // KOR/IRL: cumulative ATK bonus
          m.yearBonusAtk += 3;
          break;
        case "oil-fund":  // NOR: cumulative DEF bonus
          m.yearBonusDef += 2;
          break;
      }
    }

    // Visual feedback for significant changes
    if (Math.abs(hpDelta) > 200 || Math.abs(atkDelta) > 5) {
      const grew = hpDelta > 0;
      const emoji = grew ? (isKo ? "+" : "+") : (isKo ? "-" : "-");
      const label = grew
        ? `${emoji}${Math.abs(hpDelta)} HP`
        : `${emoji}${Math.abs(hpDelta)} HP`;
      texts.push({
        x: m.x, y: m.y - m.baseRadius - 20,
        text: label,
        color: grew ? "#4ade80" : "#ef4444",
        life: 50, size: 14,
      });

      // Growth sparkle or decay flicker
      const clr = grew ? "#4ade80" : "#ef4444";
      for (let k = 0; k < 6; k++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 2;
        particles.push({
          x: m.x + (Math.random() - 0.5) * m.baseRadius,
          y: m.y + (Math.random() - 0.5) * m.baseRadius,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1,
          life: 20 + Math.random() * 15,
          color: clr, size: 2 + Math.random() * 3,
        });
      }
    }
  }
}

/* ═══════════════════════════════════════════════
   SPECIAL MOVE BEHAVIORS (visual + mechanical)
   ═══════════════════════════════════════════════ */

type SpecialType = "charge" | "wave" | "fortress" | "dance" | "bombard" | "none";

const SPECIAL_MAP: Record<string, SpecialType> = {
  // Charge — dash at target with afterimages
  JPN: "charge", RUS: "charge", VNM: "charge", GBR: "charge",
  // Wave — emit shockwave ring that pushes enemies
  KOR: "wave", FRA: "wave", IND: "wave",
  // Fortress — brief immovability + shield flash
  CHN: "fortress", DEU: "fortress", CHE: "fortress",
  // Dance — erratic zigzag movement with rainbow trail
  BRA: "dance", COL: "dance", THA: "dance", ARG: "dance",
  // Bombard — ranged AOE explosion on target
  USA: "bombard", ISR: "bombard", SAU: "bombard", TWN: "bombard",
};

function getSpecialType(iso3: string): SpecialType {
  return SPECIAL_MAP[iso3] ?? "none";
}

/* ═══════════════════════════════════════════════
   PHYSICS + CANVAS
   ═══════════════════════════════════════════════ */

function createMarbles(fighters: Fighter[], W: number, H: number): Marble[] {
  // Scale marble size based on number of fighters
  const n = fighters.length;
  const scaleFactor = n <= 8 ? 1 : Math.max(0.35, 8 / n);
  const baseR = (Math.min(W, H) / 11) * scaleFactor;
  const cx = W / 2, cy = H / 2;
  const spread = Math.min(W, H) * Math.min(0.42, 0.25 + n * 0.01);

  // Normalize population for marble size (power-law — 더 극적인 차이)
  // pop^0.3: 중국 14억→564, 미국 3.3억→252, 한국 5천만→148, 싱가포르 600만→72
  const pops = fighters.map(f => Math.pow(Math.max(1, f.stats.pop), 0.3));
  const minPop = Math.min(...pops), maxPop = Math.max(...pops);
  const popRange = maxPop - minPop || 1;

  return fighters.map((f, i) => {
    // Population → size factor (0.35 ~ 1.85) — 대국은 5배 이상 큰 구슬
    const popNorm = (Math.pow(Math.max(1, f.stats.pop), 0.3) - minPop) / popRange;
    const sizeFactor = 0.35 + popNorm * 1.5;
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
      baseRadius: radius, radius, mass: f.stats.pop,
      hp: f.stats.maxHp, maxHp: f.stats.maxHp,
      alive: true, rageMode: false, flashTimer: 0,
      color: f.canvasColor, bgColor: f.canvasBg,
      targetIso: "",
      retargetFrame: 0,
      trail: [],
      // Skill state
      skillTimer: 0,
      skillActivated: false,
      skillBuff: 0,
      hitCounter: 0,
      slowTimer: 0,
      yearBonusAtk: 0,
      yearBonusDef: 0,
      // Special move state
      specialCD: 60 + Math.floor(Math.random() * 40),
      specialActive: 0,
      dashDx: 0, dashDy: 0,
      afterImages: [],
    };
  });
}

function pickTarget(m: Marble, alive: Marble[]): string {
  const others = alive.filter(t => t.fighter.iso3 !== m.fighter.iso3);
  if (others.length === 0) return m.fighter.iso3;

  // Small countries (low HP) tend to target the biggest
  const hpRatioSelf = m.hp / m.maxHp;
  if (hpRatioSelf < 0.5 && Math.random() < 0.4) {
    const biggest = others.reduce((a, b) => a.maxHp > b.maxHp ? a : b);
    return biggest.fighter.iso3;
  }

  // Default: target nearest
  let best = others[0];
  let bestDist = Infinity;
  for (const t of others) {
    const dx = t.x - m.x, dy = t.y - m.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best.fighter.iso3;
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
  // Scale cooldown down for large battles so they don't drag forever
  let DMG_CD = alive.length > 16 ? Math.round(DMG_CD_BASE * 0.5) : alive.length > 10 ? Math.round(DMG_CD_BASE * 0.7) : DMG_CD_BASE;
  // Time-based cooldown reduction: shrink CD over time (min 50% of original at ~100s)
  const cdTimeScale = Math.max(0.5, 1 - frame * 0.00008);
  DMG_CD = Math.max(8, Math.round(DMG_CD * cdTimeScale));

  if (shake.value > 0) shake.value *= 0.88;
  if (shake.value < 0.3) shake.value = 0;

  // ── Skill: periodic & threshold processing ──
  for (const m of alive) {
    m.skillTimer++;
    if (m.skillBuff > 0) m.skillBuff--;
    if (m.slowTimer > 0) m.slowTimer--;
    const sk = m.fighter.skill;
    const hpPct = m.hp / m.maxHp;

    // Periodic skills
    if (sk.type === "periodic" && sk.interval && m.skillTimer >= sk.interval) {
      m.skillTimer = 0;
      switch (sk.id) {
        case "human-wave": {  // CHN: regen 2% maxHP
          const heal = Math.round(m.maxHp * 0.02);
          m.hp = Math.min(m.maxHp, m.hp + heal);
          texts.push({ x: m.x, y: m.y - m.baseRadius - 14, text: `+${heal}`, color: sk.color, life: 35, size: 12 });
          break;
        }
        case "ofw": case "welfare": case "hygge": {  // PHL/SWE/DNK: regen 1.5~2%
          const rate = sk.id === "hygge" ? 0.02 : 0.015;
          const heal = Math.round(m.maxHp * rate);
          m.hp = Math.min(m.maxHp, m.hp + heal);
          texts.push({ x: m.x, y: m.y - m.baseRadius - 14, text: `+${heal}`, color: sk.color, life: 35, size: 12 });
          break;
        }
        case "giant-africa": {  // NGA: regen scales with missing HP
          const missingPct = 1 - hpPct;
          const rate = 0.01 + missingPct * 0.03;
          const heal = Math.round(m.maxHp * rate);
          m.hp = Math.min(m.maxHp, m.hp + heal);
          texts.push({ x: m.x, y: m.y - m.baseRadius - 14, text: `+${heal}`, color: sk.color, life: 35, size: 12 });
          break;
        }
        case "oil-power": {  // SAU: slow all enemies
          for (const other of alive) {
            if (other === m) continue;
            other.slowTimer = 90;  // 1.5s slow
          }
          texts.push({ x: m.x, y: m.y - m.baseRadius - 20, text: isKo ? "석유 제재!" : "Oil Sanction!", color: sk.color, life: 45, size: 14 });
          rings.push({ x: m.x, y: m.y, radius: m.baseRadius, maxRadius: Math.max(W, H) * 0.4, life: 20, maxLife: 20, color: sk.color, lineWidth: 2 });
          break;
        }
        case "samba": {  // BRA: speed burst
          m.skillBuff = 180;
          texts.push({ x: m.x, y: m.y - m.baseRadius - 20, text: "SAMBA!", color: sk.color, life: 45, size: 14 });
          break;
        }
        case "coffee": {  // COL: permanent speed buff (applied in movement)
          break;
        }
        case "diversity": case "rainbow": {  // MYS/ZAF: random stat boost
          const boost = sk.id === "rainbow" ? 0.3 : 0.2;
          const roll = Math.floor(Math.random() * 4);
          const stats = m.fighter.stats;
          if (roll === 0) stats.atk = Math.round(stats.atk * (1 + boost));
          else if (roll === 1) stats.def = Math.round(stats.def * (1 + boost));
          else if (roll === 2) stats.spd = Math.round(stats.spd * (1 + boost));
          else stats.crit = Math.round(stats.crit * (1 + boost));
          const statNames = ["ATK", "DEF", "SPD", "CRT"];
          texts.push({ x: m.x, y: m.y - m.baseRadius - 20, text: `${statNames[roll]} UP!`, color: sk.color, life: 45, size: 13 });
          break;
        }
        case "haka": break; // NZL: applied at init
      }
    }

    // Threshold skills (one-time)
    if (sk.type === "threshold" && !m.skillActivated && sk.hpThreshold && hpPct <= sk.hpThreshold) {
      m.skillActivated = true;
      const skillName = isKo ? sk.nameKo : sk.nameEn;
      switch (sk.id) {
        case "dollar-hegemony":  // USA
          m.skillBuff = 99999;  // permanent for rest of battle
          texts.push({ x: m.x, y: m.y - m.baseRadius - 24, text: skillName, color: sk.color, life: 60, size: 16 });
          logs.push(isKo ? `${m.fighter.flag} ${m.fighter.name} [${skillName}] 발동!` : `${m.fighter.flag} ${m.fighter.name} [${skillName}] activated!`);
          rings.push({ x: m.x, y: m.y, radius: m.baseRadius, maxRadius: m.baseRadius * 3, life: 25, maxLife: 25, color: sk.color, lineWidth: 3 });
          break;
        case "guerrilla":  // VNM
          m.skillBuff = 99999;
          texts.push({ x: m.x, y: m.y - m.baseRadius - 24, text: skillName, color: sk.color, life: 60, size: 16 });
          logs.push(isKo ? `${m.fighter.flag} ${m.fighter.name} [${skillName}] 발동!` : `${m.fighter.flag} ${m.fighter.name} [${skillName}] activated!`);
          rings.push({ x: m.x, y: m.y, radius: m.baseRadius, maxRadius: m.baseRadius * 3, life: 25, maxLife: 25, color: sk.color, lineWidth: 3 });
          break;
        case "revolution":  // FRA
          m.skillBuff = 300;  // 5s
          texts.push({ x: m.x, y: m.y - m.baseRadius - 24, text: "REVOLUTION!", color: sk.color, life: 60, size: 18 });
          logs.push(isKo ? `${m.fighter.flag} ${m.fighter.name} [${skillName}] 발동! 공격력 3배!` : `${m.fighter.flag} ${m.fighter.name} [${skillName}] ATK x3!`);
          shake.value = Math.max(shake.value, 10);
          rings.push({ x: m.x, y: m.y, radius: m.baseRadius, maxRadius: m.baseRadius * 4, life: 30, maxLife: 30, color: "#ef4444", lineWidth: 4 });
          break;
        case "engineering":  // DEU
          m.skillBuff = 99999;
          texts.push({ x: m.x, y: m.y - m.baseRadius - 24, text: skillName, color: sk.color, life: 60, size: 16 });
          logs.push(isKo ? `${m.fighter.flag} ${m.fighter.name} [${skillName}] 발동!` : `${m.fighter.flag} ${m.fighter.name} [${skillName}] activated!`);
          break;
        case "resilience":  // MEX
          m.skillBuff = 99999;
          texts.push({ x: m.x, y: m.y - m.baseRadius - 24, text: skillName, color: sk.color, life: 60, size: 16 });
          break;
        case "phoenix": {  // POL: heal to 30%
          const heal = Math.round(m.maxHp * 0.3) - m.hp;
          if (heal > 0) {
            m.hp += heal;
            texts.push({ x: m.x, y: m.y - m.baseRadius - 24, text: `${skillName}! +${heal}`, color: sk.color, life: 65, size: 18 });
            logs.push(isKo ? `${m.fighter.flag} ${m.fighter.name} [${skillName}] 부활!` : `${m.fighter.flag} ${m.fighter.name} [${skillName}] revived!`);
            shake.value = Math.max(shake.value, 8);
            rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.5, maxRadius: m.baseRadius * 4, life: 28, maxLife: 28, color: "#ef4444", lineWidth: 3 });
            for (let k = 0; k < 12; k++) {
              const ang = Math.random() * Math.PI * 2;
              particles.push({ x: m.x, y: m.y, vx: Math.cos(ang) * 3, vy: Math.sin(ang) * 3 - 2, life: 30, color: "#ef4444", size: 3 + Math.random() * 3 });
            }
          }
          break;
        }
        default:  // generic threshold (ATK +20%)
          m.skillBuff = 99999;
          texts.push({ x: m.x, y: m.y - m.baseRadius - 24, text: skillName, color: sk.color, life: 60, size: 14 });
          break;
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
      m.targetIso = pickTarget(m, alive);
    }
    let target = alive.find(t => t.fighter.iso3 === m.targetIso);
    if (!target) { m.targetIso = pickTarget(m, alive); target = alive.find(t => t.fighter.iso3 === m.targetIso); }

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

    // Time-based chaos: jitter grows over time (starts gentle, gets wild)
    const chaos = 1 + frame * 0.0003;
    m.vx += (Math.random() - 0.5) * 0.08 * chaos;
    m.vy += (Math.random() - 0.5) * 0.08 * chaos;

    let maxSpd = 2.2 + (m.fighter.stats.spd / 20) * 4.0;
    // Time-based speed escalation: marbles get much faster over time
    maxSpd *= (1 + frame * 0.00025);
    // Skill: COL coffee (+25% spd), BRA samba (2x during buff)
    if (m.fighter.skill.id === "coffee") maxSpd *= 1.25;
    if (m.fighter.skill.id === "samba" && m.skillBuff > 0) maxSpd *= 2.0;
    // Slow debuff
    if (m.slowTimer > 0) maxSpd *= 0.6;
    const rageSpd = m.rageMode ? maxSpd * 1.3 : maxSpd;
    const curSpd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
    if (curSpd > rageSpd) { const s = rageSpd / curSpd; m.vx *= s; m.vy *= s; }

    m.x += m.vx; m.y += m.vy;

    // Wall bounce elasticity grows over time: 1.05 → up to 1.25
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

    // ── Special move processing ──
    const specType = getSpecialType(m.fighter.iso3);
    if (m.specialActive > 0) {
      m.specialActive--;
      // After-image trail during charge
      if (specType === "charge" && frame % 2 === 0) {
        m.afterImages.push({ x: m.x, y: m.y, r: m.radius * 0.8, alpha: 0.5 });
      }
      // Dash movement override
      if (specType === "charge" && m.specialActive > 0) {
        const dashSpd = 8 + (m.fighter.stats.spd / 20) * 4;
        m.vx = m.dashDx * dashSpd;
        m.vy = m.dashDy * dashSpd;
      }
      // Dance zigzag
      if (specType === "dance" && m.specialActive > 0) {
        const zigzag = Math.sin(frame * 0.5) * 4;
        m.vx += m.dashDy * zigzag * 0.3;
        m.vy += -m.dashDx * zigzag * 0.3;
      }
    }
    // Decay after-images
    for (let ai = m.afterImages.length - 1; ai >= 0; ai--) {
      m.afterImages[ai].alpha -= 0.06;
      if (m.afterImages[ai].alpha <= 0) m.afterImages.splice(ai, 1);
    }

    // Trigger new special move
    if (specType !== "none" && m.specialActive <= 0) {
      m.specialCD--;
      if (m.specialCD <= 0) {
        m.specialCD = 100 + Math.floor(Math.random() * 80);
        const tgt = alive.find(t => t.fighter.iso3 === m.targetIso && t.alive);
        if (tgt) {
          const dx = tgt.x - m.x, dy = tgt.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          m.dashDx = dx / dist; m.dashDy = dy / dist;

          const skClr = m.fighter.skill.color;
          const R = m.baseRadius;
          switch (specType) {
            case "charge": {  // JPN, RUS, VNM, GBR — samurai dash
              m.specialActive = 20;
              const labels: Record<string, [string, string]> = {
                JPN: ["참격!", "SLASH!"], RUS: ["돌격!", "CHARGE!"],
                VNM: ["기습!", "AMBUSH!"], GBR: ["돌격!", "CHARGE!"],
              };
              const [ko, en] = labels[m.fighter.iso3] ?? ["돌격!", "CHARGE!"];
              texts.push({ x: m.x, y: m.y - R - 35, text: isKo ? ko : en, color: skClr, life: 65, size: 26 });
              shake.value = Math.max(shake.value, 8);
              // Big burst of trail particles
              for (let k = 0; k < 16; k++) {
                const spread = (Math.random() - 0.5) * 2;
                particles.push({ x: m.x + (Math.random() - 0.5) * R, y: m.y + (Math.random() - 0.5) * R, vx: -m.dashDx * (3 + Math.random() * 3) + spread, vy: -m.dashDy * (3 + Math.random() * 3) + spread, life: 25 + Math.random() * 15, color: skClr, size: 3 + Math.random() * 4 });
              }
              // Slash line ring
              rings.push({ x: m.x + m.dashDx * R, y: m.y + m.dashDy * R, radius: R * 0.3, maxRadius: R * 3, life: 14, maxLife: 14, color: skClr, lineWidth: 5 });
              break;
            }
            case "wave": {  // KOR, FRA, IND — shockwave push
              m.specialActive = 12;
              const pushR = Math.max(R * 6, 120);
              for (const other of alive) {
                if (other === m) continue;
                const ddx = other.x - m.x, ddy = other.y - m.y;
                const dd = Math.sqrt(ddx * ddx + ddy * ddy);
                if (dd < pushR && dd > 0) {
                  const pushF = (1 - dd / pushR) * 12;
                  other.vx += (ddx / dd) * pushF;
                  other.vy += (ddy / dd) * pushF;
                }
              }
              // Triple expanding ring
              rings.push({ x: m.x, y: m.y, radius: R * 0.5, maxRadius: pushR, life: 24, maxLife: 24, color: skClr, lineWidth: 6 });
              rings.push({ x: m.x, y: m.y, radius: R * 0.3, maxRadius: pushR * 0.8, life: 20, maxLife: 20, color: "#ffffff", lineWidth: 3 });
              rings.push({ x: m.x, y: m.y, radius: R * 0.2, maxRadius: pushR * 0.5, life: 16, maxLife: 16, color: skClr, lineWidth: 2 });
              const waveLabels: Record<string, [string, string]> = {
                KOR: ["한류!", "K-WAVE!"], FRA: ["자유!", "LIBERTE!"], IND: ["옴!", "OM!"],
              };
              const [wko, wen] = waveLabels[m.fighter.iso3] ?? ["충격파!", "WAVE!"];
              texts.push({ x: m.x, y: m.y - R - 35, text: isKo ? wko : wen, color: skClr, life: 70, size: 28 });
              shake.value = Math.max(shake.value, 10);
              // Burst particles in all directions
              for (let k = 0; k < 20; k++) {
                const ang = (k / 20) * Math.PI * 2;
                const sp = 4 + Math.random() * 4;
                particles.push({ x: m.x + Math.cos(ang) * R, y: m.y + Math.sin(ang) * R, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 28 + Math.random() * 10, color: Math.random() > 0.3 ? skClr : "#ffffff", size: 3 + Math.random() * 4 });
              }
              break;
            }
            case "fortress": {  // CHN, DEU, CHE — immovable stance
              m.specialActive = 55;
              m.vx *= 0.02; m.vy *= 0.02;
              const fLabels: Record<string, [string, string]> = {
                CHN: ["만리장성!", "GREAT WALL!"], DEU: ["철벽!", "IRON WALL!"], CHE: ["중립!", "NEUTRAL!"],
              };
              const [fko, fen] = fLabels[m.fighter.iso3] ?? ["방어!", "DEFEND!"];
              texts.push({ x: m.x, y: m.y - R - 35, text: isKo ? fko : fen, color: skClr, life: 60, size: 24 });
              shake.value = Math.max(shake.value, 4);
              // Multiple concentric rings
              rings.push({ x: m.x, y: m.y, radius: R * 1.0, maxRadius: R * 2.2, life: 20, maxLife: 20, color: skClr, lineWidth: 4 });
              rings.push({ x: m.x, y: m.y, radius: R * 0.6, maxRadius: R * 1.6, life: 16, maxLife: 16, color: "#ffffff", lineWidth: 2 });
              // Shield particles orbiting
              for (let k = 0; k < 12; k++) {
                const ang = (k / 12) * Math.PI * 2;
                particles.push({ x: m.x + Math.cos(ang) * R * 1.3, y: m.y + Math.sin(ang) * R * 1.3, vx: Math.cos(ang + Math.PI / 2) * 1.5, vy: Math.sin(ang + Math.PI / 2) * 1.5, life: 40, color: skClr, size: 3 + Math.random() * 2 });
              }
              break;
            }
            case "dance": {  // BRA, COL, THA, ARG — erratic movement
              m.specialActive = 65;
              const dLabels: Record<string, [string, string]> = {
                BRA: ["삼바!", "SAMBA!"], COL: ["쿰비아!", "CUMBIA!"],
                THA: ["무에타이!", "MUAY THAI!"], ARG: ["탱고!", "TANGO!"],
              };
              const [dko, den] = dLabels[m.fighter.iso3] ?? ["춤!", "DANCE!"];
              texts.push({ x: m.x, y: m.y - R - 35, text: isKo ? dko : den, color: skClr, life: 60, size: 24 });
              // Speed boost
              m.vx *= 1.8; m.vy *= 1.8;
              // Colorful explosion
              for (let k = 0; k < 10; k++) {
                const ang = Math.random() * Math.PI * 2;
                const hue = Math.floor(Math.random() * 360);
                particles.push({ x: m.x, y: m.y, vx: Math.cos(ang) * 3, vy: Math.sin(ang) * 3, life: 20 + Math.random() * 10, color: `hsl(${hue}, 80%, 60%)`, size: 3 + Math.random() * 3 });
              }
              break;
            }
            case "bombard": {  // USA, ISR, SAU, TWN — ranged AOE
              m.specialActive = 15;
              const bx = tgt.x + (Math.random() - 0.5) * 15;
              const by = tgt.y + (Math.random() - 0.5) * 15;
              // Big triple-ring explosion
              rings.push({ x: bx, y: by, radius: 4, maxRadius: Math.max(tgt.baseRadius * 4, 60), life: 22, maxLife: 22, color: skClr, lineWidth: 6 });
              rings.push({ x: bx, y: by, radius: 3, maxRadius: Math.max(tgt.baseRadius * 3, 45), life: 18, maxLife: 18, color: "#fbbf24", lineWidth: 4 });
              rings.push({ x: bx, y: by, radius: 2, maxRadius: Math.max(tgt.baseRadius * 2, 30), life: 14, maxLife: 14, color: "#ffffff", lineWidth: 2 });
              // Massive particle burst
              for (let k = 0; k < 25; k++) {
                const ang = Math.random() * Math.PI * 2;
                const sp = 2 + Math.random() * 7;
                particles.push({ x: bx, y: by, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 28 + Math.random() * 18, color: Math.random() > 0.4 ? skClr : (Math.random() > 0.5 ? "#fbbf24" : "#ffffff"), size: 3 + Math.random() * 5 });
              }
              // Dollar signs flying out
              for (let k = 0; k < 4; k++) {
                const ang = Math.random() * Math.PI * 2;
                particles.push({ x: bx, y: by, vx: Math.cos(ang) * 3, vy: -2 - Math.random() * 3, life: 35, color: skClr, size: 12 + Math.random() * 4, char: "$" });
              }
              const bLabels: Record<string, [string, string]> = {
                USA: ["폭격!", "AIRSTRIKE!"], ISR: ["미사일!", "MISSILE!"],
                SAU: ["유전!", "OIL STRIKE!"], TWN: ["칩공격!", "CHIP ATTACK!"],
              };
              const [bko, ben] = bLabels[m.fighter.iso3] ?? ["공격!", "STRIKE!"];
              texts.push({ x: bx, y: by - 30, text: isKo ? bko : ben, color: skClr, life: 60, size: 26 });
              shake.value = Math.max(shake.value, 12);
              break;
            }
          }
        }
      }
    }

    // Fortress: reduce knockback during active
    if (specType === "fortress" && m.specialActive > 0) {
      m.vx *= 0.85; m.vy *= 0.85;
    }
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
        // Collision restitution escalates: 1.15 → up to 1.6 (super bouncy over time)
        const restitution = Math.min(1.6, 1.15 + frame * 0.00006);
        const imp = (restitution * dvn) / totalMass;
        a.vx -= imp * b.mass * nx; a.vy -= imp * b.mass * ny;
        b.vx += imp * a.mass * nx; b.vy += imp * a.mass * ny;
      }

      // Extra push force grows over time – makes marbles bounce wildly
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

      // Damage cooldown
      const key = a.fighter.iso3 < b.fighter.iso3
        ? `${a.fighter.iso3}-${b.fighter.iso3}`
        : `${b.fighter.iso3}-${a.fighter.iso3}`;
      if (frame - (cooldowns.get(key) ?? -999) < DMG_CD) continue;
      cooldowns.set(key, frame);

      const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy);
      const spdF = Math.max(0.4, relSpeed / 5);

      // ── Time-based damage escalation ──
      // Damage grows 1% per 60 frames (~1% per second), 2x at ~100s
      const timeScale = 1 + frame * 0.00015;

      // ── Calculate ATK with skill modifiers ──
      let atkA = a.fighter.stats.atk + a.yearBonusAtk;
      let atkB = b.fighter.stats.atk + b.yearBonusAtk;
      let defA = a.fighter.stats.def + a.yearBonusDef;
      let defB = b.fighter.stats.def + b.yearBonusDef;
      let critChanceA = a.fighter.stats.crit;
      let critChanceB = b.fighter.stats.crit;

      // Skill: onAttack modifiers
      const skA = a.fighter.skill, skB = b.fighter.skill;
      const hpPctA = a.hp / a.maxHp, hpPctB = b.hp / b.maxHp;

      // USA: ATK +40% when threshold active
      if (skA.id === "dollar-hegemony" && a.skillBuff > 0) atkA = Math.round(atkA * 1.4);
      if (skB.id === "dollar-hegemony" && b.skillBuff > 0) atkB = Math.round(atkB * 1.4);
      // VNM: ATK doubled when threshold active
      if (skA.id === "guerrilla" && a.skillBuff > 0) atkA *= 2;
      if (skB.id === "guerrilla" && b.skillBuff > 0) atkB *= 2;
      // FRA: ATK tripled during buff
      if (skA.id === "revolution" && a.skillBuff > 0) atkA *= 3;
      if (skB.id === "revolution" && b.skillBuff > 0) atkB *= 3;
      // DEU: DEF +50% when threshold active
      if (skA.id === "engineering" && a.skillBuff > 0) defA = Math.round(defA * 1.5);
      if (skB.id === "engineering" && b.skillBuff > 0) defB = Math.round(defB * 1.5);
      // MEX: DEF doubled when threshold active
      if (skA.id === "resilience" && a.skillBuff > 0) defA *= 2;
      if (skB.id === "resilience" && b.skillBuff > 0) defB *= 2;
      // GBR: ATK scales with missing HP
      if (skA.id === "stiff-lip") atkA = Math.round(atkA * (1 + (1 - hpPctA) * 0.6));
      if (skB.id === "stiff-lip") atkB = Math.round(atkB * (1 + (1 - hpPctB) * 0.6));
      // IND: attack speed (extra atk at low HP)
      if (skA.id === "jugaad") atkA = Math.round(atkA * (1 + (1 - hpPctA) * 0.4));
      if (skB.id === "jugaad") atkB = Math.round(atkB * (1 + (1 - hpPctB) * 0.4));
      // THA: +25% close-range dmg
      if (skA.id === "muay-thai") atkA = Math.round(atkA * 1.25);
      if (skB.id === "muay-thai") atkB = Math.round(atkB * 1.25);
      // TUR: crit rate doubled
      if (skA.id === "ottoman") critChanceA *= 2;
      if (skB.id === "ottoman") critChanceB *= 2;
      // ESP: crit increases at low HP
      if (skA.id === "toro") critChanceA = Math.round(critChanceA * (1 + (1 - hpPctA) * 1.5));
      if (skB.id === "toro") critChanceB = Math.round(critChanceB * (1 + (1 - hpPctB) * 1.5));
      // Default threshold: ATK +20%
      if (skA.type === "threshold" && a.skillBuff > 0 && !["dollar-hegemony","guerrilla","revolution","engineering","resilience","phoenix"].includes(skA.id)) atkA = Math.round(atkA * 1.2);
      if (skB.type === "threshold" && b.skillBuff > 0 && !["dollar-hegemony","guerrilla","revolution","engineering","resilience","phoenix"].includes(skB.id)) atkB = Math.round(atkB * 1.2);

      const critA = Math.random() * 100 < critChanceA;
      let dmgA = atkA * spdF * (0.8 + Math.random() * 0.4);
      if (a.rageMode) dmgA *= 1.4;
      if (critA) dmgA *= 2.0;
      // TWN: crit damage doubled
      if (critA && skA.id === "semiconductor") dmgA *= 2.0;
      // ARG: 10% chance to deal 3x
      if (skA.id === "hand-of-god" && Math.random() < 0.1) { dmgA *= 3; texts.push({ x: a.x, y: a.y - a.baseRadius - 28, text: isKo ? "신의 손!" : "Hand of God!", color: skA.color, life: 50, size: 16 }); }
      // CHL: 15% chance to ignore DEF
      const ignoreDefA = skA.id === "copper" && Math.random() < 0.15;
      dmgA = Math.max(1, Math.round(dmgA - (ignoreDefA ? 0 : defB * 0.5)));
      dmgA = Math.round(dmgA * (1 + b.fighter.stats.debt / 400));

      const critB = Math.random() * 100 < critChanceB;
      let dmgB = atkB * spdF * (0.8 + Math.random() * 0.4);
      if (b.rageMode) dmgB *= 1.4;
      if (critB) dmgB *= 2.0;
      if (critB && skB.id === "semiconductor") dmgB *= 2.0;
      if (skB.id === "hand-of-god" && Math.random() < 0.1) { dmgB *= 3; texts.push({ x: b.x, y: b.y - b.baseRadius - 28, text: isKo ? "신의 손!" : "Hand of God!", color: skB.color, life: 50, size: 16 }); }
      const ignoreDefB = skB.id === "copper" && Math.random() < 0.15;
      dmgB = Math.max(1, Math.round(dmgB - (ignoreDefB ? 0 : defA * 0.5)));
      dmgB = Math.round(dmgB * (1 + a.fighter.stats.debt / 400));

      // ── Skill: onDamaged modifiers ──
      // IDN: 30% dodge
      if (skB.id === "archipelago" && Math.random() < 0.3) { dmgA = 0; texts.push({ x: b.x, y: b.y - b.baseRadius - 14, text: "DODGE!", color: skB.color, life: 35, size: 14 }); }
      if (skA.id === "archipelago" && Math.random() < 0.3) { dmgB = 0; texts.push({ x: a.x, y: a.y - a.baseRadius - 14, text: "DODGE!", color: skA.color, life: 35, size: 14 }); }
      // JPN/CAN/AUS: damage reduction
      if (skB.id === "tech-shield" || skB.id === "peacekeeping" || skB.id === "outback") dmgA = Math.round(dmgA * 0.85);
      if (skA.id === "tech-shield" || skA.id === "peacekeeping" || skA.id === "outback") dmgB = Math.round(dmgB * 0.85);
      // UAE/CHE: stronger damage reduction
      if (skB.id === "oil-money") dmgA = Math.round(dmgA * 0.8);
      if (skA.id === "oil-money") dmgB = Math.round(dmgB * 0.8);
      if (skB.id === "neutrality") dmgA = Math.round(dmgA * 0.75);
      if (skA.id === "neutrality") dmgB = Math.round(dmgB * 0.75);
      // EGY: DEF boost
      if (skB.id === "pyramid") dmgA = Math.round(dmgA * 0.7);
      if (skA.id === "pyramid") dmgB = Math.round(dmgB * 0.7);
      // ISR: every 5th hit blocked
      if (skB.id === "iron-dome") { b.hitCounter++; if (b.hitCounter % 5 === 0) { dmgA = 0; texts.push({ x: b.x, y: b.y - b.baseRadius - 14, text: "BLOCKED!", color: skB.color, life: 40, size: 14 }); rings.push({ x: b.x, y: b.y, radius: b.baseRadius * 0.8, maxRadius: b.baseRadius * 1.5, life: 12, maxLife: 12, color: skB.color, lineWidth: 2 }); } }
      if (skA.id === "iron-dome") { a.hitCounter++; if (a.hitCounter % 5 === 0) { dmgB = 0; texts.push({ x: a.x, y: a.y - a.baseRadius - 14, text: "BLOCKED!", color: skA.color, life: 40, size: 14 }); rings.push({ x: a.x, y: a.y, radius: a.baseRadius * 0.8, maxRadius: a.baseRadius * 1.5, life: 12, maxLife: 12, color: skA.color, lineWidth: 2 }); } }
      // RUS: slow attacker
      if (skB.id === "winter" && dmgA > 0) a.slowTimer = 90;
      if (skA.id === "winter" && dmgB > 0) b.slowTimer = 90;

      // Apply time-based escalation
      dmgA = Math.round(dmgA * timeScale);
      dmgB = Math.round(dmgB * timeScale);

      b.hp -= dmgA; a.hp -= dmgB;
      a.fighter.totalDamage += dmgA; b.fighter.totalDamage += dmgB;
      if (critA) a.fighter.critsLanded++;
      if (critB) b.fighter.critsLanded++;

      // Particles
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

      // Crit knockback (escalates with time)
      if (critA) {
        const knockF = (3 + dmgA / 50) * timeScale;
        b.vx += nx * knockF; b.vy += ny * knockF;
        shake.value = Math.max(shake.value, 7 * Math.min(2, timeScale));
        rings.push({ x: mx, y: my, radius: 5, maxRadius: (a.radius + b.radius) * 1.0, life: 22, maxLife: 22, color: "#fbbf24", lineWidth: 3 });
      }
      if (critB) {
        const knockF = (3 + dmgB / 50) * timeScale;
        a.vx -= nx * knockF; a.vy -= ny * knockF;
        shake.value = Math.max(shake.value, 7 * Math.min(2, timeScale));
        rings.push({ x: mx, y: my, radius: 5, maxRadius: (a.radius + b.radius) * 1.0, life: 22, maxLife: 22, color: "#fbbf24", lineWidth: 3 });
      }

      // Drain (FDI income)
      if (a.fighter.stats.drain > 0) {
        const h = Math.round(dmgA * a.fighter.stats.drain / 100);
        if (h > 0) {
          a.hp = Math.min(a.maxHp, a.hp + h);
          texts.push({ x: a.x + (Math.random() - 0.5) * 10, y: a.y - a.radius - 14, text: `+${h}`, color: "#4ade80", life: 35, size: 14 });
          if (h >= 10) logs.push(isKo ? `${a.fighter.flag} ${a.fighter.name} FDI +${h} HP` : `${a.fighter.flag} ${a.fighter.name} FDI heal +${h} HP`);
        }
      }
      if (b.fighter.stats.drain > 0) {
        const h = Math.round(dmgB * b.fighter.stats.drain / 100);
        if (h > 0) {
          b.hp = Math.min(b.maxHp, b.hp + h);
          texts.push({ x: b.x + (Math.random() - 0.5) * 10, y: b.y - b.radius - 14, text: `+${h}`, color: "#4ade80", life: 35, size: 14 });
          if (h >= 10) logs.push(isKo ? `${b.fighter.flag} ${b.fighter.name} FDI +${h} HP` : `${b.fighter.flag} ${b.fighter.name} FDI heal +${h} HP`);
        }
      }

      a.flashTimer = 10; b.flashTimer = 10;

      // Collision sparks
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

      // Floating damage
      const aName = a.fighter.flag;
      const bName = b.fighter.flag;
      texts.push(
        { x: b.x + (Math.random() - 0.5) * 20, y: b.y - b.radius - 10, text: critA ? `-${dmgA}!` : `-${dmgA}`, color: critA ? "#fbbf24" : "#f87171", life: 55, size: critA ? 22 : 14 },
        { x: a.x + (Math.random() - 0.5) * 20, y: a.y - a.radius - 10, text: critB ? `-${dmgB}!` : `-${dmgB}`, color: critB ? "#fbbf24" : "#f87171", life: 55, size: critB ? 22 : 14 },
      );

      // Rage check
      if (!a.rageMode && a.hp > 0 && a.hp < a.maxHp * 0.25) {
        a.rageMode = true;
        logs.push(isKo ? `${aName} ${a.fighter.name} 경제 위기! 패닉 모드` : `${aName} ${a.fighter.name} economic crisis! Panic mode`);
        shake.value = Math.max(shake.value, 5);
        rings.push({ x: a.x, y: a.y, radius: a.radius, maxRadius: a.radius * 3, life: 25, maxLife: 25, color: "#ef4444", lineWidth: 3 });
      }
      if (!b.rageMode && b.hp > 0 && b.hp < b.maxHp * 0.25) {
        b.rageMode = true;
        logs.push(isKo ? `${bName} ${b.fighter.name} 경제 위기! 패닉 모드` : `${bName} ${b.fighter.name} economic crisis! Panic mode`);
        shake.value = Math.max(shake.value, 5);
        rings.push({ x: b.x, y: b.y, radius: b.radius, maxRadius: b.radius * 3, life: 25, maxLife: 25, color: "#ef4444", lineWidth: 3 });
      }

      // Log
      if (critA) {
        logs.push(isKo
          ? `${aName} ${a.fighter.name}, ${bName} ${b.fighter.name}에 인플레 폭격! -${dmgA}`
          : `${aName} ${a.fighter.name} inflation bombs ${bName} ${b.fighter.name}! -${dmgA}`);
      }
      if (critB) {
        logs.push(isKo
          ? `${bName} ${b.fighter.name}, ${aName} ${a.fighter.name}에 인플레 폭격! -${dmgB}`
          : `${bName} ${b.fighter.name} inflation bombs ${aName} ${a.fighter.name}! -${dmgB}`);
      }
      if (!critA && !critB) {
        logs.push(isKo
          ? `${aName}${bName} 경제 충돌 — ${a.fighter.name} -${dmgB} / ${b.fighter.name} -${dmgA}`
          : `${aName}${bName} economic clash — ${a.fighter.name} -${dmgB} / ${b.fighter.name} -${dmgA}`);
      }

      // Eliminate
      const spawnDeath = (m: Marble, killer: Marble) => {
        m.alive = false; m.hp = 0;
        killer.fighter.kills++;
        m.fighter.deathOrder = frame;
        shake.value = Math.max(shake.value, 14);

        let absorbRate = 0.2;
        // Skill: onKill bonus
        if (killer.fighter.skill.id === "financial-hub") absorbRate = 0.4;  // SGP: 2x absorb
        if (killer.fighter.skill.id === "trade-empire") absorbRate = 0.3;   // NLD: 1.5x absorb
        const absorbHp = Math.round(m.maxHp * absorbRate);
        const oldMaxHp = killer.maxHp;
        killer.maxHp += absorbHp;
        killer.hp = Math.min(killer.maxHp, killer.hp + absorbHp);
        killer.baseRadius *= (killer.maxHp / oldMaxHp);
        killer.mass = killer.maxHp;

        texts.push({ x: killer.x, y: killer.y - killer.baseRadius - 16, text: `+${absorbHp} GDP`, color: "#22d3ee", life: 65, size: 19 });
        rings.push({ x: killer.x, y: killer.y, radius: killer.baseRadius * 0.3, maxRadius: killer.baseRadius * 2.2, life: 24, maxLife: 24, color: "#22d3ee", lineWidth: 3 });

        for (let k = 0; k < 8; k++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 0.8 + Math.random() * 2;
          particles.push({ x: killer.x + (Math.random() - 0.5) * killer.baseRadius * 2, y: killer.y + (Math.random() - 0.5) * killer.baseRadius * 2, vx: Math.cos(ang) * sp * -0.3, vy: -1.5 - Math.random() * 2, life: 35 + Math.random() * 20, color: "#22d3ee", size: 8 + Math.random() * 4, char: "$" });
        }

        logs.push(isKo
          ? `[속보] ${m.fighter.flag} ${m.fighter.name} 경제 파산! ${killer.fighter.flag} ${killer.fighter.name}에 흡수 — GDP +${absorbHp}`
          : `[BREAKING] ${m.fighter.flag} ${m.fighter.name} bankrupt! Absorbed by ${killer.fighter.flag} ${killer.fighter.name} — GDP +${absorbHp}`);

        for (let k = 0; k < 30; k++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 7;
          particles.push({ x: m.x + (Math.random() - 0.5) * m.baseRadius, y: m.y + (Math.random() - 0.5) * m.baseRadius, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 35 + Math.floor(Math.random() * 30), color: Math.random() > 0.4 ? m.color : (Math.random() > 0.5 ? "#ffffff" : "#ef4444"), size: 2.5 + Math.random() * 5 });
        }
        for (let k = 0; k < 10; k++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 1.5 + Math.random() * 4;
          particles.push({ x: m.x + (Math.random() - 0.5) * m.baseRadius, y: m.y + (Math.random() - 0.5) * m.baseRadius, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2, life: 40 + Math.random() * 25, color: "#4ade80", size: 8 + Math.random() * 4, char: "$" });
        }
        rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.5, maxRadius: m.baseRadius * 4.5, life: 30, maxLife: 30, color: m.color, lineWidth: 4 });
        rings.push({ x: m.x, y: m.y, radius: m.baseRadius * 0.3, maxRadius: m.baseRadius * 2.5, life: 20, maxLife: 20, color: "#ef4444", lineWidth: 2 });
      };
      if (b.hp <= 0 && b.alive) spawnDeath(b, a);
      if (a.hp <= 0 && a.alive) spawnDeath(a, b);
    }
  }

  // Update texts
  for (let i = texts.length - 1; i >= 0; i--) {
    texts[i].y -= 0.9; texts[i].life--;
    if (texts[i].life <= 0) texts.splice(i, 1);
  }
  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.08; p.vx *= 0.98;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
  // Update rings
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
  flagMap: Map<string, HTMLImageElement>,
  shake: number,
  currentYear?: number,
  yearProgress?: number,  // 0~1 within current year
) {
  ctx.save();

  if (shake > 0.3) {
    const sx = (Math.random() - 0.5) * shake * 2.5;
    const sy = (Math.random() - 0.5) * shake * 2.5;
    ctx.translate(sx, sy);
  }

  // Background
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, "#141418");
  grad.addColorStop(1, "#09090b");
  ctx.fillStyle = grad;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // Grid
  const gridAlpha = 0.12 + Math.sin(frame * 0.01) * 0.04;
  ctx.strokeStyle = `rgba(63, 63, 70, ${gridAlpha})`;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Arena border
  ctx.strokeStyle = "rgba(124, 58, 237, 0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  const alive = marbles.filter(m => m.alive);

  // Rings
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

  // Target lines
  for (const m of alive) {
    const tgt = marbles.find(t => t.fighter.iso3 === m.targetIso && t.alive);
    if (!tgt) continue;
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

  // Dead marbles
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

  // ═══ Country-specific special move visuals ═══
  for (const m of alive) {
    if (m.specialActive <= 0 && m.afterImages.length === 0) continue;
    const iso = m.fighter.iso3;
    const skClr = m.fighter.skill.color;
    const R = m.radius;
    const sa = m.specialActive;
    const prog = Math.max(0, sa / 20); // fade factor
    ctx.save();

    // ── JPN: Katana X-Slash ──
    if (iso === "JPN" && (sa > 0 || m.afterImages.length > 0)) {
      const slashLen = R * 4;
      const alpha = Math.min(1, sa / 6) * 0.8;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#f472b6";
      ctx.shadowBlur = 20;
      // X-shaped slash
      ctx.beginPath();
      ctx.moveTo(m.x - slashLen, m.y - slashLen * 0.6);
      ctx.lineTo(m.x + slashLen, m.y + slashLen * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - slashLen, m.y + slashLen * 0.6);
      ctx.lineTo(m.x + slashLen, m.y - slashLen * 0.6);
      ctx.stroke();
      // Thin inner slash
      ctx.strokeStyle = "#f472b6";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(m.x - slashLen * 0.8, m.y);
      ctx.lineTo(m.x + slashLen * 0.8, m.y);
      ctx.stroke();
    }

    // ── RUS: Ice/Snow freeze aura ──
    if (iso === "RUS" && sa > 0) {
      const iceR = R * 2.5;
      ctx.globalAlpha = prog * 0.4;
      ctx.fillStyle = "#93c5fd";
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.arc(m.x, m.y, iceR, 0, Math.PI * 2); ctx.fill();
      // Ice crystal spikes
      ctx.globalAlpha = prog * 0.7;
      ctx.strokeStyle = "#dbeafe";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + frame * 0.03;
        const len = R * 1.5 + Math.sin(frame * 0.2 + i) * R * 0.3;
        ctx.beginPath();
        ctx.moveTo(m.x + Math.cos(ang) * R, m.y + Math.sin(ang) * R);
        ctx.lineTo(m.x + Math.cos(ang) * len, m.y + Math.sin(ang) * len);
        ctx.stroke();
      }
    }

    // ── VNM: Jungle leaves / stealth shimmer ──
    if (iso === "VNM" && sa > 0) {
      ctx.globalAlpha = prog * 0.5;
      ctx.shadowColor = "#16a34a";
      ctx.shadowBlur = 15;
      for (let i = 0; i < 6; i++) {
        const ang = frame * 0.08 + (i / 6) * Math.PI * 2;
        const d = R * 1.5 + Math.sin(frame * 0.15 + i * 2) * R * 0.5;
        const lx = m.x + Math.cos(ang) * d;
        const ly = m.y + Math.sin(ang) * d;
        ctx.fillStyle = i % 2 === 0 ? "#22c55e" : "#15803d";
        ctx.beginPath();
        // Leaf shape
        ctx.ellipse(lx, ly, 8, 4, ang, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── GBR: Crown flash ──
    if (iso === "GBR" && sa > 0) {
      ctx.globalAlpha = prog * 0.6;
      ctx.strokeStyle = "#fbbf24";
      ctx.fillStyle = "#fbbf24";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 15;
      ctx.lineWidth = 2;
      // Crown above marble
      const cy2 = m.y - R - 8;
      const cw = R * 1.2, ch = R * 0.5;
      ctx.beginPath();
      ctx.moveTo(m.x - cw, cy2);
      ctx.lineTo(m.x - cw * 0.6, cy2 - ch);
      ctx.lineTo(m.x - cw * 0.2, cy2);
      ctx.lineTo(m.x + cw * 0.2, cy2 - ch * 1.2);
      ctx.lineTo(m.x + cw * 0.6, cy2);
      ctx.lineTo(m.x + cw, cy2 - ch);
      ctx.stroke();
    }

    // ── KOR: K-pop hearts + music notes spreading ──
    if (iso === "KOR" && sa > 0) {
      ctx.shadowColor = "#3b82f6";
      ctx.shadowBlur = 12;
      const spread = (1 - prog) * R * 5;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + frame * 0.04;
        const d = R * 1.2 + spread;
        const hx = m.x + Math.cos(ang) * d;
        const hy = m.y + Math.sin(ang) * d;
        ctx.globalAlpha = prog * 0.7;
        ctx.fillStyle = i % 2 === 0 ? "#ec4899" : "#3b82f6";
        ctx.font = `bold ${Math.round(12 + prog * 6)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(i % 3 === 0 ? "\u2665" : "\u266A", hx, hy);
      }
    }

    // ── FRA: Tricolor burst (blue-white-red) ──
    if (iso === "FRA" && sa > 0) {
      const triR = R * 2.5 * (1 - prog * 0.3);
      ctx.globalAlpha = prog * 0.35;
      // Three colored arcs
      const colors = ["#2563eb", "#ffffff", "#ef4444"];
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, triR, (i / 3) * Math.PI * 2 + frame * 0.05, ((i + 1) / 3) * Math.PI * 2 + frame * 0.05);
        ctx.strokeStyle = colors[i];
        ctx.lineWidth = 6;
        ctx.shadowColor = colors[i];
        ctx.shadowBlur = 15;
        ctx.stroke();
      }
    }

    // ── IND: Spinning Chakra wheel ──
    if (iso === "IND" && sa > 0) {
      ctx.globalAlpha = prog * 0.5;
      ctx.strokeStyle = "#f97316";
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2;
      const chakR = R * 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, chakR, 0, Math.PI * 2); ctx.stroke();
      // Spokes of Ashoka Chakra
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2 + frame * 0.06;
        ctx.beginPath();
        ctx.moveTo(m.x + Math.cos(ang) * chakR * 0.4, m.y + Math.sin(ang) * chakR * 0.4);
        ctx.lineTo(m.x + Math.cos(ang) * chakR, m.y + Math.sin(ang) * chakR);
        ctx.stroke();
      }
    }

    // ── CHN: Great Wall bricks ──
    if (iso === "CHN" && sa > 0) {
      const wallR = R * 1.6 + Math.sin(frame * 0.15) * 3;
      ctx.globalAlpha = prog * 0.45;
      ctx.fillStyle = "#b45309";
      ctx.strokeStyle = "#92400e";
      ctx.lineWidth = 1;
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 10;
      // Brick ring around marble
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + frame * 0.02;
        const bx2 = m.x + Math.cos(ang) * wallR;
        const by2 = m.y + Math.sin(ang) * wallR;
        ctx.fillRect(bx2 - 8, by2 - 4, 16, 8);
        ctx.strokeRect(bx2 - 8, by2 - 4, 16, 8);
      }
    }

    // ── DEU: Rotating gears ──
    if (iso === "DEU" && sa > 0) {
      ctx.globalAlpha = prog * 0.5;
      ctx.strokeStyle = "#fbbf24";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.5;
      const gearR = R * 1.4;
      // Gear teeth
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + frame * 0.04;
        const isOuter = i % 2 === 0;
        const gr = isOuter ? gearR : gearR * 0.8;
        const px = m.x + Math.cos(ang) * gr;
        const py = m.y + Math.sin(ang) * gr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // ── CHE: Cross shield ──
    if (iso === "CHE" && sa > 0) {
      const shR = R * 1.6;
      ctx.globalAlpha = prog * 0.45;
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 15;
      // Red square
      ctx.fillRect(m.x - shR * 0.7, m.y - shR * 0.7, shR * 1.4, shR * 1.4);
      // White cross
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(m.x - shR * 0.15, m.y - shR * 0.5, shR * 0.3, shR * 1.0);
      ctx.fillRect(m.x - shR * 0.5, m.y - shR * 0.15, shR * 1.0, shR * 0.3);
    }

    // ── USA: Missile rain lines from top ──
    if (iso === "USA" && sa > 0) {
      const tgt2 = marbles.find(t => t.fighter.iso3 === m.targetIso && t.alive);
      if (tgt2) {
        ctx.globalAlpha = prog * 0.6;
        ctx.strokeStyle = "#ef4444";
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        // Multiple missile trails from sky
        for (let i = 0; i < 3; i++) {
          const ox = (i - 1) * 20;
          ctx.beginPath();
          ctx.moveTo(tgt2.x + ox, 0);
          ctx.lineTo(tgt2.x + ox * 0.3, tgt2.y);
          ctx.stroke();
          // Warhead
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(tgt2.x + ox * 0.3, tgt2.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        // Crosshair
        const cr = tgt2.radius + 12;
        ctx.globalAlpha = prog * 0.5;
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(tgt2.x, tgt2.y, cr, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── ISR: Iron Dome arcs ──
    if (iso === "ISR" && sa > 0) {
      ctx.globalAlpha = prog * 0.5;
      ctx.strokeStyle = "#60a5fa";
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      // Dome shape above marble
      const domeR = R * 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, domeR, Math.PI, 0);
      ctx.stroke();
      // Interceptor arcs
      for (let i = 0; i < 3; i++) {
        const iAng = Math.PI + (i + 0.5) / 3 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y + R);
        ctx.quadraticCurveTo(
          m.x + Math.cos(iAng) * domeR * 1.5,
          m.y + Math.sin(iAng) * domeR * 1.5,
          m.x + Math.cos(iAng) * domeR,
          m.y + Math.sin(iAng) * domeR
        );
        ctx.stroke();
      }
    }

    // ── SAU: Oil geyser eruption from below ──
    if (iso === "SAU" && sa > 0) {
      ctx.globalAlpha = prog * 0.5;
      ctx.fillStyle = "#1a1a1a";
      ctx.shadowColor = "#059669";
      ctx.shadowBlur = 15;
      // Dark oil column below marble
      const colW = R * 0.8;
      ctx.fillRect(m.x - colW / 2, m.y + R, colW, H - m.y - R);
      // Oil splash crown
      ctx.fillStyle = "#059669";
      for (let i = 0; i < 5; i++) {
        const ang = Math.PI + (i / 4) * Math.PI;
        const d = R * 1.5;
        ctx.beginPath();
        ctx.arc(m.x + Math.cos(ang) * d * 0.5, m.y + R + Math.sin(ang) * d * 0.3, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── TWN: Digital circuit grid flash ──
    if (iso === "TWN" && sa > 0) {
      ctx.globalAlpha = prog * 0.4;
      ctx.strokeStyle = "#06b6d4";
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.5;
      const gridR = R * 2.5;
      // Circuit paths
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + frame * 0.03;
        const ex = m.x + Math.cos(ang) * gridR;
        const ey = m.y + Math.sin(ang) * gridR;
        ctx.beginPath();
        ctx.moveTo(m.x + Math.cos(ang) * R, m.y + Math.sin(ang) * R);
        // Right-angle circuit path
        const mid = R + (gridR - R) * 0.5;
        ctx.lineTo(m.x + Math.cos(ang) * mid, m.y + Math.sin(ang) * R);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        // Chip node
        ctx.fillStyle = "#06b6d4";
        ctx.fillRect(ex - 3, ey - 3, 6, 6);
      }
    }

    // ── BRA: Carnival confetti shower ──
    if (iso === "BRA" && sa > 0) {
      const hue2 = (frame * 10) % 360;
      for (let i = 0; i < 8; i++) {
        const ang = frame * 0.08 + (i / 8) * Math.PI * 2;
        const d = R + R * 1.5 * (1 - prog * 0.5);
        const cx2 = m.x + Math.cos(ang) * d;
        const cy3 = m.y + Math.sin(ang) * d;
        ctx.globalAlpha = prog * 0.6;
        ctx.fillStyle = `hsl(${(hue2 + i * 45) % 360}, 90%, 55%)`;
        ctx.save();
        ctx.translate(cx2, cy3);
        ctx.rotate(frame * 0.1 + i);
        ctx.fillRect(-5, -3, 10, 6);
        ctx.restore();
      }
    }

    // ── COL: Coffee bean orbit ──
    if (iso === "COL" && sa > 0) {
      ctx.globalAlpha = prog * 0.6;
      ctx.fillStyle = "#92400e";
      ctx.shadowColor = "#92400e";
      ctx.shadowBlur = 8;
      for (let i = 0; i < 5; i++) {
        const ang = frame * 0.1 + (i / 5) * Math.PI * 2;
        const d = R * 1.5;
        const bx2 = m.x + Math.cos(ang) * d;
        const by2 = m.y + Math.sin(ang) * d;
        ctx.beginPath();
        ctx.ellipse(bx2, by2, 6, 4, ang, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── THA: Muay Thai kick arc ──
    if (iso === "THA" && sa > 0) {
      ctx.globalAlpha = prog * 0.6;
      ctx.strokeStyle = "#a855f7";
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 15;
      ctx.lineWidth = 4;
      const kickAng = frame * 0.15;
      ctx.beginPath();
      ctx.arc(m.x, m.y, R * 2.5, kickAng, kickAng + Math.PI * 0.7);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, R * 2, kickAng + 0.3, kickAng + Math.PI);
      ctx.stroke();
    }

    // ── ARG: Soccer ball orbit ──
    if (iso === "ARG" && sa > 0) {
      ctx.globalAlpha = prog * 0.7;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000000";
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1;
      const ballAng = frame * 0.12;
      const ballD = R * 2;
      const bx2 = m.x + Math.cos(ballAng) * ballD;
      const by2 = m.y + Math.sin(ballAng) * ballD;
      ctx.beginPath(); ctx.arc(bx2, by2, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Pentagon pattern
      for (let i = 0; i < 5; i++) {
        const pa = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(bx2, by2);
        ctx.lineTo(bx2 + Math.cos(pa) * 6, by2 + Math.sin(pa) * 6);
        ctx.stroke();
      }
    }

    // Generic afterimages fallback for other charge types
    if (getSpecialType(iso) === "charge" && !["JPN", "RUS", "VNM", "GBR"].includes(iso)) {
      for (const ai of m.afterImages) {
        ctx.globalAlpha = ai.alpha * 0.5;
        ctx.beginPath(); ctx.arc(ai.x, ai.y, ai.r, 0, Math.PI * 2);
        ctx.fillStyle = skClr; ctx.fill();
      }
    }

    ctx.restore();
  }

  // Motion trails
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
    const breathe = 1 + Math.sin(frame * 0.06 + m.fighter.iso3.charCodeAt(0)) * 0.015;
    const displayR = (m.rageMode ? m.radius * 1.1 : m.radius) * breathe;

    // Rage aura
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

    // White base
    ctx.beginPath();
    ctx.arc(m.x, m.y, displayR - 1, 0, Math.PI * 2);
    ctx.fillStyle = flash ? "#dc2626" : "#ffffff";
    ctx.fill();

    // Flag image or fallback
    if (!flash) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR - 2, 0, Math.PI * 2);
      ctx.clip();
      const flag = flagMap.get(m.fighter.iso2);
      if (flag && flag.complete && flag.naturalWidth > 0) {
        const imgW = flag.naturalWidth;
        const imgH = flag.naturalHeight;
        const circleD = (displayR - 2) * 2;
        const scale = circleD / Math.min(imgW, imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        try { ctx.drawImage(flag, m.x - drawW / 2, m.y - drawH / 2, drawW, drawH); } catch { /* ignore */ }
      } else {
        // Fallback: gradient + flag emoji
        const fGrad = ctx.createRadialGradient(m.x - displayR * 0.3, m.y - displayR * 0.3, 0, m.x, m.y, displayR);
        fGrad.addColorStop(0, m.color);
        fGrad.addColorStop(1, m.bgColor);
        ctx.fillStyle = fGrad;
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.max(14, Math.round(displayR * 0.8))}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(m.fighter.flag, m.x, m.y);
      }
      ctx.restore();
    }

    // Border ring
    ctx.save();
    ctx.shadowColor = flash ? "#fca5a5" : m.color;
    ctx.shadowBlur = flash ? 16 : 10;
    ctx.beginPath();
    ctx.arc(m.x, m.y, displayR, 0, Math.PI * 2);
    ctx.strokeStyle = flash ? "#fca5a5" : m.color;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    // HP bar
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

    // Country label
    const fSize = Math.max(9, Math.round(displayR * 0.35));
    ctx.font = `bold ${fSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillText(m.fighter.name, m.x + 0.5, barY + barH + 3.5);
    ctx.fillStyle = "#d4d4d8";
    ctx.fillText(m.fighter.name, m.x, barY + barH + 3);

    // Skill buff active indicator
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
      // Inner glow
      ctx.globalAlpha = pulse * 0.3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, displayR + 4, 0, Math.PI * 2);
      ctx.fillStyle = sk.color;
      ctx.fill();
      ctx.restore();
    }
    // Slow debuff: icy overlay
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

  // Particles
  for (const p of particles) {
    const alpha = Math.max(0, Math.min(1, p.life / 20));
    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.char) {
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
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * Math.min(1, p.life / 15)), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.restore();
  }

  // Floating texts
  for (const ft of texts) {
    const alpha = Math.min(1, ft.life / 15);
    const size = ft.size || 13;
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${size}px system-ui, -apple-system, sans-serif`;
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

  // ── Year HUD (top-center) ──
  if (currentYear !== undefined) {
    const yp = yearProgress ?? 0;
    // Big year number
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `bold ${Math.round(W * 0.065)}px "SF Mono", "Cascadia Code", Consolas, monospace`;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    const yearStr = `${currentYear}`;
    ctx.strokeText(yearStr, W / 2, 12);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(yearStr, W / 2, 12);

    // Progress bar under year
    const barW = Math.min(140, W * 0.3);
    const barH = 3;
    const barX = W / 2 - barW / 2;
    const barY = 16 + W * 0.065;
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = "rgba(251, 191, 36, 0.6)";
    ctx.fillRect(barX, barY, barW * yp, barH);
    ctx.restore();
  }

  ctx.restore();
}

/* ═══════════════════════════════════════════════
   LOCALIZATION
   ═══════════════════════════════════════════════ */

const L = {
  ko: {
    title: "나라 배틀로얄",
    subtitle: "경제력으로 국가 대결! 2개국부터 전세계 40개국까지",
    pick: "참전국을 고르세요",
    selected: (n: number) => `${n}개국`,
    random: "랜덤 8",
    randomAll: "전체 참전",
    start: "배틀 시작!",
    need: (n: number) => `${n}개 더 선택하세요`,
    loading: "경제 데이터 로딩 중...",
    alive: (n: number) => `생존 ${n}`,
    champion: "세계 경제 패권국",
    statsTitle: "경제 리포트",
    dmg: "피해량",
    kills: "흡수",
    crits: "인플레 공격",
    again: "다시 하기",
    speed: (x: number) => `${x}x`,
    skip: "스킵",
    fight: "개전!",
    fighters: "참전국",
    search: "국가 검색...",
    all: "전체",
    asia: "아시아",
    americas: "미주",
    europe: "유럽",
    other: "기타",
    notEnough: "경제 데이터를 4개국 이상 로딩하지 못했습니다. 다시 시도해주세요.",
    share: "결과 공유",
    copied: "링크 복사됨!",
    rematch: "같은 국가 재경기",
    shareText: (winner: string, countries: string[]) =>
      `나라 배틀로얄 결과\n\n세계 경제 패권국: ${winner}\n참전국: ${countries.join(", ")}\n\n같은 국가로 배틀해보세요!`,
    statNote: "인구->HP  GDP->ATK  수출->SPD  인플레->CRT  1인당GDP->DEF  FDI->DRN  인구->SIZE  부채->DEBUFF",
    evWin: (name: string, flag: string) => `[마감] ${flag} ${name}, 세계 경제를 독점하다!`,
    gdpLabel: "GDP",
    growthLabel: "성장률",
    popLabel: "인구",
    debtLabel: "부채",
    gdppcLabel: "1인당",
  },
  en: {
    title: "Country Battle Royale",
    subtitle: "Nations clash with economic power! 2 to 40 countries",
    pick: "Pick your countries",
    selected: (n: number) => `${n} countries`,
    random: "Random 8",
    randomAll: "All Nations",
    start: "Start Battle!",
    need: (n: number) => `Pick ${n} more`,
    loading: "Loading economic data...",
    alive: (n: number) => `${n} alive`,
    champion: "World Economic Hegemon",
    statsTitle: "Economic Report",
    dmg: "Damage",
    kills: "Absorbed",
    crits: "Inflation Attacks",
    again: "Play Again",
    speed: (x: number) => `${x}x`,
    skip: "Skip",
    fight: "CLASH!",
    fighters: "CONTENDERS",
    search: "Search countries...",
    all: "All",
    asia: "Asia",
    americas: "Americas",
    europe: "Europe",
    other: "Other",
    notEnough: "Could not load enough country data. Please try again.",
    share: "Share Results",
    copied: "Link copied!",
    rematch: "Rematch",
    shareText: (winner: string, countries: string[]) =>
      `Country Battle Royale\n\nWorld Economic Hegemon: ${winner}\nContenders: ${countries.join(", ")}\n\nBattle with the same countries!`,
    statNote: "Pop->HP  GDP->ATK  Export->SPD  Inflation->CRT  GDPpc->DEF  FDI->DRN  Pop->SIZE  Debt->DEBUFF",
    evWin: (name: string, flag: string) => `[CLOSE] ${flag} ${name} achieves world economic hegemony!`,
    gdpLabel: "GDP",
    growthLabel: "Growth",
    popLabel: "Pop",
    debtLabel: "Debt",
    gdppcLabel: "GDPpc",
  },
} as const;

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function CountryBattleClient() {
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
  const [lobbyTab, setLobbyTab] = useState<"all" | "asia" | "americas" | "europe" | "other">("all");
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
  const flagMapRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const timeSeriesRef = useRef<Map<string, Map<number, CountryData>>>(new Map());
  const yearsRef = useRef<number[]>(getYears());
  const yearIdxRef = useRef(0);
  const yearFrameRef = useRef(0);  // frames elapsed in current year
  const [currentYear, setCurrentYear] = useState(2000);

  const filteredPool = useMemo(() => {
    let list = [...COUNTRIES];
    if (lobbyTab !== "all") list = list.filter(c => c.region === lobbyTab);
    if (lobbyQuery.trim()) {
      const q = lobbyQuery.trim().toLowerCase();
      list = list.filter(c =>
        c.iso3.toLowerCase().includes(q) ||
        c.name.ko.toLowerCase().includes(q) ||
        c.name.en.toLowerCase().includes(q) ||
        c.flag.includes(q)
      );
    }
    return list;
  }, [lobbyQuery, lobbyTab]);

  // Auto-select from URL
  useEffect(() => {
    const sParam = searchParams.get("s");
    if (sParam && phase === "lobby") {
      const codes = sParam.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
      const valid = codes.filter(c => COUNTRIES.some(p => p.iso3 === c));
      if (valid.length >= 2) {
        setSelected(new Set(valid.slice(0, 8)));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { isKoRef.current = isKo; }, [isKo]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [battleLogs.length]);

  const toggle = useCallback((iso3: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(iso3)) next.delete(iso3);
      else if (next.size < 40) next.add(iso3);
      return next;
    });
  }, []);

  const randomPick = useCallback((count: number = 8) => {
    const shuffled = [...COUNTRIES].sort(() => Math.random() - 0.5);
    setSelected(new Set(shuffled.slice(0, count).map(c => c.iso3)));
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(COUNTRIES.map(c => c.iso3)));
  }, []);

  const finishBattle = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(animRef.current);
    clearInterval(logSyncRef.current);

    const winner = marblesRef.current.find(m => m.alive);
    const ko = isKoRef.current;
    if (winner) pendingLogsRef.current.push(ko ? L.ko.evWin(winner.fighter.name, winner.fighter.flag) : L.en.evWin(winner.fighter.name, winner.fighter.flag));

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
    const years = yearsRef.current;
    const FRAMES_PER_YEAR = 120;
    let safety = 0;
    while (marblesRef.current.filter(m => m.alive).length > 1 && safety < 100000) {
      frameRef.current++;
      yearFrameRef.current++;
      // Year progression during skip
      if (yearFrameRef.current >= FRAMES_PER_YEAR) {
        yearFrameRef.current = 0;
        const nextIdx = yearIdxRef.current + 1;
        if (nextIdx < years.length) {
          yearIdxRef.current = nextIdx;
          applyYearUpdate(marblesRef.current, timeSeriesRef.current, years[nextIdx], textsRef.current, particlesRef.current, ko);
        }
      }
      physicsStep(marblesRef.current, w, h, cooldownRef.current, textsRef.current, particlesRef.current, ringsRef.current, pendingLogsRef.current, ko, frameRef.current, shakeRef.current);
      safety++;
    }
    setCurrentYear(years[yearIdxRef.current] ?? 2023);
    finishBattle();
  }, [finishBattle]);

  const startBattle = useCallback(async () => {
    if (selected.size < 2) return;
    setPhase("loading");
    try {
      const iso3List = Array.from(selected);
      const presets = iso3List.map(iso => COUNTRIES.find(c => c.iso3 === iso)!);
      const iso2List = presets.map(p => p.iso2);

      // Fetch latest data + time-series + flags in parallel
      const [countryDataArr, tsData, flagMap] = await Promise.all([
        fetchAllCountryData(iso3List),
        fetchTimeSeriesData(iso3List),
        preloadFlags(iso2List),
      ]);
      flagMapRef.current = flagMap;
      timeSeriesRef.current = tsData;
      yearIdxRef.current = 0;
      yearFrameRef.current = 0;

      // Use year 2000 data as starting stats (time-series mode)
      const years = yearsRef.current;
      const startYear = years[0] ?? 2000;

      const loaded: Fighter[] = [];
      for (let i = 0; i < iso3List.length; i++) {
        const preset = presets[i];
        // Try 2000 from time-series, fallback to latest
        const tsYearData = tsData.get(preset.iso3)?.get(startYear);
        const data = tsYearData ?? countryDataArr[i];
        if (!data) continue;

        const stats = toGameStats(data);
        const palette = PALETTE[i % PALETTE.length];

        // Format labels (from latest data for display)
        const latestData = countryDataArr[i] ?? data;
        const gdp = latestData.gdp ?? 0;
        const gdpLabel = gdp >= 1e12 ? `$${(gdp / 1e12).toFixed(1)}T` : gdp >= 1e9 ? `$${(gdp / 1e9).toFixed(0)}B` : `$${(gdp / 1e6).toFixed(0)}M`;
        const growthPct = `${(latestData.gdpGrowth ?? 0).toFixed(1)}%`;
        const pop = latestData.population ?? 0;
        const popLabel = pop >= 1e9 ? `${(pop / 1e9).toFixed(1)}B` : pop >= 1e6 ? `${(pop / 1e6).toFixed(0)}M` : `${(pop / 1e3).toFixed(0)}K`;
        const debtPct = `${(latestData.debt ?? 0).toFixed(0)}%`;
        const gdppc = pop > 0 ? gdp / pop : 0;
        const gdppcLabel = gdppc >= 1000 ? `$${(gdppc / 1000).toFixed(1)}K` : `$${gdppc.toFixed(0)}`;

        loaded.push({
          iso3: preset.iso3,
          name: isKo ? preset.name.ko : preset.name.en,
          flag: preset.flag,
          iso2: preset.iso2,
          stats,
          skill: getSkill(preset.iso3),
          canvasColor: palette.color, canvasBg: palette.bg,
          hp: stats.hp, alive: true,
          kills: 0, totalDamage: 0, critsLanded: 0, deathOrder: 0,
          gdpLabel, growthPct, popLabel, debtPct, gdppcLabel,
        });
      }

      if (loaded.length < 2) { alert(t.notEnough); setPhase("lobby"); return; }

      fightersRef.current = loaded;
      setFighters(loaded);
      setBattleLogs([]);
      setAliveCnt(loaded.length);
      setCurrentYear(startYear);
      doneRef.current = false;
      setIntroPhase("cards");
      setPhase("battle");
      setTimeout(() => setIntroPhase("fight"), 3000);
      setTimeout(() => setIntroPhase("none"), 4200);
    } catch (err) {
      console.error(err);
      setPhase("lobby");
    }
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
    yearFrameRef.current = 0;
    pendingLogsRef.current = [];

    // Year progression: ~120 frames per year at speed 1 (~2s per year)
    const FRAMES_PER_YEAR = 120;

    const loop = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || doneRef.current) return;

      for (let s = 0; s < speedRef.current; s++) {
        frameRef.current++;
        yearFrameRef.current++;

        // ── Year progression ──
        if (yearFrameRef.current >= FRAMES_PER_YEAR) {
          yearFrameRef.current = 0;
          const years = yearsRef.current;
          const nextIdx = yearIdxRef.current + 1;
          if (nextIdx < years.length) {
            yearIdxRef.current = nextIdx;
            const newYear = years[nextIdx];
            setCurrentYear(newYear);

            // Apply year update to all alive marbles
            applyYearUpdate(
              marblesRef.current,
              timeSeriesRef.current,
              newYear,
              textsRef.current,
              particlesRef.current,
              isKoRef.current,
            );

            // Log year change
            const ko = isKoRef.current;
            pendingLogsRef.current.push(
              ko ? `--- ${newYear}년 ---` : `--- Year ${newYear} ---`
            );
          }
        }

        physicsStep(marblesRef.current, w, h, cooldownRef.current, textsRef.current, particlesRef.current, ringsRef.current, pendingLogsRef.current, isKoRef.current, frameRef.current, shakeRef.current);
      }

      const years = yearsRef.current;
      const yearProg = Math.min(1, yearFrameRef.current / FRAMES_PER_YEAR);

      ctx.save();
      ctx.scale(dpr, dpr);
      drawFrame(ctx, marblesRef.current, textsRef.current, particlesRef.current, ringsRef.current, w, h, frameRef.current, flagMapRef.current, shakeRef.current.value, years[yearIdxRef.current], yearProg);
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
    setCurrentYear(2000);
    doneRef.current = false;
    fightersRef.current = [];
    marblesRef.current = [];
    yearIdxRef.current = 0;
    yearFrameRef.current = 0;
  }, []);

  const buildShareUrl = useCallback(() => {
    const codes = fighters.map(f => f.iso3).join(",");
    const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    return `${base}?s=${encodeURIComponent(codes)}`;
  }, [fighters]);

  const handleShare = useCallback(async () => {
    const winner = fighters.find(f => f.alive);
    const names = fighters.map(f => `${f.flag}${f.name}`);
    const url = buildShareUrl();
    const text = t.shareText(winner ? `${winner.flag}${winner.name}` : "?", names);

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
    const codes = fighters.map(f => f.iso3);
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

  /* ═══════════════════════════════════════════════
     RENDER — BATTLE
     ═══════════════════════════════════════════════ */
  if (phase === "battle") {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-hidden">
        {/* Intro Cards */}
        {introPhase === "cards" && fighters.length > 0 && (
          <div className="absolute inset-0 z-50 bg-black/92 flex flex-col items-center justify-center p-3 overflow-auto animate-in fade-in duration-300">
            <h2 className="text-yellow-400 font-black text-lg sm:text-xl mb-3 tracking-widest flex items-center gap-2">
              <Swords size={20} /> {t.fighters} ({fighters.length}) <Swords size={20} />
            </h2>
            {fighters.length <= 10 ? (
              /* ── Full stat cards (10 or fewer) ── */
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl w-full">
                {fighters.map((f) => (
                  <div key={f.iso3} className="bg-zinc-900/90 rounded-xl p-2.5 border border-zinc-700/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <img src={`https://flagcdn.com/w40/${f.iso2}.png`} alt={f.flag} width={28} height={21} className="rounded-sm shadow-sm object-cover" />
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
                      <span className="text-zinc-500">DRN <span className="text-pink-400 font-bold">{f.stats.drain}</span></span>
                      <span className="text-zinc-500">POP <span className="text-cyan-400 font-bold">{f.popLabel}</span></span>
                      <span className="text-zinc-500">DBT <span className="text-orange-400 font-bold">{f.debtPct}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Compact view (11+ countries) ── */
              <div className="max-w-2xl w-full">
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[...fighters].sort((a, b) => b.stats.maxHp - a.stats.maxHp).map((f) => (
                    <div key={f.iso3} className="bg-zinc-900/80 rounded-lg px-2 py-1.5 border border-zinc-700/40 flex items-center gap-1.5">
                      <img src={`https://flagcdn.com/w40/${f.iso2}.png`} alt={f.flag} width={20} height={15} className="rounded-sm object-cover" />
                      <span className="text-white text-[10px] font-bold">{f.name}</span>
                      <span className="text-zinc-500 text-[9px]">HP<span className="text-zinc-300 font-bold ml-0.5">{f.stats.maxHp}</span></span>
                      <span className="text-[8px] font-medium" style={{ color: f.skill.color }}>{isKo ? f.skill.nameKo : f.skill.nameEn}</span>
                    </div>
                  ))}
                </div>
                <p className="text-zinc-500 text-[10px] text-center mt-2">{isKo ? "HP 순으로 정렬" : "Sorted by HP"}</p>
              </div>
            )}
            <p className="text-zinc-600 text-[10px] mt-3">{t.statNote}</p>
          </div>
        )}
        {/* FIGHT Flash */}
        {introPhase === "fight" && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 animate-in zoom-in duration-200">
            <span className="text-6xl sm:text-8xl font-black text-white tracking-[0.2em] animate-pulse">{t.fight}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-red-500 text-xs font-bold animate-pulse">LIVE</span>
            <span className="text-zinc-400 text-xs">{t.alive(aliveCnt)}</span>
            <span className="text-yellow-400/70 text-xs font-mono font-bold">{currentYear}</span>
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
              line.includes("[속보]") || line.includes("[BREAKING]") ? "text-red-400 font-bold"
              : line.includes("[마감]") || line.includes("[CLOSE]") ? "text-yellow-400 font-bold"
              : line.includes("인플레") || line.includes("inflation") ? "text-orange-300"
              : line.includes("위기") || line.includes("crisis") ? "text-orange-400 font-bold"
              : line.includes("GDP") ? "text-cyan-400 font-bold"
              : line.includes("FDI") ? "text-green-400"
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
            <img src={`https://flagcdn.com/w160/${winner?.iso2 ?? "un"}.png`} alt={winner?.flag ?? ""} width={80} height={60} className="rounded shadow-lg object-cover" />
            <p className="text-2xl font-black text-white">{winner?.name}</p>
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
                  <th className="px-2 py-1.5 text-left">{isKo ? "국가" : "Country"}</th>
                  <th className="px-2 py-1.5 text-right">{t.dmg}</th>
                  <th className="px-2 py-1.5 text-right">{t.kills}</th>
                  <th className="px-2 py-1.5 text-right">{t.crits}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((f, i) => (
                  <tr key={f.iso3} className={`border-t border-zinc-800 ${i === 0 ? "bg-yellow-900/10" : ""}`}>
                    <td className="px-2 py-1.5 text-zinc-500 font-bold">{i === 0 ? "🏆" : `#${i + 1}`}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <img src={`https://flagcdn.com/w40/${f.iso2}.png`} alt={f.flag} width={20} height={15} className="rounded-sm object-cover" />
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
                copied ? "bg-green-600 text-white" : "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white"
              }`}
            >
              {copied ? <><Check size={16} /> {t.copied}</> : <><Share2 size={16} /> {t.share}</>}
            </button>
            <button onClick={rematch}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
            >
              <Link2 size={16} /> {t.rematch}
            </button>
            <button onClick={reset}
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
  const canStart = selected.size >= 2;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-20">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 text-xs font-bold mb-3">
          <Swords size={14} /> {t.title}
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">{t.title}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t.subtitle}</p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.pick}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-violet-600">{t.selected(selected.size)}</span>
          <button onClick={() => randomPick(8)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition">
            <Shuffle size={14} /> {t.random}
          </button>
          <button onClick={selectAll} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-xs font-bold text-red-600 dark:text-red-400 transition border border-red-200 dark:border-red-800">
            {t.randomAll}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="text" value={lobbyQuery} onChange={e => setLobbyQuery(e.target.value)}
            placeholder={t.search}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0">
          {(["all", "asia", "americas", "europe", "other"] as const).map(tab => (
            <button key={tab} onClick={() => setLobbyTab(tab)}
              className={`px-2 py-2 text-xs font-bold transition ${lobbyTab === tab ? "bg-violet-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >{t[tab]}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 max-h-[50vh] overflow-y-auto pr-1">
        {filteredPool.map(country => {
          const sel = selected.has(country.iso3);
          return (
            <button key={country.iso3} onClick={() => toggle(country.iso3)}
              className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${
                sel ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-2 ring-violet-300 shadow-sm"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm"
              }`}
            >
              <img
                src={`https://flagcdn.com/w40/${country.iso2}.png`}
                alt={country.flag}
                width={28}
                height={21}
                className="shrink-0 rounded-sm shadow-sm object-cover"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                  {isKo ? country.name.ko : country.name.en}
                </p>
                <p className="text-[10px] truncate" style={{ color: getSkill(country.iso3).color }}>
                  {isKo ? getSkill(country.iso3).nameKo : getSkill(country.iso3).nameEn}
                </p>
              </div>
              {sel && <span className="text-violet-600 font-bold text-sm">✓</span>}
            </button>
          );
        })}
      </div>

      <button disabled={!canStart || phase === "loading"} onClick={startBattle}
        className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition sticky bottom-4 ${
          canStart ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/30"
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
