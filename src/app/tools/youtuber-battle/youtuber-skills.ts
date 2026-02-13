/**
 * YouTuber-specific passive skills
 *
 * Same structure as CountrySkill — reuses the skill engine from country-battle.
 *
 * Skill types:
 *  - "onDamaged"  : triggers when taking damage (modify incoming damage)
 *  - "onAttack"   : triggers when dealing damage (modify outgoing damage)
 *  - "periodic"   : triggers every N frames (regen, buff, etc.)
 *  - "threshold"  : triggers once when HP drops below threshold%
 *  - "onKill"     : triggers when absorbing another YouTuber
 */

export interface YouTuberSkill {
  id: string;
  nameKo: string;
  nameEn: string;
  descKo: string;
  descEn: string;
  type: "onDamaged" | "onAttack" | "periodic" | "threshold" | "onKill";
  hpThreshold?: number;
  interval?: number;
  color: string;
}

export function getYoutuberSkill(channelId: string): YouTuberSkill {
  return SKILLS[channelId] ?? DEFAULT_SKILL;
}

const DEFAULT_SKILL: YouTuberSkill = {
  id: "grit",
  nameKo: "근성",
  nameEn: "Grit",
  descKo: "HP 30% 이하 시 ATK +25%",
  descEn: "ATK +25% when HP below 30%",
  type: "threshold",
  hpThreshold: 0.3,
  color: "#a1a1aa",
};

