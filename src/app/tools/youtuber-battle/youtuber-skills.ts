/**
 * YouTuber skill system — 4 skills per channel, LoL-style
 *
 * Each YouTuber gets exactly 4 skills (Q/W/E/R style):
 *   Q = onAttack (offensive)
 *   W = onDamaged (defensive)
 *   E = periodic (sustain/utility)
 *   R = threshold/onKill (ultimate, clutch)
 *
 * Skills are deterministically assigned from channel ID seed.
 */

/* ═══════════════════════════════════════════════
   ELEMENT / ATTRIBUTE SYSTEM
   ═══════════════════════════════════════════════ */

export type ElementType = "fire" | "water" | "wind" | "earth" | "light" | "dark" | "neutral";

export interface ElementInfo {
  type: ElementType;
  nameKo: string;
  nameEn: string;
  icon: string;
  color: string;
  glow: string;
}

export const ELEMENT_INFO: Record<ElementType, ElementInfo> = {
  fire:    { type: "fire",    nameKo: "불",  nameEn: "Fire",    icon: "🔥", color: "#ef4444", glow: "#ff6b6b" },
  water:   { type: "water",   nameKo: "물",  nameEn: "Water",   icon: "💧", color: "#3b82f6", glow: "#60a5fa" },
  wind:    { type: "wind",    nameKo: "풍",  nameEn: "Wind",    icon: "🌪", color: "#22c55e", glow: "#4ade80" },
  earth:   { type: "earth",   nameKo: "땅",  nameEn: "Earth",   icon: "🪨", color: "#a16207", glow: "#ca8a04" },
  light:   { type: "light",   nameKo: "빛",  nameEn: "Light",   icon: "✨", color: "#eab308", glow: "#fde047" },
  dark:    { type: "dark",    nameKo: "암",  nameEn: "Dark",    icon: "🌑", color: "#7c3aed", glow: "#a78bfa" },
  neutral: { type: "neutral", nameKo: "무",  nameEn: "Neutral", icon: "⚪", color: "#6b7280", glow: "#9ca3af" },
};

/**
 * YouTube topicId → Element mapping table.
 * Uses curated Freebase topic IDs returned by YouTube Data API v3.
 */
const TOPIC_ELEMENT_MAP: Record<string, ElementType> = {
  // ── Fire: Entertainment & Gaming ──
  "/m/02jjt":   "fire",    // Entertainment (parent)
  "/m/0bzvm2":  "fire",    // Gaming (parent)
  "/m/09kqc":   "fire",    // Humor
  "/m/02vxn":   "fire",    // Movies
  "/m/0f2f9":   "fire",    // TV shows
  "/m/066wd":   "fire",    // Professional wrestling
  "/m/05qjc":   "fire",    // Performing arts
  "/m/025zzc":  "fire",    // Action game
  "/m/02ntfj":  "fire",    // Action-adventure game
  "/m/0b1vjn":  "fire",    // Casual game
  "/m/02hygl":  "fire",    // Music video game
  "/m/04q1x3q": "fire",    // Puzzle video game
  "/m/01sjng":  "fire",    // Racing video game
  "/m/0403l3g": "fire",    // Role-playing video game
  "/m/021bp2":  "fire",    // Simulation video game
  "/m/022dc6":  "fire",    // Sports game
  "/m/03hf_rm": "fire",    // Strategy video game

  // ── Water: Music ──
  "/m/04rlf":   "water",   // Music (parent)
  "/m/02mscn":  "water",   // Christian music
  "/m/0ggq0m":  "water",   // Classical music
  "/m/01lyv":   "water",   // Country
  "/m/02lkt":   "water",   // Electronic music
  "/m/0glt670": "water",   // Hip hop music
  "/m/05rwpb":  "water",   // Independent music
  "/m/03_d0":   "water",   // Jazz
  "/m/028sqc":  "water",   // Music of Asia
  "/m/0g293":   "water",   // Music of Latin America
  "/m/064t9":   "water",   // Pop music
  "/m/06cqb":   "water",   // Reggae
  "/m/06j6l":   "water",   // Rhythm and blues
  "/m/06by7":   "water",   // Rock music
  "/m/0gywn":   "water",   // Soul music

  // ── Wind: Sports & Fitness ──
  "/m/06ntj":   "wind",    // Sports (parent)
  "/m/0jm_":    "wind",    // American football
  "/m/018jz":   "wind",    // Baseball
  "/m/018w8":   "wind",    // Basketball
  "/m/01cgz":   "wind",    // Boxing
  "/m/09xp_":   "wind",    // Cricket
  "/m/02vx4":   "wind",    // Football
  "/m/037hz":   "wind",    // Golf
  "/m/03tmr":   "wind",    // Ice hockey
  "/m/01h7lh":  "wind",    // Mixed martial arts
  "/m/0410tth": "wind",    // Motorsport
  "/m/07bs0":   "wind",    // Tennis
  "/m/07_53":   "wind",    // Volleyball
  "/m/027x7n":  "wind",    // Fitness

  // ── Earth: Knowledge & Technology ──
  "/m/01k8wb":  "earth",   // Knowledge
  "/m/07c1v":   "earth",   // Technology
  "/m/07bxq":   "earth",   // Tourism
  "/m/07yv9":   "earth",   // Vehicles
  "/m/03glg":   "earth",   // Hobby

  // ── Light: Lifestyle ──
  "/m/019_rr":  "light",   // Lifestyle (parent)
  "/m/032tl":   "light",   // Fashion
  "/m/041xxh":  "light",   // Physical attractiveness / Beauty
  "/m/02wbm":   "light",   // Food
  "/m/068hy":   "light",   // Pets

  // ── Dark: Society ──
  "/m/098wr":   "dark",    // Society (parent)
  "/m/09s1f":   "dark",    // Business
  "/m/0kt51":   "dark",    // Health
  "/m/01h6rj":  "dark",    // Military
  "/m/05qt0":   "dark",    // Politics
  "/m/06bvp":   "dark",    // Religion
};

