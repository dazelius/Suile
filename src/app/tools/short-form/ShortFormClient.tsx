"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Play, Scissors, Download, RotateCcw,
  Loader2, Check, Sparkles, Settings2,
  Music, MessageSquareText, Volume2, VolumeX, Stamp, Move,
  Clapperboard, LogOut,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { CaptionEntry } from "./lib/types";
import { uploadToYouTube, type PrivacyStatus } from "./lib/youtube-upload";

/* ═══════════════════════════════════════════════
   Google Identity Services Types
   ═══════════════════════════════════════════════ */

interface GisTokenResponse {
  access_token?: string;
  error?: string;
}

interface GisTokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GisTokenResponse) => void;
          }) => GisTokenClient;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = "860732393806-ppvqgivj0s0tjesj9ed1aianc6rjh3sh.apps.googleusercontent.com";
const YT_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

/* ═══════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════ */

const CAPTION_API =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/transcribeWithTimestamps";

const BGM_LIST = [
  { id: "none", labelKo: "없음", labelEn: "None" },
  { id: "Music1", labelKo: "Music 1", labelEn: "Music 1" },
  { id: "Music2", labelKo: "Music 2", labelEn: "Music 2" },
] as const;

type BgmId = (typeof BGM_LIST)[number]["id"];

/* ═══════════════════════════════════════════════
   i18n
   ═══════════════════════════════════════════════ */

const L = {
  ko: {
    title: "숏폼 편집기",
    desc: "영상을 올리면 AI가 자막과 음악을 입혀 숏폼으로 만들어드립니다",
    upload: "영상을 드래그하거나 클릭하여 업로드",
    uploadSub: "MP4, MOV, WebM · 최대 500MB",
    fileTooBig: "파일이 500MB를 초과합니다",
    preview: "미리보기",
    auto916: "9:16 자동 크롭",
    trimInfo: (d: string) => `처음 ${d}초가 사용됩니다`,
    trimFull: (d: string) => `전체 ${d}초`,
    dragCrop: "드래그하여 위치 조정",
    makeShort: "숏폼 만들기",
    loadingFF: "영상 엔진 다운로드 중... (첫 실행 시 30초 소요)",
    encoding: "영상 생성 중...",
    done: "완료!",
    download: "다운로드",
    again: "다른 영상으로",
    size: (mb: string) => `${mb} MB`,
    settings: "설정",
    resolution: "해상도",
    quality: "품질",
    high: "고화질",
    medium: "보통",
    low: "빠름",
    bgMode: "배경",
    bgBlur: "블러",
    bgBlack: "검정",
    // ─── AI 자막 ───
    aiCaption: "AI 자막",
    captionOn: "켜짐",
    captionOff: "꺼짐",
    stepFrames: "프레임 캡처 중...",
    transcribing: "AI 자막 생성 중...",
    captionDone: (n: number) => `자막 ${n}개 생성 완료`,
    captionFail: "자막 생성 실패",
    noCaptions: "자막을 생성하지 못했습니다",
    // ─── BGM ───
    bgmLabel: "배경음악",
    bgmMissing: "BGM 파일이 없습니다",
    // ─── 워터마크 ───
    watermarkLabel: "워터마크",
    watermarkPlaceholder: "suile.im",
    // ─── 인트로/아웃트로 ───
    introLabel: "오프닝 텍스트",
    introPlaceholder: "주제를 입력하세요",
    outroLabel: "엔딩 텍스트",
    outroPlaceholder: "suile.im",
    // ─── 이펙트 ───
    effects: "이펙트",
    vignette: "비네팅",
    particles: "파티클",
    letterbox: "레터박스",
    letterboxNone: "없음",
    letterboxThin: "얇게",
    letterboxThick: "두껍게",
    // ─── YouTube ───
    uploadYoutube: "YouTube Shorts 업로드",
    uploadYoutubeDesc: "파일 다운로드 후 YouTube Studio가 열립니다",
    encodingFast: "고속 영상 생성 중...",
    remuxing: "MP4 변환 중...",
    // ─── YouTube Direct Upload ───
    ytUpload: "YouTube Shorts 직접 업로드",
    ytUploading: "YouTube에 업로드 중...",
    ytDone: "업로드 완료!",
    ytWatch: "YouTube에서 보기",
    ytError: "업로드 실패",
    ytTitle: "제목",
    ytTitlePlaceholder: "Shorts 제목을 입력하세요",
    ytPrivacy: "공개 설정",
    ytPublic: "공개",
    ytUnlisted: "일부공개",
    ytPrivate: "비공개",
    ytGoogleError: "Google 로그인을 사용할 수 없습니다",
    // ─── Trim ───
    trimRange: (sel: string, total: string) => `선택: ${sel}초 / 전체: ${total}초`,
    trimDrag: "핸들을 드래그하여 구간 선택",
  },
  en: {
    title: "Short-form Editor",
    desc: "Upload a video and AI will add captions & music to make it a short",
    upload: "Drag & drop or click to upload",
    uploadSub: "MP4, MOV, WebM · Max 500MB",
    fileTooBig: "File exceeds 500MB",
    preview: "Preview",
    auto916: "Auto 9:16 crop",
    trimInfo: (d: string) => `First ${d}s will be used`,
    trimFull: (d: string) => `Full ${d}s`,
    dragCrop: "Drag to adjust position",
    makeShort: "Make Short",
    loadingFF: "Downloading video engine... (~30s on first run)",
    encoding: "Creating video...",
    done: "Done!",
    download: "Download",
    again: "Try another",
    size: (mb: string) => `${mb} MB`,
    settings: "Settings",
    resolution: "Resolution",
    quality: "Quality",
    high: "High",
    medium: "Medium",
    low: "Fast",
    bgMode: "Background",
    bgBlur: "Blur",
    bgBlack: "Black",
    // ─── AI captions ───
    aiCaption: "AI Captions",
    captionOn: "On",
    captionOff: "Off",
    stepFrames: "Capturing frames...",
    transcribing: "Generating captions...",
    captionDone: (n: number) => `${n} caption(s) generated`,
    captionFail: "Caption generation failed",
    noCaptions: "Could not generate captions",
    // ─── BGM ───
    bgmLabel: "Background Music",
    bgmMissing: "BGM file not found",
    // ─── Watermark ───
    watermarkLabel: "Watermark",
    watermarkPlaceholder: "suile.im",
    // ─── Intro/Outro ───
    introLabel: "Opening Text",
    introPlaceholder: "Enter a topic",
    outroLabel: "Ending Text",
    outroPlaceholder: "suile.im",
    // ─── Effects ───
    effects: "Effects",
    vignette: "Vignette",
    particles: "Particles",
    letterbox: "Letterbox",
    letterboxNone: "None",
    letterboxThin: "Thin",
    letterboxThick: "Thick",
    // ─── YouTube ───
    uploadYoutube: "Upload to YouTube Shorts",
    uploadYoutubeDesc: "File will download, then YouTube Studio opens",
    encodingFast: "Fast video creation...",
    remuxing: "Converting to MP4...",
    // ─── YouTube Direct Upload ───
    ytUpload: "Upload to YouTube Shorts",
    ytUploading: "Uploading to YouTube...",
    ytDone: "Upload complete!",
    ytWatch: "Watch on YouTube",
    ytError: "Upload failed",
    ytTitle: "Title",
    ytTitlePlaceholder: "Enter Shorts title",
    ytPrivacy: "Privacy",
    ytPublic: "Public",
    ytUnlisted: "Unlisted",
    ytPrivate: "Private",
    ytGoogleError: "Google sign-in not available",
    // ─── Trim ───
    trimRange: (sel: string, total: string) => `Selected: ${sel}s / Total: ${total}s`,
    trimDrag: "Drag handles to select range",
  },
} as const;

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */

