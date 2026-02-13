/**
 * Country-specific passive skills
 *
 * Each country has ONE unique skill that activates under certain conditions.
 * Skills are designed around real national characteristics.
 *
 * Skill types:
 *  - "onDamaged"  : triggers when taking damage (modify incoming damage)
 *  - "onAttack"   : triggers when dealing damage (modify outgoing damage)
 *  - "periodic"   : triggers every N frames (regen, buff, etc.)
 *  - "threshold"   : triggers once when HP drops below threshold%
 *  - "onKill"     : triggers when absorbing another country
 *  - "yearChange" : triggers when the year advances
 */

export interface CountrySkill {
  id: string;
  nameKo: string;
  nameEn: string;
  descKo: string;
  descEn: string;
  type: "onDamaged" | "onAttack" | "periodic" | "threshold" | "onKill" | "yearChange";
  /** For threshold type: HP % (0~1) */
  hpThreshold?: number;
  /** For periodic type: every N frames */
  interval?: number;
  /** Skill color for visual effects */
  color: string;
}

/** Returns the skill for a given iso3 code */
export function getSkill(iso3: string): CountrySkill {
  return SKILLS[iso3] ?? DEFAULT_SKILL;
}

const DEFAULT_SKILL: CountrySkill = {
  id: "default",
  nameKo: "근성",
  nameEn: "Grit",
  descKo: "체력이 30% 이하일 때 공격력 +20%",
  descEn: "ATK +20% when HP below 30%",
  type: "threshold",
  hpThreshold: 0.3,
  color: "#a1a1aa",
};