/**
 * Determine channel element from YouTube topicIds.
 * Returns the first matched element, or "neutral" if none found.
 */
export function getChannelElement(topicIds: string[]): ElementType {
  for (const tid of topicIds) {
    const el = TOPIC_ELEMENT_MAP[tid];
    if (el) return el;
  }
  return "neutral";
}

/**
 * Advantage table:
 *   Earth -> Water -> Fire -> Wind -> Earth  (후자가 전자를 이김)
 *   즉: Water beats Fire, Fire beats Wind, Wind beats Earth, Earth beats Water
 *   Dark <=> Light (서로 유리)
 *
 * Returns: 1.2 (advantage), 0.8 (disadvantage), 1.0 (neutral)
 */
export function getElementAdvantage(attacker: ElementType, defender: ElementType): number {
  if (attacker === "neutral" || defender === "neutral") return 1.0;
  if (attacker === defender) return 1.0;

  // Dark <=> Light mutual advantage
  if ((attacker === "dark" && defender === "light") || (attacker === "light" && defender === "dark")) {
    return 1.2;
  }

  // Cyclic: Water > Fire > Wind > Earth > Water
  const BEATS: Record<string, ElementType> = {
    water: "fire",
    fire:  "wind",
    wind:  "earth",
    earth: "water",
  };

  if (BEATS[attacker] === defender) return 1.2;   // attacker beats defender
  if (BEATS[defender] === attacker) return 0.8;   // defender beats attacker
  return 1.0;
}

/* ═══════════════════════════════════════════════
   SKILL INTERFACES & POOLS
   ═══════════════════════════════════════════════ */

export interface YouTuberSkill {
  id: string;
  nameKo: string;
  nameEn: string;
  descKo: string;
  descEn: string;
  type: "onDamaged" | "onAttack" | "periodic" | "threshold" | "onKill" | "ultimate";
  hpThreshold?: number;
  interval?: number;
  color: string;
  slot: "Q" | "W" | "E" | "R";
}

/* ═══════════════════════════════════════════════
   Q POOL — onAttack (offensive)
   ═══════════════════════════════════════════════ */

const Q_POOL: YouTuberSkill[] = [
  { id: "critical-eye", slot: "Q", nameKo: "크리티컬 아이", nameEn: "Critical Eye", descKo: "크리티컬 확률 2배", descEn: "Crit rate doubled", type: "onAttack", color: "#fbbf24" },
  { id: "power-strike", slot: "Q", nameKo: "파워 스트라이크", nameEn: "Power Strike", descKo: "25% 확률 데미지 2배", descEn: "25% chance 2x dmg", type: "onAttack", color: "#ef4444" },
  { id: "venom", slot: "Q", nameKo: "독침", nameEn: "Venom Sting", descKo: "공격 시 적 둔화 2초", descEn: "Slow enemy 2s on hit", type: "onAttack", color: "#a855f7" },
  { id: "chaos-strike", slot: "Q", nameKo: "카오스 스트라이크", nameEn: "Chaos Strike", descKo: "데미지 +80% 또는 -30%", descEn: "+80% or -30% dmg", type: "onAttack", color: "#f97316" },
  { id: "armor-break", slot: "Q", nameKo: "방어 관통", nameEn: "Armor Break", descKo: "적 DEF 무시", descEn: "Ignore enemy DEF", type: "onAttack", color: "#dc2626" },
  { id: "life-steal", slot: "Q", nameKo: "흡혈", nameEn: "Life Steal", descKo: "데미지 15% HP 회복", descEn: "Heal 15% of dmg dealt", type: "onAttack", color: "#e11d48" },
  { id: "double-tap", slot: "Q", nameKo: "더블 탭", nameEn: "Double Tap", descKo: "20% 확률 2연타", descEn: "20% chance double hit", type: "onAttack", color: "#fb923c" },
  { id: "execute", slot: "Q", nameKo: "처형", nameEn: "Execute", descKo: "적 HP 30% 이하 시 데미지 2배", descEn: "2x dmg if enemy HP < 30%", type: "onAttack", color: "#7f1d1d" },
  { id: "chain-lightning", slot: "Q", nameKo: "체인 라이트닝", nameEn: "Chain Lightning", descKo: "10% 확률 3배 데미지", descEn: "10% chance 3x dmg", type: "onAttack", color: "#38bdf8" },
  { id: "blaze", slot: "Q", nameKo: "점화", nameEn: "Blaze", descKo: "공격 시 추가 고정 데미지 30", descEn: "Bonus 30 true damage on hit", type: "onAttack", color: "#f97316" },
];

