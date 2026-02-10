/**
 * QR 편지 테마 설정
 * 새 테마 추가 시 여기에 등록
 */

export interface LetterTheme {
  id: string;
  name: string;
  emoji: string;
  /** 메시지 열람 페이지 배경 gradient */
  bgClass: string;
  /** 카드 배경 */
  cardClass: string;
  /** 텍스트 색상 */
  textClass: string;
  /** 악센트 색상 */
  accentClass: string;
}

export const letterThemes: LetterTheme[] = [
  {
    id: "love",
    name: "사랑",
    emoji: "💌",
    bgClass: "bg-gradient-to-br from-pink-50 via-rose-50 to-red-50",
    cardClass: "bg-white/80 border-pink-200",
    textClass: "text-rose-900",
    accentClass: "text-pink-500",
  },
  {
    id: "birthday",
    name: "생일",
    emoji: "🎂",
    bgClass: "bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50",
    cardClass: "bg-white/80 border-amber-200",
    textClass: "text-amber-900",
    accentClass: "text-amber-500",
  },
  {
    id: "thanks",
    name: "감사",
    emoji: "🙏",
    bgClass: "bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50",
    cardClass: "bg-white/80 border-emerald-200",
    textClass: "text-emerald-900",
    accentClass: "text-emerald-500",
  },
  {
    id: "cheer",
    name: "응원",
    emoji: "💪",
    bgClass: "bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50",
    cardClass: "bg-white/80 border-blue-200",
    textClass: "text-blue-900",
    accentClass: "text-blue-500",
  },
  {
    id: "graduation",
    name: "졸업",
    emoji: "🎓",
    bgClass: "bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50",
    cardClass: "bg-white/80 border-violet-200",
    textClass: "text-violet-900",
    accentClass: "text-violet-500",
  },
  {
    id: "simple",
    name: "심플",
    emoji: "✉️",
    bgClass: "bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50",
    cardClass: "bg-white/80 border-gray-200",
    textClass: "text-gray-900",
    accentClass: "text-gray-500",
  },
];

export function getThemeById(id: string): LetterTheme {
  return letterThemes.find((t) => t.id === id) || letterThemes[0];
}
