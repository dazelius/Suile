/**
 * i18n (국제화) 시스템
 *
 * 지원 언어: ko (한국어, 기본), en (English US)
 * 사용법:
 *   import { t, getLocale } from "@/lib/i18n";
 *   t("siteName") → "블라인드 메시지" (ko) / "Blind Message" (en)
 */

export type Locale = "ko" | "en";

export interface Translations {
  // ── 사이트 기본 ──
  siteName: string;
  siteDescription: string;
  siteSlogan: string;

  // ── 네비게이션 ──
  navHome: string;
  navTools: string;
  navAbout: string;
  navQuickLinks: string;
  navPolicies: string;
  navPrivacy: string;
  navTerms: string;
  menuOpen: string;
  menuClose: string;
  breadcrumbHome: string;

  // ── 홈페이지 ──
  homeAllTools: string;
  homeToolCount: string; // "{count}개" / "{count} tools"

  // ── 카테고리 ──
  catMessage: string;
  catMessageDesc: string;
  catText: string;
  catTextDesc: string;
  catImage: string;
  catImageDesc: string;
  catCalculator: string;
  catCalculatorDesc: string;
  catConverter: string;
  catConverterDesc: string;
  catGenerator: string;
  catGeneratorDesc: string;
  catLifestyle: string;
  catLifestyleDesc: string;
  catDeveloper: string;
  catDeveloperDesc: string;
  catFinance: string;
  catFinanceDesc: string;

  // ── 주식 배틀 도구 ──
  toolStockBattleName: string;
  toolStockBattleDesc: string;

  // ── 몬테카를로 시뮬레이터 ──
  toolMonteCarloName: string;
  toolMonteCarloDesc: string;

  // ── PEG 비율 차트 ──
  toolPegChartName: string;
  toolPegChartDesc: string;

  // ── 아파트 배틀 ──
  toolAptBattleName: string;
  toolAptBattleDesc: string;

  // ── 주식 성적표 ──
  toolStockScoreName: string;
  toolStockScoreDesc: string;

  // ── 얼굴 평가 ──
  toolFaceScoreName: string;
  toolFaceScoreDesc: string;

  // ── 회의록 AI 정리 ──
  toolMeetingNoteName: string;
  toolMeetingNoteDesc: string;

  // ── 심박수 측정기 ──
  toolHeartRateName: string;
  toolHeartRateDesc: string;

  // ── 연봉 실수령액 계산기 ──
  toolSalaryCalcName: string;
  toolSalaryCalcDesc: string;

  // ── QR 비밀 메시지 도구 ──
  toolQrName: string;
  toolQrDesc: string;
  toolQrTitle: string;
  toolQrSubtitle: string;
  toolQrPlaceholder: string;
  toolQrCharCount: string; // "{current}/{max}자"
  toolQrSenderLabel: string;
  toolQrSenderPlaceholder: string;
  toolQrReceiverLabel: string;
  toolQrReceiverPlaceholder: string;
  toolQrSenderReceiverToggle: string;
  toolQrCreateBtn: string;
  toolQrResultTitle: string;
  toolQrResultSubtitle: string;
  toolQrPreview: string;
  toolQrNewMessage: string;

  // ── 사용법 ──
  toolQrHowTo: string;
  toolQrStep1Title: string;
  toolQrStep1Desc: string;
  toolQrStep2Title: string;
  toolQrStep2Desc: string;
  toolQrStep3Title: string;
  toolQrStep3Desc: string;

  // ── SEO 설명 ──
  toolQrSeoTitle: string;
  toolQrSeoDesc1: string;
  toolQrSeoDesc2: string;

  // ── 활용 팁 ──
  toolQrUseTip: string;
  toolQrUseChat: string;
  toolQrUseSns: string;
  toolQrUseLetter: string;
  toolQrUseGift: string;

  // ── 공유 ──
  shareCardBtn: string;
  shareCopyImage: string;
  shareSaveImage: string;
  shareCopied: string;
  shareCopiedLink: string;
  shareCopiedImg: string;
  shareHint: string;

