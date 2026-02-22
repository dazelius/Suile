"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Moon, Sun, Settings, X, Smartphone } from "lucide-react";

// ── PWA 설치 이벤트 타입 ────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ── 근무 로테이션 ──────────────────────────────────────
const BASE_DATE = new Date(2025, 0, 7);
const ROTATION = [
  { day: "A", night: "B", off: "C" },
  { day: "C", night: "A", off: "B" },
  { day: "B", night: "C", off: "A" },
];

// ── 한국 공휴일 (2025~2027) ─────────────────────────────
const HOLIDAYS: Record<string, string> = {
  "2025-1-1": "신정", "2025-1-28": "설날", "2025-1-29": "설날", "2025-1-30": "설날",
  "2025-3-1": "삼일절", "2025-5-5": "어린이날", "2025-5-6": "대체휴일",
  "2025-6-6": "현충일", "2025-8-15": "광복절", "2025-10-3": "개천절",
  "2025-10-5": "추석", "2025-10-6": "추석", "2025-10-7": "추석",
  "2025-10-8": "대체휴일", "2025-10-9": "한글날", "2025-12-25": "크리스마스",
  "2026-1-1": "신정", "2026-2-16": "설날", "2026-2-17": "설날", "2026-2-18": "설날",
  "2026-3-1": "삼일절", "2026-3-2": "대체휴일", "2026-5-5": "어린이날",
  "2026-5-24": "부처님오신날", "2026-6-6": "현충일", "2026-8-15": "광복절",
  "2026-8-17": "대체휴일", "2026-9-24": "추석", "2026-9-25": "추석", "2026-9-26": "추석",
  "2026-10-3": "개천절", "2026-10-5": "대체휴일", "2026-10-9": "한글날",
  "2026-12-25": "크리스마스",
  "2027-1-1": "신정", "2027-2-6": "설날", "2027-2-7": "설날", "2027-2-8": "설날",
  "2027-2-9": "대체휴일", "2027-3-1": "삼일절", "2027-5-5": "어린이날",
  "2027-5-13": "부처님오신날", "2027-6-6": "현충일", "2027-6-7": "대체휴일",
  "2027-8-15": "광복절", "2027-8-16": "대체휴일",
  "2027-9-14": "추석", "2027-9-15": "추석", "2027-9-16": "추석",
  "2027-10-3": "개천절", "2027-10-4": "대체휴일", "2027-10-9": "한글날",
  "2027-10-11": "대체휴일", "2027-12-25": "크리스마스",
};

// ── 근무표 공통 상수 ────────────────────────────────────
// B조 2026-02-23 주간 = 세트 A 기준
const SET_REF_DATE  = new Date(2026, 1, 23);
const SET_LABELS    = ["A", "B", "C", "D", "E"] as const;
type  SetLabel      = (typeof SET_LABELS)[number];

const POSITIONS = ["초소", "1검색대", "2검색대", "3검색대", "휴식"] as const;

// 주간 타임슬롯 (11개)
const DAY_TIME_SLOTS = [
  "07:00~08:00", "08:00~09:00", "09:00~10:00",
  "10:00~11:00", "11:00~12:00", "12:00~13:00",
  "13:00~14:00", "14:00~15:00", "15:00~16:00",
  "16:00~17:00", "17:00~18:00",
] as const;

// 야간 타임슬롯 (13개)
const NIGHT_TIME_SLOTS = [
  "18:00~19:00", "19:00~20:00", "20:00~21:00",
  "21:00~22:00", "22:00~23:00", "23:00~00:00",
  "00:00~01:00", "01:00~02:00", "02:00~03:00",
  "03:00~04:00", "04:00~05:00", "05:00~06:00",
  "06:00~07:00",
] as const;

// ── 이벤트 타입 ────────────────────────────────────────
type CellEvent =
  | "입차시작" | "출근" | "식사" | "퇴근" | "순찰"
  | "WBR보고" | "차량보고" | "교육지회수"
  | null;

