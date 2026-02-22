"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChevronLeft, ChevronRight, CalendarDays,
  Moon, Sun, Settings, X, Smartphone,
} from "lucide-react";

// ── PWA 설치 이벤트 타입 ────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ── 근무 로테이션 상수 ─────────────────────────────────────
const BASE_DATE = new Date(2025, 0, 7);
const ROTATION = [
  { day: "A", night: "B", off: "C" },
  { day: "C", night: "A", off: "B" },
  { day: "B", night: "C", off: "A" },
];

// ── 한국 공휴일 (2025~2027) ─────────────────────────────────
const HOLIDAYS: Record<string, string> = {
  "2025-1-1":"신정","2025-1-28":"설날","2025-1-29":"설날","2025-1-30":"설날",
  "2025-3-1":"삼일절","2025-5-5":"어린이날","2025-5-6":"대체휴일",
  "2025-6-6":"현충일","2025-8-15":"광복절","2025-10-3":"개천절",
  "2025-10-5":"추석","2025-10-6":"추석","2025-10-7":"추석",
  "2025-10-8":"대체휴일","2025-10-9":"한글날","2025-12-25":"크리스마스",
  "2026-1-1":"신정","2026-2-16":"설날","2026-2-17":"설날","2026-2-18":"설날",
  "2026-3-1":"삼일절","2026-3-2":"대체휴일","2026-5-5":"어린이날",
  "2026-5-24":"부처님오신날","2026-6-6":"현충일","2026-8-15":"광복절",
  "2026-8-17":"대체휴일","2026-9-24":"추석","2026-9-25":"추석","2026-9-26":"추석",
  "2026-10-3":"개천절","2026-10-5":"대체휴일","2026-10-9":"한글날",
  "2026-12-25":"크리스마스",
  "2027-1-1":"신정","2027-2-6":"설날","2027-2-7":"설날","2027-2-8":"설날",
  "2027-2-9":"대체휴일","2027-3-1":"삼일절","2027-5-5":"어린이날",
  "2027-5-13":"부처님오신날","2027-6-6":"현충일","2027-6-7":"대체휴일",
  "2027-8-15":"광복절","2027-8-16":"대체휴일",
  "2027-9-14":"추석","2027-9-15":"추석","2027-9-16":"추석",
  "2027-10-3":"개천절","2027-10-4":"대체휴일","2027-10-9":"한글날",
  "2027-10-11":"대체휴일","2027-12-25":"크리스마스",
};

// ── 타임슬롯 ────────────────────────────────────────────────
const DAY_TIME_SLOTS = [
  "07:00~08:00","08:00~09:00","09:00~10:00","10:00~11:00","11:00~12:00",
  "12:00~13:00","13:00~14:00","14:00~15:00","15:00~16:00","16:00~17:00",
  "17:00~18:00",
] as const;

const NIGHT_TIME_SLOTS = [
  "18:00~19:00","19:00~20:00","20:00~21:00","21:00~22:00","22:00~23:00",
  "23:00~00:00","00:00~01:00","01:00~02:00","02:00~03:00","03:00~04:00",
  "04:00~05:00","05:00~06:00","06:00~07:00",
] as const;

const POSITIONS = ["초소", "1검색대", "2검색대", "3검색대", "휴식"] as const;

// ── 타입 ────────────────────────────────────────────────────
type ShiftType = "day-s" | "night-s" | "off-s";
type Team      = "all" | "A" | "B" | "C";
type TeamABC   = "A" | "B" | "C";
type Names     = Record<TeamABC, string[]>;

interface ShiftInfo     { day: string; night: string; off: string; }
interface RotModalState { date: Date; team: TeamABC; shiftType: "day" | "night"; }

const DEFAULT_NAMES: Names = {
  A: ["","","","",""],
  B: ["","","","",""],
  C: ["","","","",""],
};

