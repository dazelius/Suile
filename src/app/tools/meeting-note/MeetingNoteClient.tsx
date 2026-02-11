"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Mic,
  MicOff,
  Loader2,
  Copy,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  Users,
  ListChecks,
  FileText,
  Tag,
  AlertCircle,
  ExternalLink,
  Upload,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

// ── 타입 ──
interface ActionItem {
  who: string;
  what: string;
  deadline: string;
}

interface MeetingResult {
  title: string;
  summary: string;
  actionItems: ActionItem[];
  decisions: string[];
  followUps: string[];
  keywords: string[];
  duration: string;
}

type Phase = "idle" | "recording" | "uploading" | "editing" | "analyzing" | "result";

const API_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/meetingAi";
const TRANSCRIBE_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/transcribeAudio";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ACCEPTED_AUDIO = ".mp3,.wav,.m4a,.webm,.ogg,.aac,.flac,.mp4";
const EXPORT_API_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/exportGoogleDoc";

const GOOGLE_CLIENT_ID = "860732393806-ppvqgivj0s0tjesj9ed1aianc6rjh3sh.apps.googleusercontent.com";

const GOOGLE_SCOPES =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents";

// ── Google Identity Services 타입 ──
interface TokenResponse {
  access_token?: string;
  error?: string;
}