  // ── 메시지 열기 페이지 ──
  msgArrived: string;
  msgArrivedTo: string; // "{name}님에게 온 메시지"
  msgArrivedFrom: string; // "{name}님이 보낸 메시지"
  msgArrivedAnon: string;
  msgOpen: string;
  msgOpened: string;
  msgNotFound: string;
  msgNotFoundDesc: string;
  msgGoHome: string;
  msgLoading: string;
  msgScanHint: string;
  msgSendToo: string;

  // ── 카드 이미지 텍스트 ──
  cardFromTo: string; // "{from}님이 {to}님에게"
  cardFromOnly: string; // "{from}님이 보낸 메시지"
  cardToOnly: string; // "{to}님에게 온 메시지"
  cardAnon: string;
  cardWhatIWantToSay: string;
  cardOpenLink: string;

  // ── 푸터 ──
  footerSlogan1: string;
  footerSlogan2: string;
  footerCopyright: string;

  // ── About 페이지 ──
  aboutTitle: string;
  aboutDesc: string;
  aboutFastTitle: string;
  aboutFastDesc: string;
  aboutFreeTitle: string;
  aboutFreeDesc: string;
  aboutPrivacyTitle: string;
  aboutPrivacyDesc: string;
  aboutGrowTitle: string;
  aboutGrowDesc: string;
  aboutWhatTitle: string;
  aboutWhatDesc1: string;
  aboutWhatDesc2: string;
  aboutCtaText: string;
  aboutCtaBtn: string;
  aboutContactTitle: string;
  aboutContactDesc: string;
  aboutContactEmail: string;

  // ── 법적 페이지 제목 ──
  privacyTitle: string;
  termsTitle: string;

  // ── 배지 ──
  badgeNew: string;
  badgePopular: string;

  // ── 기타 ──
  anonymous: string;
}

