"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, RotateCcw, Share2, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

// ── 타입 ──
interface CategoryResult {
  score: number;
  comment: string;
}
interface FaceResult {
  overallScore: number;
  symmetryScore: number;
  estimatedAge: number;
  nickname: string;
  celebrity: { name: string; similarity: number };
  categories: {
    eyes: CategoryResult;
    nose: CategoryResult;
    mouth: CategoryResult;
    skin: CategoryResult;
    jawline: CategoryResult;
    vibe: CategoryResult;
  };
  oneLiner: string;
  tips: string[];
}

type Phase = "intro" | "camera" | "scanning" | "result";
type ScanStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

const API_URL = "https://asia-northeast3-suile-21173.cloudfunctions.net/faceScore";

// ── 일일 사용 제한 ──
const DAILY_LIMIT_KEY = "face-score-last-used";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function hasUsedToday(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DAILY_LIMIT_KEY) === getTodayStr();
  } catch {
    return false;
  }
}

function markUsedToday() {
  try {
    localStorage.setItem(DAILY_LIMIT_KEY, getTodayStr());
  } catch { /* secret mode */ }
}

// ── 랜드마크 위치 (정면 얼굴 비율 기준, %) ──
const LANDMARKS = [
  { x: 38, y: 36 },
  { x: 62, y: 36 },
  { x: 50, y: 48 },
  { x: 42, y: 60 },
  { x: 58, y: 60 },
  { x: 30, y: 70 },
  { x: 70, y: 70 },
  { x: 50, y: 26 },
];

const WIREFRAME_LINES = [
  [0, 1], [0, 2], [1, 2], [2, 3], [2, 4], [3, 4],
  [0, 5], [1, 6], [5, 3], [6, 4], [5, 6], [0, 7], [1, 7],
];

// ── 점수 바 색상 ──
function scoreColor(s: number) {
  if (s >= 90) return "bg-emerald-500";
  if (s >= 80) return "bg-blue-500";
  if (s >= 70) return "bg-amber-500";
  return "bg-red-400";
}
function scoreTextColor(s: number) {
  if (s >= 90) return "text-emerald-600";
  if (s >= 80) return "text-blue-600";
  if (s >= 70) return "text-amber-600";
  return "text-red-500";
}

