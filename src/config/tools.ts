import { CategoryConfig, ToolCategory, ToolConfig } from "@/types/tool";

// ============================================
// 카테고리 설정
// 새 카테고리 추가 시 여기에 등록
// ============================================
export const categories: CategoryConfig[] = [
  {
    id: "message",
    name: "메시지",
    nameKey: "catMessage",
    icon: "MessageCircle",
    description: "비밀 메시지, 편지 관련 도구",
  },
  {
    id: "text",
    name: "텍스트",
    nameKey: "catText",
    icon: "Type",
    description: "글자수 세기, 맞춤법, 텍스트 변환",
  },
  {
    id: "image",
    name: "이미지",
    nameKey: "catImage",
    icon: "Image",
    description: "이미지 편집, 변환, 압축 도구",
  },
  {
    id: "calculator",
    name: "계산기",
    nameKey: "catCalculator",
    icon: "Calculator",
    description: "연봉, 대출, BMI 등 각종 계산기",
  },
  {
    id: "converter",
    name: "변환",
    nameKey: "catConverter",
    icon: "ArrowLeftRight",
    description: "단위, 색상, 인코딩 변환",
  },
  {
    id: "generator",
    name: "생성기",
    nameKey: "catGenerator",
    icon: "Wand2",
    description: "비밀번호, 닉네임, 랜덤 생성",
  },
  {
    id: "lifestyle",
    name: "생활",
    nameKey: "catLifestyle",
    icon: "Heart",
    description: "D-Day, 나이, 타이머 등 생활 도구",
  },
  {
    id: "developer",
    name: "개발자",
    nameKey: "catDeveloper",
    icon: "Code",
    description: "JSON, Base64, URL 인코딩 등 개발 도구",
  },
  {
    id: "finance",
    name: "금융",
    nameKey: "catFinance",
    icon: "TrendingUp",
    description: "주식, 투자, 금융 관련 도구",
  },
  {
    id: "game",
    name: "게임",
    nameKey: "catGame",
    icon: "Gamepad2",
    description: "배틀로얄, 시뮬레이션 등 데이터 기반 게임",
  },
];