const ko: Translations = {
  siteName: "SUILE",
  siteDescription:
    "SUILE - 블라인드 메시지를 보내보세요. 받는 사람만 열어볼 수 있는 비밀 메시지 서비스.",
  siteSlogan: "당신의 일상을 편리하게. 무료 온라인 도구를 한 곳에서.",

  navHome: "홈",
  navTools: "도구 모음",
  navAbout: "소개",
  navQuickLinks: "바로가기",
  navPolicies: "정책",
  navPrivacy: "개인정보처리방침",
  navTerms: "이용약관",
  menuOpen: "메뉴 열기",
  menuClose: "메뉴 닫기",
  breadcrumbHome: "홈",

  homeAllTools: "전체 도구",
  homeToolCount: "{count}개",

  catMessage: "메시지",
  catMessageDesc: "비밀 메시지, 편지 관련 도구",
  catText: "텍스트",
  catTextDesc: "글자수 세기, 맞춤법, 텍스트 변환",
  catImage: "이미지",
  catImageDesc: "이미지 편집, 변환, 압축 도구",
  catCalculator: "계산기",
  catCalculatorDesc: "연봉, 대출, BMI 등 각종 계산기",
  catConverter: "변환",
  catConverterDesc: "단위, 색상, 인코딩 변환",
  catGenerator: "생성기",
  catGeneratorDesc: "비밀번호, 닉네임, 랜덤 생성",
  catLifestyle: "생활",
  catLifestyleDesc: "D-Day, 나이, 타이머 등 생활 도구",
  catDeveloper: "개발자",
  catDeveloperDesc: "JSON, Base64, URL 인코딩 등 개발 도구",
  catFinance: "금융",
  catFinanceDesc: "주식, 투자, 금융 관련 도구",

  toolStockBattleName: "주식 배틀",
  toolStockBattleDesc: "두 종목의 수익률을 대결시켜 보세요!",

  toolMonteCarloName: "몬테카를로 시뮬레이터",
  toolMonteCarloDesc: "과거 데이터 기반 몬테카를로 미래 수익률 예측",

  toolPegChartName: "PEG 비율 차트",
  toolPegChartDesc: "여러 종목의 분기별 PEG 비율을 한눈에 비교",

  toolAptBattleName: "아파트 배틀",
  toolAptBattleDesc: "전국 아파트 실거래가로 평당가 상승률 대결!",

  toolStockScoreName: "주식 성적표",
  toolStockScoreDesc: "S&P 500 전 종목 자동 채점! 100점 만점 투자 성적표",

  toolFaceScoreName: "AI 얼굴 평가",
  toolFaceScoreDesc: "AI가 당신의 얼굴을 정밀 분석! 점수, 나이, 닮은 연예인까지",

  toolMeetingNoteName: "회의록 AI 정리",
  toolMeetingNoteDesc: "녹음 → 텍스트 변환 → AI 자동 정리! 회의록을 한번에",

  toolHeartRateName: "심박수 측정기",
  toolHeartRateDesc: "카메라에 손가락을 대면 심박수를 실시간 측정합니다",

  toolSalaryCalcName: "연봉 실수령액 계산기",
  toolSalaryCalcDesc: "2026년 확정 요율 기준 연봉 실수령액을 정확하게 계산합니다",

  toolQrName: "블라인드 메시지",
  toolQrDesc: "비밀 메시지를 보내보세요. 받는 사람만 열어볼 수 있어요.",
  toolQrTitle: "블라인드 메시지",
  toolQrSubtitle:
    "비밀 메시지를 보내보세요.\n받는 사람만 열어볼 수 있어요.",
  toolQrPlaceholder: "비밀 메시지를 입력하세요...",
  toolQrCharCount: "{current}/{max}자",
  toolQrSenderLabel: "보내는 사람",
  toolQrSenderPlaceholder: "익명",
  toolQrReceiverLabel: "받는 사람",
  toolQrReceiverPlaceholder: "선택사항",
  toolQrSenderReceiverToggle: "보내는 사람 / 받는 사람 설정 (선택)",
  toolQrCreateBtn: "비밀 메시지 만들기",
  toolQrResultTitle: "비밀 메시지 완성!",
  toolQrResultSubtitle: "카드 이미지를 공유해보세요.",
  toolQrPreview: "미리보기",
  toolQrNewMessage: "새로 만들기",

  toolQrHowTo: "어떻게 사용하나요?",
  toolQrStep1Title: "메시지 작성",
  toolQrStep1Desc: "비밀 메시지를 입력",
  toolQrStep2Title: "카드 공유",
  toolQrStep2Desc: "카톡·SNS로 전송",
  toolQrStep3Title: "메시지 확인",
  toolQrStep3Desc: "링크를 열어 확인",

  toolQrSeoTitle: "블라인드 메시지란?",
  toolQrSeoDesc1:
    "블라인드 메시지는 비밀 메시지를 링크로 보내는 서비스입니다. 카카오톡, 인스타그램 등 메신저로 링크를 보내면 받는 사람만 열어볼 수 있어요.",
  toolQrSeoDesc2:
    "생일 축하, 사랑 고백, 감사 인사, 응원의 말을 비밀 메시지로 전해보세요. 받는 사람이 열어보는 순간 특별한 감동을 전할 수 있습니다.",

  toolQrUseTip: "이런 곳에 활용해보세요",
  toolQrUseChat: "카톡 · 메신저",
  toolQrUseSns: "인스타 · SNS",
  toolQrUseLetter: "카드 · 편지",
  toolQrUseGift: "선물 포장",

  shareCardBtn: "카드 이미지 공유하기",
  shareCopyImage: "이미지 복사",
  shareSaveImage: "이미지 저장",
  shareCopied: "복사 완료!",
  shareCopiedLink: "링크가 복사되었어요! 원하는 곳에 붙여넣기 하세요.",
  shareCopiedImg: "카드 이미지가 복사됐어요! 카톡/메신저에 붙여넣기 하세요.",
  shareHint: "카드 이미지와 링크가 함께 전송돼요 (카카오톡, 문자 등)",

  msgArrived: "비밀 메시지가 도착했어요",
  msgArrivedTo: "{name}님에게 온 메시지",
  msgArrivedFrom: "{name}님이 보낸 메시지",
  msgArrivedAnon: "누군가 보낸 비밀 메시지",
  msgOpen: "메시지 열기",
  msgOpened: "비밀 메시지가 공개되었습니다",
  msgNotFound: "메시지를 찾을 수 없습니다",
  msgNotFoundDesc: "잘못된 링크이거나 손상되었습니다.",
  msgGoHome: "홈으로 돌아가기",
  msgLoading: "메시지를 불러오는 중...",
  msgScanHint: "링크를 열면 이 페이지가 열려요",
  msgSendToo: "나도 비밀 메시지 보내기",

  cardFromTo: "{from}님이 {to}님에게",
  cardFromOnly: "{from}님이 보낸 메시지",
  cardToOnly: "{to}님에게 온 메시지",
  cardAnon: "비밀 메시지가 도착했어요",
  cardWhatIWantToSay: "제가 하고 싶은 말은...",
  cardOpenLink: "링크를 열어 비밀 메시지를 확인하세요",

  footerSlogan1: "당신의 일상을 편리하게.",
  footerSlogan2: "무료 온라인 도구를 한 곳에서.",
  footerCopyright: "All rights reserved.",

  aboutTitle: "SUILE",
  aboutDesc: "당신의 일상을 편리하게 만드는 무료 온라인 도구 모음",
  aboutFastTitle: "빠르고 간편하게",
  aboutFastDesc:
    "회원가입 없이 바로 사용. 필요한 도구를 열고 즉시 결과를 얻으세요.",
  aboutFreeTitle: "완전 무료",
  aboutFreeDesc:
    "모든 도구를 무료로 제공합니다. 숨겨진 비용이나 제한 없이 자유롭게 사용하세요.",
  aboutPrivacyTitle: "개인정보 보호",
  aboutPrivacyDesc:
    "데이터를 서버에 저장하지 않습니다. 여러분의 콘텐츠는 여러분의 기기에만 존재합니다.",
  aboutGrowTitle: "계속 성장하는 도구",
  aboutGrowDesc:
    "새로운 도구가 지속적으로 추가됩니다. 더 많은 도구로 일상의 불편함을 해결해 드리겠습니다.",
  aboutWhatTitle: "SUILE는 어떤 서비스인가요?",
  aboutWhatDesc1:
    "SUILE는 일상에서 자주 필요한 온라인 도구들을 모아둔 서비스입니다. 블라인드 메시지로 비밀 메시지를 보내거나, 다양한 도구를 회원가입 없이 무료로 사용할 수 있습니다.",
  aboutWhatDesc2:
    "복잡한 앱을 설치하거나 회원가입을 할 필요 없이, 브라우저에서 바로 사용할 수 있도록 설계했습니다. 모바일과 데스크톱 모두에서 최적의 경험을 제공합니다.",
  aboutCtaText: "지금 바로 도구를 사용해보세요.",
  aboutCtaBtn: "도구 모음 보기",
  aboutContactTitle: "문의",
  aboutContactDesc: "서비스 이용 중 문의사항이 있으시면 아래 이메일로 연락해 주세요.",
  aboutContactEmail: "이메일",

  privacyTitle: "개인정보처리방침",
  termsTitle: "이용약관",

  badgeNew: "NEW",
  badgePopular: "인기",

  anonymous: "익명",
};