const SKILLS: Record<string, YouTuberSkill> = {
  // ═══════════════════ 한국 엔터 ═══════════════════

  // 침착맨
  UCUj6rrhMTR9pipbAWBAMvUQ: {
    id: "calm-power", nameKo: "침착의 힘", nameEn: "Calm Power",
    descKo: "받는 데미지 20% 감소", descEn: "Incoming damage reduced by 20%",
    type: "onDamaged", color: "#3b82f6",
  },
  // 쯔양
  UCyJ68aqTzEMCsJg5nYRjvOQ: {
    id: "mukbang", nameKo: "먹방 파워", nameEn: "Mukbang Power",
    descKo: "매 1.5초마다 HP 3% 회복", descEn: "Regenerate 3% HP every 1.5s",
    type: "periodic", interval: 90, color: "#f472b6",
  },
  // 피식대학
  "UC-Ax48vMVkCkeNz5YZjbTDg": {
    id: "comedy", nameKo: "웃음 폭탄", nameEn: "Comedy Bomb",
    descKo: "공격 시 30% 확률로 데미지 2배", descEn: "30% chance to deal 2x damage",
    type: "onAttack", color: "#facc15",
  },
  // 빠니보틀
  UCynGrMaI2GiFwGNLfdTm4cg: {
    id: "traveler", nameKo: "세계여행", nameEn: "World Traveler",
    descKo: "이동 속도 30% 증가", descEn: "Movement speed +30%",
    type: "periodic", interval: 9999, color: "#22d3ee",
  },
  // 곽튜브
  UClRNDVO8093rmRTtNtEzMaQ: {
    id: "adventure", nameKo: "모험의 기운", nameEn: "Adventurer Spirit",
    descKo: "HP 50% 이하 시 SPD +50%", descEn: "SPD +50% when HP below 50%",
    type: "threshold", hpThreshold: 0.5, color: "#4ade80",
  },
  // 보겸TV
  UCQ2O_iftmnlfrBuNsUUTofQ: {
    id: "scream", nameKo: "절규", nameEn: "Scream",
    descKo: "공격 시 상대 둔화 (2초)", descEn: "Attacks slow enemy for 2s",
    type: "onAttack", color: "#ef4444",
  },
  // 워크맨
  UC5BMQOsAB8hKUyHu9KI6yig: {
    id: "workman", nameKo: "알바의 달인", nameEn: "Job Master",
    descKo: "매 2초마다 ATK 5% 영구 증가 (최대 50%)", descEn: "ATK +5% every 2s (max 50%)",
    type: "periodic", interval: 120, color: "#fb923c",
  },
  // 문복희
  UCw5QTuWsaPNnJJIXxp7_VDQ: {
    id: "feast", nameKo: "대식가", nameEn: "Big Eater",
    descKo: "킬 시 HP 3배 흡수", descEn: "Absorb 3x HP on kill",
    type: "onKill", color: "#f472b6",
  },
  // 영국남자
  UCOQVkMSqUBQbHEOEFXeVQjA: {
    id: "british", nameKo: "영국 신사", nameEn: "British Gentleman",
    descKo: "받는 크리티컬 데미지 50% 감소", descEn: "Critical damage taken reduced 50%",
    type: "onDamaged", color: "#60a5fa",
  },
  // 성시경
  UCIG7D2ZhP1Oi8hdNs1BmwgA: {
    id: "serenade", nameKo: "세레나데", nameEn: "Serenade",
    descKo: "매 3초마다 주변 적 ATK 10% 감소 (3초)", descEn: "Nearby enemy ATK -10% every 3s",
    type: "periodic", interval: 180, color: "#c084fc",
  },

  // ═══════════════════ 한국 교육/정보 ═══════════════════

  // 슈카월드
  UCsJ6RuBiTVWRX156FVbeaGg: {
    id: "analysis", nameKo: "경제 분석", nameEn: "Economic Analysis",
    descKo: "크리티컬 확률 2배", descEn: "Critical rate doubled",
    type: "onAttack", color: "#3b82f6",
  },
  // 신사임당
  UCX4bAxGcrCJKdvOo0Rp41Rw: {
    id: "hustle", nameKo: "사업 수완", nameEn: "Business Hustle",
    descKo: "킬 시 HP 2배 흡수 + ATK 10% 영구 증가", descEn: "2x absorb + ATK +10% on kill",
    type: "onKill", color: "#facc15",
  },
  // 안될과학
  UC2jEaVniHkI0X44OjdLJQ7A: {
    id: "science", nameKo: "과학의 힘", nameEn: "Science Power",
    descKo: "DEF 30% 증가", descEn: "DEF +30%",
    type: "onDamaged", color: "#22d3ee",
  },
  // 삼프로TV
  UChlgI3UHCOnwUGzWzbJ3H5A: {
    id: "investing", nameKo: "투자의 귀재", nameEn: "Investment Genius",
    descKo: "매 2초마다 HP 2% 회복 + ATK 3% 증가", descEn: "HP +2% + ATK +3% every 2s",
    type: "periodic", interval: 120, color: "#4ade80",
  },
  // 너덜트
  UCUpAPsO_pCYKMaRekRkFUUg: {
    id: "nerd", nameKo: "너드 파워", nameEn: "Nerd Power",
    descKo: "HP 70% 이상 시 크리티컬 데미지 2배", descEn: "Crit damage 2x when HP > 70%",
    type: "onAttack", color: "#c084fc",
  },

  // ═══════════════════ 글로벌 ═══════════════════

  // MrBeast
  UCX6OQ3DkcsbYNE6H8uQQuVA: {
    id: "money-challenge", nameKo: "돈 챌린지", nameEn: "Money Challenge",
    descKo: "킬 시 HP 3배 흡수", descEn: "Absorb 3x HP on kill",
    type: "onKill", color: "#4ade80",
  },
  // PewDiePie
  "UC-lHJZR3Gqxm24_Vd_AJ5Yw": {
    id: "meme-lord", nameKo: "밈 로드", nameEn: "Meme Lord",
    descKo: "크리티컬 확률 2배 + 크리티컬 데미지 1.5배", descEn: "Crit rate 2x + Crit damage 1.5x",
    type: "onAttack", color: "#ef4444",
  },
  // T-Series
  "UCq-Fj5jknLsUf-MWSy4_brA": {
    id: "bollywood", nameKo: "볼리우드 파워", nameEn: "Bollywood Power",
    descKo: "HP 50% 이하 시 ATK 50% 증가", descEn: "ATK +50% when HP below 50%",
    type: "threshold", hpThreshold: 0.5, color: "#fb923c",
  },
  // Cocomelon
  UCbCmjCuTUZos6Inko4u57UQ: {
    id: "nursery", nameKo: "동요 파워", nameEn: "Nursery Power",
    descKo: "매 2초마다 HP 4% 회복", descEn: "Regenerate 4% HP every 2s",
    type: "periodic", interval: 120, color: "#facc15",
  },
  // WWE
  UCJ5v_MCY6GNUBTO8_D3XoAg: {
    id: "wrestling", nameKo: "레슬링", nameEn: "Wrestling",
    descKo: "공격 시 넉백 2배", descEn: "Knockback force doubled on attack",
    type: "onAttack", color: "#ef4444",
  },
  // Like Nastya
  UCk1SpWNzOs4MYmr0uICEntg: {
    id: "kids-power", nameKo: "키즈 파워", nameEn: "Kids Power",
    descKo: "받는 데미지 25% 감소", descEn: "Incoming damage reduced by 25%",
    type: "onDamaged", color: "#f472b6",
  },
  // Dude Perfect
  UCiGm_E4ZwYSHV3bcW1pnSeQ: {
    id: "trick-shot", nameKo: "트릭샷", nameEn: "Trick Shot",
    descKo: "10% 확률로 3배 데미지", descEn: "10% chance for 3x damage",
    type: "onAttack", color: "#22d3ee",
  },
  // Veritasium
  UCHnyfMqiRRG1u_2MsSQLbXA: {
    id: "truth", nameKo: "진실의 힘", nameEn: "Truth Power",
    descKo: "DEF 40% 증가", descEn: "DEF +40%",
    type: "onDamaged", color: "#3b82f6",
  },

  // ═══════════════════ 게임 ═══════════════════

  // 풍월량
  UCBkyj16n2snkRg1BAzpovXQ: {
    id: "legend", nameKo: "레전드", nameEn: "Legend",
    descKo: "HP 40% 이하 시 ATK/SPD 30% 증가", descEn: "ATK/SPD +30% when HP < 40%",
    type: "threshold", hpThreshold: 0.4, color: "#60a5fa",
  },
  // 우왁굳
  UCzh4yY8rl38knH33XpNqXbQ: {
    id: "chaos", nameKo: "카오스", nameEn: "Chaos",
    descKo: "공격 시 50% 확률로 데미지 +80%, 50% 확률로 -30%", descEn: "50% chance +80% or -30% damage",
    type: "onAttack", color: "#c084fc",
  },
  // 도티
  UCEdh_FnknJnmgOF3SRPP0ug: {
    id: "minecraft", nameKo: "마크 장인", nameEn: "Minecraft Master",
    descKo: "매 2초마다 DEF 5% 영구 증가 (최대 40%)", descEn: "DEF +5% every 2s (max 40%)",
    type: "periodic", interval: 120, color: "#4ade80",
  },
  // 김블루
  "UC2-_WWPT_124LE0K2bGpXRw": {
    id: "blue-fire", nameKo: "블루 파이어", nameEn: "Blue Fire",
    descKo: "공격 시 상대 둔화 + 추가 데미지", descEn: "Attacks slow and deal bonus damage",
    type: "onAttack", color: "#3b82f6",
  },
  // Markiplier
  UC7_YxT_KID8kRbqZo7MyscQ: {
    id: "horror", nameKo: "공포의 힘", nameEn: "Horror Power",
    descKo: "HP 60% 이하 시 ATK 40% 증가", descEn: "ATK +40% when HP below 60%",
    type: "threshold", hpThreshold: 0.6, color: "#ef4444",
  },
  // Dream
  UCY30JRSgfhYXA6i6xX1erWg: {
    id: "speedrun", nameKo: "스피드런", nameEn: "Speedrun",
    descKo: "이동 속도 40% 증가 + 회피 15%", descEn: "SPD +40% + 15% dodge",
    type: "onDamaged", color: "#4ade80",
  },
  // MrBeast Gaming
  UCIPPMRA040LQr5QPyJEbmXA: {
    id: "challenge", nameKo: "도전!", nameEn: "Challenge!",
    descKo: "킬마다 ATK 15% 영구 증가", descEn: "ATK +15% permanently per kill",
    type: "onKill", color: "#facc15",
  },
  // LazarBeam
  UCOpNcN46UbXVtpKMrmU4Abg: {
    id: "laser", nameKo: "레이저", nameEn: "Laser Beam",
    descKo: "크리티컬 시 추가 넉백 + 데미지", descEn: "Extra knockback and damage on crit",
    type: "onAttack", color: "#fb923c",
  },

  // ═══════════════════ 음악 ═══════════════════

  // BLACKPINK
  UCOmHUn__16B90oW2L6FRR3A: {
    id: "pink-venom", nameKo: "핑크 베놈", nameEn: "Pink Venom",
    descKo: "공격 시 적 둔화 + 독 (3초간 추가 데미지)", descEn: "Attacks slow + poison for 3s",
    type: "onAttack", color: "#f472b6",
  },
  // HYBE LABELS
  UC3IZKseVpdzPSBo2Mk4c5cg: {
    id: "army-power", nameKo: "아미 파워", nameEn: "ARMY Power",
    descKo: "매 1.5초 HP 2.5% 회복", descEn: "Regen 2.5% HP every 1.5s",
    type: "periodic", interval: 90, color: "#c084fc",
  },
  // SMTOWN
  UCEf_Bc_KVd7onSeifS3py9g: {
    id: "kpop-wave", nameKo: "한류", nameEn: "K-Pop Wave",
    descKo: "공격 시 20% 확률로 스턴 (1.5초)", descEn: "20% chance to stun for 1.5s",
    type: "onAttack", color: "#22d3ee",
  },
  // BANGTANTV (BTS)
  "UC-9-kyTW8ZkZNDHQJ6FgpwQ": {
    id: "dynamite", nameKo: "다이너마이트", nameEn: "Dynamite",
    descKo: "HP 40% 이하 시 폭발 (주변 적에게 큰 데미지)", descEn: "Explode when HP < 40% dealing AoE",
    type: "threshold", hpThreshold: 0.4, color: "#facc15",
  },
  // Ed Sheeran
  UCbW18JZRgko_mOGm5er8Yzg: {
    id: "shape-of-you", nameKo: "Shape of You", nameEn: "Shape of You",
    descKo: "받는 데미지 15% 감소 + HP 1%/s 자연 회복", descEn: "DMG taken -15% + regen 1%/s",
    type: "onDamaged", color: "#fb923c",
  },
  // JYP Entertainment
  UCuHzBCaKmtaLcRAOoazhCPA: {
    id: "jyp-nation", nameKo: "JYP 네이션", nameEn: "JYP Nation",
    descKo: "킬 시 HP 2배 흡수 + SPD 20% 증가 (5초)", descEn: "2x absorb + SPD buff on kill",
    type: "onKill", color: "#4ade80",
  },
  // 1MILLION Dance
  UCGwv_ECIfCLPCIjHobILNMw: {
    id: "dance-power", nameKo: "춤의 신", nameEn: "Dance God",
    descKo: "이동 속도 35% 증가 + 회피 10%", descEn: "SPD +35% + 10% dodge",
    type: "onDamaged", color: "#f472b6",
  },
};