function fmtSec(s: number): string {
  return s < 10 ? s.toFixed(1) : Math.round(s).toString();
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const MAX_FILE = 500 * 1024 * 1024;
const MAX_DUR = 60;

/** Convert Uint8Array to base64 */
function uint8ToBase64(u8: Uint8Array): string {
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function ShortFormClient() {
  const { locale } = useI18n();
  const t = locale === "ko" ? L.ko : L.en;

  /* ── State ── */
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Auto-calculated crop
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropW, setCropW] = useState(1);
  const [cropH, setCropH] = useState(1);

  // Simple settings
  const [bgMode, setBgMode] = useState<"blur" | "black">("black");
  const [resolution, setResolution] = useState<"1080" | "720">("1080");
  const [quality, setQuality] = useState<"high" | "medium" | "low">("medium");
  const [showSettings, setShowSettings] = useState(false);

  // Export
  const [phase, setPhase] = useState<"upload" | "preview" | "loading" | "encoding" | "done">("upload");
  const [progress, setProgress] = useState(0);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  // Keep ref in sync so GIS callback always sees latest blob
  useEffect(() => { exportBlobRef.current = exportBlob; }, [exportBlob]);
  const [error, setError] = useState("");

  // ─── AI Captions ───
  const [captionEnabled, setCaptionEnabled] = useState(false);
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [captionPhase, setCaptionPhase] = useState<"idle" | "extracting" | "transcribing" | "done" | "error">("idle");
  const [captionMsg, setCaptionMsg] = useState("");

  // ─── Intro / Outro Text ───
  const [introTitle, setIntroTitle] = useState("");
  const [outroText, setOutroText] = useState("suile.im");

  // ─── BGM ───
  const [bgmTrack, setBgmTrack] = useState<BgmId>("none");
  const [bgmData, setBgmData] = useState<Uint8Array | null>(null);
  const [bgmLoadError, setBgmLoadError] = useState(false);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmUrlRef = useRef<string>("");

  // ─── Watermark ───
  const [watermark, setWatermark] = useState("suile.im");

  // ─── Visual Effects ───
  const [vignetteOn, setVignetteOn] = useState(true);
  const [particlesOn, setParticlesOn] = useState(true);
  const [letterbox, setLetterbox] = useState<"none" | "thin" | "thick">("thin");

  // ─── YouTube Upload ───
  const [ytPhase, setYtPhase] = useState<"idle" | "auth" | "uploading" | "done" | "error">("idle");
  const [ytProgress, setYtProgress] = useState(0);
  const [ytVideoId, setYtVideoId] = useState("");
  const [ytUploadStatus, setYtUploadStatus] = useState("");
  const [ytError, setYtError] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [ytPrivacy, setYtPrivacy] = useState<PrivacyStatus>("private");
  const gisTokenClientRef = useRef<GisTokenClient | null>(null);
  const ytPendingRef = useRef(false);
  const exportBlobRef = useRef<Blob | null>(null);
  // Ref to always call the latest doYoutubeUpload (avoids stale closure in GIS callback)
  const doYoutubeUploadRef = useRef<(token: string, blob: Blob) => void>(() => {});

  // ─── Trim Range ───
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const trimDuration = trimEnd - trimStart;
  const needsRangeSelect = duration > MAX_DUR;

  /* ── Refs ── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pre-read file data (avoids NotReadableError when File reference expires)
  const fileDataRef = useRef<Uint8Array | null>(null);

  // Particle system (persistent across frames)
  const particlesRef = useRef<{ x: number; y: number; size: number; speed: number; opacity: number; drift: number }[]>([]);
  const particleInitRef = useRef(false);

  const outW = resolution === "1080" ? 1080 : 720;
  const outH = resolution === "1080" ? 1920 : 1280;
  const canvasW = 320;
  const canvasH = 569; // 9:16

  /* ── File handling ── */
  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE) { setError(t.fileTooBig); return; }
    setError("");
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setPhase("preview");
    setExportBlob(null);
    setProgress(0);
    // Reset caption/bgm state
    setCaptions([]);
    setCaptionPhase("idle");
    setCaptionMsg("");
    setBgmData(null);
    setBgmLoadError(false);
    // Read file data immediately to avoid NotReadableError later
    try {
      const buf = await file.arrayBuffer();
      fileDataRef.current = new Uint8Array(buf);
      console.log("[handleFile] Pre-read file:", fileDataRef.current.length, "bytes");
    } catch (err) {
      console.error("[handleFile] Failed to pre-read file:", err);
      fileDataRef.current = null;
    }
    // Start pre-loading FFmpeg in background (downloads ~30MB WASM)
    import("./lib/ffmpeg-worker").then(w => w.preloadFFmpeg()).catch(() => {});
  }, [t.fileTooBig]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("video/")) handleFile(f);
  }, [handleFile]);

  /* ── Video loaded → auto calculate 9:16 crop + trim range ── */
  const onMeta = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const dur = v.duration;
    setDuration(dur);
    setCurrentTime(0);

    // Trim: 60초 이하면 전체, 초과면 처음 60초
    setTrimStart(0);
    setTrimEnd(Math.min(dur, MAX_DUR));

    const vr = v.videoWidth / v.videoHeight;
    const tr = 9 / 16;
    if (vr > tr) {
      const w = tr / vr;
      setCropX((1 - w) / 2); setCropY(0); setCropW(w); setCropH(1);
    } else {
      const h = vr / tr;
      setCropX(0); setCropY((1 - h) / 2); setCropW(1); setCropH(h);
    }
  }, []);

  /* ════════════════════════════════════════════
     AUTO CAPTION GENERATION
     Uses native <video> + <canvas> for frame capture — no FFmpeg needed.
     ════════════════════════════════════════════ */
  const generateCaptions = useCallback(async () => {
    if (!videoFile || !captionEnabled) return;
    const v = videoRef.current;
    if (!v) return;

    setCaptionPhase("extracting");
    setCaptionMsg(t.stepFrames);

    try {
      // 1. Capture frames using browser-native video + canvas (fast!)
      const frameCanvas = document.createElement("canvas");
      const scale = 320 / Math.max(v.videoWidth, 1);
      frameCanvas.width = Math.round(v.videoWidth * scale);
      frameCanvas.height = Math.round(v.videoHeight * scale);
      const fCtx = frameCanvas.getContext("2d")!;

      const frameInterval = 8;
      const effectiveDur = trimEnd - trimStart;
      const maxFrames = Math.min(Math.ceil(effectiveDur / frameInterval), 8);
      const framesPayload: { time: number; data: string }[] = [];

      // Pause video for seeking
      const wasPlaying = !v.paused;
      if (wasPlaying) {
        if (playPromiseRef.current) await playPromiseRef.current.catch(() => {});
        v.pause();
        playPromiseRef.current = null;
      }
      const origTime = v.currentTime;

      // On mobile, ensure video has enough data to seek
      if (v.readyState < 2) {
        await new Promise<void>((res) => {
          const onReady = () => { v.removeEventListener("loadeddata", onReady); res(); };
          v.addEventListener("loadeddata", onReady);
          setTimeout(() => { v.removeEventListener("loadeddata", onReady); res(); }, 8000);
        });
      }

      for (let i = 0; i < maxFrames; i++) {
        const t_sec = trimStart + i * frameInterval;
        if (t_sec >= trimEnd) break;

        // Seek and wait (with timeout for mobile browsers)
        v.currentTime = t_sec;
        await new Promise<void>((res) => {
          const timeout = setTimeout(() => { v.removeEventListener("seeked", handler); res(); }, 4000);
          const handler = () => { clearTimeout(timeout); v.removeEventListener("seeked", handler); res(); };
          v.addEventListener("seeked", handler);
          // If already at position, seeked won't fire
          if (Math.abs(v.currentTime - t_sec) < 0.1 && v.readyState >= 2) {
            clearTimeout(timeout);
            v.removeEventListener("seeked", handler);
            res();
          }
        });

        // Draw to canvas and export as base64 JPEG (skip if video not ready)
        if (v.readyState >= 2) {
          fCtx.drawImage(v, 0, 0, frameCanvas.width, frameCanvas.height);
          const dataUrl = frameCanvas.toDataURL("image/jpeg", 0.5);
          const base64 = dataUrl.split(",")[1];
          framesPayload.push({ time: t_sec, data: base64 });
        }
      }

      // Restore video position
      v.currentTime = origTime;
      if (wasPlaying) {
        playPromiseRef.current = v.play().catch(() => {});
      }

      // 2. Send frames to Cloud Function
      setCaptionPhase("transcribing");
      setCaptionMsg(t.transcribing);

      const body: Record<string, unknown> = { frames: framesPayload };

      const resp = await fetch(CAPTION_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const caps: CaptionEntry[] = data.captions || [];
      const aiTitle: string = data.title || "";

      if (aiTitle) setIntroTitle(aiTitle);

      if (caps.length === 0) {
        setCaptionPhase("done");
        setCaptionMsg(t.noCaptions);
        setCaptions([]);
      } else {
        setCaptions(caps);
        setCaptionPhase("done");
        setCaptionMsg(t.captionDone(caps.length));
      }
    } catch (err) {
      console.error("Caption generation failed:", err);
      setCaptionPhase("error");
      setCaptionMsg(t.captionFail);
      setCaptions([]);
    }
  }, [videoFile, captionEnabled, trimStart, trimEnd, t]);

  // Auto-generate captions when video is loaded and captions are enabled
  useEffect(() => {
    if (phase === "preview" && captionEnabled && captionPhase === "idle" && videoFile && duration > 0) {
      generateCaptions();
    }
  }, [phase, captionEnabled, captionPhase, videoFile, duration, generateCaptions]);

  /* ════════════════════════════════════════════
     BGM LOADING
     ════════════════════════════════════════════ */
  useEffect(() => {
    if (bgmTrack === "none") {
      setBgmData(null);
      setBgmLoadError(false);
      return;
    }

    let cancelled = false;
    setBgmLoadError(false);

    (async () => {
      try {
        const resp = await fetch(`/bgm/${bgmTrack}.mp3`);
        if (!resp.ok) throw new Error("Not found");
        const buf = await resp.arrayBuffer();
        if (!cancelled) setBgmData(new Uint8Array(buf));
      } catch {
        if (!cancelled) {
          setBgmLoadError(true);
          setBgmData(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [bgmTrack]);

  // Create/destroy BGM preview audio element when bgmData changes
  useEffect(() => {
    // Cleanup previous
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current = null;
    }
    if (bgmUrlRef.current) {
      URL.revokeObjectURL(bgmUrlRef.current);
      bgmUrlRef.current = "";
    }

    if (!bgmData) return;

    const blob = new Blob([new Uint8Array(bgmData)], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    bgmUrlRef.current = url;

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.2;
    bgmAudioRef.current = audio;

    // If video is currently playing, start BGM too
    const v = videoRef.current;
    if (v && !v.paused) {
      audio.currentTime = (v.currentTime % audio.duration) || 0;
      audio.play().catch(() => {});
    }

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }, [bgmData]);

  /* ════════════════════════════════════════════
     CANVAS RENDER LOOP (with live captions)
     ════════════════════════════════════════════ */
  const drawFrame = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const cW = c.width, cH = c.height;
    const sx = cropX * v.videoWidth;
    const sy = cropY * v.videoHeight;
    const sw = cropW * v.videoWidth;
    const sh = cropH * v.videoHeight;

    if (bgMode === "blur") {
      ctx.filter = "blur(20px) brightness(0.6)";
      ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight, -20, -20, cW + 40, cH + 40);
      ctx.filter = "none";
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cW, cH);
    }

    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, cW, cH);

    // ─── Draw live caption preview ───
    if (captions.length > 0) {
      const ct = v.currentTime;
      const activeCap = captions.find(cap => ct >= cap.start && ct <= cap.end);
      if (activeCap) {
        const fontSize = Math.round(cW * 0.055); // ~18px on 320px canvas
        const yPos = Math.round(cH * 0.82);
        const padding = 6;

        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textWidth = ctx.measureText(activeCap.text).width;

        // Background box
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        const boxX = (cW - textWidth) / 2 - padding * 2;
        const boxY = yPos - fontSize / 2 - padding;
        const boxW = textWidth + padding * 4;
        const boxH = fontSize + padding * 2;
        const radius = 6;
        ctx.moveTo(boxX + radius, boxY);
        ctx.lineTo(boxX + boxW - radius, boxY);
        ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
        ctx.lineTo(boxX + boxW, boxY + boxH - radius);
        ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
        ctx.lineTo(boxX + radius, boxY + boxH);
        ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
        ctx.lineTo(boxX, boxY + radius);
        ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
        ctx.fill();

        // Text
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(activeCap.text, cW / 2, yPos);
        ctx.textAlign = "start";
      }
    }

    // ─── Vignette ───
    if (vignetteOn) {
      const grd = ctx.createRadialGradient(cW / 2, cH / 2, cW * 0.25, cW / 2, cH / 2, cH * 0.75);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(0.7, "rgba(0,0,0,0.08)");
      grd.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cW, cH);
    }

    // ─── Particles (floating upward sparkles) ───
    // Particles use normalized coords (0-1) so they scale to any canvas size
    if (particlesOn) {
      const P = particlesRef.current;
      // Init particles once (normalized 0-1 coords)
      if (!particleInitRef.current || P.length === 0) {
        P.length = 0;
        for (let i = 0; i < 25; i++) {
          P.push({
            x: Math.random(),         // 0-1 normalized
            y: Math.random(),         // 0-1 normalized
            size: 0.003 + Math.random() * 0.005, // relative to cW
            speed: 0.0005 + Math.random() * 0.0012, // relative to cH per frame
            opacity: 0.15 + Math.random() * 0.4,
            drift: (Math.random() - 0.5) * 0.001,
          });
        }
        particleInitRef.current = true;
      }
      for (const p of P) {
        p.y -= p.speed;
        p.x += p.drift + Math.sin(p.y * 12) * 0.0005;
        // Wrap around (normalized)
        if (p.y < -0.01) { p.y = 1.01; p.x = Math.random(); }
        if (p.x < -0.01) p.x = 1.01;
        if (p.x > 1.01) p.x = -0.01;
        // Convert to pixel coords
        const px = p.x * cW;
        const py = p.y * cH;
        const ps = p.size * cW;
        // Draw glowing dot
        ctx.beginPath();
        ctx.arc(px, py, ps, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.opacity.toFixed(2)})`;
        ctx.fill();
        // Soft glow
        ctx.beginPath();
        ctx.arc(px, py, ps * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(p.opacity * 0.15).toFixed(3)})`;
        ctx.fill();
      }
    }

    // ─── Letterbox ───
    const lbRatio = letterbox === "thick" ? 0.08 : letterbox === "thin" ? 0.035 : 0;
    if (lbRatio > 0) {
      const barH = Math.round(cH * lbRatio);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cW, barH);
      ctx.fillRect(0, cH - barH, cW, barH);
    }

    // ─── Draw watermark preview (center) ───
    if (watermark.trim()) {
      const wmSize = Math.round(cW * 0.08);
      ctx.font = `bold ${wmSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillText(watermark.trim(), cW / 2, cH / 2);
      ctx.textAlign = "start";
    }

    // ─── Intro / Outro — dynamic black bars + title ───
    const ct = v.currentTime;
    const relCt = ct - trimStart; // relative time from trim start
    const INTRO = 1.0;  // 1 second intro
    const OUTRO = 0.8;  // 0.8 second outro

    if (relCt >= 0 && relCt < INTRO) {
      const p = relCt / INTRO; // 0→1 progress
      ctx.fillStyle = "#000";

      // ── Phase 1 (0–0.35): Bars slam in from top/bottom/sides ──
      if (p < 0.35) {
        const bp = p / 0.35; // bar progress 0→1
        const ease = 1 - Math.pow(1 - bp, 3); // ease-out cubic
        // Top bar
        const topH = cH * 0.40 * ease;
        ctx.fillRect(0, 0, cW, topH);
        // Bottom bar
        ctx.fillRect(0, cH - topH, cW, topH);
        // Left bar (narrower, staggered)
        const sideP = Math.max(0, (bp - 0.3) / 0.7);
        const sideEase = 1 - Math.pow(1 - sideP, 3);
        const sideW = cW * 0.12 * sideEase;
        ctx.fillRect(0, topH, sideW, cH - topH * 2);
        // Right bar
        ctx.fillRect(cW - sideW, topH, sideW, cH - topH * 2);
        // Accent lines (thin white flashes)
        if (bp > 0.5) {
          const lineAlpha = (bp - 0.5) * 2;
          ctx.fillStyle = `rgba(255,255,255,${(lineAlpha * 0.8).toFixed(2)})`;
          ctx.fillRect(0, topH - 2, cW, 2);
          ctx.fillRect(0, cH - topH, cW, 2);
        }
      }
      // ── Phase 2 (0.35–0.70): Bars hold + title text appears ──
      else if (p < 0.70) {
        const topH = cH * 0.40;
        const sideW = cW * 0.12;
        ctx.fillRect(0, 0, cW, topH);
        ctx.fillRect(0, cH - topH, cW, topH);
        ctx.fillRect(0, topH, sideW, cH - topH * 2);
        ctx.fillRect(cW - sideW, topH, sideW, cH - topH * 2);
        // White accent lines
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(0, topH - 2, cW, 2);
        ctx.fillRect(0, cH - topH, cW, 2);
        ctx.fillRect(sideW, topH, 2, cH - topH * 2);
        ctx.fillRect(cW - sideW - 2, topH, 2, cH - topH * 2);
        // Title text (fade in)
        const titleText = introTitle || "SHORT";
        const textP = (p - 0.35) / 0.35;
        const textAlpha = Math.min(1, textP * 2);
        const titleSize = Math.round(cW * 0.14);
        ctx.font = `900 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(255,255,255,${textAlpha.toFixed(2)})`;
        ctx.fillText(titleText, cW / 2, cH / 2);
        // Subtle underline
        if (textP > 0.3) {
          const lineW = ctx.measureText(titleText).width * Math.min(1, (textP - 0.3) / 0.4);
          ctx.fillStyle = `rgba(139,92,246,${(textAlpha * 0.9).toFixed(2)})`; // violet
          ctx.fillRect((cW - lineW) / 2, cH / 2 + titleSize * 0.5, lineW, 3);
        }
        ctx.textAlign = "start";
      }
      // ── Phase 3 (0.70–1.0): Bars split open, title fades ──
      else {
        const exitP = (p - 0.70) / 0.30;
        const ease = exitP * exitP; // ease-in quad
        const topH = cH * 0.40 * (1 - ease);
        const sideW = cW * 0.12 * (1 - ease);
        ctx.fillRect(0, -cH * 0.40 * ease, cW, cH * 0.40);
        ctx.fillRect(0, cH - topH, cW, topH);
        ctx.fillRect(-cW * 0.12 * ease, 0, cW * 0.12, cH);
        ctx.fillRect(cW - sideW + cW * 0.12 * ease, 0, cW * 0.12, cH);
        // Fading title
        const titleText = introTitle || "SHORT";
        const textAlpha = 1 - ease;
        const titleSize = Math.round(cW * 0.14);
        ctx.font = `900 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(255,255,255,${textAlpha.toFixed(2)})`;
        ctx.fillText(titleText, cW / 2, cH / 2);
        ctx.textAlign = "start";
        // White flash at the split moment
        if (exitP < 0.2) {
          ctx.fillStyle = `rgba(255,255,255,${(0.6 * (1 - exitP / 0.2)).toFixed(2)})`;
          ctx.fillRect(0, 0, cW, cH);
        }
      }
    }

    // ── Outro (1.0s): bars close in + ending text ──
    const OUTRO_FULL = 1.0;
    const outroStart = trimEnd - OUTRO_FULL;
    if (trimEnd > 2 && ct > outroStart && ct <= trimEnd) {
      const p = (ct - outroStart) / OUTRO_FULL; // 0→1
      ctx.fillStyle = "#000";

      // Phase 1 (0–0.4): Bars close in
      if (p < 0.4) {
        const bp = p / 0.4;
        const ease = bp * bp;
        const barH = cH * 0.5 * ease;
        ctx.fillRect(0, 0, cW, barH);
        ctx.fillRect(0, cH - barH, cW, barH);
        const sw = cW * 0.12 * ease;
        ctx.fillRect(0, barH, sw, cH - barH * 2);
        ctx.fillRect(cW - sw, barH, sw, cH - barH * 2);
        // Accent lines
        if (bp > 0.5) {
          ctx.fillStyle = `rgba(255,255,255,${(0.6 * ease).toFixed(2)})`;
          ctx.fillRect(0, barH - 1, cW, 1);
          ctx.fillRect(0, cH - barH, cW, 1);
        }
      }
      // Phase 2 (0.4–0.85): Full black + outro text
      else if (p < 0.85) {
        ctx.fillRect(0, 0, cW, cH);
        // Outro text
        const endText = outroText.trim() || "suile.im";
        const textP = (p - 0.4) / 0.45;
        const textAlpha = textP < 0.3 ? textP / 0.3 : textP > 0.8 ? (1 - textP) / 0.2 : 1;
        const fontSize = Math.round(cW * 0.10);
        ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Text with subtle glow
        ctx.fillStyle = `rgba(139,92,246,${(textAlpha * 0.3).toFixed(2)})`;
        ctx.fillText(endText, cW / 2 + 1, cH / 2 + 1);
        ctx.fillStyle = `rgba(255,255,255,${textAlpha.toFixed(2)})`;
        ctx.fillText(endText, cW / 2, cH / 2);
        // Thin accent line under text
        if (textP > 0.15 && textP < 0.85) {
          const lineAlpha = Math.min(1, textP < 0.3 ? (textP - 0.15) / 0.15 : textP > 0.7 ? (0.85 - textP) / 0.15 : 1);
          const lineW = ctx.measureText(endText).width * 0.6;
          ctx.fillStyle = `rgba(139,92,246,${(lineAlpha * 0.7).toFixed(2)})`;
          ctx.fillRect((cW - lineW) / 2, cH / 2 + fontSize * 0.55, lineW, 2);
        }
        ctx.textAlign = "start";
      }
      // Phase 3 (0.85–1.0): Hold black
      else {
        ctx.fillRect(0, 0, cW, cH);
      }
    }
  }, [cropX, cropY, cropW, cropH, bgMode, captions, watermark, trimStart, trimEnd, introTitle, outroText, vignetteOn, particlesOn, letterbox]);

  useEffect(() => {
    if (phase !== "preview" && phase !== "done") return;
    let running = true;
    const loop = () => {
      if (!running) return;
      drawFrame();
      const v = videoRef.current;
      if (v) {
        setCurrentTime(v.currentTime);
        if (v.currentTime >= trimEnd) {
          v.currentTime = trimStart;
          if (bgmAudioRef.current) bgmAudioRef.current.currentTime = 0;
        }
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [phase, drawFrame, trimStart, trimEnd]);

  /* ── Playback ── */
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const togglePlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    
    // Wait for previous play() Promise to settle
    if (playPromiseRef.current) {
      await playPromiseRef.current.catch(() => {});
    }
    
    if (v.paused) {
      playPromiseRef.current = v.play().catch((err) => {
        console.warn("[Play] Interrupted:", err.message);
      });
      // Start BGM preview
      if (bgmAudioRef.current) {
        bgmAudioRef.current.currentTime = 0;
        bgmAudioRef.current.play().catch(() => {});
      }
      setPlaying(true);
    } else {
      v.pause();
      // Pause BGM preview
      if (bgmAudioRef.current) bgmAudioRef.current.pause();
      setPlaying(false);
      playPromiseRef.current = null;
    }
  }, []);

  /* ── Timeline seek ── */
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);

  const seekToPosition = useCallback((clientX: number) => {
    const el = timelineRef.current;
    const v = videoRef.current;
    if (!el || !v) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = trimStart + ratio * (trimEnd - trimStart);
    setCurrentTime(v.currentTime);
    // Sync BGM position
    if (bgmAudioRef.current) {
      const bgmDur = bgmAudioRef.current.duration || 30;
      bgmAudioRef.current.currentTime = ((v.currentTime - trimStart) % bgmDur);
    }
  }, [trimStart, trimEnd]);

  const onTimelineDown = useCallback(async (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsSeeking(true);
    const v = videoRef.current;
    if (v && !v.paused) {
      if (playPromiseRef.current) await playPromiseRef.current.catch(() => {});
      v.pause();
      setPlaying(false);
      playPromiseRef.current = null;
    }
    seekToPosition(e.clientX);
  }, [seekToPosition]);

  const onTimelineMove = useCallback((e: React.PointerEvent) => {
    if (!isSeeking) return;
    seekToPosition(e.clientX);
  }, [isSeeking, seekToPosition]);

  const onTimelineUp = useCallback(() => {
    setIsSeeking(false);
  }, []);

  /* ── Range trim handles (for videos > 60s) ── */
  const rangeRef = useRef<HTMLDivElement>(null);
  const [rangeDragging, setRangeDragging] = useState<"start" | "end" | null>(null);

  const onRangePointerDown = useCallback((handle: "start" | "end", e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setRangeDragging(handle);
  }, []);

  const onRangePointerMove = useCallback((e: React.PointerEvent) => {
    if (!rangeDragging || !rangeRef.current) return;
    const rect = rangeRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = ratio * duration;

    const MIN_RANGE = 5;

    if (rangeDragging === "start") {
      const newStart = Math.max(0, Math.min(time, trimEnd - MIN_RANGE));
      // Enforce max 60s range
      if (trimEnd - newStart > MAX_DUR) {
        setTrimStart(trimEnd - MAX_DUR);
      } else {
        setTrimStart(newStart);
      }
    } else {
      const newEnd = Math.min(duration, Math.max(time, trimStart + MIN_RANGE));
      // Enforce max 60s range
      if (newEnd - trimStart > MAX_DUR) {
        setTrimEnd(trimStart + MAX_DUR);
      } else {
        setTrimEnd(newEnd);
      }
    }
  }, [rangeDragging, duration, trimStart, trimEnd]);

  const onRangePointerUp = useCallback(() => {
    setRangeDragging(null);
  }, []);

  /* ── Range timeline seek (click inside selected range) ── */
  const seekInRange = useCallback((clientX: number) => {
    const el = rangeRef.current;
    const v = videoRef.current;
    if (!el || !v) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = ratio * duration;
    // Clamp to trim range
    const clamped = Math.max(trimStart, Math.min(trimEnd, time));
    v.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration, trimStart, trimEnd]);

  /* ── Drag-to-crop state ── */
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number; startY: number;
    startCropX: number; startCropY: number;
    moved: boolean;
  } | null>(null);

  const canDrag = cropW < 0.999 || cropH < 0.999; // can move if crop doesn't fill full frame

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (phase !== "preview") return;
    
    // Always allow pointer capture for tap-to-play
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    
    // Only track drag if crop position is adjustable
    if (canDrag) {
      dragRef.current = {
        startX: e.clientX, startY: e.clientY,
        startCropX: cropX, startCropY: cropY,
        moved: false,
      };
    } else {
      // Not draggable, but still track for tap detection
      dragRef.current = {
        startX: e.clientX, startY: e.clientY,
        startCropX: cropX, startCropY: cropY,
        moved: false,
      };
    }
  }, [phase, canDrag, cropX, cropY]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !canDrag) return; // only allow drag if canDrag
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    if (!d.moved) return;
    if (!isDragging) setIsDragging(true);
    // Convert canvas-pixel delta → normalized crop coords (drag content = opposite direction)
    const newX = Math.max(0, Math.min(1 - cropW, d.startCropX - dx * (cropW / canvasW)));
    const newY = Math.max(0, Math.min(1 - cropH, d.startCropY - dy * (cropH / canvasH)));
    setCropX(newX);
    setCropY(newY);
  }, [canDrag, cropW, cropH, isDragging, canvasW, canvasH]);

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    // Short tap (no drag) → toggle play
    if (d && !d.moved) togglePlay();
  }, [togglePlay]);

  /* ════════════════════════════════════════════
     EXPORT — FAST (MediaRecorder)
     ════════════════════════════════════════════ */
  const handleExportFast = useCallback(async (): Promise<boolean> => {
    const v = videoRef.current;
    const origCanvas = canvasRef.current;
    if (!v || !origCanvas) return false;

    // Feature check
    if (typeof MediaRecorder === "undefined") return false;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = outW;
    exportCanvas.height = outH;
    if (typeof exportCanvas.captureStream !== "function") return false;

    console.log("[FastExport] Starting MediaRecorder path...");
    setPhase("encoding");

    // Swap canvas for full-res
    canvasRef.current = exportCanvas;

    const exportDuration = trimEnd - trimStart;
    const fps = 24;

    try {
      // 1. Set up video stream from canvas
      const canvasStream = exportCanvas.captureStream(fps);

      // 2. Set up audio: original + optional BGM via AudioContext
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();

      // Original audio from video element
      let mediaSource: MediaElementAudioSourceNode | null = null;
      try {
        mediaSource = audioCtx.createMediaElementSource(v);
        mediaSource.connect(dest);
        // Also keep it connected to speakers for monitoring? No — muted export.
      } catch {
        // No audio or already captured — fine
      }

      // BGM
      let bgmSource: AudioBufferSourceNode | null = null;
      if (bgmData) {
        try {
          const bgmBuf = await audioCtx.decodeAudioData(new Uint8Array(bgmData).buffer);
          bgmSource = audioCtx.createBufferSource();
          bgmSource.buffer = bgmBuf;
          bgmSource.loop = true;
          const bgmGain = audioCtx.createGain();
          bgmGain.gain.value = 0.2;
          bgmSource.connect(bgmGain).connect(dest);
        } catch (e) {
          console.warn("[FastExport] BGM decode failed:", e);
        }
      }

      // Combine: canvas video track + mixed audio track
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
      dest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));

      // 3. MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: quality === "high" ? 8_000_000 : quality === "medium" ? 4_000_000 : 2_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const recorderDone = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const webm = new Blob(chunks, { type: mimeType });
          resolve(webm);
        };
        recorder.onerror = (e) => reject(e);
      });

      // 4. Playback at 1x — MediaRecorder records wall-clock time,
      //    so speed-up would shorten the output video duration
      v.muted = false;
      v.volume = 0; // silent to user, but audio goes through AudioContext
      v.currentTime = trimStart;
      v.playbackRate = 1;

      // Wait for seek
      await new Promise<void>((res) => {
        const onSeeked = () => { v.removeEventListener("seeked", onSeeked); res(); };
        v.addEventListener("seeked", onSeeked);
        setTimeout(res, 1000);
      });

      // Start recording & playback
      recorder.start(100); // collect chunks every 100ms
      bgmSource?.start(0);
      await v.play().catch(() => {});

      // 5. Render loop — use setInterval (NOT requestAnimationFrame)
      //    rAF stops completely when tab is hidden/throttled, causing frozen frames.
      //    setInterval is only throttled to 1Hz in background, much more reliable.
      let running = true;
      let lastProgressUpdate = 0;
      let lastVideoTime = v.currentTime;
      let stallCount = 0;

      const RENDER_INTERVAL = Math.round(1000 / fps); // ~42ms for 24fps
      const renderInterval = setInterval(() => {
        if (!running) return;

        // Stall detection: if video.currentTime hasn't moved for ~2s, video may have stalled
        const ct = v.currentTime;
        if (Math.abs(ct - lastVideoTime) < 0.01) {
          stallCount++;
          if (stallCount > 50) { // ~2 seconds at 24fps interval
            console.warn("[FastExport] Video stalled at", ct.toFixed(2), "s, attempting resume...");
            stallCount = 0;
            // Try to resume: play() again in case it paused
            v.play().catch(() => {});
          }
        } else {
          stallCount = 0;
          lastVideoTime = ct;
        }

        drawFrame();

        // Throttle progress updates to ~4 Hz for smooth UI
        const now = performance.now();
        if (now - lastProgressUpdate > 250) {
          const elapsed = ct - trimStart;
          const prog = Math.min(1, elapsed / exportDuration);
          setProgress(prog * 0.8); // 0-80% during recording
          lastProgressUpdate = now;
        }

        if (ct >= trimEnd - 0.05) {
          running = false;
          clearInterval(renderInterval);
          v.pause();
          setProgress(0.8);
          recorder.stop();
        }
      }, RENDER_INTERVAL);

      // Also listen for video ended
      const onEnded = () => {
        if (running) {
          running = false;
          clearInterval(renderInterval);
          recorder.stop();
        }
      };
      v.addEventListener("ended", onEnded, { once: true });

      // Safety timeout
      const safetyMs = (exportDuration + 15) * 1000;
      const safetyTimer = setTimeout(() => {
        if (running) {
          running = false;
          clearInterval(renderInterval);
          try { recorder.stop(); } catch {}
        }
      }, safetyMs);

      // Wait for recording to finish
      const webmBlob = await recorderDone;
      clearTimeout(safetyTimer);
      v.removeEventListener("ended", onEnded);

      // Cleanup audio
      bgmSource?.stop();
      if (mediaSource) { try { mediaSource.disconnect(); } catch {} }
      await audioCtx.close();

      // Restore
      v.playbackRate = 1;
      v.muted = true;
      v.volume = 1;
      canvasRef.current = origCanvas;

      console.log("[FastExport] WebM recorded:", (webmBlob.size / 1024).toFixed(0), "KB");

      if (webmBlob.size < 1000) {
        console.warn("[FastExport] WebM too small, falling back");
        return false;
      }

      // 6. Remux WebM → MP4 via FFmpeg
      setProgress(0.85);
      const worker = await import("./lib/ffmpeg-worker");
      const mp4Blob = await worker.remuxToMp4(webmBlob, (p) => setProgress(0.85 + p * 0.15));

      setExportBlob(mp4Blob);
      setPhase("done");
      return true;
    } catch (err) {
      console.error("[FastExport] Failed:", err);
      canvasRef.current = origCanvas;
      v.playbackRate = 1;
      v.muted = true;
      v.volume = 1;
      return false;
    }
  }, [videoFile, trimStart, trimEnd, outW, outH, quality, bgmData, drawFrame]);

  /* ════════════════════════════════════════════
     EXPORT — LEGACY (frame-by-frame seeking)
     ════════════════════════════════════════════ */
  const handleExportLegacy = useCallback(async () => {
    if (!videoFile || !videoRef.current) return;

    try {
      const worker = await import("./lib/ffmpeg-worker");
      setPhase("encoding");

      const v = videoRef.current;

      let fileData = fileDataRef.current;
      if (!fileData) {
        console.log("[Export] fileDataRef empty, reading file now...");
        fileData = new Uint8Array(await videoFile.arrayBuffer());
      }

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = outW;
      exportCanvas.height = outH;
      const origCanvas = canvasRef.current;
      canvasRef.current = exportCanvas;

      const exportDuration = trimEnd - trimStart;
      const fps = exportDuration > 30 ? 15 : 24;
      const totalFrames = Math.ceil(exportDuration * fps);
      const frames: Uint8Array[] = [];

      const wasPlaying = !v.paused;
      if (wasPlaying) {
        if (playPromiseRef.current) await playPromiseRef.current.catch(() => {});
        v.pause();
        setPlaying(false);
        playPromiseRef.current = null;
      }

      if (v.readyState < 2) {
        await new Promise<void>((res) => {
          const h = () => { v.removeEventListener("loadeddata", h); res(); };
          v.addEventListener("loadeddata", h);
          setTimeout(() => { v.removeEventListener("loadeddata", h); res(); }, 8000);
        });
      }

      console.log("[Export Legacy] Capturing", totalFrames, "frames at", fps, "fps");

      for (let i = 0; i < totalFrames; i++) {
        const time = trimStart + i / fps;
        if (time >= trimEnd) break;

        v.currentTime = time;
        await new Promise<void>((res) => {
          let done = false;
          const finish = () => { if (!done) { done = true; res(); } };
          const timer = setTimeout(() => { v.removeEventListener("seeked", onSeeked); finish(); }, 3000);
          const onSeeked = () => { clearTimeout(timer); v.removeEventListener("seeked", onSeeked); finish(); };
          v.addEventListener("seeked", onSeeked);
        });

        drawFrame();

        let frameData: Uint8Array | null = null;
        try {
          const blob = await new Promise<Blob | null>((res) =>
            exportCanvas.toBlob(b => res(b), "image/jpeg", 0.85)
          );
          if (blob) {
            frameData = new Uint8Array(await blob.arrayBuffer());
          }
        } catch {
          try {
            const dataUrl = exportCanvas.toDataURL("image/jpeg", 0.85);
            const base64 = dataUrl.split(",")[1];
            const binary = atob(base64);
            const arr = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) arr[j] = binary.charCodeAt(j);
            frameData = arr;
          } catch { /* skip frame */ }
        }

        if (frameData) frames.push(frameData);
        setProgress((i + 1) / totalFrames * 0.5);
      }

      canvasRef.current = origCanvas;
      console.log("[Export Legacy] Captured", frames.length, "frames, encoding...");

      const result = await worker.encodeFrames({
        frames,
        fps,
        originalVideo: fileData,
        originalName: videoFile.name,
        trimStart,
        duration: exportDuration,
        bgmData: bgmData ?? undefined,
        bgmVolume: 0.2,
        quality,
        onProgress: (p) => setProgress(0.5 + p * 0.5),
      });

      setExportBlob(result);
      setPhase("done");
    } catch (err) {
      console.error(err);
      setError("Export failed");
      setPhase("preview");
    }
  }, [videoFile, trimStart, trimEnd, outW, outH, quality, bgmData, drawFrame]);

  /* ════════════════════════════════════════════
     EXPORT — unified entry (fast → legacy fallback)
     ════════════════════════════════════════════ */
  const handleExport = useCallback(async () => {
    if (!videoFile || !videoRef.current) return;
    // Stop BGM preview during export
    if (bgmAudioRef.current) bgmAudioRef.current.pause();
    setPhase("loading");
    setProgress(0);
    setError("");

    // Try fast path first
    const ok = await handleExportFast();
    if (ok) return;

    // Fallback to legacy
    console.log("[Export] Fast path failed, using legacy frame-by-frame...");
    await handleExportLegacy();
  }, [videoFile, handleExportFast, handleExportLegacy]);

  const handleDownload = useCallback(() => {
    if (!exportBlob) return;
    const url = URL.createObjectURL(exportBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `short_${Date.now()}.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportBlob]);

  const reset = useCallback(() => {
    // Stop BGM preview
    if (bgmAudioRef.current) { bgmAudioRef.current.pause(); bgmAudioRef.current = null; }
    if (bgmUrlRef.current) { URL.revokeObjectURL(bgmUrlRef.current); bgmUrlRef.current = ""; }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null); setVideoUrl(""); setDuration(0);
    setPlaying(false); setCurrentTime(0); setTrimStart(0); setTrimEnd(0);
    setPhase("upload"); setExportBlob(null);
    setProgress(0); setError(""); setShowSettings(false);
    setCaptions([]); setCaptionPhase("idle"); setCaptionMsg("");
    setBgmTrack("none"); setBgmData(null); setBgmLoadError(false);
    setCaptionEnabled(false); setWatermark("suile.im"); setIntroTitle(""); setOutroText("suile.im");
    setVignetteOn(true); setParticlesOn(true); setLetterbox("thin");
    particlesRef.current = []; particleInitRef.current = false;
    fileDataRef.current = null;
    // YouTube reset
    setYtPhase("idle"); setYtProgress(0); setYtVideoId(""); setYtError(""); setYtTitle(""); setYtPrivacy("private");
    ytPendingRef.current = false;
  }, [videoUrl]);

  /* ════════════════════════════════════════════
     YOUTUBE — Google Identity Services OAuth
     ════════════════════════════════════════════ */

  // Load GIS script
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // Initialize GIS token client (singleton — uses refs to avoid stale closures)
  const initGisTokenClient = useCallback(() => {
    if (gisTokenClientRef.current) return gisTokenClientRef.current;
    if (!window.google) return null;

    gisTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: YT_SCOPE,
      callback: (response: GisTokenResponse) => {
        console.log("[YouTube] GIS callback fired, has token:", !!response.access_token, "error:", response.error);
        const blob = exportBlobRef.current;
        if (response.access_token && ytPendingRef.current && blob) {
          ytPendingRef.current = false;
          console.log("[YouTube] Calling doYoutubeUpload via ref, blob size:", blob.size);
          doYoutubeUploadRef.current(response.access_token, blob);
        } else if (response.access_token && !blob) {
          console.error("[YouTube] Auth OK but no export blob available");
          setYtPhase("error");
          setYtError("No video to upload. Please export first.");
        } else if (response.error) {
          console.error("[YouTube] Auth error:", response.error);
          setYtPhase("error");
          setYtError(response.error);
        }
      },
    });
    return gisTokenClientRef.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Perform the actual upload
  const doYoutubeUpload = useCallback(async (token: string, blob: Blob) => {
    console.log("[YouTube] Starting upload, blob size:", (blob.size / 1024 / 1024).toFixed(2), "MB, type:", blob.type);
    setYtPhase("uploading");
    setYtProgress(0);
    setYtError("");

    try {
      const result = await uploadToYouTube({
        token,
        blob,
        title: ytTitle || "Short",
        description: `${ytTitle || "Short"} — Made with SUILE (suile.im)`,
        privacy: ytPrivacy,
        onProgress: (r) => {
          console.log("[YouTube] Upload progress:", (r * 100).toFixed(1) + "%");
          setYtProgress(r);
        },
      });

      console.log("[YouTube] Upload complete! Video ID:", result.videoId, "URL:", result.url);
      console.log("[YouTube] Upload status:", result.uploadStatus, "Privacy:", result.privacyStatus, "Rejection:", result.rejectionReason);
      setYtVideoId(result.videoId);
      setYtUploadStatus(result.uploadStatus || "uploaded");

      if (result.uploadStatus === "rejected" || result.uploadStatus === "failed") {
        setYtPhase("error");
        setYtError(`YouTube rejected the video: ${result.rejectionReason || "unknown reason"}`);
      } else {
        setYtPhase("done");
      }
    } catch (err) {
      console.error("[YouTube Upload] Error:", err);
      setYtPhase("error");
      setYtError(err instanceof Error ? err.message : "Upload failed");
    }
  }, [ytTitle, ytPrivacy]);
  // Keep ref in sync so GIS callback always uses latest upload function
  useEffect(() => { doYoutubeUploadRef.current = doYoutubeUpload; }, [doYoutubeUpload]);

  // Entry point: request OAuth then upload
  const handleYoutubeUpload = useCallback(() => {
    if (!exportBlobRef.current) {
      setYtPhase("error");
      setYtError("No video to upload. Please export first.");
      return;
    }

    const client = initGisTokenClient();
    if (!client) {
      setYtPhase("error");
      setYtError(t.ytGoogleError);
      return;
    }

    ytPendingRef.current = true;
    setYtPhase("auth");
    client.requestAccessToken();
  }, [initGisTokenClient, t]);

  /* ═══════════════════════════════════════════════
     RENDER — UPLOAD
     ═══════════════════════════════════════════════ */
  if (phase === "upload") {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-bold mb-3">
            <Scissors size={14} /> {t.title}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">{t.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">{t.desc}</p>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-16 text-center cursor-pointer hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-all group"
        >
          <Upload size={48} className="mx-auto text-zinc-400 group-hover:text-violet-500 transition mb-4" />
          <p className="text-zinc-600 dark:text-zinc-300 font-bold">{t.upload}</p>
          <p className="text-xs text-zinc-400 mt-1">{t.uploadSub}</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {error && <p className="mt-4 text-center text-red-500 text-sm font-bold">{error}</p>}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     RENDER — PREVIEW / ENCODING / DONE
     ═══════════════════════════════════════════════ */

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-20">
      {/* Video element — off-screen (NOT display:none) so mobile browsers still decode frames */}
      <video
        ref={videoRef}
        src={videoUrl}
        onLoadedMetadata={onMeta}
        playsInline
        muted
        preload="auto"
        crossOrigin="anonymous"
        className="absolute w-px h-px opacity-0 overflow-hidden pointer-events-none"
        style={{ top: -9999, left: -9999 }}
      />

      {/* Preview */}
      <div className="flex flex-col items-center gap-4">
        {/* Canvas */}
        <div
          className={`relative rounded-2xl overflow-hidden shadow-2xl bg-black touch-none select-none ${
            phase === "preview" && canDrag ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
          style={{ width: canvasW, height: canvasH }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <canvas ref={canvasRef} width={canvasW} height={canvasH} className="block pointer-events-none" />

          {/* Play icon (non-interactive — tap handled by pointer events) */}
          {phase === "preview" && !playing && !isDragging && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <Play size={24} className="text-violet-600 ml-1" />
              </div>
            </div>
          )}

          {/* Drag hint (shown once, fades) */}
          {phase === "preview" && canDrag && !playing && !isDragging && (
            <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none">
              <span className="text-[9px] text-white/60 bg-black/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Move size={9} /> {t.dragCrop}
              </span>
            </div>
          )}

          {/* Auto-crop badge */}
          {phase === "preview" && (
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <span className="text-[10px] bg-violet-600/90 text-white px-2 py-0.5 rounded-full font-bold">
                {t.auto916}
              </span>
            </div>
          )}

          {/* Caption status badge */}
          {phase === "preview" && captionEnabled && captionPhase !== "idle" && (
            <div className="absolute bottom-3 left-3 right-3 flex justify-center">
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                captionPhase === "done" ? "bg-green-600/90 text-white" :
                captionPhase === "error" ? "bg-red-600/90 text-white" :
                "bg-blue-600/90 text-white"
              }`}>
                {(captionPhase === "extracting" || captionPhase === "transcribing") && (
                  <Loader2 size={10} className="animate-spin" />
                )}
                {captionPhase === "done" && <Check size={10} />}
                <MessageSquareText size={10} />
                {captionMsg}
              </span>
            </div>
          )}

          {/* Encoding overlay */}
          {(phase === "loading" || phase === "encoding") && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
              <Loader2 size={40} className="text-violet-400 animate-spin" />
              <p className="text-white text-sm font-bold">
                {phase === "loading" ? t.loadingFF : t.encoding}
              </p>
              {phase === "encoding" && (
                <div className="w-48">
                  <div className="h-2.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                      style={{ width: `${Math.max(3, progress * 100)}%` }}
                    />
                  </div>
                  <p className="text-zinc-300 text-xs text-center mt-1.5 font-bold">{Math.round(progress * 100)}%</p>
                </div>
              )}
            </div>
          )}

          {/* Done overlay */}
          {phase === "done" && (
            <div className="absolute top-3 left-3">
              <span className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                <Check size={12} /> {t.done}
              </span>
            </div>
          )}
        </div>

        {/* Timeline scrubber */}
        {(phase === "preview" || phase === "done") && duration > 0 && !needsRangeSelect && (
          <div style={{ width: canvasW }} className="mt-1">
            <div
              ref={timelineRef}
              className="relative w-full h-7 flex items-center cursor-pointer touch-none"
              onPointerDown={onTimelineDown}
              onPointerMove={onTimelineMove}
              onPointerUp={onTimelineUp}
            >
              {/* Track background */}
              <div className="absolute left-0 right-0 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full overflow-hidden">
                {/* Filled portion */}
                <div
                  className="h-full bg-violet-500 rounded-full"
                  style={{ width: `${trimDuration > 0 ? ((currentTime - trimStart) / trimDuration) * 100 : 0}%` }}
                />
              </div>
              {/* Thumb */}
              <div
                className="absolute w-3.5 h-3.5 bg-white border-2 border-violet-500 rounded-full shadow-md -translate-x-1/2 pointer-events-none"
                style={{ left: `${trimDuration > 0 ? ((currentTime - trimStart) / trimDuration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 -mt-1 px-0.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(trimEnd)}</span>
            </div>
          </div>
        )}

        {/* Range-select timeline (for videos > 60s) */}
        {(phase === "preview" || phase === "done") && duration > 0 && needsRangeSelect && (
          <div style={{ width: canvasW }} className="mt-1">
            <div
              ref={rangeRef}
              className="relative w-full h-10 flex items-center touch-none"
              onPointerMove={onRangePointerMove}
              onPointerUp={onRangePointerUp}
              onClick={(e) => { if (!rangeDragging) seekInRange(e.clientX); }}
            >
              {/* Full track background */}
              <div className="absolute left-0 right-0 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
              {/* Selected range highlight */}
              <div
                className="absolute h-1.5 bg-violet-500/40 rounded-full"
                style={{
                  left: `${(trimStart / duration) * 100}%`,
                  width: `${((trimEnd - trimStart) / duration) * 100}%`,
                }}
              />
              {/* Playback position within range */}
              <div
                className="absolute w-2 h-2 bg-white border-2 border-violet-500 rounded-full -translate-x-1/2 pointer-events-none z-10"
                style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              {/* Start handle */}
              <div
                className="absolute z-20 flex items-center justify-center cursor-ew-resize"
                style={{ left: `${(trimStart / duration) * 100}%`, transform: "translateX(-50%)" }}
                onPointerDown={(e) => onRangePointerDown("start", e)}
              >
                <div className="w-6 h-10 flex items-center justify-center">
                  <div className="w-1.5 h-6 bg-violet-500 rounded-sm shadow" />
                </div>
              </div>
              {/* End handle */}
              <div
                className="absolute z-20 flex items-center justify-center cursor-ew-resize"
                style={{ left: `${(trimEnd / duration) * 100}%`, transform: "translateX(-50%)" }}
                onPointerDown={(e) => onRangePointerDown("end", e)}
              >
                <div className="w-6 h-10 flex items-center justify-center">
                  <div className="w-1.5 h-6 bg-violet-500 rounded-sm shadow" />
                </div>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 -mt-1 px-0.5">
              <span>{formatTime(trimStart)}</span>
              <span className="text-violet-500 font-bold">{formatTime(currentTime)}</span>
              <span>{formatTime(trimEnd)}</span>
            </div>
            <p className="text-[10px] text-zinc-400 text-center mt-0.5">
              {t.trimRange(fmtSec(trimEnd - trimStart), fmtSec(duration))}
            </p>
          </div>
        )}

        {/* Video info */}
        {phase === "preview" && !needsRangeSelect && (
          <p className="text-xs text-zinc-500 text-center">
            {t.trimFull(fmtSec(duration))}
          </p>
        )}

        {/* ─── AI Caption Toggle ─── */}
        {phase === "preview" && (
          <div className="w-full flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <MessageSquareText size={16} className="text-violet-500" />
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{t.aiCaption}</span>
            </div>
            <button
              onClick={() => {
                setCaptionEnabled(prev => {
                  const next = !prev;
                  if (next && captionPhase === "idle") {
                    // trigger generation
                    setTimeout(() => generateCaptions(), 100);
                  }
                  return next;
                });
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                captionEnabled ? "bg-violet-600" : "bg-zinc-300 dark:bg-zinc-700"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                captionEnabled ? "translate-x-5" : ""
              }`} />
            </button>
          </div>
        )}

        {/* ─── BGM Selector ─── */}
        {phase === "preview" && (
          <div className="w-full bg-zinc-50 dark:bg-zinc-900 rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Music size={16} className="text-violet-500" />
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{t.bgmLabel}</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {BGM_LIST.map(bgm => (
                <button
                  key={bgm.id}
                  onClick={() => setBgmTrack(bgm.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    bgmTrack === bgm.id
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {bgm.id === "none"
                    ? <VolumeX size={12} />
                    : <Volume2 size={12} />
                  }
                  {locale === "ko" ? bgm.labelKo : bgm.labelEn}
                </button>
              ))}
            </div>
            {bgmLoadError && bgmTrack !== "none" && (
              <p className="text-[10px] text-amber-500 mt-1.5">{t.bgmMissing}</p>
            )}
          </div>
        )}

        {/* ─── Intro / Outro / Watermark Text Inputs ─── */}
        {phase === "preview" && (
          <div className="w-full bg-zinc-50 dark:bg-zinc-900 rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-800 space-y-3">
            {/* Intro text */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Clapperboard size={14} className="text-violet-500" />
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t.introLabel}</span>
              </div>
              <input
                type="text"
                value={introTitle}
                onChange={e => setIntroTitle(e.target.value)}
                placeholder={t.introPlaceholder}
                maxLength={12}
                className="w-full px-3 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            </div>
            {/* Outro text */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <LogOut size={14} className="text-violet-500" />
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t.outroLabel}</span>
              </div>
              <input
                type="text"
                value={outroText}
                onChange={e => setOutroText(e.target.value)}
                placeholder={t.outroPlaceholder}
                maxLength={20}
                className="w-full px-3 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            </div>
            {/* Watermark */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Stamp size={14} className="text-violet-500" />
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t.watermarkLabel}</span>
              </div>
              <input
                type="text"
                value={watermark}
                onChange={e => setWatermark(e.target.value)}
                placeholder={t.watermarkPlaceholder}
                className="w-full px-3 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            </div>
          </div>
        )}

        {/* Settings toggle */}
        {phase === "preview" && (
          <button
            onClick={() => setShowSettings(s => !s)}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1 transition"
          >
            <Settings2 size={12} /> {t.settings}
          </button>
        )}

        {/* Settings panel */}
        {phase === "preview" && showSettings && (
          <div className="w-full bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 space-y-3 border border-zinc-200 dark:border-zinc-800">
            {/* Resolution */}
            <div>
              <p className="text-[10px] text-zinc-500 font-bold mb-1">{t.resolution}</p>
              <div className="flex gap-2">
                {(["1080", "720"] as const).map(r => (
                  <button key={r} onClick={() => setResolution(r)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                      resolution === r ? "bg-violet-600 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                    }`}>
                    {r === "1080" ? "1080x1920" : "720x1280"}
                  </button>
                ))}
              </div>
            </div>
            {/* Quality */}
            <div>
              <p className="text-[10px] text-zinc-500 font-bold mb-1">{t.quality}</p>
              <div className="flex gap-2">
                {(["high", "medium", "low"] as const).map(q => (
                  <button key={q} onClick={() => setQuality(q)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                      quality === q ? "bg-violet-600 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                    }`}>
                    {q === "high" ? t.high : q === "medium" ? t.medium : t.low}
                  </button>
                ))}
              </div>
            </div>
            {/* BG Mode */}
            <div>
              <p className="text-[10px] text-zinc-500 font-bold mb-1">{t.bgMode}</p>
              <div className="flex gap-2">
                <button onClick={() => setBgMode("blur")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    bgMode === "blur" ? "bg-violet-600 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                  }`}>{t.bgBlur}</button>
                <button onClick={() => setBgMode("black")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    bgMode === "black" ? "bg-violet-600 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                  }`}>{t.bgBlack}</button>
              </div>
            </div>
            {/* Effects */}
            <div>
              <p className="text-[10px] text-zinc-500 font-bold mb-1">{t.effects}</p>
              <div className="flex gap-2 mb-2">
                {/* Vignette toggle */}
                <button onClick={() => setVignetteOn(v => !v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    vignetteOn ? "bg-violet-600 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                  }`}>{t.vignette}</button>
                {/* Particles toggle */}
                <button onClick={() => setParticlesOn(v => !v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    particlesOn ? "bg-violet-600 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                  }`}>{t.particles}</button>
              </div>
              {/* Letterbox */}
              <p className="text-[10px] text-zinc-500 font-bold mb-1">{t.letterbox}</p>
              <div className="flex gap-2">
                {(["none", "thin", "thick"] as const).map(lb => (
                  <button key={lb} onClick={() => setLetterbox(lb)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                      letterbox === lb ? "bg-violet-600 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                    }`}>
                    {lb === "none" ? t.letterboxNone : lb === "thin" ? t.letterboxThin : t.letterboxThick}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ACTION BUTTONS ─── */}
        <div className="w-full space-y-2">
          {/* MAKE SHORT — the ONE button */}
          {phase === "preview" && (
            <button
              onClick={handleExport}
              disabled={captionEnabled && (captionPhase === "extracting" || captionPhase === "transcribing")}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 hover:from-violet-500 hover:via-purple-500 hover:to-blue-500 text-white font-black text-base flex items-center justify-center gap-2.5 transition shadow-xl shadow-violet-500/20 hover:shadow-violet-500/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={20} /> {t.makeShort}
            </button>
          )}

          {/* Download + YouTube */}
          {phase === "done" && exportBlob && (
            <>
              <button
                onClick={handleDownload}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black text-base flex items-center justify-center gap-2.5 transition shadow-xl shadow-green-500/20"
              >
                <Download size={20} /> {t.download}
              </button>

              {/* YouTube Direct Upload Section */}
              {ytPhase === "done" && ytVideoId ? (
                <div className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-green-300 dark:border-green-800 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400">
                    <Check size={16} />
                    {t.ytDone}
                  </div>
                  <a
                    href={`https://youtube.com/shorts/${ytVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-red-500/20 hover:from-red-500 hover:to-red-400"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 00.5 6.19 31.6 31.6 0 000 12a31.6 31.6 0 00.5 5.81 3.02 3.02 0 002.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 002.12-2.14A31.6 31.6 0 0024 12a31.6 31.6 0 00-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
                    {t.ytWatch}
                  </a>
                  <a
                    href="https://studio.youtube.com/channel/UC/videos/shorts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs flex items-center justify-center gap-2 transition hover:bg-zinc-300 dark:hover:bg-zinc-700"
                  >
                    YouTube Studio에서 확인
                  </a>
                  {ytUploadStatus && (
                    <p className="text-[10px] text-zinc-500 text-center font-mono">
                      Status: {ytUploadStatus} | Video ID: {ytVideoId}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
                    YouTube가 영상을 처리 중일 수 있습니다 (수 분 소요).<br/>
                    <strong>YouTube Studio &gt; 콘텐츠</strong>에서 업로드 상태를 확인하세요.<br/>
                    비공개(private) 영상은 Studio에서만 보입니다.
                  </p>
                </div>
              ) : ytPhase === "uploading" ? (
                <div className="w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    <Loader2 size={14} className="animate-spin text-red-500" />
                    {t.ytUploading}
                  </div>
                  <div className="h-2 bg-zinc-300 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(3, ytProgress * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 text-center font-bold">{Math.round(ytProgress * 100)}%</p>
                </div>
              ) : (
                <div className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
                  {/* Title input */}
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold mb-1 block">{t.ytTitle}</label>
                    <input
                      type="text"
                      value={ytTitle}
                      onChange={e => setYtTitle(e.target.value)}
                      placeholder={t.ytTitlePlaceholder}
                      maxLength={100}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-red-500 transition"
                    />
                  </div>
                  {/* Privacy selector */}
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold mb-1 block">{t.ytPrivacy}</label>
                    <div className="flex gap-1.5">
                      {(["private", "unlisted", "public"] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setYtPrivacy(p)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                            ytPrivacy === p
                              ? "bg-red-600 text-white"
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                          }`}
                        >
                          {p === "private" ? t.ytPrivate : p === "unlisted" ? t.ytUnlisted : t.ytPublic}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Error */}
                  {ytPhase === "error" && ytError && (
                    <p className="text-xs text-red-500 font-bold">{t.ytError}: {ytError}</p>
                  )}
                  {/* Upload button */}
                  <button
                    onClick={handleYoutubeUpload}
                    disabled={ytPhase === "auth"}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-red-500/20 disabled:opacity-50"
                  >
                    {ytPhase === "auth" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 00.5 6.19 31.6 31.6 0 000 12a31.6 31.6 0 00.5 5.81 3.02 3.02 0 002.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 002.12-2.14A31.6 31.6 0 0024 12a31.6 31.6 0 00-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
                    )}
                    {t.ytUpload}
                  </button>
                </div>
              )}

              <p className="text-xs text-zinc-400 text-center">{t.size((exportBlob.size / 1024 / 1024).toFixed(1))}</p>
            </>
          )}

          {/* Reset */}
          {(phase === "preview" || phase === "done") && (
            <button
              onClick={reset}
              className="w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 text-sm font-bold flex items-center justify-center gap-2 transition"
            >
              <RotateCcw size={14} /> {t.again}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-center text-red-500 text-sm font-bold">{error}</p>
      )}
    </div>
  );
}
