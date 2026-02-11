"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Heart, RotateCcw, Share2, Activity, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

// ── 타입 ──
type Phase = "intro" | "measuring" | "analyzing" | "result";

interface HeartRateResult {
  bpm: number;
  status: "bradycardia" | "normal" | "tachycardia";
  statusLabel: string;
  confidence: string;
  waveform: number[];
  aiComment: string;
}

const MEASURE_DURATION = 20;

function getStatus(bpm: number): "bradycardia" | "normal" | "tachycardia" {
  if (bpm < 60) return "bradycardia";
  if (bpm > 100) return "tachycardia";
  return "normal";
}

// ══════════════════════════════════════════════
// 로컬라이즈 텍스트
// ══════════════════════════════════════════════
const L = {
  ko: {
    title: "심박수 측정기",
    subtitle: "카메라에 손가락을 대면 심박수를 측정합니다",
    errCamera: "카메라 접근이 거부되었습니다. 브라우저 설정에서 카메라를 허용해주세요.",
    errHint: "밝은 환경에서 손가락을 카메라에 꽉 대고 시도해주세요.",
    errMeasure: "심박수를 정확히 측정하지 못했습니다. 손가락을 카메라에 꽉 대고 다시 시도해주세요.",
    retry: "다시 시도하기",
    howTo: "사용 방법",
    step1: "1. 후면 카메라 렌즈에 검지 손가락을 올려주세요",
    step2: "2. 플래시가 켜지면 손가락을 움직이지 마세요",
    step3: (s: number) => `3. ${s}초간 측정 후 결과가 나옵니다`,
    start: "측정 시작",
    disclaimer: "본 측정은 의료 목적이 아니며 참고용입니다. 정확한 진단은 전문 의료기기를 이용해주세요.",
    signalPlace: "카메라에 손가락을 올려주세요...",
    signalPress: "손가락을 카메라 렌즈에 꽉 대세요",
    signalDetecting: "신호 감지 중... 손가락을 움직이지 마세요",
    signalMeasuring: "측정 중...",
    cancelMeasure: "측정 취소",
    analyzing: "분석 중...",
    analyzingHint: "심박 데이터를 분석하고 있습니다",
    waveformLabel: "측정된 심박 파형",
    statusLabel: "측정 상태",
    confidenceLabel: "신뢰도",
    durationLabel: "측정 시간",
    sec: "초",
    rangeLabel: "심박수 범위",
    aiHealth: "AI 건강 분석",
    disclaimerResult: "본 측정은 스마트폰 카메라를 이용한 광전용적맥파(PPG) 방식으로, 의료기기 수준의 정확도를 보장하지 않습니다. 건강에 이상이 느껴지시면 전문 의료기관을 방문하세요.",
    reMeasure: "다시 측정",
    share: "공유하기",
    shareCopied: "결과가 복사되었습니다!",
    shareTitle: (bpm: number) => `심박수: ${bpm} BPM`,
    shareText: (bpm: number, label: string) => `심박수 측정 결과: ${bpm} BPM (${label})`,
    statusConfig: {
      bradycardia: { label: "서맥", desc: "60 미만" },
      normal: { label: "정상", desc: "60~100" },
      tachycardia: { label: "빈맥", desc: "100 초과" },
    },
    confHigh: "높음",
    confMedium: "보통",
    confLow: "낮음",
    comment: (bpm: number) => {
      if (bpm < 50) return `심박수 ${bpm}bpm은 상당히 낮은 편입니다. 운동선수처럼 심폐기능이 뛰어난 경우일 수 있지만, 어지럼증이나 피로감이 있다면 전문의 상담을 권합니다.`;
      if (bpm < 60) return `심박수 ${bpm}bpm은 약간 낮은 편(서맥)입니다. 규칙적으로 운동하는 분이라면 정상 범위일 수 있습니다. 안정 시 지속적으로 낮다면 검진을 고려해보세요.`;
      if (bpm < 70) return `심박수 ${bpm}bpm은 매우 건강한 수준입니다! 심폐기능이 양호하다는 신호입니다. 규칙적인 운동과 수면 습관이 잘 유지되고 있는 것 같습니다.`;
      if (bpm < 80) return `심박수 ${bpm}bpm은 정상 범위의 중간입니다. 전반적으로 양호한 상태입니다. 꾸준한 유산소 운동으로 심박수를 더 낮출 수 있습니다.`;
      if (bpm < 90) return `심박수 ${bpm}bpm은 정상 범위이지만 약간 높은 편입니다. 카페인 섭취나 스트레스가 영향을 줄 수 있습니다. 심호흡과 규칙적 운동을 추천합니다.`;
      if (bpm <= 100) return `심박수 ${bpm}bpm은 정상 범위의 상단입니다. 측정 직전 활동, 카페인, 긴장 등이 영향을 줄 수 있습니다. 안정 상태에서 재측정해보세요.`;
      if (bpm <= 110) return `심박수 ${bpm}bpm은 약간 빠른 편(빈맥)입니다. 운동 직후거나 긴장한 상태일 수 있습니다. 안정을 취한 후 다시 측정해보세요.`;
      return `심박수 ${bpm}bpm은 빠른 편입니다. 운동 직후가 아니라면, 충분한 휴식과 수분 섭취를 권합니다. 지속적으로 높다면 전문의 상담을 고려해보세요.`;
    },
  },
  en: {
    title: "Heart Rate Monitor",
    subtitle: "Place your finger on the camera to measure heart rate",
    errCamera: "Camera access denied. Please allow camera in browser settings.",
    errHint: "Try pressing your finger firmly on the camera in good lighting.",
    errMeasure: "Could not measure heart rate accurately. Press your finger firmly on the camera and try again.",
    retry: "Retry",
    howTo: "How to Use",
    step1: "1. Place your index finger on the rear camera lens",
    step2: "2. Keep your finger still when the flash turns on",
    step3: (s: number) => `3. Results appear after ${s} seconds`,
    start: "Start Measurement",
    disclaimer: "This is not a medical device. For accurate diagnosis, please use professional medical equipment.",
    signalPlace: "Place your finger on the camera...",
    signalPress: "Press your finger firmly on the lens",
    signalDetecting: "Detecting signal... keep your finger still",
    signalMeasuring: "Measuring...",
    cancelMeasure: "Cancel",
    analyzing: "Analyzing...",
    analyzingHint: "Analyzing heart rate data",
    waveformLabel: "Measured Heart Waveform",
    statusLabel: "Status",
    confidenceLabel: "Confidence",
    durationLabel: "Duration",
    sec: "s",
    rangeLabel: "Heart Rate Range",
    aiHealth: "AI Health Analysis",
    disclaimerResult: "This measurement uses photoplethysmography (PPG) via smartphone camera and does not guarantee medical-grade accuracy. Please visit a healthcare professional if you have concerns.",
    reMeasure: "Measure Again",
    share: "Share",
    shareCopied: "Result copied!",
    shareTitle: (bpm: number) => `Heart Rate: ${bpm} BPM`,
    shareText: (bpm: number, label: string) => `Heart Rate Result: ${bpm} BPM (${label})`,
    statusConfig: {
      bradycardia: { label: "Bradycardia", desc: "Below 60" },
      normal: { label: "Normal", desc: "60–100" },
      tachycardia: { label: "Tachycardia", desc: "Above 100" },
    },
    confHigh: "High",
    confMedium: "Medium",
    confLow: "Low",
    comment: (bpm: number) => {
      if (bpm < 50) return `A heart rate of ${bpm} BPM is quite low. This could indicate excellent cardiovascular fitness (like an athlete), but if you experience dizziness or fatigue, consult a doctor.`;
      if (bpm < 60) return `A heart rate of ${bpm} BPM is slightly low (bradycardia). If you exercise regularly, this may be normal. Consider a checkup if it's consistently low at rest.`;
      if (bpm < 70) return `A heart rate of ${bpm} BPM is very healthy! This indicates good cardiovascular fitness. Your exercise and sleep habits seem well-maintained.`;
      if (bpm < 80) return `A heart rate of ${bpm} BPM is in the normal mid-range. Overall healthy. Regular cardio exercise can help lower it further.`;
      if (bpm < 90) return `A heart rate of ${bpm} BPM is normal but slightly elevated. Caffeine or stress may be a factor. Deep breathing and regular exercise are recommended.`;
      if (bpm <= 100) return `A heart rate of ${bpm} BPM is at the upper end of normal. Recent activity, caffeine, or nervousness may have an effect. Try measuring again at rest.`;
      if (bpm <= 110) return `A heart rate of ${bpm} BPM is slightly fast (tachycardia). This could be from recent exercise or stress. Rest and measure again.`;
      return `A heart rate of ${bpm} BPM is elevated. If not from recent exercise, rest and hydrate. Consult a doctor if consistently high.`;
    },
  },
} as const;

