/** Shared types for the short-form editor — no ffmpeg dependency */

export interface CaptionEntry {
  start: number;
  end: number;
  text: string;
}

export interface ExtractedFrame {
  /** timestamp in seconds */
  time: number;
  /** JPEG data */
  data: Uint8Array;
}

export interface ExportOptions {
  inputData: Uint8Array;
  inputName: string;
  trimStart: number;
  trimEnd: number;
  /** crop region within original video (0-1 normalized) */
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  /** output resolution */
  outW: number;
  outH: number;
  /** legacy text overlays (kept for compatibility) */
  texts: {
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    bgColor?: string;
    startTime: number;
    endTime: number;
  }[];
  /** AI-generated captions with timestamps */
  captions?: CaptionEntry[];
  /** BGM audio file data */
  bgmData?: Uint8Array;
  /** BGM volume relative to original (0-1, default 0.2) */
  bgmVolume?: number;
  /** Watermark text (e.g. "suile.im") — shown always, center */
  watermark?: string;
  /** Intro title (shown in intro animation) */
  introTitle?: string;
  /** Outro text (shown in outro animation) */
  outroText?: string;
  /** Vignette effect */
  vignette?: boolean;
  /** Letterbox bar ratio (0 = none) */
  letterboxRatio?: number;
  quality: "high" | "medium" | "low";
  onProgress?: (ratio: number) => void;
}