/* ═══════════════════════════════════════════════
   W POOL — onDamaged (defensive)
   ═══════════════════════════════════════════════ */

const W_POOL: YouTuberSkill[] = [
  { id: "iron-wall", slot: "W", nameKo: "철벽", nameEn: "Iron Wall", descKo: "피해 20% 감소", descEn: "Dmg taken -20%", type: "onDamaged", color: "#60a5fa" },
  { id: "rubber-body", slot: "W", nameKo: "고무 바디", nameEn: "Rubber Body", descKo: "피해 15% 감소 + 반사 10%", descEn: "Dmg -15%, reflect 10%", type: "onDamaged", color: "#4ade80" },
  { id: "thick-skin", slot: "W", nameKo: "두꺼운 피부", nameEn: "Thick Skin", descKo: "크리 피해 50% 감소", descEn: "Crit dmg taken -50%", type: "onDamaged", color: "#22d3ee" },
  { id: "dodge-master", slot: "W", nameKo: "회피의 달인", nameEn: "Dodge Master", descKo: "15% 확률 완전 회피", descEn: "15% chance full dodge", type: "onDamaged", color: "#c084fc" },
  { id: "counter", slot: "W", nameKo: "카운터", nameEn: "Counter", descKo: "받는 피해 25% 반사", descEn: "Reflect 25% dmg taken", type: "onDamaged", color: "#f472b6" },
  { id: "bone-plate", slot: "W", nameKo: "뼈 방패", nameEn: "Bone Plate", descKo: "3회 연속 피격 시 다음 피해 무효", descEn: "Block dmg after 3 consecutive hits", type: "onDamaged", color: "#a3a3a3" },
  { id: "thorn-mail", slot: "W", nameKo: "가시 갑옷", nameEn: "Thorn Mail", descKo: "받는 피해 20% 반사 + 둔화", descEn: "Reflect 20% + slow attacker", type: "onDamaged", color: "#65a30d" },
  { id: "spirit-shield", slot: "W", nameKo: "정신 방벽", nameEn: "Spirit Shield", descKo: "HP 50% 이하에서 피해 30% 감소", descEn: "Dmg -30% when HP < 50%", type: "onDamaged", color: "#8b5cf6" },
];

/* ═══════════════════════════════════════════════
   E POOL — periodic (sustain/utility)
   ═══════════════════════════════════════════════ */

const E_POOL: YouTuberSkill[] = [
  { id: "regen", slot: "E", nameKo: "재생", nameEn: "Regeneration", descKo: "1.5초마다 HP 3% 회복", descEn: "Regen 3% HP / 1.5s", type: "periodic", interval: 90, color: "#4ade80" },
  { id: "power-up", slot: "E", nameKo: "파워업", nameEn: "Power Up", descKo: "2초마다 ATK +5% (최대 +50%)", descEn: "ATK +5% / 2s (max 50%)", type: "periodic", interval: 120, color: "#f97316" },
  { id: "fortify", slot: "E", nameKo: "강화", nameEn: "Fortify", descKo: "2초마다 DEF +1 (최대 +15)", descEn: "DEF +1 / 2s (max +15)", type: "periodic", interval: 120, color: "#3b82f6" },
  { id: "war-cry", slot: "E", nameKo: "전투 함성", nameEn: "War Cry", descKo: "3초마다 주변 적 ATK -10%", descEn: "Nearby enemy ATK -10% / 3s", type: "periodic", interval: 180, color: "#c084fc" },
  { id: "heal-burst", slot: "E", nameKo: "힐 버스트", nameEn: "Heal Burst", descKo: "3초마다 HP 5% 회복", descEn: "Regen 5% HP / 3s", type: "periodic", interval: 180, color: "#22c55e" },
  { id: "bloodlust", slot: "E", nameKo: "피의 갈망", nameEn: "Bloodlust", descKo: "2초마다 ATK +3%, SPD +2%", descEn: "ATK +3%, SPD +2% / 2s", type: "periodic", interval: 120, color: "#dc2626" },
  { id: "aura-of-speed", slot: "E", nameKo: "신속의 오라", nameEn: "Speed Aura", descKo: "이동 속도 영구 +30%", descEn: "Move speed +30%", type: "periodic", interval: 9999, color: "#22d3ee" },
  { id: "mana-burn", slot: "E", nameKo: "마나 소각", nameEn: "Mana Burn", descKo: "2초마다 가장 가까운 적 HP -2%", descEn: "Nearest enemy HP -2% / 2s", type: "periodic", interval: 120, color: "#7c3aed" },
];