/** 주간 이벤트 (이미지 기준) */
function getDayCellEvent(hourIdx: number, posIdx: number): CellEvent {
  if (hourIdx === 0) return "입차시작";                          // 07:00 전 포지션
  if (hourIdx === 1) return "출근";                             // 08:00 전 포지션
  if (hourIdx === 5  && posIdx === 4) return "식사";            // 12:00 휴식
  if (hourIdx === 10 && posIdx === 4) return "순찰";            // 17:00 휴식
  if (hourIdx === 10 && posIdx !== 4) return "퇴근";            // 17:00 나머지
  return null;
}

/** 야간 이벤트 (이미지 기준) */
function getNightCellEvent(hourIdx: number, posIdx: number): CellEvent {
  if (hourIdx === 0) return "입차시작";                          // 18:00 전 포지션
  if (hourIdx === 1) return "출근";                             // 19:00 전 포지션
  if (hourIdx === 3  && posIdx === 4) return "식사";            // 21:00 휴식
  if (hourIdx === 5  && posIdx === 4) return "순찰";            // 23:00 휴식
  if (hourIdx === 10 && posIdx === 4) return "WBR보고";         // 04:00 휴식
  if (hourIdx === 11 && posIdx === 4) return "차량보고";         // 05:00 휴식
  if (hourIdx === 12 && posIdx === 4) return "교육지회수";       // 06:00 휴식
  if (hourIdx === 12 && posIdx !== 4) return "퇴근";            // 06:00 나머지
  return null;
}

const EVENT_STYLE: Record<NonNullable<CellEvent>, string> = {
  입차시작:   "bg-sky-100 text-sky-800",
  출근:      "bg-red-500 text-white",
  식사:      "bg-teal-500 text-white",
  퇴근:      "bg-green-500 text-white",
  순찰:      "bg-indigo-700 text-white",
  WBR보고:   "bg-pink-400 text-white",
  차량보고:   "bg-blue-500 text-white",
  교육지회수: "bg-lime-500 text-white",
};
const EVENT_DOT: Record<NonNullable<CellEvent>, string> = {
  입차시작:   "bg-sky-300",
  출근:      "bg-red-500",
  식사:      "bg-teal-500",
  퇴근:      "bg-green-500",
  순찰:      "bg-indigo-700",
  WBR보고:   "bg-pink-400",
  차량보고:   "bg-blue-500",
  교육지회수: "bg-lime-500",
};

// ── 타입 ──────────────────────────────────────────────
type ShiftType  = "day-s" | "night-s" | "off-s";
type Team       = "all" | "A" | "B" | "C";
type TeamABC    = "A" | "B" | "C";
type Names      = Record<TeamABC, string[]>;
interface ShiftInfo   { day: string; night: string; off: string; }
interface RotModalState {
  date:      Date;
  team:      TeamABC;
  shiftType: "day" | "night";
}

const DEFAULT_NAMES: Names = {
  A: ["", "", "", "", ""],
  B: ["", "", "", "", ""],
  C: ["", "", "", "", ""],
};

// ── 헬퍼 함수 ─────────────────────────────────────────
function getShift(date: Date): ShiftInfo {
  const diff = Math.floor((date.getTime() - BASE_DATE.getTime()) / (1000 * 60 * 60 * 24));
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
  return HOLIDAYS[`${y}-${m + 1}-${d}`] || null;
}
function getDaysUntilOff(team: string): number {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 30; i++) {
    const c = new Date(t); c.setDate(t.getDate() + i);
    if (getShift(c).off === team) return i;
  }
  return -1;
}

// 주간·야간 세트 계산 – 2026-02-23(B조 주간 A) 기준
// 6일 주기에서 2칸씩 전진: floor(sd/6)*2 + sd%2
// 주간: A→B→C→D→E (순방향), 야간: E→D→C→B→A (역방향)
function _shiftSetOccurrence(date: Date): number {
  const refMs  = Date.UTC(2026, 1, 23);
  const dateMs = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const sd     = Math.round((dateMs - refMs) / 86400000);
  return Math.floor(sd / 6) * 2 + (((sd % 2) + 2) % 2);
}
function getDaySetIndex(date: Date): number {
  return ((_shiftSetOccurrence(date) % 5) + 5) % 5;
}
function getNightSetIndex(date: Date): number {
  return ((4 - _shiftSetOccurrence(date) % 5) + 5) % 5;
}