// ============================================
// 도구 레지스트리
// 새 도구 추가 시 여기에 등록하면 자동으로:
//   - 홈페이지 카드에 표시
//   - 브레드크럼에 반영
//   - 탑바 메뉴에 반영
//   - SEO 메타데이터 생성
// ============================================
export const tools: ToolConfig[] = [
  {
    id: "qr-letter",
    name: "블라인드 메시지",
    nameKey: "toolQrName",
    descriptionKey: "toolQrDesc",
    description: "비밀 메시지를 보내보세요. 받는 사람만 열어볼 수 있어요.",
    category: "message",
    icon: "Lock",
    path: "/tools/qr-letter",
    isNew: true,
    isPopular: true,
    keywords: ["블라인드메시지", "비밀메시지", "blind message", "secret message", "비밀편지"],
  },
  {
    id: "stock-battle",
    name: "주식 배틀",
    nameKey: "toolStockBattleName",
    descriptionKey: "toolStockBattleDesc",
    description: "두 종목의 수익률을 대결시켜 보세요!",
    category: "finance",
    icon: "TrendingUp",
    path: "/tools/stock-battle",
    isNew: true,
    isPopular: true,
    keywords: ["주식배틀", "stock battle", "주식비교", "수익률비교", "주식시뮬레이터"],
  },
  {
    id: "monte-carlo",
    name: "몬테카를로 시뮬레이터",
    nameKey: "toolMonteCarloName",
    descriptionKey: "toolMonteCarloDesc",
    description: "과거 데이터 기반 몬테카를로 미래 수익률 예측",
    category: "finance",
    icon: "TrendingUp",
    path: "/tools/monte-carlo",
    isNew: true,
    isPopular: true,
    keywords: ["몬테카를로", "monte carlo", "미래예측", "주식예측", "시뮬레이션", "투자시뮬"],
  },
  {
    id: "peg-chart",
    name: "PEG 비율 차트",
    nameKey: "toolPegChartName",
    descriptionKey: "toolPegChartDesc",
    description: "여러 종목의 분기별 PEG 비율을 한눈에 비교",
    category: "finance",
    icon: "TrendingUp",
    path: "/tools/peg-chart",
    isNew: true,
    isPopular: false,
    keywords: ["PEG", "peg ratio", "PEG비율", "밸류에이션", "PE", "성장률", "저평가", "고평가"],
  },
  {
    id: "apt-battle",
    name: "아파트 배틀",
    nameKey: "toolAptBattleName",
    descriptionKey: "toolAptBattleDesc",
    description: "전국 아파트 실거래가로 평당가 상승률 대결!",
    category: "lifestyle",
    icon: "Building2",
    path: "/tools/apt-battle",
    isNew: true,
    isPopular: true,
    keywords: ["아파트배틀", "부동산", "아파트비교", "실거래가", "평당가", "apartment", "real estate"],
  },
  {
    id: "stock-score",
    name: "주식 성적표",
    nameKey: "toolStockScoreName",
    descriptionKey: "toolStockScoreDesc",
    description: "S&P 500 전 종목 자동 채점! 100점 만점 투자 성적표",
    category: "finance",
    icon: "Award",
    path: "/tools/stock-score",
    isNew: true,
    isPopular: true,
    keywords: ["주식성적표", "주식점수", "S&P500", "주식평가", "PER", "PBR", "ROE", "stock score", "stock ranking", "밸류에이션"],
  },
  {
    id: "face-score",
    name: "AI 얼굴 평가",
    nameKey: "toolFaceScoreName",
    descriptionKey: "toolFaceScoreDesc",
    description: "AI가 당신의 얼굴을 정밀 분석! 점수, 나이, 닮은 연예인까지",
    category: "lifestyle",
    icon: "Smile",
    path: "/tools/face-score",
    isNew: true,
    isPopular: true,
    keywords: ["얼굴평가", "AI얼굴분석", "외모점수", "face score", "닮은연예인", "관상", "얼굴나이"],
  },
  {
    id: "meeting-note",
    name: "회의록 AI 정리",
    nameKey: "toolMeetingNoteName",
    descriptionKey: "toolMeetingNoteDesc",
    description: "녹음 → 텍스트 변환 → AI 자동 정리! 회의록을 한번에",
    category: "lifestyle",
    icon: "Mic",
    path: "/tools/meeting-note",
    isNew: true,
    isPopular: true,
    keywords: ["회의록", "회의록정리", "AI회의록", "음성인식", "STT", "meeting notes", "회의요약", "액션아이템"],
  },
  {
    id: "heart-rate",
    name: "심박수 측정기",
    nameKey: "toolHeartRateName",
    descriptionKey: "toolHeartRateDesc",
    description: "카메라에 손가락을 대면 심박수를 실시간 측정합니다",
    category: "lifestyle",
    icon: "HeartPulse",
    path: "/tools/heart-rate",
    isNew: true,
    isPopular: true,
    keywords: ["심박수", "심박수측정", "맥박", "BPM", "heart rate", "PPG", "건강", "맥박측정"],
  },
  {
    id: "stock-royale",
    name: "주식 배틀로얄",
    nameKey: "toolStockRoyaleName",
    descriptionKey: "toolStockRoyaleDesc",
    description: "주식 데이터를 RPG 스탯으로 변환! 8개 종목의 배틀로얄",
    category: "game",
    icon: "Swords",
    path: "/tools/stock-royale",
    isNew: true,
    isPopular: true,
    keywords: ["주식배틀로얄", "주식게임", "stock battle royale", "RPG", "배틀로얄", "주식RPG", "stock game"],
  },
  {
    id: "country-battle",
    name: "나라 배틀로얄",
    nameKey: "toolCountryBattleName",
    descriptionKey: "toolCountryBattleDesc",
    description: "8개국 경제 데이터로 구슬 배틀! GDP, 인플레, 실업률이 스탯이 된다",
    category: "game",
    icon: "Globe",
    path: "/tools/country-battle",
    isNew: true,
    isPopular: true,
    keywords: ["나라배틀로얄", "국가배틀", "경제게임", "country battle", "GDP", "경제비교", "한국vs일본", "미국vs중국"],
  },
  {
    id: "short-form",
    name: "숏폼 편집기",
    nameKey: "toolShortFormName",
    descriptionKey: "toolShortFormDesc",
    description: "브라우저에서 바로 편집! 트리밍, 세로 크롭, 자막 추가까지",
    category: "lifestyle",
    icon: "Scissors",
    path: "/tools/short-form",
    isNew: true,
    isPopular: true,
    keywords: ["숏폼", "영상편집", "short form", "video editor", "트리밍", "크롭", "자막", "유튜브쇼츠", "틱톡"],
  },
  {
    id: "salary-calculator",
    name: "연봉 실수령액 계산기",
    nameKey: "toolSalaryCalcName",
    descriptionKey: "toolSalaryCalcDesc",
    description: "2026년 확정 요율 기준 연봉 실수령액을 정확하게 계산합니다",
    category: "calculator",
    icon: "Wallet",
    path: "/tools/salary-calculator",
    isNew: true,
    isPopular: true,
    keywords: ["연봉", "실수령액", "연봉계산기", "4대보험", "소득세", "세후연봉", "salary", "take home pay"],
  },
];

// ============================================
// 유틸리티 함수
// ============================================

/** 도구 ID로 도구 찾기 */
export function getToolById(id: string): ToolConfig | undefined {
  return tools.find((tool) => tool.id === id);
}

/** 경로로 도구 찾기 */
export function getToolByPath(path: string): ToolConfig | undefined {
  return tools.find((tool) => tool.path === path);
}

/** 카테고리별 도구 목록 */
export function getToolsByCategory(category: ToolCategory): ToolConfig[] {
  return tools.filter((tool) => tool.category === category);
}

/** 카테고리 ID로 카테고리 찾기 */
export function getCategoryById(id: ToolCategory): CategoryConfig | undefined {
  return categories.find((cat) => cat.id === id);
}

/** 도구가 있는 카테고리만 반환 */
export function getActiveCategories(): CategoryConfig[] {
  const activeIds = new Set(tools.map((t) => t.category));
  return categories.filter((cat) => activeIds.has(cat.id));
}

/** 인기 도구 목록 */
export function getPopularTools(): ToolConfig[] {
  return tools.filter((tool) => tool.isPopular);
}

/** 신규 도구 목록 */
export function getNewTools(): ToolConfig[] {
  return tools.filter((tool) => tool.isNew);
}