// ══════════════════════════════════════════════
// 로컬라이즈 텍스트
// ══════════════════════════════════════════════
const L = {
  ko: {
    title: "AI 얼굴 평가",
    subtitle: "카메라로 정면 사진을 촬영하면 AI가 정밀 분석합니다",
    errCamera: "카메라 접근이 거부되었습니다. 브라우저 설정에서 카메라를 허용해주세요.",
    errAnalyze: "얼굴 분석에 실패했습니다.",
    errTipDefault: "밝은 곳에서 정면을 바라보고 다시 촬영해주세요.",
    retryCapture: "다시 촬영하기",
    dailyUsed: "오늘의 분석을 이미 사용했습니다",
    dailyLimit: "하루 1회 무료 분석이 제공됩니다.",
    dailyTomorrow: "내일 다시 도전해보세요!",
    dailyReset: "자정(00:00) 이후 초기화됩니다",
    introGuide: "정면을 바라보고 촬영해주세요",
    introHint: "밝은 곳에서 촬영하면 더 정확합니다",
    openCamera: "카메라 열기",
    freeOnce: "하루 1회 무료 분석",
    disclaimer: "사진은 AI 분석에만 사용되며 서버에 저장되지 않습니다. 본 결과는 재미용이며 실제 외모 평가가 아닙니다.",
    cameraGuide: "얼굴을 가이드 안에 맞춰주세요",
    scanMessages: [
      "",
      "안면 영역 디텍션 중...",
      "랜드마크 68포인트 매핑 중...",
      "좌우 대칭 지수 측정 중...",
      "눈 — 미간 비율 · 눈꼬리 각도 분석 중...",
      "코 — 브릿지 라인 · 코 길이 비율 측정 중...",
      "입 — 상하 입술비 · 인중 길이 분석 중...",
      "윤곽 — 삼정 비율 · 턱선 각도 측정 중...",
      "피부 — 색조 균일도 · 질감 분석 중...",
      "황금비율 종합 스코어 산출 중...",
      "분석 완료!",
    ],
    waitMessages: [
      "데이터 포인트 종합 중...",
      "황금비율 매칭 알고리즘 실행 중...",
      "삼정오안 비율 계산 중...",
      "닮은 연예인 데이터베이스 검색 중...",
      "AI 리포트 생성 중...",
      "최종 스코어 산출 중...",
    ],
    preparing: "준비 중...",
    stepOf: (n: number) => `${n} / 10 단계`,
    scanDone: "스캔 완료 · AI가 리포트를 작성하고 있습니다",
    boundingLabels: { eyes: "눈", nose: "코", mouth: "입", jawline: "윤곽", skin: "피부" },
    catLabels: { eyes: "눈", nose: "코", mouth: "입", skin: "피부", jawline: "윤곽", vibe: "분위기" } as Record<string, string>,
    estimatedAge: "추정 나이",
    ageSuffix: "세",
    celebrityMatch: (sim: number) => `닮은 연예인 · ${sim}%`,
    partAnalysis: "부위별 정밀 분석",
    analysisBasis: "황금비율 · 삼정오안 기반",
    symmetry: "좌우 대칭",
    oneLiner: "종합 한줄평",
    styleTip: "스타일 팁",
    disclaimerResult: "본 결과는 AI 기반 재미용 분석이며 실제 외모 평가가 아닙니다. 사진은 서버에 저장되지 않습니다.",
    retake: "다시 찍기",
    share: "공유하기",
    shareCopied: "결과가 복사되었습니다!",
    shareTitle: (score: number, age: number) => `AI 얼굴 평가: ${score}점 · ${age}세`,
    shareText: (score: number, age: number, celeb: string) =>
      `AI 얼굴 평가 결과: ${score}점 · ${age}세 · 닮은 연예인: ${celeb}`,
  },
  en: {
    title: "AI Face Score",
    subtitle: "Take a front-facing photo and AI will analyze your face",
    errCamera: "Camera access denied. Please allow camera in browser settings.",
    errAnalyze: "Face analysis failed.",
    errTipDefault: "Try again in good lighting while facing forward.",
    retryCapture: "Retry",
    dailyUsed: "You've already used today's analysis",
    dailyLimit: "1 free analysis per day.",
    dailyTomorrow: "Try again tomorrow!",
    dailyReset: "Resets after midnight (00:00)",
    introGuide: "Face the camera directly",
    introHint: "Better lighting = more accurate results",
    openCamera: "Open Camera",
    freeOnce: "1 free analysis per day",
    disclaimer: "Photos are only used for AI analysis and are not stored on servers. Results are for entertainment only.",
    cameraGuide: "Align your face within the guide",
    scanMessages: [
      "",
      "Detecting facial region...",
      "Mapping 68 landmark points...",
      "Measuring bilateral symmetry...",
      "Eyes — Analyzing ratio & angle...",
      "Nose — Measuring bridge line & proportion...",
      "Mouth — Analyzing lip ratio & philtrum...",
      "Contour — Measuring facial thirds & jawline...",
      "Skin — Analyzing tone uniformity & texture...",
      "Computing golden ratio composite score...",
      "Analysis complete!",
    ],
    waitMessages: [
      "Aggregating data points...",
      "Running golden ratio matching...",
      "Computing facial proportion ratios...",
      "Searching celebrity database...",
      "Generating AI report...",
      "Calculating final score...",
    ],
    preparing: "Preparing...",
    stepOf: (n: number) => `Step ${n} / 10`,
    scanDone: "Scan complete · AI is writing the report",
    boundingLabels: { eyes: "Eyes", nose: "Nose", mouth: "Mouth", jawline: "Contour", skin: "Skin" },
    catLabels: { eyes: "Eyes", nose: "Nose", mouth: "Mouth", skin: "Skin", jawline: "Contour", vibe: "Vibe" } as Record<string, string>,
    estimatedAge: "Est. Age",
    ageSuffix: "",
    celebrityMatch: (sim: number) => `Celebrity Match · ${sim}%`,
    partAnalysis: "Detailed Analysis",
    analysisBasis: "Golden Ratio Based",
    symmetry: "Symmetry",
    oneLiner: "Overall Comment",
    styleTip: "Style Tips",
    disclaimerResult: "This is an AI-based fun analysis, not an actual appearance evaluation. Photos are not stored.",
    retake: "Retake",
    share: "Share",
    shareCopied: "Result copied!",
    shareTitle: (score: number, age: number) => `AI Face Score: ${score} pts · Age ${age}`,
    shareText: (score: number, age: number, celeb: string) =>
      `AI Face Score: ${score} pts · Age ${age} · Celebrity Match: ${celeb}`,
  },
} as const;