// 위치 p, 시간 h, 세트 오프셋 s → 근무자 인덱스 (0~4)
function getWorkerIdx(p: number, h: number, s: number): number {
  return ((p - h + s) % 5 + 5) % 5;
}

// ── 스타일 상수 ────────────────────────────────────────
const SHIFT_BG: Record<ShiftType, string> = {
  "day-s":   "bg-orange-500",
  "night-s": "bg-violet-600",
  "off-s":   "bg-sky-400",
};
const SHIFT_MINI: Record<ShiftType, string> = {
  "day-s":   "bg-orange-100 text-orange-700",
  "night-s": "bg-violet-100 text-violet-700",
  "off-s":   "bg-sky-100 text-sky-700",
};
const TEAM_ACTIVE: Record<string, string> = {
  all: "!bg-gray-700 !border-gray-700 !text-white",
  A:   "!bg-red-500 !border-red-500 !text-white",
  B:   "!bg-blue-500 !border-blue-500 !text-white",
  C:   "!bg-green-500 !border-green-500 !text-white",
};
const TEAM_TEXT: Record<TeamABC, string> = { A: "text-red-500", B: "text-blue-500", C: "text-green-500" };
const TEAM_BG:   Record<TeamABC, string> = { A: "bg-red-500",   B: "bg-blue-500",   C: "bg-green-500" };