const SKILLS: Record<string, CountrySkill> = {
  // ═══════════════════ ASIA ═══════════════════

  KOR: {
    id: "miracle",
    nameKo: "한강의 기적",
    nameEn: "Miracle on the Han",
    descKo: "연도가 지날수록 공격력이 추가 상승",
    descEn: "ATK bonus increases each year",
    type: "yearChange",
    color: "#3b82f6",
  },
  JPN: {
    id: "tech-shield",
    nameKo: "기술력",
    nameEn: "Tech Shield",
    descKo: "받는 데미지 15% 감소",
    descEn: "Incoming damage reduced by 15%",
    type: "onDamaged",
    color: "#f472b6",
  },
  CHN: {
    id: "human-wave",
    nameKo: "인해전술",
    nameEn: "Human Wave",
    descKo: "매 1.5초마다 HP 회복 (최대HP의 2%)",
    descEn: "Regenerate 2% maxHP every 1.5s",
    type: "periodic",
    interval: 90,
    color: "#ef4444",
  },
  IND: {
    id: "jugaad",
    nameKo: "주가드",
    nameEn: "Jugaad",
    descKo: "체력이 낮을수록 공격 속도 증가",
    descEn: "Attack speed increases as HP drops",
    type: "onAttack",
    color: "#f97316",
  },
  TWN: {
    id: "semiconductor",
    nameKo: "반도체 패권",
    nameEn: "Chip Supremacy",
    descKo: "치명타 데미지 2배",
    descEn: "Critical hit damage doubled",
    type: "onAttack",
    color: "#06b6d4",
  },
  IDN: {
    id: "archipelago",
    nameKo: "만섬의 나라",
    nameEn: "Archipelago",
    descKo: "30% 확률로 공격 회피",
    descEn: "30% chance to dodge attacks",
    type: "onDamaged",
    color: "#22c55e",
  },
  SGP: {
    id: "financial-hub",
    nameKo: "금융허브",
    nameEn: "Financial Hub",
    descKo: "적 처치 시 HP 흡수량 2배",
    descEn: "Absorb 2x HP on kill",
    type: "onKill",
    color: "#eab308",
  },
  THA: {
    id: "muay-thai",
    nameKo: "무에타이",
    nameEn: "Muay Thai",
    descKo: "근접 충돌 시 추가 데미지 25%",
    descEn: "+25% damage on close-range collision",
    type: "onAttack",
    color: "#a855f7",
  },
  VNM: {
    id: "guerrilla",
    nameKo: "게릴라전",
    nameEn: "Guerrilla",
    descKo: "HP 40% 이하일 때 공격력 2배",
    descEn: "ATK doubled when HP below 40%",
    type: "threshold",
    hpThreshold: 0.4,
    color: "#16a34a",
  },
  SAU: {
    id: "oil-power",
    nameKo: "석유 패권",
    nameEn: "Oil Power",
    descKo: "매 2초마다 모든 적의 속도 잠시 감소",
    descEn: "Slow all enemies briefly every 2s",
    type: "periodic",
    interval: 120,
    color: "#059669",
  },
  ARE: {
    id: "oil-money",
    nameKo: "오일머니",
    nameEn: "Oil Money",
    descKo: "받는 데미지 20% 감소 (부유한 방어)",
    descEn: "Incoming damage reduced by 20%",
    type: "onDamaged",
    color: "#d4af37",
  },
  MYS: {
    id: "diversity",
    nameKo: "다민족 연합",
    nameEn: "Diversity",
    descKo: "매 3초 무작위 스탯 상승 (밸런스형)",
    descEn: "Random stat boost every 3s",
    type: "periodic",
    interval: 180,
    color: "#0ea5e9",
  },
  PHL: {
    id: "ofw",
    nameKo: "해외동포",
    nameEn: "Overseas Workers",
    descKo: "매 2초 HP 회복 (최대HP의 1.5%)",
    descEn: "Regen 1.5% maxHP every 2s",
    type: "periodic",
    interval: 120,
    color: "#2563eb",
  },

  // ═══════════════════ AMERICAS ═══════════════════

  USA: {
    id: "dollar-hegemony",
    nameKo: "달러 패권",
    nameEn: "Dollar Hegemony",
    descKo: "HP 50% 이하일 때 공격력 40% 증가",
    descEn: "ATK +40% when HP below 50%",
    type: "threshold",
    hpThreshold: 0.5,
    color: "#3b82f6",
  },
  CAN: {
    id: "peacekeeping",
    nameKo: "평화유지군",
    nameEn: "Peacekeeping",
    descKo: "받는 모든 데미지 15% 감소",
    descEn: "All incoming damage reduced by 15%",
    type: "onDamaged",
    color: "#dc2626",
  },
  BRA: {
    id: "samba",
    nameKo: "삼바",
    nameEn: "Samba",
    descKo: "주기적으로 이동속도 2배 폭발 (3초)",
    descEn: "Periodically double speed for 3s",
    type: "periodic",
    interval: 150,
    color: "#16a34a",
  },
  MEX: {
    id: "resilience",
    nameKo: "불굴",
    nameEn: "Resilience",
    descKo: "HP 25% 이하일 때 방어력 2배",
    descEn: "DEF doubled when HP below 25%",
    type: "threshold",
    hpThreshold: 0.25,
    color: "#15803d",
  },
  ARG: {
    id: "hand-of-god",
    nameKo: "신의 손",
    nameEn: "Hand of God",
    descKo: "10% 확률로 데미지 3배",
    descEn: "10% chance to deal 3x damage",
    type: "onAttack",
    color: "#60a5fa",
  },
  CHL: {
    id: "copper",
    nameKo: "구리의 나라",
    nameEn: "Copper Nation",
    descKo: "공격 시 15% 확률로 적 방어력 무시",
    descEn: "15% chance to ignore enemy DEF",
    type: "onAttack",
    color: "#b45309",
  },
  COL: {
    id: "coffee",
    nameKo: "커피의 힘",
    nameEn: "Coffee Power",
    descKo: "항상 이동속도 +25%",
    descEn: "Permanent +25% movement speed",
    type: "periodic",
    interval: 60,
    color: "#92400e",
  },

  // ═══════════════════ EUROPE ═══════════════════

  DEU: {
    id: "engineering",
    nameKo: "독일 공학",
    nameEn: "German Engineering",
    descKo: "HP 30% 이하일 때 방어력 +50%",
    descEn: "DEF +50% when HP below 30%",
    type: "threshold",
    hpThreshold: 0.3,
    color: "#fbbf24",
  },
  GBR: {
    id: "stiff-lip",
    nameKo: "대영제국",
    nameEn: "Stiff Upper Lip",
    descKo: "HP가 깎일수록 공격력 비례 증가",
    descEn: "ATK scales with missing HP",
    type: "onAttack",
    color: "#1d4ed8",
  },
  FRA: {
    id: "revolution",
    nameKo: "혁명",
    nameEn: "Revolution",
    descKo: "HP 20% 이하일 때 공격력 3배 (5초)",
    descEn: "ATK tripled for 5s when HP drops below 20%",
    type: "threshold",
    hpThreshold: 0.2,
    color: "#2563eb",
  },
  ITA: {
    id: "renaissance",
    nameKo: "르네상스",
    nameEn: "Renaissance",
    descKo: "매 3초 무작위 스탯 하나 20% 상승",
    descEn: "Random stat +20% every 3s",
    type: "periodic",
    interval: 180,
    color: "#16a34a",
  },
  ESP: {
    id: "toro",
    nameKo: "투우",
    nameEn: "El Toro",
    descKo: "HP가 낮을수록 치명타 확률 증가",
    descEn: "CRIT rate increases as HP drops",
    type: "onAttack",
    color: "#dc2626",
  },
  NLD: {
    id: "trade-empire",
    nameKo: "무역제국",
    nameEn: "Trade Empire",
    descKo: "적 처치 시 HP 흡수량 +50%",
    descEn: "Absorb +50% HP on kill",
    type: "onKill",
    color: "#f97316",
  },
  CHE: {
    id: "neutrality",
    nameKo: "영세중립",
    nameEn: "Neutrality",
    descKo: "받는 데미지 25% 감소",
    descEn: "Incoming damage reduced by 25%",
    type: "onDamaged",
    color: "#ef4444",
  },
  SWE: {
    id: "welfare",
    nameKo: "복지국가",
    nameEn: "Welfare State",
    descKo: "매 1.5초 HP 회복 (최대HP의 1.5%)",
    descEn: "Regen 1.5% maxHP every 1.5s",
    type: "periodic",
    interval: 90,
    color: "#0369a1",
  },
  NOR: {
    id: "oil-fund",
    nameKo: "국부펀드",
    nameEn: "Sovereign Fund",
    descKo: "연도마다 방어력 추가 상승",
    descEn: "DEF bonus increases each year",
    type: "yearChange",
    color: "#1e40af",
  },
  POL: {
    id: "phoenix",
    nameKo: "불사조",
    nameEn: "Phoenix",
    descKo: "HP 10% 이하일 때 한번 30% HP 회복",
    descEn: "Revive to 30% HP once when below 10%",
    type: "threshold",
    hpThreshold: 0.1,
    color: "#dc2626",
  },
  TUR: {
    id: "ottoman",
    nameKo: "오스만의 후예",
    nameEn: "Ottoman Legacy",
    descKo: "치명타 확률 2배",
    descEn: "Critical hit rate doubled",
    type: "onAttack",
    color: "#dc2626",
  },
  IRL: {
    id: "celtic-tiger",
    nameKo: "켈틱 타이거",
    nameEn: "Celtic Tiger",
    descKo: "연도마다 공격력 추가 성장",
    descEn: "ATK bonus increases each year",
    type: "yearChange",
    color: "#16a34a",
  },
  DNK: {
    id: "hygge",
    nameKo: "휘게",
    nameEn: "Hygge",
    descKo: "매 2초 HP 회복 (최대HP의 2%)",
    descEn: "Regen 2% maxHP every 2s",
    type: "periodic",
    interval: 120,
    color: "#dc2626",
  },

  // ═══════════════════ OTHER ═══════════════════

  AUS: {
    id: "outback",
    nameKo: "아웃백",
    nameEn: "Outback Tough",
    descKo: "받는 데미지 15% 감소, 속도 +10%",
    descEn: "Incoming dmg -15%, speed +10%",
    type: "onDamaged",
    color: "#f59e0b",
  },
  RUS: {
    id: "winter",
    nameKo: "동장군",
    nameEn: "General Winter",
    descKo: "피격 시 공격자 속도 40% 감소 (3초)",
    descEn: "Attacker slowed by 40% for 3s on hit",
    type: "onDamaged",
    color: "#93c5fd",
  },
  ZAF: {
    id: "rainbow",
    nameKo: "무지개 국가",
    nameEn: "Rainbow Nation",
    descKo: "매 3초마다 무작위 스탯 30% 상승",
    descEn: "Random stat +30% every 3s",
    type: "periodic",
    interval: 180,
    color: "#f59e0b",
  },
  EGY: {
    id: "pyramid",
    nameKo: "피라미드",
    nameEn: "Pyramid",
    descKo: "방어력 +30% (고대의 수호)",
    descEn: "DEF +30% (Ancient Protection)",
    type: "onDamaged",
    color: "#d4a017",
  },
  NGA: {
    id: "giant-africa",
    nameKo: "아프리카의 거인",
    nameEn: "Giant of Africa",
    descKo: "매 1.5초 HP 회복 + 체력이 낮을수록 증가",
    descEn: "HP regen every 1.5s, increases at low HP",
    type: "periodic",
    interval: 90,
    color: "#16a34a",
  },
  ISR: {
    id: "iron-dome",
    nameKo: "아이언돔",
    nameEn: "Iron Dome",
    descKo: "매 5번째 피격 완전 무효화",
    descEn: "Every 5th hit is completely blocked",
    type: "onDamaged",
    color: "#60a5fa",
  },
  NZL: {
    id: "haka",
    nameKo: "하카",
    nameEn: "Haka",
    descKo: "전투 시작 시 적 공격력 10% 감소",
    descEn: "Enemy ATK reduced by 10% at battle start",
    type: "periodic",
    interval: 600,
    color: "#000000",
  },
};
