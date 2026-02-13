/**
 * OG 이미지 및 파비콘 생성 스크립트
 * sharp를 사용하여 SVG → PNG 변환
 */
import sharp from "sharp";
import { mkdirSync } from "fs";

const OUT = "public";

// ─── Color palette ───
const VIOLET = "#7c3aed";
const VIOLET_DARK = "#5b21b6";
const INDIGO = "#4f46e5";
const BG_DARK = "#0f0a1a";

// ─── Main site OG (1200x630) ───
async function generateMainOG() {
  const svg = `
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BG_DARK}"/>
        <stop offset="50%" stop-color="#1a0a2e"/>
        <stop offset="100%" stop-color="#0d1117"/>
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${VIOLET}"/>
        <stop offset="100%" stop-color="${INDIGO}"/>
      </linearGradient>
      <radialGradient id="glow" cx="30%" cy="50%" r="60%">
        <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glow2" cx="80%" cy="30%" r="40%">
        <stop offset="0%" stop-color="${INDIGO}" stop-opacity="0.1"/>
        <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <rect width="1200" height="630" fill="url(#glow2)"/>
    <!-- Grid pattern (subtle) -->
    <g opacity="0.04">
      ${Array.from({length: 20}, (_, i) => `<line x1="${i*65}" y1="0" x2="${i*65}" y2="630" stroke="white" stroke-width="1"/>`).join("")}
      ${Array.from({length: 10}, (_, i) => `<line x1="0" y1="${i*70}" x2="1200" y2="${i*70}" stroke="white" stroke-width="1"/>`).join("")}
    </g>
    <!-- Decorative circles -->
    <circle cx="950" cy="120" r="180" fill="none" stroke="${VIOLET}" stroke-width="1" opacity="0.1"/>
    <circle cx="950" cy="120" r="120" fill="none" stroke="${INDIGO}" stroke-width="1" opacity="0.08"/>
    <circle cx="200" cy="500" r="150" fill="none" stroke="${VIOLET}" stroke-width="1" opacity="0.06"/>
    <!-- Accent bar at top -->
    <rect x="0" y="0" width="1200" height="4" fill="url(#accent)"/>
    <!-- Logo text -->
    <text x="100" y="260" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="120" fill="white" letter-spacing="-3">SUILE</text>
    <!-- Tagline -->
    <text x="105" y="340" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="36" fill="#a78bfa">무료 온라인 도구 모음</text>
    <!-- Description -->
    <text x="105" y="400" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="22" fill="#94a3b8">Free Online Tools Collection</text>
    <!-- Tool badges -->
    <g transform="translate(105, 450)">
      <rect x="0" y="0" width="120" height="36" rx="18" fill="${VIOLET}" fill-opacity="0.2" stroke="${VIOLET}" stroke-width="1"/>
      <text x="60" y="24" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#c4b5fd" text-anchor="middle" font-weight="600">주식 분석</text>
      <rect x="135" y="0" width="120" height="36" rx="18" fill="${INDIGO}" fill-opacity="0.2" stroke="${INDIGO}" stroke-width="1"/>
      <text x="195" y="24" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#a5b4fc" text-anchor="middle" font-weight="600">AI 도구</text>
      <rect x="270" y="0" width="140" height="36" rx="18" fill="${VIOLET}" fill-opacity="0.2" stroke="${VIOLET}" stroke-width="1"/>
      <text x="340" y="24" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#c4b5fd" text-anchor="middle" font-weight="600">숏폼 편집기</text>
      <rect x="425" y="0" width="100" height="36" rx="18" fill="${INDIGO}" fill-opacity="0.2" stroke="${INDIGO}" stroke-width="1"/>
      <text x="475" y="24" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#a5b4fc" text-anchor="middle" font-weight="600">계산기</text>
    </g>
    <!-- URL -->
    <text x="105" y="560" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="20" fill="#64748b">suile.im</text>
    <!-- Bottom accent -->
    <rect x="0" y="626" width="1200" height="4" fill="url(#accent)"/>
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/og.png`);
  console.log("✓ og.png (1200x630)");
}