// ── 컴포넌트 ──────────────────────────────────────────
export default function WorkScheduleClient() {
  const now = new Date();
  const [year, setYear]           = useState(now.getFullYear());
  const [month, setMonth]         = useState(now.getMonth());
  const [team, setTeam]           = useState<Team>("all");
  const [dark, setDark]           = useState(false);
  const [names, setNames]         = useState<Names>(DEFAULT_NAMES);
  const [editNames, setEditNames] = useState<Names>(DEFAULT_NAMES);
  const [showSettings, setShowSettings] = useState(false);
  const [rotModal, setRotModal]   = useState<RotModalState | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOSDevice, setIsIOSDevice]       = useState(false);
  const [showIOSGuide, setShowIOSGuide]     = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("ws-team") as Team | null;
    const d = localStorage.getItem("ws-dark") === "true";
    const n = localStorage.getItem("ws-names");
    if (t) setTeam(t);
    setDark(d);
    if (n) {
      try {
        const p = JSON.parse(n) as Names;
        setNames(p);
        setEditNames({ A: [...p.A], B: [...p.B], C: [...p.C] });
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // iOS Safari: API 없으므로 안내 모달로 처리
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    if (ios) {
      setIsIOSDevice(true);
      setShowInstallBtn(true);
    }

    // Android Chrome / Edge 등: beforeinstallprompt 이벤트 감지
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBtn(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIOSDevice) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };

  const changeMonth = useCallback((delta: number) => {
    const nm = month + delta;
    if (nm > 11) { setYear((y) => y + 1); setMonth(0); }
    else if (nm < 0) { setYear((y) => y - 1); setMonth(11); }
    else { setMonth(nm); }
  }, [month]);

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

  const todayShift = (() => {
    if (team === "all") return null;
    const t = new Date();
    const shift = getShift(t);
    const type  = getTeamShift(shift, team);
    return { type, name: getShiftName(type), ddays: getDaysUntilOff(team) };
  })();

  useEffect(() => {
    let sx = 0;
    const os = (e: TouchEvent) => { sx = e.touches[0].clientX; };
    const oe = (e: TouchEvent) => {
      const d = sx - e.changedTouches[0].clientX;
      if (Math.abs(d) > 80) changeMonth(d > 0 ? 1 : -1);
    };
    document.addEventListener("touchstart", os);
    document.addEventListener("touchend", oe);
    return () => { document.removeEventListener("touchstart", os); document.removeEventListener("touchend", oe); };
  }, [changeMonth]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = i - firstDay + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });

  const bg   = dark ? "bg-[#1c1c1e] text-[#f5f5f7]" : "bg-[#f5f5f7] text-[#1d1d1f]";
  const card = dark ? "bg-[#2c2c2e] border-[#3a3a3c]" : "bg-white border-[#e5e5e7]";

  return (
    <div className={`flex flex-col h-screen ${bg} transition-colors duration-300`}>

      {/* ── 헤더 ─────────────────────────────────────── */}
      <header className={`${card} border-b px-4 pt-3 pb-3 flex-shrink-0`}>
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => changeMonth(-1)}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center ${card} active:opacity-70`}>
            <ChevronLeft size={18} />
          </button>
          <span className="flex-1 text-center text-lg font-semibold">{year}년 {month + 1}월</span>
          <button onClick={() => changeMonth(1)}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center ${card} active:opacity-70`}>
            <ChevronRight size={18} />
          </button>
          <button onClick={openSettings}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center ${card} active:opacity-70`}>
            <Settings size={16} />
          </button>
        </div>

        {todayShift && (
          <div className={`flex items-center justify-center gap-3 px-3 py-2 mb-2 rounded-xl border ${card}`}>
            <span className="text-xs text-[#86868b]">오늘</span>
            <span className={`text-sm font-bold px-3 py-1 rounded-lg text-white ${SHIFT_BG[todayShift.type]}`}>
              {todayShift.name}
            </span>
            {todayShift.type !== "off-s" && todayShift.ddays > 0 && (
              <span className="text-xs text-[#86868b]">
                다음 비번 <span className="font-bold text-sky-400">D-{todayShift.ddays}</span>
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-4 gap-1.5">
          {(["all", "A", "B", "C"] as Team[]).map((t) => (
            <button key={t} onClick={() => selectTeam(t)}
              className={`py-2 rounded-lg border text-sm font-semibold transition-all
                ${dark ? "bg-[#3a3a3c] border-[#4a4a4c] text-[#8e8e93]" : "bg-white border-[#e5e5e7] text-[#86868b]"}
                ${team === t ? TEAM_ACTIVE[t] : ""}`}>
              {t === "all" ? "전체" : `${t}조`}
            </button>
          ))}
        </div>
      </header>

      {/* ── 범례 ─────────────────────────────────────── */}
      <div className={`${card} border-b flex items-center justify-center gap-6 py-2 flex-shrink-0 text-xs`}>
        {[["bg-orange-500","주간"],["bg-violet-600","야간"],["bg-sky-400","비번"]].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${c}`} />
            <span className="text-[#86868b]">{l}</span>
          </div>
        ))}
        <span className="text-[#86868b] opacity-50 text-[0.62rem]">탭 → 시간표</span>
      </div>

      {/* ── 요일 헤더 ────────────────────────────────── */}
      <div className={`${card} border-b grid grid-cols-7 text-center text-xs font-semibold py-2 flex-shrink-0`}>
        {["일","월","화","수","목","금","토"].map((d,i) => (
          <div key={d} className={i===0?"text-red-500":i===6?"text-blue-500":"text-[#86868b]"}>{d}</div>
        ))}
      </div>

      {/* ── 달력 ─────────────────────────────────────── */}
      <div className={`flex-1 grid grid-cols-7 gap-px p-px min-h-0 ${dark?"bg-[#3a3a3c]":"bg-[#e5e5e7]"}`}>
        {cells.map((dn, i) => {
          if (!dn) return <div key={i} className={dark?"bg-[#1c1c1e]":"bg-[#fafafa]"} />;

          const date    = new Date(year, month, dn);
          const dow     = date.getDay();
          const shift   = getShift(date);
          const isToday = date.getTime() === today.getTime();
          const hol     = getHoliday(year, month, dn);
          const isSun   = dow === 0 || !!hol;
          const isSat   = dow === 6;

          let cc = dark ? "bg-[#2c2c2e]" : "bg-white";
          if (isSun && !hol) cc = dark ? "bg-[#2a2025]" : "bg-red-50";
          if (isSat)         cc = dark ? "bg-[#202530]" : "bg-blue-50";
          if (hol)           cc = dark ? "bg-[#3a2025]" : "bg-red-50";
          if (isToday)       cc = dark
            ? "bg-[#3a3020] ring-2 ring-inset ring-orange-400"
            : "bg-amber-50 ring-2 ring-inset ring-orange-400";

          const dc = hol||isSun ? "text-red-500" : isSat ? "text-blue-500"
            : dark ? "text-[#f5f5f7]" : "text-[#1d1d1f]";

          return (
            <div key={i} className={`${cc} flex flex-col items-center justify-start pt-1 pb-1 px-0.5 min-h-0`}>
              <span className={`text-sm font-semibold leading-tight ${dc}`}>{dn}</span>
              {hol && (
                <span className="text-[0.5rem] text-red-400 leading-tight text-center truncate w-full px-0.5">
                  {hol}
                </span>
              )}

              {team === "all" ? (
                <div className="flex flex-col gap-px w-full mt-0.5">
                  {(["day-s","night-s","off-s"] as ShiftType[]).map((type) => {
                    const lbl  = type==="day-s"?"주":type==="night-s"?"야":"비";
                    const tl   = type==="day-s"?shift.day:type==="night-s"?shift.night:shift.off;
                    const st   = type==="day-s" ? "day" : type==="night-s" ? "night" : null;
                    const setL = type==="day-s"   ? SET_LABELS[getDaySetIndex(date)]
                               : type==="night-s" ? SET_LABELS[getNightSetIndex(date)]
                               : null;
                    return (
                      <div key={type}
                        className={`flex justify-between items-center px-1 rounded-sm text-[0.6rem] font-medium
                          ${SHIFT_MINI[type]} ${st ? "cursor-pointer active:opacity-60" : ""}`}
                        onClick={st ? () => openRot(date, tl as TeamABC, st) : undefined}>
                        <span>{lbl}</span>
                        <span className="flex items-center gap-px">
                          <span className="font-bold">{tl}</span>
                          {setL && (
                            <span className="font-bold opacity-60 text-[0.5rem] leading-none">{setL}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                (() => {
                  const ms   = getTeamShift(shift, team);
                  const st   = ms==="day-s" ? "day" : ms==="night-s" ? "night" : null;
                  const setL = ms==="day-s"   ? SET_LABELS[getDaySetIndex(date)]
                             : ms==="night-s" ? SET_LABELS[getNightSetIndex(date)]
                             : null;
                  return (
                    <div
                      className={`w-[88%] mt-1 py-1 rounded-md text-center text-[0.7rem] font-bold text-white
                        ${SHIFT_BG[ms]} ${st ? "cursor-pointer active:opacity-60" : ""}`}
                      onClick={st ? () => openRot(date, team as TeamABC, st) : undefined}>
                      {getShiftName(ms)}
                      {setL && (
                        <span className="text-[0.55rem] font-bold opacity-80 ml-0.5">{setL}</span>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          );
        })}
      </div>

      {/* ── FAB ──────────────────────────────────────── */}
      <button onClick={goToday}
        className={`fixed bottom-4 right-4 w-12 h-12 rounded-full shadow-lg border flex items-center justify-center ${card} active:opacity-70 z-10`}>
        <CalendarDays size={22} />
      </button>
      <button onClick={toggleDark}
        className={`fixed bottom-4 left-4 w-12 h-12 rounded-full shadow-lg border flex items-center justify-center ${card} active:opacity-70 z-10`}>
        {dark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      {showInstallBtn && (
        <button onClick={handleInstall}
          className={`fixed bottom-20 left-4 w-12 h-12 rounded-full shadow-lg border flex items-center justify-center ${card} active:opacity-70 z-10`}
          title="홈 화면에 추가">
          <Smartphone size={20} />
        </button>
      )}

      {/* ══════════════════════════════════════════════
          iOS 홈 화면 추가 안내 모달
      ══════════════════════════════════════════════ */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowIOSGuide(false)}>
          <div
            className={`w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden
              ${dark ? "bg-[#2c2c2e] text-[#f5f5f7]" : "bg-white text-[#1d1d1f]"}`}
            onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${dark?"border-[#3a3a3c]":"border-[#e5e5e7]"}`}>
              <span className="font-bold text-base">홈 화면에 추가하기</span>
              <button onClick={() => setShowIOSGuide(false)} className="p-1 rounded-lg active:opacity-70">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <p className={`text-sm leading-relaxed ${dark?"text-[#aeaeb2]":"text-[#6e6e73]"}`}>
                Safari 브라우저에서 아래 순서대로 따라하세요.
              </p>
              <div className="space-y-3">
                {([
                  ["1", "하단 가운데 공유 버튼", "□↑", "을 탭하세요."],
                  ["2", "스크롤을 내려", "홈 화면에 추가", "를 선택하세요."],
                  ["3", "오른쪽 위", "추가", "버튼을 탭하면 완료!"],
                ] as const).map(([n, pre, bold, post]) => (
                  <div key={n} className={`flex items-start gap-3 p-3 rounded-xl ${dark?"bg-[#3a3a3c]":"bg-[#f5f5f7]"}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white bg-blue-500`}>{n}</span>
                    <p className="text-sm leading-relaxed">
                      {pre}&nbsp;<span className="font-semibold">{bold}</span>&nbsp;{post}
                    </p>
                  </div>
                ))}
              </div>
              <p className={`text-xs text-center ${dark?"text-[#6e6e73]":"text-[#aeaeb2]"}`}>
                Chrome 앱은 주소창 오른쪽 메뉴(⋮) → 홈 화면에 추가
              </p>
            </div>
            <div className={`px-5 pb-5`}>
              <button onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold active:opacity-80">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          팀원 이름 설정 모달
      ══════════════════════════════════════════════ */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSettings(false)}>
          <div
            className={`w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] flex flex-col
              ${dark ? "bg-[#2c2c2e] text-[#f5f5f7]" : "bg-white text-[#1d1d1f]"}`}
            onClick={(e) => e.stopPropagation()}>

            <div className={`flex items-center justify-between px-4 py-3 border-b
              ${dark?"border-[#3a3a3c]":"border-[#e5e5e7]"}`}>
              <span className="font-semibold">팀원 이름 설정</span>
              <button onClick={() => setShowSettings(false)} className="p-1 rounded-lg active:opacity-70">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-auto flex-1 p-4 space-y-5">
              {(["A","B","C"] as TeamABC[]).map((t) => (
                <div key={t}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-5 h-5 rounded-full ${TEAM_BG[t]} text-white flex items-center justify-center text-xs font-bold`}>{t}</div>
                    <span className={`font-semibold text-sm ${TEAM_TEXT[t]}`}>{t}조 팀원</span>
                  </div>
                  <div className="space-y-2">
                    {[0,1,2,3,4].map((idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className={`text-xs w-4 text-center font-semibold ${dark?"text-[#8e8e93]":"text-[#86868b]"}`}>{idx+1}</span>
                        <input
                          value={editNames[t][idx]}
                          onChange={(e) => updateName(t, idx, e.target.value)}
                          placeholder={`${t}조 ${idx+1}번 이름`}
                          className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-400
                            ${dark
                              ? "bg-[#3a3a3c] border-[#4a4a4c] text-[#f5f5f7] placeholder:text-[#6e6e73]"
                              : "bg-[#f5f5f7] border-[#e5e5e7] text-[#1d1d1f] placeholder:text-[#86868b]"}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={`px-4 py-3 border-t ${dark?"border-[#3a3a3c]":"border-[#e5e5e7]"}`}>
              <button onClick={saveNames}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors active:opacity-80">
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          주간 / 야간 근무표 모달
      ══════════════════════════════════════════════ */}
      {rotModal && (() => {
        const { date, team: mt, shiftType } = rotModal;

        const isDay      = shiftType === "day";
        const timeSlots  = isDay ? DAY_TIME_SLOTS  : NIGHT_TIME_SLOTS;
        const si: number   = isDay ? getDaySetIndex(date) : getNightSetIndex(date);
        const sl: SetLabel = SET_LABELS[si];
        const setDir       = isDay ? "A→B→C→D→E" : "E→D→C→B→A";
        const shiftLabel = isDay ? "주간" : "야간";
        const dateStr    = `${date.getMonth()+1}월 ${date.getDate()}일`;

        // 퇴근 행 인덱스
        const checkoutHour = isDay ? 10 : 12;          // 주간 17:00, 야간 06:00

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2"
            onClick={() => setRotModal(null)}>
            <div
              className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col
                ${dark ? "bg-[#2c2c2e] text-[#f5f5f7]" : "bg-white text-[#1d1d1f]"}`}
              onClick={(e) => e.stopPropagation()}>

              {/* 헤더 */}
              <div className={`flex items-start justify-between px-4 py-3 border-b flex-shrink-0
                ${dark?"border-[#3a3a3c]":"border-[#e5e5e7]"}`}>
                <div>
                  <div className="font-semibold">
                    {dateStr}&nbsp;
                    <span className={TEAM_TEXT[mt]}>{mt}조</span>
                    &nbsp;{shiftLabel} 시간표
                  </div>
                  <div className={`text-xs mt-0.5 ${dark?"text-[#8e8e93]":"text-[#86868b]"}`}>
                    근무 세트&nbsp;
                    <span className="font-bold text-orange-500 text-sm">{sl}</span>
                    <span className="ml-2 opacity-60">({setDir} 순환)</span>
                  </div>
                </div>
                <button onClick={() => setRotModal(null)} className="p-1 mt-0.5 rounded-lg active:opacity-70 flex-shrink-0">
                  <X size={20} />
                </button>
              </div>

              {/* 표 */}
              <div className="overflow-auto flex-1">
                <table className="w-full text-xs border-collapse" style={{ minWidth: 340 }}>
                  <thead>
                    <tr className={dark?"bg-[#3a3a3c]":"bg-[#f5f5f7]"}>
                      <th className={`px-2 py-2 text-left font-semibold whitespace-nowrap border-b
                        ${dark?"border-[#4a4a4c] text-[#8e8e93]":"border-[#e5e5e7] text-[#86868b]"}`}>
                        시간
                      </th>
                      {POSITIONS.map((pos) => (
                        <th key={pos} className={`px-1 py-2 text-center font-semibold whitespace-nowrap border-b
                          ${dark?"border-[#4a4a4c]":"border-[#e5e5e7]"}`}>
                          {pos}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((slot, hi) => {
                      const isCheckout = hi === checkoutHour;
                      return (
                        <tr key={slot}
                          className={hi%2===0
                            ? (dark?"bg-[#2c2c2e]":"bg-white")
                            : (dark?"bg-[#323234]":"bg-[#fafafa]")}>
                          <td className={`px-2 py-1 font-medium whitespace-nowrap border-b
                            ${isCheckout ? "bg-green-500 text-white" :
                              dark ? "border-[#3a3a3c] text-[#8e8e93]" : "border-[#f0f0f0] text-[#86868b]"}`}>
                            {slot}
                          </td>
                          {POSITIONS.map((_, pi) => {
                            const wi     = getWorkerIdx(pi, hi, si);
                            const nm     = getName(mt, wi);
                            const isRest = pi === 4;
                            let cellCls  = "";
                            if (isCheckout)  cellCls = "bg-green-500 text-white";
                            else if (isRest) cellCls = dark
                              ? "bg-violet-900/50 text-violet-200"
                              : "bg-violet-100 text-violet-800";
                            return (
                              <td key={pi} className={`border-b p-0.5
                                ${dark?"border-[#3a3a3c]":"border-[#f0f0f0]"}`}>
                                <div className={`flex items-center justify-center py-1.5 px-1 rounded-md font-semibold ${cellCls}`}>
                                  {nm}
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

              {/* 범례 */}
              <div className={`flex gap-4 px-4 py-2.5 border-t flex-shrink-0
                ${dark?"border-[#3a3a3c]":"border-[#e5e5e7]"}`}>
                {([
                  ["bg-green-500",  "퇴근"],
                  ["bg-violet-300", "휴식"],
                ] as const).map(([dot, label]) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-sm ${dot}`} />
                    <span className={`text-[0.65rem] ${dark?"text-[#8e8e93]":"text-[#86868b]"}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