// ── 스타일 맵 ────────────────────────────────────────────────
const SHIFT_BG: Record<ShiftType, string> = {
  "day-s":   "bg-blue-500",
  "night-s": "bg-violet-600",
  "off-s":   "bg-rose-500",
};
const SHIFT_MINI: Record<ShiftType, string> = {
  "day-s":   "bg-blue-100 text-blue-700",
  "night-s": "bg-violet-100 text-violet-700",
  "off-s":   "bg-rose-100 text-rose-700",
};
const TEAM_ACTIVE: Record<string, string> = {
  all: "!bg-gray-700 !border-gray-700 !text-white",
  A:   "!bg-red-500 !border-red-500 !text-white",
  B:   "!bg-blue-500 !border-blue-500 !text-white",
  C:   "!bg-green-500 !border-green-500 !text-white",
};
const TEAM_TEXT: Record<TeamABC, string> = { A:"text-red-500",  B:"text-blue-500",  C:"text-green-500" };
const TEAM_BG:   Record<TeamABC, string> = { A:"bg-red-500",    B:"bg-blue-500",    C:"bg-green-500"   };

const SET_LABELS = ["A","B","C","D","E"] as const;
type SetLabel    = (typeof SET_LABELS)[number];

// ── 헬퍼 함수 ────────────────────────────────────────────────
function getShift(date: Date): ShiftInfo {
  const diff = Math.floor((date.getTime() - BASE_DATE.getTime()) / 86_400_000);
  return ROTATION[((Math.floor(diff / 2) % 3) + 3) % 3];
}
function getTeamShift(shift: ShiftInfo, team: string): ShiftType {
  if (shift.day   === team) return "day-s";
  if (shift.night === team) return "night-s";
  return "off-s";
}
function getShiftName(type: ShiftType) {
  return type === "day-s" ? "주간" : type === "night-s" ? "야간" : "비번";
}
function getHoliday(y: number, m: number, d: number): string | null {
  return HOLIDAYS[`${y}-${m + 1}-${d}`] ?? null;
}
function getDaysUntilOff(team: string): number {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 30; i++) {
    const c = new Date(t); c.setDate(t.getDate() + i);
    if (getShift(c).off === team) return i;
  }
  return -1;
}

// 세트 순환: 6일 주기에서 2칸씩 전진 (2026-02-23 B조 주간 = A 기준)
// 주간: A→B→C→D→E / 야간: E→D→C→B→A
function shiftSetOccurrence(date: Date): number {
  const refMs  = Date.UTC(2026, 1, 23);
  const dateMs = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const sd     = Math.round((dateMs - refMs) / 86_400_000);
  return Math.floor(sd / 6) * 2 + (((sd % 2) + 2) % 2);
}
function getDaySetIndex(date: Date):   number { return ((shiftSetOccurrence(date) % 5) + 5) % 5; }
function getNightSetIndex(date: Date): number { return ((4 - shiftSetOccurrence(date) % 5) + 5) % 5; }
function getWorkerIdx(pos: number, hour: number, setOffset: number): number {
  return ((pos - hour + setOffset) % 5 + 5) % 5;
}

// ── 테마 헬퍼 ────────────────────────────────────────────────
function theme(dark: boolean) {
  return {
    bg:       dark ? "bg-[#1c1c1e] text-[#f5f5f7]" : "bg-[#f5f5f7] text-[#1d1d1f]",
    card:     dark ? "bg-[#2c2c2e] border-[#3a3a3c]" : "bg-white border-[#e5e5e7]",
    modalBg:  dark ? "bg-[#2c2c2e] text-[#f5f5f7]"  : "bg-white text-[#1d1d1f]",
    itemBg:   dark ? "bg-[#3a3a3c]" : "bg-[#f5f5f7]",
    input:    dark
      ? "bg-[#3a3a3c] border-[#4a4a4c] text-[#f5f5f7] placeholder:text-[#6e6e73]"
      : "bg-[#f5f5f7] border-[#e5e5e7] text-[#1d1d1f] placeholder:text-[#86868b]",
    divider:  dark ? "border-[#3a3a3c]" : "border-[#e5e5e7]",
    faint:    dark ? "border-[#3a3a3c]" : "border-[#f0f0f0]",
    muted:    dark ? "text-[#8e8e93]"   : "text-[#86868b]",
    sub:      dark ? "text-[#aeaeb2]"   : "text-[#6e6e73]",
    rowEven:  dark ? "bg-[#2c2c2e]"     : "bg-white",
    rowOdd:   dark ? "bg-[#323234]"     : "bg-[#fafafa]",
    theadBg:  dark ? "bg-[#3a3a3c]"     : "bg-[#f5f5f7]",
    theadBorder: dark ? "border-[#4a4a4c]" : "border-[#e5e5e7]",
  };
}