/* ═══════════════════════════════════════════════
   R POOL — threshold + onKill (ultimate)
   ═══════════════════════════════════════════════ */

const R_POOL: YouTuberSkill[] = [
  { id: "shadow-clone", slot: "R", nameKo: "분신술", nameEn: "Shadow Clone", descKo: "분신 2마리 소환, 함께 돌격", descEn: "Summon 2 clones (30% HP) that charge", type: "ultimate", color: "#c084fc" },
  { id: "flash-slash", slot: "R", nameKo: "일섬", nameEn: "Flash Slash", descKo: "직선으로 돌진, 경로 전원 넉백+피해", descEn: "Dash in a line, knockback + dmg all in path", type: "ultimate", color: "#f43f5e" },
  { id: "missile-barrage", slot: "R", nameKo: "다연발 미사일", nameEn: "Missile Barrage", descKo: "호밍 미사일 8발 발사", descEn: "Fire 8 homing missiles", type: "ultimate", color: "#fb923c" },
  { id: "gigantify", slot: "R", nameKo: "거대화", nameEn: "Gigantify", descKo: "HP 1.5배, 크기 ↑, 충돌 데미지 ↑", descEn: "HP x1.5, size up, collision dmg up", type: "ultimate", color: "#22d3ee" },
  { id: "black-hole", slot: "R", nameKo: "블랙홀", nameEn: "Black Hole", descKo: "주변 적을 빨아들이며 AoE 피해", descEn: "Pull nearby enemies + AoE damage", type: "ultimate", color: "#7c3aed" },
  { id: "thunder-storm", slot: "R", nameKo: "번개 폭풍", nameEn: "Thunder Storm", descKo: "무작위 5회 낙뢰, 넉백", descEn: "5 random lightning strikes + knockback", type: "ultimate", color: "#38bdf8" },
  { id: "phoenix", slot: "R", nameKo: "불사조", nameEn: "Phoenix", descKo: "HP 40% 회복 + 주변 화염 폭발", descEn: "Heal 40% HP + fire AoE around", type: "ultimate", color: "#f97316" },
  { id: "meteor", slot: "R", nameKo: "메테오", nameEn: "Meteor Strike", descKo: "가장 센 적에게 돌진, 착지 AoE + 스턴", descEn: "Charge at strongest, AoE impact + stun", type: "ultimate", color: "#dc2626" },
  { id: "frost-field", slot: "R", nameKo: "빙결장", nameEn: "Frost Field", descKo: "전체 적 5초 빙결 + 데미지", descEn: "Freeze all enemies 5s + damage", type: "ultimate", color: "#67e8f9" },
  { id: "rage-burst", slot: "R", nameKo: "분노 폭발", nameEn: "Rage Burst", descKo: "5초간 ATK 3배 + 초고속 돌진", descEn: "ATK x3 + hyper speed for 5s", type: "ultimate", color: "#ef4444" },
  { id: "machine-gun", slot: "R", nameKo: "머신건", nameEn: "Machine Gun", descKo: "전방으로 총알 20발 연사", descEn: "Rapid-fire 20 bullets forward", type: "ultimate", color: "#facc15" },
];

/* ═══════════════════════════════════════════════
   SEEDED RANDOM — deterministic from channel ID
   ═══════════════════════════════════════════════ */

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Get exactly 4 skills for a YouTuber (Q/W/E/R), deterministic from channelId.
 */
export function getYoutuberSkills(channelId: string): YouTuberSkill[] {
  const hash = hashCode(channelId);
  const rng = seededRandom(hash);

  const q = Q_POOL[Math.floor(rng() * Q_POOL.length)];
  const w = W_POOL[Math.floor(rng() * W_POOL.length)];
  const e = E_POOL[Math.floor(rng() * E_POOL.length)];
  const r = R_POOL[Math.floor(rng() * R_POOL.length)];

  return [q, w, e, r];
}

/**
 * Get the primary (Q) skill — for lobby display
 */
export function getYoutuberSkill(channelId: string): YouTuberSkill {
  return getYoutuberSkills(channelId)[0];
}