const STATUS_COLORS = {
  bradycardia: { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  normal: { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  tachycardia: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
};

// ── 파형 그래프 컴포넌트 ──
function WaveformGraph({ data, color = "#10b981", height = 120 }: { data: number[]; color?: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += h / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h * 0.8) - h * 0.1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + "30");
    grad.addColorStop(1, color + "05");
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }, [data, color, height]);

  return <canvas ref={canvasRef} width={600} height={height} className="w-full" style={{ height }} />;
}

// ── 실시간 파형 (측정 중) ──
function LiveWaveform({ data, signalQuality }: { data: number[]; signalQuality: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(16,185,129,0.1)";
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    if (data.length < 2) return;

    const slice = data.slice(-150);
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    const range = max - min || 1;

    ctx.strokeStyle = signalQuality > 0.5 ? "#10b981" : "#f59e0b";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = signalQuality > 0.5 ? "#10b981" : "#f59e0b";
    ctx.shadowBlur = 6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    slice.forEach((v, i) => {
      const x = (i / (slice.length - 1)) * w;
      const y = h - ((v - min) / range) * (h * 0.7) - h * 0.15;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [data, signalQuality]);

  return (
    <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700">
      <canvas ref={canvasRef} width={600} height={160} className="w-full" style={{ height: 160 }} />
    </div>
  );
}

// ══════════════════════════════════════════════
// 메인 컴포넌트
// ══════════════════════════════════════════════
export default function HeartRateClient() {
  const { locale } = useI18n();
  const t = locale === "ko" ? L.ko : L.en;

  const [phase, setPhase] = useState<Phase>("intro");
  const [bpm, setBpm] = useState(0);
  const [countdown, setCountdown] = useState(MEASURE_DURATION);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [signalQuality, setSignalQuality] = useState(0);
  const [signalMessage, setSignalMessage] = useState<string>(t.signalPlace);
  const [result, setResult] = useState<HeartRateResult | null>(null);
  const [error, setError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const bufferRef = useRef<{ time: number; red: number }[]>([]);
  const measuringRef = useRef(false);
  const startTimeRef = useRef(0);

  const stopCamera = useCallback(() => {
    measuringRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  const movingAverage = (arr: number[], window: number) => {
    if (arr.length < window) return arr;
    const result: number[] = [];
    for (let i = 0; i < arr.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(arr.length, i + Math.ceil(window / 2));
      const sum = arr.slice(start, end).reduce((a, b) => a + b, 0);
      result.push(sum / (end - start));
    }
    return result;
  };

  const detectPeaks = (data: number[]) => {
    const peaks: number[] = [];
    for (let i = 2; i < data.length - 2; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i - 2] && data[i] > data[i + 1] && data[i] > data[i + 2]) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > 8) {
          peaks.push(i);
        }
      }
    }
    return peaks;
  };

  const calculateBPM = useCallback(() => {
    const buffer = bufferRef.current;
    if (buffer.length < 60) return 0;

    const recent = buffer.slice(-Math.min(buffer.length, 300));
    const redValues = recent.map((b) => b.red);
    const smoothed = movingAverage(redValues, 5);
    const peaks = detectPeaks(smoothed);
    if (peaks.length < 3) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const timeDiff = recent[peaks[i]].time - recent[peaks[i - 1]].time;
      if (timeDiff > 300 && timeDiff < 2000) intervals.push(timeDiff);
    }
    if (intervals.length < 2) return 0;

    intervals.sort((a, b) => a - b);
    const q1 = intervals[Math.floor(intervals.length * 0.25)];
    const q3 = intervals[Math.floor(intervals.length * 0.75)];
    const iqr = q3 - q1;
    const filtered = intervals.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
    if (filtered.length === 0) return 0;

    const avgInterval = filtered.reduce((a, b) => a + b, 0) / filtered.length;
    return Math.round(60000 / avgInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const evaluateSignal = useCallback(() => {
    const buffer = bufferRef.current;
    if (buffer.length < 30) return 0;
    const recent = buffer.slice(-60);
    const reds = recent.map((b) => b.red);
    const avg = reds.reduce((a, b) => a + b, 0) / reds.length;
    const variance = reds.reduce((a, b) => a + (b - avg) ** 2, 0) / reds.length;
    const std = Math.sqrt(variance);
    if (avg < 80) return 0;
    if (std < 0.3) return 0.1;
    if (std > 30) return 0.3;
    return Math.min(1, std / 5);
  }, []);

  // ── 측정 완료 처리 ──
  const finishMeasurement = useCallback(() => {
    setPhase("analyzing");
    const finalBpm = calculateBPM();
    const buffer = bufferRef.current;
    const redValues = buffer.map((b) => b.red);
    const smoothed = movingAverage(redValues, 5);
    stopCamera();

    setTimeout(() => {
      if (finalBpm < 30 || finalBpm > 200) {
        setError(t.errMeasure);
        setPhase("intro");
        return;
      }

      const status = getStatus(finalBpm);
      setResult({
        bpm: finalBpm,
        status,
        statusLabel: t.statusConfig[status].label,
        confidence: buffer.length > 200 ? t.confHigh : buffer.length > 100 ? t.confMedium : t.confLow,
        waveform: smoothed.slice(-200),
        aiComment: t.comment(finalBpm),
      });
      setPhase("result");
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculateBPM, stopCamera, t]);

  // ── 측정 시작 ──
  const startMeasuring = useCallback(async () => {
    setError("");
    setPhase("measuring");
    setBpm(0);
    setWaveform([]);
    setCountdown(MEASURE_DURATION);
    setSignalQuality(0);
    setSignalMessage(t.signalPlace);
    bufferRef.current = [];
    measuringRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 320 }, height: { ideal: 240 } },
      });
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({
          // @ts-expect-error torch is not in the standard type
          advanced: [{ torch: true }],
        });
      } catch {
        console.log("Torch not available");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      startTimeRef.current = Date.now();
      let lastBpmUpdate = 0;

      const countdownInterval = setInterval(() => {
        if (!measuringRef.current) { clearInterval(countdownInterval); return; }
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const remaining = MEASURE_DURATION - elapsed;
        setCountdown(Math.max(0, remaining));
        if (remaining <= 0) clearInterval(countdownInterval);
      }, 500);

      const analyze = () => {
        if (!measuringRef.current || !videoRef.current || !ctx) return;

        const video = videoRef.current;
        const w = 64;
        const h = 48;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);

        const frame = ctx.getImageData(0, 0, w, h).data;
        let redSum = 0;
        let greenSum = 0;
        const pixelCount = frame.length / 4;
        for (let i = 0; i < frame.length; i += 4) {
          redSum += frame[i];
          greenSum += frame[i + 1];
        }
        const redAvg = redSum / pixelCount;
        const greenAvg = greenSum / pixelCount;
        const rgRatio = redAvg / (greenAvg || 1);

        const now = Date.now();
        bufferRef.current.push({ time: now, red: redAvg });

        setWaveform((prev) => {
          const next = [...prev, redAvg];
          return next.length > 300 ? next.slice(-300) : next;
        });

        const quality = evaluateSignal();
        setSignalQuality(quality);

        if (rgRatio < 1.2 || redAvg < 80) {
          setSignalMessage(t.signalPress);
        } else if (quality < 0.3) {
          setSignalMessage(t.signalDetecting);
        } else {
          setSignalMessage(t.signalMeasuring);
        }

        if (now - lastBpmUpdate > 500 && bufferRef.current.length > 60) {
          lastBpmUpdate = now;
          const currentBpm = calculateBPM();
          if (currentBpm > 30 && currentBpm < 200) setBpm(currentBpm);
        }

        const elapsed = (now - startTimeRef.current) / 1000;
        if (elapsed >= MEASURE_DURATION) {
          measuringRef.current = false;
          clearInterval(countdownInterval);
          finishMeasurement();
          return;
        }

        rafRef.current = requestAnimationFrame(analyze);
      };

      rafRef.current = requestAnimationFrame(analyze);
    } catch {
      setError(t.errCamera);
      setPhase("intro");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const reset = useCallback(() => {
    stopCamera();
    setPhase("intro");
    setBpm(0);
    setWaveform([]);
    setResult(null);
    setError("");
    setCountdown(MEASURE_DURATION);
    bufferRef.current = [];
  }, [stopCamera]);

  const handleShare = useCallback(async () => {
    if (!result) return;
    const shareUrl = `https://suile-21173.web.app/hr?bpm=${result.bpm}&status=${result.status}`;
    const text = `${t.shareText(result.bpm, result.statusLabel)}\n${shareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t.shareTitle(result.bpm),
          text: t.shareText(result.bpm, result.statusLabel),
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(text);
        alert(t.shareCopied);
      }
    } catch { /* cancelled */ }
  }, [result, t]);

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
          <p className="text-xs text-amber-600">{t.errHint}</p>
          <button
            onClick={() => { setError(""); startMeasuring(); }}
            className="mt-2 px-5 py-2 bg-amber-500 text-white rounded-full text-xs font-bold hover:bg-amber-600 transition-colors"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* ── 인트로 ── */}
      {phase === "intro" && !error && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
            <Heart className="h-16 w-16 text-red-500" style={{ animation: "heartbeat 1.2s ease-in-out infinite" }} />
          </div>
          <div className="text-center space-y-3">
            <p className="text-sm text-zinc-600 font-medium">{t.howTo}</p>
            <div className="space-y-2 text-xs text-zinc-500">
              <p>{t.step1}</p>
              <p>{t.step2}</p>
              <p>{t.step3(MEASURE_DURATION)}</p>
            </div>
          </div>
          <button
            onClick={startMeasuring}
            className="px-8 py-3 bg-red-500 text-white rounded-full text-sm font-bold hover:bg-red-600 transition-colors flex items-center gap-2 shadow-lg shadow-red-200"
          >
            <Activity className="h-4 w-4" />
            {t.start}
          </button>
          <p className="text-[10px] text-zinc-400 text-center max-w-xs">{t.disclaimer}</p>
        </div>
      )}

      {/* ── 측정 중 ── */}
      {phase === "measuring" && (
        <div className="space-y-4">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />

          <div className="text-center py-4">
            <div className="inline-flex items-center gap-3">
              <Heart
                className={`h-8 w-8 text-red-500 ${bpm > 0 ? "" : "opacity-30"}`}
                style={bpm > 0 ? { animation: `heartbeat ${60 / bpm}s ease-in-out infinite` } : {}}
              />
              <span className={`text-6xl font-black tabular-nums ${bpm > 0 ? "text-zinc-900" : "text-zinc-300"}`}>
                {bpm > 0 ? bpm : "--"}
              </span>
              <span className="text-lg text-zinc-400 font-bold self-end mb-2">BPM</span>
            </div>
          </div>

          <LiveWaveform data={waveform} signalQuality={signalQuality} />

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className={`w-2 h-2 rounded-full ${signalQuality > 0.5 ? "bg-emerald-500" : signalQuality > 0.2 ? "bg-amber-500" : "bg-red-400"}`}
                style={{ animation: "pulse 1s ease-in-out infinite" }} />
              <span className="text-sm text-zinc-600">{signalMessage}</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="w-40 h-2 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-500"
                  style={{ width: `${((MEASURE_DURATION - countdown) / MEASURE_DURATION) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-zinc-500 tabular-nums w-8">{countdown}{t.sec}</span>
            </div>
          </div>

          <div className="text-center">
            <button onClick={reset} className="text-xs text-zinc-400 hover:text-zinc-600 underline">
              {t.cancelMeasure}
            </button>
          </div>
        </div>
      )}

      {/* ── 분석 중 ── */}
      {phase === "analyzing" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-red-100 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
            </div>
          </div>
          <p className="text-sm font-bold text-zinc-700">{t.analyzing}</p>
          <p className="text-xs text-zinc-400">{t.analyzingHint}</p>
        </div>
      )}

      {/* ── 결과 ── */}
      {phase === "result" && result && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-red-50 to-pink-50 px-6 py-8 text-center">
              <Heart className="h-8 w-8 text-red-500 mx-auto mb-3" style={{ animation: `heartbeat ${60 / result.bpm}s ease-in-out infinite` }} />
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-7xl font-black text-zinc-900 tabular-nums">{result.bpm}</span>
                <span className="text-2xl font-bold text-zinc-400">BPM</span>
              </div>
              <div className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-bold ${STATUS_COLORS[result.status].bg} ${STATUS_COLORS[result.status].color} ${STATUS_COLORS[result.status].border} border`}>
                {result.statusLabel} ({t.statusConfig[result.status].desc} BPM)
              </div>
            </div>

            <div className="px-4 py-3 border-t">
              <p className="text-[10px] text-zinc-400 mb-1 font-bold">{t.waveformLabel}</p>
              <WaveformGraph data={result.waveform} color={
                result.status === "normal" ? "#10b981" : result.status === "bradycardia" ? "#3b82f6" : "#ef4444"
              } />
            </div>

            <div className="px-5 py-4 border-t space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">{t.statusLabel}</span>
                <span className={`font-bold ${STATUS_COLORS[result.status].color}`}>{result.statusLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">{t.confidenceLabel}</span>
                <span className="font-bold text-zinc-700">{result.confidence}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">{t.durationLabel}</span>
                <span className="font-bold text-zinc-700">{MEASURE_DURATION}{t.sec}</span>
              </div>
            </div>

            <div className="px-5 py-4 border-t">
              <p className="text-xs font-bold text-zinc-500 mb-2">{t.rangeLabel}</p>
              <div className="relative h-3 rounded-full overflow-hidden flex">
                <div className="flex-1 bg-blue-200" />
                <div className="flex-[2] bg-emerald-200" />
                <div className="flex-1 bg-red-200" />
              </div>
              <div className="relative mt-1" style={{ paddingLeft: `${Math.min(95, Math.max(5, ((result.bpm - 40) / 120) * 100))}%` }}>
                <div className="w-0.5 h-4 bg-zinc-800 -ml-px" />
                <span className="text-[10px] font-bold text-zinc-700 -ml-3">{result.bpm}</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                <span>40</span>
                <span>60</span>
                <span>100</span>
                <span>160</span>
              </div>
            </div>

            <div className="px-5 py-4 border-t bg-zinc-50">
              <p className="text-xs font-bold text-zinc-500 mb-2">{t.aiHealth}</p>
              <p className="text-sm text-zinc-700 leading-relaxed">{result.aiComment}</p>
            </div>
          </div>

          <p className="text-[10px] text-zinc-400 text-center px-4">{t.disclaimerResult}</p>

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 py-3 border rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t.reMeasure}
            </button>
            <button
              onClick={handleShare}
              className="flex-1 py-3 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              {t.share}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.15); }
          30% { transform: scale(1); }
          45% { transform: scale(1.1); }
          60% { transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