// ── 로테이션 시간표 모달 ─────────────────────────────────────
function RotationModal({ modal, dark, getName, onClose }: {
  modal:   RotModalState;
  dark:    boolean;
  getName: (t: TeamABC, i: number) => string;
  onClose: () => void;
}) {
  const { date, team, shiftType } = modal;
  const t           = theme(dark);
  const isDay       = shiftType === "day";
  const timeSlots   = isDay ? DAY_TIME_SLOTS : NIGHT_TIME_SLOTS;
  const si          = isDay ? getDaySetIndex(date) : getNightSetIndex(date);
  const setLabel    = SET_LABELS[si] as SetLabel;
  const checkoutRow = isDay ? 10 : 12;   // 주간 17:00 / 야간 06:00

  // 오늘 날짜의 현재 시간 행 강조
  const isDateToday = date.toDateString() === new Date().toDateString();
  const nowRow = (() => {
    if (!isDateToday) return -1;
    const h = new Date().getHours();
    if (isDay)  return (h >= 7  && h <= 17) ? h - 7  : -1;
    if (h >= 18) return h - 18;
    if (h <= 6)  return h + 6;
    return -1;
  })();

  // 드래그-to-dismiss (모바일 bottom-sheet)
  const [dragY,   setDragY]   = useState(0);
  const startYRef  = useRef(0);
  const draggingRef = useRef(false);

  const onDragStart = (e: React.TouchEvent) => {
    startYRef.current  = e.touches[0].clientY;
    draggingRef.current = true;
  };
  const onDragMove = (e: React.TouchEvent) => {
    if (!draggingRef.current) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) setDragY(dy);
  };
  const onDragEnd = () => {
    draggingRef.current = false;
    if (dragY > 90) { onClose(); }
    else            { setDragY(0); }
  };

  const shiftColor = isDay ? "bg-blue-500" : "bg-violet-600";
  const setColor   = isDay
    ? "bg-blue-100 text-blue-700"
    : "bg-violet-100 text-violet-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-3"
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col ${t.modalBg}`}
        style={{ transform: `translateY(${dragY}px)`, transition: dragY === 0 ? "transform 0.25s ease" : "none" }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 (드래그 가능 영역) ── */}
        <div
          className={`px-4 pt-3 pb-3 border-b flex-shrink-0 sm:cursor-default cursor-grab active:cursor-grabbing ${t.divider}`}
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          {/* 드래그 핸들 바 */}
          <div className="flex justify-center mb-2 sm:hidden">
            <div className={`w-10 h-1.5 rounded-full ${dark ? "bg-[#5a5a5c]" : "bg-[#d1d1d6]"}`} />
          </div>

          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              {/* 날짜 + 조 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold">
                  {date.getMonth() + 1}월 {date.getDate()}일
                </span>
                <span className={`text-sm font-bold ${TEAM_TEXT[team]}`}>{team}조</span>
              </div>
              {/* 근무 종류 + 세트 배지 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-bold px-2.5 py-1 rounded-lg text-white ${shiftColor}`}>
                  {isDay ? "주간" : "야간"}
                </span>
                <span className={`text-sm font-black px-2.5 py-1 rounded-lg ${setColor}`}>
                  세트&nbsp;{setLabel}
                </span>
                <span className={`text-xs ${t.muted}`}>
                  {isDay ? "A→B→C→D→E" : "E→D→C→B→A"}
                </span>
              </div>
            </div>
            <button onClick={onClose} className={`p-1.5 rounded-xl active:opacity-70 flex-shrink-0 ${t.itemBg}`}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── 표 ── */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className={t.theadBg}>
                <th className={`px-3 py-2.5 text-left font-semibold whitespace-nowrap border-b ${t.theadBorder} ${t.muted} w-14`}>
                  시각
                </th>
                {POSITIONS.map((pos) => (
                  <th key={pos} className={`px-1 py-2.5 text-center font-semibold border-b ${t.theadBorder}`}>
                    {pos}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, hi) => {
                const isCheckout = hi === checkoutRow;
                const isNow      = hi === nowRow;
                const rowBg      = hi % 2 === 0 ? t.rowEven : t.rowOdd;
                const [timeStart, timeEnd] = slot.split("~");
                return (
                  <tr key={slot} className={rowBg}>
                    <td className={`px-2 py-1.5 font-semibold whitespace-nowrap border-b ${
                      isCheckout ? "bg-green-500 text-white"
                      : isNow    ? "bg-amber-400 text-white"
                      :            `${t.faint} ${t.muted}`
                    }`}>
                      {isNow && (
                        <div className="text-[0.6rem] font-black leading-none mb-0.5 tracking-wide">▶ 지금</div>
                      )}
                      <div className="text-xs font-bold leading-tight">{timeStart}</div>
                      <div className={`text-[0.65rem] leading-tight ${isCheckout || isNow ? "opacity-80" : "opacity-60"}`}>~{timeEnd}</div>
                    </td>
                    {POSITIONS.map((_, pi) => {
                      const isRest  = pi === 4;
                      const cellCls = isCheckout ? "bg-green-500 text-white"
                        : isNow     ? (dark ? "bg-amber-900/50 text-amber-200" : "bg-amber-100 text-amber-900")
                        : isRest    ? (dark ? "bg-violet-900/50 text-violet-200" : "bg-violet-100 text-violet-800")
                        : "";
                      return (
                        <td key={pi} className={`border-b p-1 ${t.faint}`}>
                          <div className={`flex items-center justify-center py-1.5 rounded-lg font-semibold text-sm ${cellCls}`}>
                            {getName(team, getWorkerIdx(pi, hi, si))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── 범례 ── */}
        <div className={`flex items-center gap-5 px-4 py-3 border-t flex-shrink-0 ${t.divider}`}>
          {([
            ["bg-green-500",  "퇴근 시각"],
            ["bg-violet-300", "휴식 포지션"],
          ] as const).map(([dot, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${dot}`} />
              <span className={`text-xs font-medium ${t.muted}`}>{label}</span>
            </div>
          ))}
          {isDateToday && nowRow >= 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-400" />
              <span className={`text-xs font-medium ${t.muted}`}>현재 위치</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function WorkScheduleClient() {
  const now = new Date();
  const [year,         setYear]         = useState(now.getFullYear());
  const [month,        setMonth]        = useState(now.getMonth());
  const [team,         setTeam]         = useState<Team>("all");
  const [dark,         setDark]         = useState(false);
  const [names,        setNames]        = useState<Names>(DEFAULT_NAMES);
  const [editNames,    setEditNames]    = useState<Names>(DEFAULT_NAMES);
  const [showSettings, setShowSettings] = useState(false);
  const [rotModal,     setRotModal]     = useState<RotModalState | null>(null);
  const rotModalOpenRef = useRef(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOSDevice,    setIsIOSDevice]    = useState(false);
  const [showIOSGuide,   setShowIOSGuide]   = useState(false);

  // localStorage 복원
  useEffect(() => {
    const savedTeam  = localStorage.getItem("ws-team") as Team | null;
    const savedDark  = localStorage.getItem("ws-dark") === "true";
    const savedNames = localStorage.getItem("ws-names");
    if (savedTeam) setTeam(savedTeam);
    setDark(savedDark);
    if (savedNames) {
      try {
        const p = JSON.parse(savedNames) as Names;
        setNames(p);
        setEditNames({ A: [...p.A], B: [...p.B], C: [...p.C] });
      } catch { /* ignore */ }
    }
  }, []);

  // PWA 설치 감지
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
                !(window as unknown as { MSStream?: unknown }).MSStream;
    if (ios) { setIsIOSDevice(true); setShowInstallBtn(true); }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBtn(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // 스와이프 제스처
  const changeMonth = useCallback((delta: number) => {
    const nm = month + delta;
    if      (nm > 11) { setYear((y) => y + 1); setMonth(0); }
    else if (nm < 0)  { setYear((y) => y - 1); setMonth(11); }
    else              { setMonth(nm); }
  }, [month]);

  // 모달 열릴 때 body 스크롤 잠금
  useEffect(() => {
    const locked = rotModal || showSettings || showIOSGuide;
    document.body.style.overflow = locked ? "hidden" : "";
    rotModalOpenRef.current = !!rotModal;
    return () => { document.body.style.overflow = ""; };
  }, [rotModal, showSettings, showIOSGuide]);

  // 좌우 스와이프로 월 전환 (모달 열려 있으면 무시)
  useEffect(() => {
    let startX = 0;
    const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const onEnd   = (e: TouchEvent) => {
      if (rotModalOpenRef.current) return;
      const dx = startX - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 80) changeMonth(dx > 0 ? 1 : -1);
    };
    document.addEventListener("touchstart", onStart);
    document.addEventListener("touchend",   onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend",   onEnd);
    };
  }, [changeMonth]);

  // 핸들러
  const goToday    = () => { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth()); };
  const selectTeam = (t: Team) => { setTeam(t); localStorage.setItem("ws-team", t); };
  const toggleDark = () => setDark((d) => { localStorage.setItem("ws-dark", String(!d)); return !d; });

  const openSettings = () => {
    setEditNames({ A: [...names.A], B: [...names.B], C: [...names.C] });
    setShowSettings(true);
  };
  const saveNames = () => {
    const saved = { A: [...editNames.A], B: [...editNames.B], C: [...editNames.C] };
    setNames(saved);
    localStorage.setItem("ws-names", JSON.stringify(saved));
    setShowSettings(false);
  };
  const updateName = (t: TeamABC, i: number, v: string) =>
    setEditNames((p) => ({ ...p, [t]: p[t].map((n, j) => (j === i ? v : n)) }));
  const getName = (t: TeamABC, i: number) => names[t][i]?.trim() || `${t}${i + 1}`;

  const openRot = (date: Date, t: TeamABC, shiftType: "day" | "night") => {
    const shift = getShift(date);
    if (shiftType === "day"   && shift.day   !== t) return;
    if (shiftType === "night" && shift.night !== t) return;
    setRotModal({ date, team: t, shiftType });
  };

  const handleInstall = async () => {
    if (isIOSDevice) { setShowIOSGuide(true); return; }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") { setDeferredPrompt(null); setShowInstallBtn(false); }
  };

  // 오늘 근무 정보
  const todayShift = useMemo(() => {
    if (team === "all") return null;
    const shift = getShift(new Date());
    const type  = getTeamShift(shift, team);
    return { type, name: getShiftName(type), ddays: getDaysUntilOff(team) };
  }, [team]);

  // 달력 계산
  const today       = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // 필요한 행 수만큼만 생성 (4~5행 — 불필요한 빈 행 제거)
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const cells       = Array.from({ length: totalCells }, (_, i) => {
    const d = i - firstDay + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });

  const t = theme(dark);

  // FAB 버튼 공통 클래스
  const fabCls = `fixed w-12 h-12 rounded-full shadow-lg border flex items-center justify-center ${t.card} active:opacity-70 z-10`;

  return (
    <div className={`flex flex-col h-[100dvh] ${t.bg} transition-colors duration-300`}>

      {/* ── 헤더 ──────────────────────────────────────────── */}
      <header className={`${t.card} border-b px-4 pt-3 pb-3 flex-shrink-0`}>
        {/* 월 이동 + 설정 */}
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => changeMonth(-1)}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center ${t.card} active:opacity-70`}>
            <ChevronLeft size={18} />
          </button>
          <span className="flex-1 text-center text-lg font-semibold">{year}년 {month + 1}월</span>
          <button onClick={() => changeMonth(1)}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center ${t.card} active:opacity-70`}>
            <ChevronRight size={18} />
          </button>
          <button onClick={openSettings}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center ${t.card} active:opacity-70`}>
            <Settings size={16} />
          </button>
        </div>

        {/* 오늘 근무 배너 */}
        {todayShift && (
          <div className={`flex items-center justify-center gap-3 px-3 py-2 mb-2 rounded-xl border ${t.card}`}>
            <span className={`text-xs ${t.muted}`}>오늘</span>
            <span className={`text-sm font-bold px-3 py-1 rounded-lg text-white ${SHIFT_BG[todayShift.type]}`}>
              {todayShift.name}
            </span>
            {todayShift.type !== "off-s" && todayShift.ddays > 0 && (
              <span className={`text-xs ${t.muted}`}>
                다음 비번 <span className="font-bold text-sky-400">D-{todayShift.ddays}</span>
              </span>
            )}
          </div>
        )}

        {/* 조 선택 탭 */}
        <div className="grid grid-cols-4 gap-1.5">
          {(["all","A","B","C"] as Team[]).map((tab) => (
            <button key={tab} onClick={() => selectTeam(tab)}
              className={`py-2 rounded-lg border text-sm font-semibold transition-all
                ${dark ? `bg-[#3a3a3c] border-[#4a4a4c] ${t.muted}` : `bg-white border-[#e5e5e7] ${t.muted}`}
                ${team === tab ? TEAM_ACTIVE[tab] : ""}`}>
              {tab === "all" ? "전체" : `${tab}조`}
            </button>
          ))}
        </div>
      </header>

      {/* ── 범례 ──────────────────────────────────────────── */}
      <div className={`${t.card} border-b flex items-center justify-center gap-5 py-2 flex-shrink-0`}>
        {[["bg-blue-500","주간"],["bg-violet-600","야간"],["bg-rose-500","비번"]].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${c}`} />
            <span className={`text-xs font-medium ${t.muted}`}>{l}</span>
          </div>
        ))}
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[0.7rem] font-medium ${t.muted} ${t.divider}`}>
          탭 → 시간표
        </div>
      </div>

      {/* ── 요일 헤더 ─────────────────────────────────────── */}
      <div className={`${dark ? "bg-[#3a3a3c]" : "bg-[#eeeef0]"} border-b grid grid-cols-7 text-center text-xs font-bold py-2 flex-shrink-0`}>
        {["일","월","화","수","목","금","토"].map((d, i) => (
          <div key={d} className={i===0 ? "text-red-500" : i===6 ? "text-blue-500" : dark ? "text-[#aeaeb2]" : "text-[#48484a]"}>{d}</div>
        ))}
      </div>

      {/* ── 달력 ──────────────────────────────────────────── */}
      <div className={`flex-1 grid grid-cols-7 auto-rows-fr gap-[1.5px] p-[1.5px] min-h-0 pb-16 overflow-hidden ${dark ? "bg-[#3a3a3c]" : "bg-[#d8d8dc]"}`}>
        {cells.map((dn, i) => {
          if (!dn) return <div key={i} className={dark ? "bg-[#1c1c1e]" : "bg-[#f2f2f4]"} />;

          const date    = new Date(year, month, dn);
          const dow     = date.getDay();
          const shift   = getShift(date);
          const isToday = date.getTime() === today.getTime();
          const hol     = getHoliday(year, month, dn);
          const isSun   = dow === 0;
          const isSat   = dow === 6;

          // 셀 배경
          let cellBg = dark ? "bg-[#2c2c2e]" : "bg-white";
          if (isSun || hol) cellBg = dark ? "bg-[#3a2025]" : "bg-red-50";
          if (isSat)        cellBg = dark ? "bg-[#202530]" : "bg-blue-50";
          if (isToday)      cellBg = dark ? "bg-[#2e2a1e]" : "bg-amber-50";

          // 날짜 숫자 색상 (오늘은 원형 배경이 처리하므로 일반 색만)
          const dateCls = hol || isSun ? "text-red-500" : isSat ? "text-blue-500"
            : dark ? "text-[#f5f5f7]" : "text-[#1d1d1f]";

          return (
            <div key={i} className={`${cellBg} flex flex-col items-center justify-start pt-1 pb-1 px-0.5
              ${isToday ? "ring-2 ring-inset ring-orange-500" : ""}`}>
              {/* 날짜 숫자 */}
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                <span className={`text-sm font-bold leading-none ${dateCls}`}>{dn}</span>
              </div>

              {/* 공휴일명 — 항상 고정 높이 영역 확보 (얼라인 일치) */}
              <div className="h-3.5 w-full flex items-center justify-center px-0.5 flex-shrink-0">
                {hol && (
                  <span className="text-[0.65rem] leading-none text-red-400 font-medium text-center truncate w-full">
                    {hol}
                  </span>
                )}
              </div>

              {/* 전체 조 뷰 */}
              {team === "all" ? (
                <div className="flex flex-col gap-[2px] w-full mt-0.5">
                  {(["day-s","night-s","off-s"] as ShiftType[]).map((type) => {
                    const label   = type==="day-s" ? "주" : type==="night-s" ? "야" : "비";
                    const teamLbl = type==="day-s" ? shift.day : type==="night-s" ? shift.night : shift.off;
                    const st      = type==="day-s" ? "day" : type==="night-s" ? "night" : null;
                    const setL    = type==="day-s"   ? SET_LABELS[getDaySetIndex(date)]
                                  : type==="night-s" ? SET_LABELS[getNightSetIndex(date)]
                                  : null;
                    return (
                      <div key={type}
                        className={`flex items-center justify-between px-1 py-px rounded text-[0.68rem] font-semibold
                          ${SHIFT_MINI[type]} ${st ? "cursor-pointer active:opacity-60" : ""}`}
                        onClick={st ? () => openRot(date, teamLbl as TeamABC, st) : undefined}>
                        <span className="opacity-70">{label}</span>
                        <span className="flex flex-col items-end leading-none">
                          <span className="font-bold">{teamLbl}</span>
                          <span className={`text-[0.55rem] font-black ${
                            setL
                              ? (type==="day-s" ? "text-blue-600" : "text-violet-600")
                              : "opacity-0 select-none"
                          }`}>
                            {setL ?? "A"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* 단일 조 뷰 */
                (() => {
                  const ms   = getTeamShift(shift, team);
                  const st   = ms==="day-s" ? "day" : ms==="night-s" ? "night" : null;
                  const setL = ms==="day-s"   ? SET_LABELS[getDaySetIndex(date)]
                             : ms==="night-s" ? SET_LABELS[getNightSetIndex(date)]
                             : null;
                  return (
                    <div
                      className={`w-[calc(100%-4px)] mt-1 py-1 rounded-lg flex flex-col items-center justify-center
                        text-xs font-bold text-white leading-tight
                        ${SHIFT_BG[ms]} ${st ? "cursor-pointer active:opacity-70" : ""}`}
                      onClick={st ? () => openRot(date, team as TeamABC, st) : undefined}>
                      <span>{getShiftName(ms)}</span>
                      <span className={`text-[0.6rem] font-black leading-tight ${setL ? "opacity-90" : "opacity-0 select-none"}`}>
                        {setL ?? "A"}
                      </span>
                    </div>
                  );
                })()
              )}
            </div>
          );
        })}
      </div>

      {/* ── FAB 버튼 ──────────────────────────────────────── */}
      <button onClick={goToday}    className={`${fabCls} bottom-4 right-4`}><CalendarDays size={22} /></button>
      <button onClick={toggleDark} className={`${fabCls} bottom-4 left-4`}>{dark ? <Sun size={20}/> : <Moon size={20}/>}</button>
      {showInstallBtn && (
        <button onClick={handleInstall} title="홈 화면에 추가" className={`${fabCls} bottom-20 left-4`}>
          <Smartphone size={20} />
        </button>
      )}

      {/* ── 모달: iOS 홈 화면 추가 안내 ──────────────────── */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowIOSGuide(false)}>
          <div className={`w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden ${t.modalBg}`}
            onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${t.divider}`}>
              <span className="font-bold text-base">홈 화면에 추가하기</span>
              <button onClick={() => setShowIOSGuide(false)} className="p-1 rounded-lg active:opacity-70">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <p className={`text-sm leading-relaxed ${t.sub}`}>Safari 브라우저에서 아래 순서대로 따라하세요.</p>
              <div className="space-y-3">
                {([
                  ["1","하단 가운데 공유 버튼","□↑","을 탭하세요."],
                  ["2","스크롤을 내려","홈 화면에 추가","를 선택하세요."],
                  ["3","오른쪽 위","추가","버튼을 탭하면 완료!"],
                ] as const).map(([n, pre, bold, post]) => (
                  <div key={n} className={`flex items-start gap-3 p-3 rounded-xl ${t.itemBg}`}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white bg-blue-500">{n}</span>
                    <p className="text-sm leading-relaxed">{pre}&nbsp;<span className="font-semibold">{bold}</span>&nbsp;{post}</p>
                  </div>
                ))}
              </div>
              <p className={`text-xs text-center ${t.muted}`}>Chrome 앱은 주소창 오른쪽 메뉴(⋮) → 홈 화면에 추가</p>
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold active:opacity-80">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 모달: 팀원 이름 설정 ──────────────────────────── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSettings(false)}>
          <div className={`w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] flex flex-col ${t.modalBg}`}
            onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${t.divider}`}>
              <span className="font-semibold">팀원 이름 설정</span>
              <button onClick={() => setShowSettings(false)} className="p-1 rounded-lg active:opacity-70">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4 space-y-5">
              {(["A","B","C"] as TeamABC[]).map((abc) => (
                <div key={abc}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-5 h-5 rounded-full ${TEAM_BG[abc]} text-white flex items-center justify-center text-xs font-bold`}>{abc}</div>
                    <span className={`font-semibold text-sm ${TEAM_TEXT[abc]}`}>{abc}조 팀원</span>
                  </div>
                  <div className="space-y-2">
                    {[0,1,2,3,4].map((idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className={`text-xs w-4 text-center font-semibold ${t.muted}`}>{idx+1}</span>
                        <input
                          value={editNames[abc][idx]}
                          onChange={(e) => updateName(abc, idx, e.target.value)}
                          placeholder={`${abc}조 ${idx+1}번 이름`}
                          className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-400 ${t.input}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className={`px-4 py-3 border-t ${t.divider}`}>
              <button onClick={saveNames}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors active:opacity-80">
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 모달: 로테이션 시간표 ─────────────────────────── */}
      {rotModal && (
        <RotationModal
          modal={rotModal}
          dark={dark}
          getName={getName}
          onClose={() => setRotModal(null)}
        />
      )}
    </div>
  );
}