const en: Translations = {
  siteName: "SUILE",
  siteDescription:
    "SUILE - Send blind messages. A secret message service only the recipient can open.",
  siteSlogan: "Making your daily life easier. Free online tools in one place.",

  navHome: "Home",
  navTools: "Tools",
  navAbout: "About",
  navQuickLinks: "Quick Links",
  navPolicies: "Policies",
  navPrivacy: "Privacy Policy",
  navTerms: "Terms of Service",
  menuOpen: "Open menu",
  menuClose: "Close menu",
  breadcrumbHome: "Home",

  homeAllTools: "All Tools",
  homeToolCount: "{count} tools",

  catMessage: "Message",
  catMessageDesc: "Secret messages and letter tools",
  catText: "Text",
  catTextDesc: "Character count, spell check, text conversion",
  catImage: "Image",
  catImageDesc: "Image editing, conversion, compression",
  catCalculator: "Calculator",
  catCalculatorDesc: "Salary, loan, BMI calculators",
  catConverter: "Converter",
  catConverterDesc: "Unit, color, encoding conversion",
  catGenerator: "Generator",
  catGeneratorDesc: "Password, nickname, random generation",
  catLifestyle: "Lifestyle",
  catLifestyleDesc: "D-Day, age, timer and more",
  catDeveloper: "Developer",
  catDeveloperDesc: "JSON, Base64, URL encoding tools",
  catFinance: "Finance",
  catFinanceDesc: "Stocks, investment, and financial tools",

  toolStockBattleName: "Stock Battle",
  toolStockBattleDesc: "Battle the returns of two stocks!",

  toolMonteCarloName: "Monte Carlo Simulator",
  toolMonteCarloDesc: "Monte Carlo future return prediction based on historical data",

  toolPegChartName: "PEG Ratio Chart",
  toolPegChartDesc: "Compare quarterly PEG ratios of multiple stocks at a glance",

  toolAptBattleName: "Apartment Battle",
  toolAptBattleDesc: "Compare apartment price changes using real transaction data!",

  toolStockScoreName: "Stock Report Card",
  toolStockScoreDesc: "Auto-grade all S&P 500 stocks! 100-point investment score",

  toolFaceScoreName: "AI Face Score",
  toolFaceScoreDesc: "AI analyzes your face! Score, age, celebrity lookalike and more",

  toolMeetingNoteName: "Meeting Notes AI",
  toolMeetingNoteDesc: "Record → Transcribe → AI organizes your meeting notes automatically",

  toolHeartRateName: "Heart Rate Monitor",
  toolHeartRateDesc: "Measure your heart rate with your phone camera using PPG technology",

  toolSalaryCalcName: "Salary Take-Home Calculator",
  toolSalaryCalcDesc: "Calculate your exact take-home pay based on 2026 Korean tax rates",

  toolQrName: "Blind Message",
  toolQrDesc: "Send a secret message. Only the recipient can open it.",
  toolQrTitle: "Blind Message",
  toolQrSubtitle:
    "Send a secret message.\nOnly the recipient can open it.",
  toolQrPlaceholder: "Type your secret message...",
  toolQrCharCount: "{current}/{max}",
  toolQrSenderLabel: "From",
  toolQrSenderPlaceholder: "Anonymous",
  toolQrReceiverLabel: "To",
  toolQrReceiverPlaceholder: "Optional",
  toolQrSenderReceiverToggle: "Set sender / receiver (optional)",
  toolQrCreateBtn: "Create Blind Message",
  toolQrResultTitle: "Message Ready!",
  toolQrResultSubtitle: "Share the card image.",
  toolQrPreview: "Preview",
  toolQrNewMessage: "Create New",

  toolQrHowTo: "How does it work?",
  toolQrStep1Title: "Write",
  toolQrStep1Desc: "Type your secret message",
  toolQrStep2Title: "Share",
  toolQrStep2Desc: "Send via chat or SNS",
  toolQrStep3Title: "Read",
  toolQrStep3Desc: "Open the link to read",

  toolQrSeoTitle: "What is Blind Message?",
  toolQrSeoDesc1:
    "Blind Message is a service for sending secret messages via link. Share it on KakaoTalk, Instagram, or any messenger — only the recipient can open it.",
  toolQrSeoDesc2:
    "Send birthday wishes, love confessions, thank you notes, or words of encouragement as a secret message. Create a special moment when they open it.",

  toolQrUseTip: "Great for...",
  toolQrUseChat: "Chat · Messenger",
  toolQrUseSns: "Instagram · SNS",
  toolQrUseLetter: "Cards · Letters",
  toolQrUseGift: "Gift Wrapping",

  shareCardBtn: "Share Card Image",
  shareCopyImage: "Copy Image",
  shareSaveImage: "Save Image",
  shareCopied: "Copied!",
  shareCopiedLink: "Link copied! Paste it wherever you want.",
  shareCopiedImg: "Card image copied! Paste it in your messenger.",
  shareHint: "Card image and link are sent together (KakaoTalk, text, etc.)",

  msgArrived: "A secret message has arrived",
  msgArrivedTo: "A message for {name}",
  msgArrivedFrom: "A message from {name}",
  msgArrivedAnon: "Someone sent a secret message",
  msgOpen: "Open Message",
  msgOpened: "Secret message revealed",
  msgNotFound: "Message not found",
  msgNotFoundDesc: "The link is invalid or broken.",
  msgGoHome: "Go Home",
  msgLoading: "Loading message...",
  msgScanHint: "Opening the link will show this page",
  msgSendToo: "Send a Blind Message too",

  cardFromTo: "From {from} to {to}",
  cardFromOnly: "A message from {from}",
  cardToOnly: "A message for {to}",
  cardAnon: "A secret message has arrived",
  cardWhatIWantToSay: "What I want to say is...",
  cardOpenLink: "Open the link to read the secret message",

  footerSlogan1: "Making your daily life easier.",
  footerSlogan2: "Free online tools in one place.",
  footerCopyright: "All rights reserved.",

  aboutTitle: "SUILE",
  aboutDesc: "A free collection of online tools to make your life easier",
  aboutFastTitle: "Quick & Easy",
  aboutFastDesc:
    "No sign-up required. Open a tool and get results instantly.",
  aboutFreeTitle: "Completely Free",
  aboutFreeDesc:
    "All tools are free. No hidden costs or limitations.",
  aboutPrivacyTitle: "Privacy First",
  aboutPrivacyDesc:
    "We don't store data on our servers. Your content stays on your device.",
  aboutGrowTitle: "Growing Toolkit",
  aboutGrowDesc:
    "New tools are added continuously. More tools to make your life easier.",
  aboutWhatTitle: "What is SUILE?",
  aboutWhatDesc1:
    "SUILE is a collection of useful everyday online tools. Send blind messages, and use various tools for free — no sign-up required.",
  aboutWhatDesc2:
    "No apps to install, no sign-up required. Designed to work right in your browser, optimized for both mobile and desktop.",
  aboutCtaText: "Try our tools now.",
  aboutCtaBtn: "View Tools",
  aboutContactTitle: "Contact",
  aboutContactDesc: "If you have any questions, please reach out via email below.",
  aboutContactEmail: "Email",

  privacyTitle: "Privacy Policy",
  termsTitle: "Terms of Service",

  badgeNew: "NEW",
  badgePopular: "Popular",

  anonymous: "Anonymous",
};

const translations: Record<Locale, Translations> = { ko, en };

// ── 현재 로케일 관리 ──
let currentLocale: Locale = "ko";

/** 브라우저 언어 기반으로 초기 로케일 설정 */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "ko";
  const lang = navigator.language || "";
  if (lang.startsWith("en")) return "en";
  return "ko";
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    localStorage.setItem("blind-message-locale", locale);
  }
}

/** localStorage에서 저장된 로케일 불러오기, 없으면 브라우저 감지 */
export function initLocale(): Locale {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("blind-message-locale") as Locale | null;
    if (saved && translations[saved]) {
      currentLocale = saved;
      return saved;
    }
  }
  const detected = detectLocale();
  currentLocale = detected;
  return detected;
}

/** 번역 문자열 가져오기 */
export function t(key: keyof Translations, params?: Record<string, string>): string {
  let text = translations[currentLocale][key] || translations.ko[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }
  return text;
}

/** 특정 로케일의 번역 문자열 가져오기 */
export function tLocale(
  locale: Locale,
  key: keyof Translations,
  params?: Record<string, string>
): string {
  let text = translations[locale][key] || translations.ko[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }
  return text;
}

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
];
