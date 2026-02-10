import { CategoryConfig, ToolCategory, ToolConfig } from "@/types/tool";

// ============================================
// 카테고리 설정
// 새 카테고리 추가 시 여기에 등록
// ============================================
export const categories: CategoryConfig[] = [
  {
    id: "message",
    name: "메시지",
    icon: "MessageCircle",
    description: "QR코드, 편지, 메시지 관련 도구",
  },
  {
    id: "text",
    name: "텍스트",
    icon: "Type",
    description: "글자수 세기, 맞춤법, 텍스트 변환",
  },
  {
    id: "image",
    name: "이미지",
    icon: "Image",
    description: "이미지 편집, 변환, 압축 도구",
  },
  {
    id: "calculator",
    name: "계산기",
    icon: "Calculator",
    description: "연봉, 대출, BMI 등 각종 계산기",
  },
  {
    id: "converter",
    name: "변환",
    icon: "ArrowLeftRight",
    description: "단위, 색상, 인코딩 변환",
  },
  {
    id: "generator",
    name: "생성기",
    icon: "Wand2",
    description: "비밀번호, 닉네임, 랜덤 생성",
  },
  {
    id: "lifestyle",
    name: "생활",
    icon: "Heart",
    description: "D-Day, 나이, 타이머 등 생활 도구",
  },
  {
    id: "developer",
    name: "개발자",
    icon: "Code",
    description: "JSON, Base64, URL 인코딩 등 개발 도구",
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
    name: "QR 비밀 메시지",
    description: "QR코드 안에 비밀 메시지를 숨겨보세요. 스캔한 사람만 읽을 수 있어요.",
    category: "message",
    icon: "QrCode",
    path: "/tools/qr-letter",
    isNew: true,
    isPopular: true,
    keywords: ["QR코드", "비밀메시지", "비밀편지", "큐알코드", "QR메시지"],
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