// ══════════════════════════════════════════════
// 메인 컴포넌트
// ══════════════════════════════════════════════
export default function FaceScoreClient() {
  const { locale } = useI18n();
  const t = locale === "ko" ? L.ko : L.en;

  const BOUNDING_BOXES = [
    { x: 30, y: 30, w: 40, h: 14, label: t.boundingLabels.eyes, step: 4 },
    { x: 40, y: 42, w: 20, h: 14, label: t.boundingLabels.nose, step: 5 },
    { x: 35, y: 55, w: 30, h: 12, label: t.boundingLabels.mouth, step: 6 },
    { x: 25, y: 25, w: 50, h: 55, label: t.boundingLabels.jawline, step: 7 },
    { x: 22, y: 20, w: 56, h: 65, label: t.boundingLabels.skin, step: 8 },
  ];

  const [phase, setPhase] = useState<Phase>("intro");
  const [scanStep, setScanStep] = useState<ScanStep>(0);
  const [capturedImage, setCapturedImage] = useState<string>("");
  const [result, setResult] = useState<FaceResult | null>(null);
  const [waitingMsg, setWaitingMsg] = useState(0);
  const [error, setError] = useState("");
  const [errorTip, setErrorTip] = useState("");
  const [dailyLimited, setDailyLimited] = useState(false);

  useEffect(() => {
    setDailyLimited(hasUsedToday());
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── 카메라 시작 ──
  const startCamera = useCallback(async () => {
    setError("");
    setPhase("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError(t.errCamera);
      setPhase("intro");
    }
  }, [t]);

  // ── 카메라 종료 ──
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  // ── 촬영 ──
  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();

    setPhase("scanning");
    setScanStep(0);

    const apiPromise = fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          const err = new Error(data.error);
          (err as Error & { tip?: string }).tip = data.tip || "";
          throw err;
        }
        return data as FaceResult;
      });

    const scanTimings = [700, 900, 800, 900, 800, 800, 800, 700, 900, 400];
    let elapsed = 0;
    for (let step = 1; step <= 10; step++) {
      elapsed += scanTimings[step - 1];
      setTimeout(() => setScanStep(step as ScanStep), elapsed);
    }

    const waitingInterval = setInterval(() => {
      setWaitingMsg((prev) => (prev + 1) % t.waitMessages.length);
    }, 2000);

    try {
      const data = await apiPromise;
      clearInterval(waitingInterval);
      const minWait = elapsed + 300;
      const now = Date.now();
      const captureTime = now;
      const remaining = minWait - (Date.now() - captureTime);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setResult(data);
      setPhase("result");
      markUsedToday();
      setDailyLimited(true);
    } catch (err: unknown) {
      clearInterval(waitingInterval);
      const errObj = err as Error & { tip?: string };
      setError(errObj.message || t.errAnalyze);
      setErrorTip(errObj.tip || t.errTipDefault);
      setPhase("intro");
    }
  }, [stopCamera, t]);

  // ── 다시 찍기 ──
  const reset = useCallback(() => {
    setResult(null);
    setCapturedImage("");
    setError("");
    setErrorTip("");
    setScanStep(0);
    setPhase("intro");
  }, []);

  // ── 공유 ──
  const handleShare = async () => {
    if (!result) return;
    const shareUrl = `https://suile-21173.web.app/fs?score=${encodeURIComponent(result.overallScore)}&age=${encodeURIComponent(result.estimatedAge)}&celeb=${encodeURIComponent(result.celebrity.name)}`;
    const text = `${t.shareText(result.overallScore, result.estimatedAge, result.celebrity.name)}\n${shareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t.shareTitle(result.overallScore, result.estimatedAge),
          text: t.shareText(result.overallScore, result.estimatedAge, result.celebrity.name),
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(text);
        alert(t.shareCopied);
      }
    } catch { /* cancelled */ }
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-black text-center">{t.title}</h1>
      <p className="text-sm text-zinc-500 text-center">{t.subtitle}</p>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-center space-y-2">
          <p className="text-sm font-bold text-amber-800">{error}</p>
          {errorTip && <p className="text-xs text-amber-600">{errorTip}</p>}
          <button
            onClick={() => { setError(""); setErrorTip(""); startCamera(); }}
            className="mt-2 px-5 py-2 bg-amber-500 text-white rounded-full text-xs font-bold hover:bg-amber-600 transition-colors"
          >
            {t.retryCapture}
          </button>
        </div>
      )}

      {/* ── 인트로 ── */}
      {phase === "intro" && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center">
            <Camera className="h-16 w-16 text-violet-500" />
          </div>

          {dailyLimited ? (
            <div className="text-center space-y-3">
              <div className="inline-block px-4 py-2 bg-zinc-100 rounded-full">
                <p className="text-sm font-bold text-zinc-700">{t.dailyUsed}</p>
              </div>
              <p className="text-xs text-zinc-500">
                {t.dailyLimit}<br />
                {t.dailyTomorrow}
              </p>
              <div className="flex items-center gap-2 justify-center text-xs text-zinc-400 mt-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t.dailyReset}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm text-zinc-600">{t.introGuide}</p>
                <p className="text-xs text-zinc-400">{t.introHint}</p>
              </div>
              <button
                onClick={startCamera}
                className="px-8 py-3 bg-zinc-900 text-white rounded-full text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                {t.openCamera}
              </button>
              <p className="text-xs text-zinc-400 text-center">{t.freeOnce}</p>
            </>
          )}

          <p className="text-[10px] text-zinc-400 text-center max-w-xs">
            {t.disclaimer}
          </p>
        </div>
      )}

      {/* ── 카메라 ── */}
      {phase === "camera" && (
        <div className="relative">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[70%] h-[85%] border-2 border-white/30 rounded-[50%]" />
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <p className="text-white/70 text-xs">{t.cameraGuide}</p>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex justify-center mt-4">
            <button
              onClick={capture}
              className="w-16 h-16 rounded-full bg-white border-4 border-zinc-300 hover:border-violet-400 transition-colors shadow-lg flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-900 hover:bg-violet-600 transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* ── 스캔 중 ── */}
      {phase === "scanning" && capturedImage && (
        <div className="relative">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capturedImage} alt="" className="w-full h-full object-cover" />

            <div className="absolute inset-0">
              {scanStep >= 1 && scanStep < 10 && (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  style={{ animation: "scanline 1.5s ease-in-out infinite" }}
                />
              )}

              {scanStep >= 2 && (
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                  {WIREFRAME_LINES.map(([a, b], i) => (
                    <line
                      key={`line-${i}`}
                      x1={LANDMARKS[a].x} y1={LANDMARKS[a].y}
                      x2={LANDMARKS[b].x} y2={LANDMARKS[b].y}
                      stroke={scanStep >= 10 ? "rgba(52,211,153,0.15)" : "rgba(52,211,153,0.4)"}
                      strokeWidth="0.3"
                      style={{ animation: `fadeIn 0.3s ease ${i * 0.06}s both` }}
                    />
                  ))}
                  {LANDMARKS.map((lm, i) => (
                    <circle
                      key={`pt-${i}`}
                      cx={lm.x} cy={lm.y}
                      r={scanStep >= 10 ? 0.5 : 1}
                      fill={scanStep >= 10 ? "rgba(52,211,153,0.2)" : "#34d399"}
                      style={{ animation: `popIn 0.2s ease ${i * 0.08}s both` }}
                    />
                  ))}
                </svg>
              )}

              {scanStep >= 3 && scanStep < 10 && (
                <>
                  <div className="absolute top-[15%] bottom-[15%] left-1/2 w-px border-l border-dashed border-cyan-400/60" />
                  <div className="absolute top-[15%] bottom-[15%] left-0 right-1/2 bg-cyan-400/5" style={{ animation: "fadeIn 0.4s ease both" }} />
                  <div className="absolute top-[15%] bottom-[15%] left-1/2 right-0 bg-violet-400/5" style={{ animation: "fadeIn 0.4s ease both" }} />
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                    <line x1="35" y1="36" x2="65" y2="36" stroke="rgba(6,182,212,0.4)" strokeWidth="0.2" strokeDasharray="1 0.5" style={{ animation: "fadeIn 0.5s ease both" }} />
                    <line x1="35" y1="60" x2="65" y2="60" stroke="rgba(6,182,212,0.4)" strokeWidth="0.2" strokeDasharray="1 0.5" style={{ animation: "fadeIn 0.5s ease 0.2s both" }} />
                  </svg>
                </>
              )}

              {scanStep >= 4 && (
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                  {BOUNDING_BOXES.map((box, i) => {
                    const isActive = scanStep === box.step;
                    const isPast = scanStep > box.step;
                    const isVisible = scanStep >= box.step;
                    if (!isVisible) return null;
                    return (
                      <g key={`box-${i}`} style={{ animation: `fadeIn 0.3s ease both` }}>
                        {isActive && (
                          <rect
                            x={box.x} y={box.y} width={box.w} height={box.h}
                            fill="rgba(99,102,241,0.08)" rx="1"
                            style={{ animation: "pulse 1s ease-in-out infinite" }}
                          />
                        )}
                        <rect
                          x={box.x} y={box.y} width={box.w} height={box.h}
                          fill="none"
                          stroke={isActive ? "rgba(99,102,241,0.8)" : isPast ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.5)"}
                          strokeWidth={isActive ? "0.6" : "0.3"} rx="1"
                        />
                        <text
                          x={box.x + box.w + 1.5} y={box.y + 4}
                          fill={isActive ? "rgba(99,102,241,1)" : "rgba(99,102,241,0.3)"}
                          fontSize={isActive ? "3.5" : "2.5"} fontWeight="bold"
                        >
                          {box.label}
                        </text>
                        {isActive && (
                          <>
                            <line x1={box.x} y1={box.y} x2={box.x + 3} y2={box.y} stroke="#6366f1" strokeWidth="0.6" />
                            <line x1={box.x} y1={box.y} x2={box.x} y2={box.y + 3} stroke="#6366f1" strokeWidth="0.6" />
                            <line x1={box.x + box.w} y1={box.y} x2={box.x + box.w - 3} y2={box.y} stroke="#6366f1" strokeWidth="0.6" />
                            <line x1={box.x + box.w} y1={box.y} x2={box.x + box.w} y2={box.y + 3} stroke="#6366f1" strokeWidth="0.6" />
                            <line x1={box.x} y1={box.y + box.h} x2={box.x + 3} y2={box.y + box.h} stroke="#6366f1" strokeWidth="0.6" />
                            <line x1={box.x} y1={box.y + box.h} x2={box.x} y2={box.y + box.h - 3} stroke="#6366f1" strokeWidth="0.6" />
                            <line x1={box.x + box.w} y1={box.y + box.h} x2={box.x + box.w - 3} y2={box.y + box.h} stroke="#6366f1" strokeWidth="0.6" />
                            <line x1={box.x + box.w} y1={box.y + box.h} x2={box.x + box.w} y2={box.y + box.h - 3} stroke="#6366f1" strokeWidth="0.6" />
                          </>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}

              {scanStep === 9 && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" style={{ animation: "pulse 1.2s ease-in-out infinite" }} />
              )}
            </div>
          </div>

          <div className="mt-4 text-center space-y-2">
            {scanStep < 10 ? (
              <>
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                  <span className="text-sm font-bold text-zinc-700">
                    {t.scanMessages[scanStep] || t.preparing}
                  </span>
                </div>
                <div className="mx-auto max-w-[200px] h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(scanStep / 10) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">{t.stepOf(Math.min(scanStep, 10))}</p>
              </>
            ) : (
              <div className="space-y-3 py-1">
                <div className="flex items-center justify-center gap-2">
                  <div className="relative h-5 w-5">
                    <div className="absolute inset-0 rounded-full border-2 border-violet-200" />
                    <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                  </div>
                  <span className="text-sm font-bold text-violet-600">
                    {t.waitMessages[waitingMsg]}
                  </span>
                </div>
                <div className="mx-auto max-w-[200px] h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ animation: "progressPulse 1.5s ease-in-out infinite" }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400">{t.scanDone}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 결과 ── */}
      {phase === "result" && result && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <div className="relative aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capturedImage} alt="" className="w-full h-full object-cover" />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
              {WIREFRAME_LINES.map(([a, b], i) => (
                <line
                  key={i}
                  x1={LANDMARKS[a].x} y1={LANDMARKS[a].y}
                  x2={LANDMARKS[b].x} y2={LANDMARKS[b].y}
                  stroke="rgba(52,211,153,0.15)" strokeWidth="0.25"
                />
              ))}
              {LANDMARKS.map((lm, i) => (
                <circle key={i} cx={lm.x} cy={lm.y} r={0.5} fill="rgba(52,211,153,0.25)" />
              ))}
            </svg>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-16 pb-4 px-4 text-center">
              <div className="text-5xl font-black text-white drop-shadow-lg">{result.overallScore}</div>
              <div className="text-sm text-white/60 mt-0.5">/ 100</div>
              <div className="mt-1 inline-block px-3 py-1 bg-white/20 backdrop-blur rounded-full">
                <span className="text-white font-bold text-sm">&quot;{result.nickname}&quot;</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x border-b">
            <div className="py-3 text-center">
              <div className="text-2xl font-black text-zinc-800">
                {result.estimatedAge}{t.ageSuffix}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">{t.estimatedAge}</div>
            </div>
            <div className="py-3 text-center">
              <div className="text-lg font-black text-violet-600">{result.celebrity.name}</div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                {t.celebrityMatch(result.celebrity.similarity)}
              </div>
            </div>
          </div>

          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-zinc-500 tracking-wider">{t.partAnalysis}</p>
              <span className="text-[8px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{t.analysisBasis}</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700">{t.symmetry}</span>
                <span className={`text-xs font-black ${scoreTextColor(result.symmetryScore)}`}>
                  {result.symmetryScore}
                </span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${scoreColor(result.symmetryScore)} rounded-full transition-all duration-700`}
                  style={{ width: `${result.symmetryScore}%` }}
                />
              </div>
            </div>

            {Object.entries(result.categories).map(([key, cat]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700">
                    {t.catLabels[key] || key}
                  </span>
                  <span className={`text-xs font-black ${scoreTextColor(cat.score)}`}>
                    {cat.score}
                  </span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${scoreColor(cat.score)} rounded-full transition-all duration-700`}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 pl-0.5">{cat.comment}</p>
              </div>
            ))}
          </div>

          <div className="mx-4 mb-3 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold text-violet-600 mb-0.5">{t.oneLiner}</p>
            <p className="text-[11px] text-violet-800 leading-relaxed">{result.oneLiner}</p>
          </div>

          {result.tips.length > 0 && (
            <div className="mx-4 mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <p className="text-[10px] font-bold text-blue-600 mb-1">{t.styleTip}</p>
              {result.tips.map((tip, i) => (
                <p key={i} className="text-[10px] text-blue-800 leading-relaxed flex gap-1">
                  <span className="shrink-0">💡</span>
                  {tip}
                </p>
              ))}
            </div>
          )}

          <div className="px-4 pt-1 pb-1">
            <p className="text-[8px] text-zinc-400 text-center leading-relaxed">
              {t.disclaimerResult}
            </p>
          </div>

          <div className="px-3 pb-3 flex gap-2">
            <button
              onClick={reset}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border text-sm font-medium hover:bg-zinc-50 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              {t.retake}
            </button>
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              {t.share}
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scanline {
          0% { top: 5%; opacity: 1; }
          50% { top: 90%; opacity: 0.6; }
          100% { top: 5%; opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          0% { r: 0; opacity: 0; }
          50% { r: 1.8; opacity: 1; }
          100% { r: 1; opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes progressPulse {
          0% { width: 100%; opacity: 1; }
          50% { width: 85%; opacity: 0.6; }
          100% { width: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