interface TokenClient {
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
            callback: (response: TokenResponse) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

type ExportState = "idle" | "loading" | "success" | "error";

// ── Web Speech API 타입 ──
interface SpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function isSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

function createRecognition(lang: string): SpeechRecognitionInstance | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return null;
  const recognition: SpeechRecognitionInstance = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = lang;
  return recognition;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ══════════════════════════════════════════════
// 로컬라이즈 텍스트
// ══════════════════════════════════════════════
const L = {
  ko: {
    title: "회의록 AI 정리",
    subtitle: "녹음하면 실시간 텍스트 변환 → AI가 자동으로 정리합니다",
    unsupported: "이 브라우저에서는 음성 인식을 지원하지 않습니다",
    unsupportedHint: "Chrome 또는 Edge 브라우저를 사용해주세요",
    idleDesc: "실시간 녹음 또는 음성 파일을 업로드하세요",
    idleHint: "AI가 자동으로 텍스트 변환 후 정리합니다",
    liveRecord: "실시간 녹음",
    or: "또는",
    uploadFile: "음성 파일 업로드",
    fileHint: "mp3, wav, m4a, webm 등 · 최대 25MB",
    uploading: "AI가 음성을 텍스트로 변환하고 있습니다...",
    uploadingHint: "파일 길이에 따라 1~2분 소요될 수 있습니다",
    recording: "녹음 중",
    recordPlaceholder: "말씀하시면 여기에 텍스트가 나타납니다...",
    stopRecord: "녹음 중지",
    transcribedText: (n: number) => `전사된 텍스트 (${n}자)`,
    recordTime: (t: string) => `녹음 시간: ${t}`,
    editPlaceholder: "텍스트를 수정할 수 있습니다...",
    editHint: "AI 정리 전에 텍스트를 확인하고 수정할 수 있습니다",
    reRecord: "다시 녹음",
    analyzeAI: "AI 정리하기",
    analyzing: "AI가 회의록을 정리하고 있습니다...",
    analyzingHint: "요약, 액션 아이템, 결정사항을 추출하고 있어요",
    summaryTitle: "핵심 요약",
    actionItems: "액션 아이템",
    deadline: "기한",
    decisions: "결정사항",
    followUps: "후속조치",
    originalText: "원본 텍스트",
    exportDocs: "Google Docs로 내보내기",
    audioAttachNote: "녹음 파일이 Google Drive에 함께 첨부됩니다",
    exporting: "Google Docs 문서 생성 중...",
    exportSuccess: "Google Docs에 저장되었습니다!",
    openDoc: "문서 열기",
    retry: "다시 시도",
    newMeeting: "새 회의",
    copied: "복사됨!",
    copyAll: "전체 복사",
    // copy format
    copySummary: "핵심 요약",
    copyAction: "액션 아이템",
    copyDeadline: "기한",
    copyDecisions: "결정사항",
    copyFollowUps: "후속조치",
    copyKeywords: "키워드",
    copyDuration: "소요 시간",
    // errors
    errUnsupported: "이 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.",
    errMicDenied: "마이크 접근이 거부되었습니다. 브라우저 설정에서 마이크를 허용해주세요.",
    errStartFail: "음성 인식을 시작할 수 없습니다.",
    errNoText: "녹음된 텍스트가 없습니다. 마이크 가까이에서 다시 시도해주세요.",
    errAnalyze: "AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.",
    errFileSize: "파일 크기가 25MB를 초과합니다. 더 짧은 음성 파일을 사용해주세요.",
    errTranscribe: "음성 전사에 실패했습니다. 다시 시도해주세요.",
    errGoogleCancel: "Google 로그인이 취소되었습니다.",
    errAuthExpired: "인증이 만료되었습니다. 다시 시도해주세요.",
    errDocCreate: "문서 생성 실패",
    errExportFail: "Google Docs 내보내기에 실패했습니다.",
    errGoogleLoad: "Google 로그인을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.",
    sttLang: "ko-KR",
  },
  en: {
    title: "Meeting Notes AI",
    subtitle: "Record → Real-time transcription → AI organizes automatically",
    unsupported: "Speech recognition is not supported in this browser",
    unsupportedHint: "Please use Chrome or Edge browser",
    idleDesc: "Record live or upload an audio file",
    idleHint: "AI will transcribe and organize automatically",
    liveRecord: "Live Recording",
    or: "or",
    uploadFile: "Upload Audio File",
    fileHint: "mp3, wav, m4a, webm, etc. · max 25MB",
    uploading: "AI is transcribing your audio...",
    uploadingHint: "This may take 1–2 minutes depending on file length",
    recording: "Recording",
    recordPlaceholder: "Speak and text will appear here...",
    stopRecord: "Stop Recording",
    transcribedText: (n: number) => `Transcribed Text (${n} chars)`,
    recordTime: (t: string) => `Duration: ${t}`,
    editPlaceholder: "You can edit the text here...",
    editHint: "Review and edit the text before AI organizes it",
    reRecord: "Re-record",
    analyzeAI: "Organize with AI",
    analyzing: "AI is organizing your meeting notes...",
    analyzingHint: "Extracting summary, action items, and decisions",
    summaryTitle: "Key Summary",
    actionItems: "Action Items",
    deadline: "Deadline",
    decisions: "Decisions",
    followUps: "Follow-ups",
    originalText: "Original Text",
    exportDocs: "Export to Google Docs",
    audioAttachNote: "Audio file will be attached to Google Drive",
    exporting: "Creating Google Doc...",
    exportSuccess: "Saved to Google Docs!",
    openDoc: "Open Document",
    retry: "Retry",
    newMeeting: "New Meeting",
    copied: "Copied!",
    copyAll: "Copy All",
    copySummary: "Key Summary",
    copyAction: "Action Items",
    copyDeadline: "Deadline",
    copyDecisions: "Decisions",
    copyFollowUps: "Follow-ups",
    copyKeywords: "Keywords",
    copyDuration: "Duration",
    errUnsupported: "Speech recognition is not supported. Please use Chrome or Edge.",
    errMicDenied: "Microphone access denied. Please allow microphone in browser settings.",
    errStartFail: "Failed to start speech recognition.",
    errNoText: "No text recorded. Please try again closer to the microphone.",
    errAnalyze: "Error during AI analysis. Please try again.",
    errFileSize: "File exceeds 25MB. Please use a shorter audio file.",
    errTranscribe: "Audio transcription failed. Please try again.",
    errGoogleCancel: "Google sign-in was cancelled.",
    errAuthExpired: "Authentication expired. Please try again.",
    errDocCreate: "Failed to create document",
    errExportFail: "Failed to export to Google Docs.",
    errGoogleLoad: "Cannot load Google sign-in. Please try again later.",
    sttLang: "en-US",
  },
} as const;

// ══════════════════════════════════════════════
// 메인 컴포넌트
// ══════════════════════════════════════════════
export default function MeetingNoteClient() {
  const { locale } = useI18n();
  const t = locale === "ko" ? L.ko : L.en;

  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [error, setError] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [supported] = useState(isSpeechSupported);

  const [exportState, setExportState] = useState<ExportState>("idle");
  const [docUrl, setDocUrl] = useState("");
  const [exportError, setExportError] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");
  const autoRestartRef = useRef(true);
  const tokenClientRef = useRef<TokenClient | null>(null);
  const googleTokenRef = useRef<string>("");
  const pendingExportRef = useRef(false);
  const doExportRef = useRef<(token: string) => void>(() => {});

  const audioBlobRef = useRef<Blob | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [hasAudio, setHasAudio] = useState(false);

  // ── Google Identity Services 로드 ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // ── GIS Token Client 초기화 ──
  const initTokenClient = useCallback(() => {
    if (tokenClientRef.current) return tokenClientRef.current;
    if (!window.google) return null;

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (response: TokenResponse) => {
        if (response.access_token) {
          googleTokenRef.current = response.access_token;
          if (pendingExportRef.current) {
            pendingExportRef.current = false;
            doExportRef.current(response.access_token);
          }
        } else {
          setExportState("error");
          setExportError(t.errGoogleCancel);
        }
      },
    });

    return tokenClientRef.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Google Docs로 내보내기 실행 ──
  const doExport = useCallback(
    async (token: string) => {
      if (!result) return;
      setExportState("loading");
      setExportError("");

      try {
        let audioFileId: string | undefined;

        if (audioBlobRef.current) {
          try {
            const metadata = {
              name: `[Recording] ${result.title}.webm`,
              mimeType: "audio/webm",
            };
            const form = new FormData();
            form.append(
              "metadata",
              new Blob([JSON.stringify(metadata)], {
                type: "application/json",
              })
            );
            form.append("file", audioBlobRef.current);

            const uploadRes = await fetch(
              "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
              {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form,
              }
            );

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              audioFileId = uploadData.id;
            }
          } catch {
            console.log("[Export] Audio upload failed — creating document only");
          }
        }

        const response = await fetch(EXPORT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: token,
            meetingResult: result,
            transcript,
            audioFileId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            googleTokenRef.current = "";
            setExportState("error");
            setExportError(t.errAuthExpired);
            return;
          }
          throw new Error(data.error || t.errDocCreate);
        }

        setDocUrl(data.docUrl);
        setExportState("success");
      } catch (err: unknown) {
        setExportState("error");
        setExportError(
          err instanceof Error ? err.message : t.errExportFail
        );
      }
    },
    [result, transcript, t]
  );

  useEffect(() => {
    doExportRef.current = doExport;
  }, [doExport]);

  const handleExport = useCallback(() => {
    if (googleTokenRef.current) {
      doExport(googleTokenRef.current);
      return;
    }

    const client = initTokenClient();
    if (!client) {
      setExportState("error");
      setExportError(t.errGoogleLoad);
      return;
    }

    pendingExportRef.current = true;
    setExportState("loading");
    client.requestAccessToken();
  }, [doExport, initTokenClient, t]);

  // ── 녹음 시작 ──
  const startRecording = useCallback(() => {
    setError("");
    setTranscript("");
    setInterimText("");
    setElapsed(0);
    setResult(null);
    transcriptRef.current = "";
    autoRestartRef.current = true;
    audioBlobRef.current = null;
    audioChunksRef.current = [];
    setHasAudio(false);

    const recognition = createRecognition(t.sttLang);
    if (!recognition) {
      setError(t.errUnsupported);
      return;
    }

    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const res = event.results[0];
      if (res.isFinal) {
        transcriptRef.current += res[0].transcript + " ";
        setTranscript(transcriptRef.current);
        setInterimText("");
      } else {
        setInterimText(res[0].transcript);
      }
    };

    recognition.onerror = (event) => {
      console.log("[STT] Error:", event.error);
      if (event.error === "not-allowed") {
        setError(t.errMicDenied);
        setPhase("idle");
        autoRestartRef.current = false;
      }
    };

    recognition.onend = () => {
      if (autoRestartRef.current) {
        try {
          recognition.start();
        } catch {
          // already started
        }
      }
    };

    try {
      recognition.start();
      setPhase("recording");

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch {
      setError(t.errStartFail);
    }
  }, [t]);

  // ── 녹음 중지 ──
  const stopRecording = useCallback(() => {
    autoRestartRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setInterimText("");

    if (transcriptRef.current.trim().length > 0) {
      setTranscript(transcriptRef.current);
      setPhase("editing");
    } else {
      setError(t.errNoText);
      setPhase("idle");
    }
  }, [t]);

  // ── AI 정리 요청 ──
  const analyzeWithAI = useCallback(async () => {
    if (!transcript.trim()) return;

    setPhase("analyzing");
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          duration: formatTime(elapsed),
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setResult(data as MeetingResult);
      setPhase("result");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t.errAnalyze
      );
      setPhase("editing");
    }
  }, [transcript, elapsed, t]);

  // ── 복사 ──
  const copyResult = useCallback(async () => {
    if (!result) return;

    const lines = [
      `# ${result.title}`,
      `📅 ${t.copyDuration}: ${result.duration}`,
      "",
      `## ${t.copySummary}`,
      result.summary,
      "",
    ];

    if (result.actionItems.length > 0) {
      lines.push(`## ${t.copyAction}`);
      result.actionItems.forEach((item, i) => {
        lines.push(
          `${i + 1}. [${item.who}] ${item.what}${item.deadline ? ` (${t.copyDeadline}: ${item.deadline})` : ""}`
        );
      });
      lines.push("");
    }

    if (result.decisions.length > 0) {
      lines.push(`## ${t.copyDecisions}`);
      result.decisions.forEach((d) => lines.push(`- ${d}`));
      lines.push("");
    }

    if (result.followUps.length > 0) {
      lines.push(`## ${t.copyFollowUps}`);
      result.followUps.forEach((f) => lines.push(`- ${f}`));
      lines.push("");
    }

    if (result.keywords.length > 0) {
      lines.push(`${t.copyKeywords}: ${result.keywords.join(", ")}`);
    }

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* failed */
    }
  }, [result, t]);

  // ── 파일 업로드 → Gemini 전사 ──
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        setError(t.errFileSize);
        return;
      }

      setError("");
      setPhase("uploading");

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        audioBlobRef.current = file;
        setHasAudio(true);

        const response = await fetch(TRANSCRIBE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: base64,
            mimeType: file.type || "audio/mpeg",
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || t.errTranscribe);
        }

        transcriptRef.current = data.transcript;
        setTranscript(data.transcript);
        setPhase("editing");
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : t.errTranscribe
        );
        setPhase("idle");
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [t]
  );

  // ── 리셋 ──
  const reset = useCallback(() => {
    autoRestartRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase("idle");
    setTranscript("");
    setInterimText("");
    setElapsed(0);
    setResult(null);
    setError("");
    transcriptRef.current = "";
    setExportState("idle");
    setDocUrl("");
    setExportError("");
    audioBlobRef.current = null;
    audioChunksRef.current = [];
    setHasAudio(false);
  }, []);

  // cleanup
  useEffect(() => {
    return () => {
      autoRestartRef.current = false;
      if (recognitionRef.current) recognitionRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-black text-center">{t.title}</h1>
      <p className="text-sm text-zinc-500 text-center">{t.subtitle}</p>

      {/* 브라우저 미지원 */}
      {!supported && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-center space-y-1">
          <AlertCircle className="h-5 w-5 text-amber-500 mx-auto" />
          <p className="text-sm font-bold text-amber-800">{t.unsupported}</p>
          <p className="text-xs text-amber-600">{t.unsupportedHint}</p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 text-center">
          {error}
        </div>
      )}

      {/* ══ 1. 대기 ══ */}
      {phase === "idle" && supported && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center">
              <Mic className="h-14 w-14 text-violet-500" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm text-zinc-600">{t.idleDesc}</p>
            <p className="text-xs text-zinc-400">{t.idleHint}</p>
          </div>
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <button
              onClick={startRecording}
              className="w-full px-8 py-3 bg-violet-600 text-white rounded-full text-sm font-bold hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
            >
              <Mic className="h-4 w-4" />
              {t.liveRecord}
            </button>

            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-px bg-zinc-200" />
              <span className="text-xs text-zinc-400">{t.or}</span>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>

            <label className="w-full px-8 py-3 border-2 border-dashed border-zinc-300 text-zinc-600 rounded-full text-sm font-bold hover:border-violet-400 hover:text-violet-600 transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              {t.uploadFile}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_AUDIO}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <p className="text-[10px] text-zinc-400">{t.fileHint}</p>
          </div>
        </div>
      )}

      {/* ══ 1.5 파일 업로드 중 ══ */}
      {phase === "uploading" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-violet-100 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            </div>
          </div>
          <p className="text-sm font-bold text-zinc-700">{t.uploading}</p>
          <p className="text-xs text-zinc-400">{t.uploadingHint}</p>
        </div>
      )}

      {/* ══ 2. 녹음 중 ══ */}
      {phase === "recording" && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full bg-red-500"
                  style={{ animation: "pulse 1s ease-in-out infinite" }}
                />
                <span className="text-sm font-bold text-red-700">
                  {t.recording}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-red-600 font-mono font-bold">
                <Clock className="h-4 w-4" />
                {formatTime(elapsed)}
              </div>
            </div>

            <div className="flex items-center justify-center gap-0.5 mt-3 h-8">
              {Array.from({ length: 30 }, (_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-400 rounded-full"
                  style={{
                    animation: `waveBar 0.8s ease-in-out ${i * 0.05}s infinite alternate`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
            {transcript || interimText ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                <span className="text-zinc-800">{transcript}</span>
                {interimText && (
                  <span className="text-zinc-400">{interimText}</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-zinc-300 text-center mt-16">
                {t.recordPlaceholder}
              </p>
            )}
          </div>

          <div className="flex justify-center">
            <button
              onClick={stopRecording}
              className="px-8 py-3 bg-red-500 text-white rounded-full text-sm font-bold hover:bg-red-600 transition-colors flex items-center gap-2 shadow-lg"
            >
              <MicOff className="h-4 w-4" />
              {t.stopRecord}
            </button>
          </div>
        </div>
      )}

      {/* ══ 3. 텍스트 편집 ══ */}
      {phase === "editing" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-zinc-700">
              {t.transcribedText(transcript.length)}
            </p>
            <p className="text-xs text-zinc-400">
              {t.recordTime(formatTime(elapsed))}
            </p>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              transcriptRef.current = e.target.value;
            }}
            className="w-full border rounded-xl p-4 text-sm leading-relaxed min-h-[200px] max-h-[400px] resize-y focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300"
            placeholder={t.editPlaceholder}
          />

          <p className="text-[10px] text-zinc-400">{t.editHint}</p>

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 py-3 border rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t.reRecord}
            </button>
            <button
              onClick={analyzeWithAI}
              disabled={!transcript.trim()}
              className="flex-1 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-200"
            >
              <Sparkles className="h-4 w-4" />
              {t.analyzeAI}
            </button>
          </div>
        </div>
      )}

      {/* ══ 4. 분석 중 ══ */}
      {phase === "analyzing" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-violet-100 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            </div>
          </div>
          <p className="text-sm font-bold text-zinc-700">{t.analyzing}</p>
          <p className="text-xs text-zinc-400">{t.analyzingHint}</p>
        </div>
      )}

      {/* ══ 5. 결과 ══ */}
      {phase === "result" && result && (
        <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <h2 className="text-lg font-black text-zinc-900">
              {result.title}
            </h2>
            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {result.duration}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {result.keywords.join(", ")}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-violet-500" />
              <h3 className="text-sm font-bold text-zinc-800">
                {t.summaryTitle}
              </h3>
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed">
              {result.summary}
            </p>
          </div>

          {result.actionItems.length > 0 && (
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-zinc-800">
                  {t.actionItems} ({result.actionItems.length})
                </h3>
              </div>
              <div className="space-y-2">
                {result.actionItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl"
                  >
                    <div className="w-5 h-5 mt-0.5 rounded border-2 border-emerald-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-800">
                        <span className="font-bold text-emerald-700">
                          [{item.who}]
                        </span>{" "}
                        {item.what}
                      </p>
                      {item.deadline && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {t.deadline}: {item.deadline}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.decisions.length > 0 && (
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Check className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-zinc-800">
                  {t.decisions}
                </h3>
              </div>
              <ul className="space-y-1.5">
                {result.decisions.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-zinc-700"
                  >
                    <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.followUps.length > 0 && (
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-zinc-800">
                  {t.followUps}
                </h3>
              </div>
              <ul className="space-y-1.5">
                {result.followUps.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-zinc-700"
                  >
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors"
            >
              <span className="text-sm font-bold text-zinc-500">
                {t.originalText}
              </span>
              {showOriginal ? (
                <ChevronUp className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              )}
            </button>
            {showOriginal && (
              <div className="px-5 pb-4 border-t">
                <p className="text-xs text-zinc-500 leading-relaxed mt-3 whitespace-pre-wrap">
                  {transcript}
                </p>
              </div>
            )}
          </div>

          {/* Google Docs 내보내기 */}
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            {exportState === "idle" && (
              <div className="space-y-2">
                <button
                  onClick={handleExport}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                    <path d="M8 12h8v1.5H8zM8 15h5v1.5H8z"/>
                  </svg>
                  {t.exportDocs}
                </button>
                {hasAudio && (
                  <p className="text-xs text-blue-500 text-center flex items-center justify-center gap-1">
                    <Mic className="h-3 w-3" />
                    {t.audioAttachNote}
                  </p>
                )}
              </div>
            )}

            {exportState === "loading" && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-blue-600 font-bold">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.exporting}
              </div>
            )}

            {exportState === "success" && docUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700 font-bold">
                  <Check className="h-4 w-4" />
                  {t.exportSuccess}
                </div>
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t.openDoc}
                </a>
              </div>
            )}

            {exportState === "error" && (
              <div className="space-y-2">
                <p className="text-sm text-red-600 text-center">{exportError}</p>
                <button
                  onClick={() => {
                    setExportState("idle");
                    setExportError("");
                  }}
                  className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors"
                >
                  {t.retry}
                </button>
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 py-3 border rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t.newMeeting}
            </button>
            <button
              onClick={copyResult}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  {t.copied}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {t.copyAll}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes waveBar {
          0% { height: 4px; }
          100% { height: 28px; }
        }
      `}</style>
    </div>
  );
}