// ─── Favicon (32x32) ───
async function generateFavicon() {
  const svg = `
  <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fbg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${VIOLET}"/>
        <stop offset="100%" stop-color="${INDIGO}"/>
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="6" fill="url(#fbg)"/>
    <text x="16" y="24" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="22" fill="white" text-anchor="middle">S</text>
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/favicon.png`);
  console.log("✓ favicon.png (32x32)");
}

// ─── Apple Touch Icon (180x180) ───
async function generateAppleIcon() {
  const svg = `
  <svg width="180" height="180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="abg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${VIOLET}"/>
        <stop offset="100%" stop-color="${INDIGO}"/>
      </linearGradient>
    </defs>
    <rect width="180" height="180" rx="36" fill="url(#abg)"/>
    <text x="90" y="125" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="100" fill="white" text-anchor="middle">S</text>
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/apple-touch-icon.png`);
  console.log("✓ apple-touch-icon.png (180x180)");
}

// ─── Tool-specific OG generator ───
async function generateToolOG(filename, title, subtitle, emoji) {
  const svg = `
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BG_DARK}"/>
        <stop offset="50%" stop-color="#1a0a2e"/>
        <stop offset="100%" stop-color="#0d1117"/>
      </linearGradient>
      <linearGradient id="acc2" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${VIOLET}"/>
        <stop offset="100%" stop-color="${INDIGO}"/>
      </linearGradient>
      <radialGradient id="gl2" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg2)"/>
    <rect width="1200" height="630" fill="url(#gl2)"/>
    <rect x="0" y="0" width="1200" height="4" fill="url(#acc2)"/>
    <!-- Emoji/icon area -->
    <text x="600" y="220" font-family="Arial, Helvetica, sans-serif" font-size="100" text-anchor="middle">${emoji}</text>
    <!-- Title -->
    <text x="600" y="350" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="64" fill="white" text-anchor="middle">${title}</text>
    <!-- Subtitle -->
    <text x="600" y="420" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="28" fill="#94a3b8" text-anchor="middle">${subtitle}</text>
    <!-- SUILE branding -->
    <text x="600" y="530" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="22" fill="#64748b" text-anchor="middle">SUILE</text>
    <rect x="0" y="626" width="1200" height="4" fill="url(#acc2)"/>
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${filename}`);
  console.log(`✓ ${filename} (1200x630)`);
}

// ─── Run all ───
async function main() {
  console.log("Generating OG images...\n");

  await generateMainOG();
  await generateFavicon();
  await generateAppleIcon();

  // Tool-specific OG images (for tools that don't already have one)
  await generateToolOG("og-stock-battle.png", "주식 배틀", "두 종목의 수익률을 대결시켜 보세요!", "⚔️");
  await generateToolOG("og-short-form.png", "숏폼 편집기", "AI가 자막과 음악을 입혀 숏폼으로 만들어드립니다", "🎬");
  await generateToolOG("og-stock-score.png", "주식 성적표", "내 투자 종목의 성적표를 확인하세요", "📊");
  await generateToolOG("og-apt-battle.png", "아파트 배틀", "두 아파트의 시세를 비교해보세요", "🏠");
  await generateToolOG("og-peg-chart.png", "PEG 비율 차트", "PEG 비율로 적정가를 분석하세요", "📈");
  await generateToolOG("og-monte-carlo.png", "몬테카를로", "투자 시뮬레이션으로 미래를 예측하세요", "🎲");
  await generateToolOG("og-qr-letter.png", "QR 편지", "마음을 담은 QR 편지를 보내보세요", "💌");
  await generateToolOG("og-salary-calc.png", "연봉 계산기", "연봉·실수령액을 간편하게 계산하세요", "💰");
  await generateToolOG("og-heart-rate.png", "심박수 측정", "카메라로 심박수를 측정해보세요", "❤️");
  await generateToolOG("og-face-score.png", "AI 관상", "AI가 얼굴을 분석해드립니다", "🎭");
  await generateToolOG("og-country-battle.png", "나라 배틀로얄", "8개국 경제 데이터로 구슬 배틀!", "🌍");
  await generateToolOG("og-youtuber-battle.png", "유튜버 배틀로얄", "구독자 = HP, 조회수 = 화력! 최후의 1인은?", "▶");

  console.log("\n✅ All OG images generated!");
}

main().catch(console.error);
