/**
 * FFmpeg.wasm wrapper — loads FFmpeg from jsdelivr CDN (Cloudflare, fast in Asia)
 * to completely bypass Turbopack/bundler analysis.
 *
 * KEY: core JS + WASM are loaded via direct CDN URLs (NOT blob URLs)
 * so that import.meta.url inside core JS correctly resolves the WASM file.
 * Only the Worker script is wrapped in a thin blob to avoid SecurityError
 * from cross-origin Worker creation.
 */
import type { ExportOptions, ExtractedFrame } from "./types";

/* jsdelivr CDN — Cloudflare-backed, fast worldwide including Korea */
const FFMPEG_CDN = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm";
const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
const WORKER_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadingPromise: Promise<any> | null = null;

async function getFFmpeg() {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    console.log("[FF] 1/4 Importing FFmpeg class from CDN...");
    const { FFmpeg } = await import(/* webpackIgnore: true */ FFMPEG_CDN);
    console.log("[FF] 2/4 FFmpeg class ready");

    const ff = new FFmpeg();

    // Thin blob wrapper that re-exports the CDN worker as a module.
    // This avoids SecurityError (cross-origin Worker) while keeping
    // the real worker's relative-import resolution intact.
    const classWorkerURL = URL.createObjectURL(
      new Blob([`import "${WORKER_URL}";`], { type: "text/javascript" })
    );

    console.log("[FF] 3/4 Loading WASM core (~31 MB, first run only)...");
    try {
      await ff.load({
        coreURL: `${CORE_BASE}/ffmpeg-core.js`,
        wasmURL: `${CORE_BASE}/ffmpeg-core.wasm`,
        classWorkerURL,
      });
    } catch (e) {
      console.error("[FF] ff.load() error:", e);
      throw e;
    }
    console.log("[FF] 4/4 ✅ Ready!");

    ffmpegInstance = ff;
    return ff;
  })();

  loadingPromise.catch(() => { loadingPromise = null; }); // allow retry on failure
  return loadingPromise;
}

/** Start pre-loading FFmpeg in background (call early, don't await) */
export function preloadFFmpeg(): void {
  getFFmpeg().catch(() => {});
}

/* ══════════════════════════════════════════════
   Combined audio + frames extraction (single file read)
   ══════════════════════════════════════════════ */

export interface AnalysisResult {
  audio: Uint8Array | null;
  frames: ExtractedFrame[];
}

/**
 * Extract audio AND key frames in one pass.
 * onStep callback reports current step for UI progress.
 */
export async function analyzeVideo(
  videoFile: File,
  trimEnd: number,
  frameInterval: number = 8,
  onStep?: (step: "engine" | "read" | "audio" | "frames" | "done") => void,
): Promise<AnalysisResult> {
  onStep?.("engine");
  const ff = await getFFmpeg();
  const ext = videoFile.name.split(".").pop()?.toLowerCase() ?? "mp4";
  const inFile = `analyze_in.${ext}`;

  // Write input file ONCE
  onStep?.("read");
  const buf = await videoFile.arrayBuffer();
  await ff.writeFile(inFile, new Uint8Array(buf));

  // ── Extract audio ──
  onStep?.("audio");
  let audio: Uint8Array | null = null;
  const audioOut = "analyze_audio.webm";
  try {
    await ff.exec([
      "-i", inFile,
      "-t", trimEnd.toFixed(3),
      "-vn",
      "-acodec", "libopus",
      "-b:a", "48k",
      "-ac", "1",
      "-ar", "16000",
      "-y",
      audioOut,
    ]);
    const d = await ff.readFile(audioOut);
    audio = new Uint8Array(d as Uint8Array);
    await ff.deleteFile(audioOut);
  } catch {
    // no audio track — ok
  }

  // ── Extract all frames in ONE call via fps filter ──
  onStep?.("frames");
  const frames: ExtractedFrame[] = [];
  const fpsRate = `1/${frameInterval}`;
  try {
    // outputs frame_0001.jpg, frame_0002.jpg, ...
    await ff.exec([
      "-i", inFile,
      "-t", trimEnd.toFixed(3),
      "-vf", `fps=${fpsRate},scale=320:-2`,
      "-q:v", "12",
      "-y",
      "af_%04d.jpg",
    ]);

    // collect output frames
    const maxFrames = Math.min(Math.ceil(trimEnd / frameInterval), 8);
    for (let i = 1; i <= maxFrames; i++) {
      const fname = `af_${String(i).padStart(4, "0")}.jpg`;
      try {
        const d = await ff.readFile(fname);
        frames.push({
          time: (i - 1) * frameInterval,
          data: new Uint8Array(d as Uint8Array),
        });
        await ff.deleteFile(fname);
      } catch {
        break; // no more frames
      }
    }
  } catch {
    // frame extraction failed entirely
  }

  await ff.deleteFile(inFile);
  onStep?.("done");
  return { audio, frames };
}

/* ── Legacy single-purpose exports (kept for compatibility) ── */

export async function extractAudio(
  videoFile: File,
  trimEnd: number,
): Promise<Uint8Array> {
  const result = await analyzeVideo(videoFile, trimEnd);
  if (!result.audio) throw new Error("No audio track");
  return result.audio;
}

export async function extractFrames(
  videoFile: File,
  trimEnd: number,
  intervalSec: number = 8,
): Promise<ExtractedFrame[]> {
  const result = await analyzeVideo(videoFile, trimEnd, intervalSec);
  return result.frames;
}

/* ── Timeout helper ── */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${label} took >${ms / 1000}s`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/* ══════════════════════════════════════════════════════════════
   Export video — full pipeline
   ══════════════════════════════════════════════════════════════
   What FFmpeg handles:
     ✓ Trim (start/end)
     ✓ Crop (normalized region)
     ✓ Scale to 9:16 output
     ✓ Letterbox (black bars top/bottom)
     ✓ Vignette
     ✓ Fade-in (0.5s black) / Fade-out (0.6s black)
     ✓ BGM mixing with original audio
     ✓ Quality presets

   What is canvas-preview ONLY (no font support in FFmpeg.wasm):
     ✗ Captions / Watermark / Intro-Outro text
     ✗ Particles
   ══════════════════════════════════════════════════════════════ */

export async function exportVideo(opts: ExportOptions): Promise<Blob> {
  console.log("[Export] Starting...");
  const ff = await withTimeout(getFFmpeg(), 120_000, "FFmpeg load");
  console.log("[Export] FFmpeg ready");

  // Logging & progress
  try {
    ff.on("log", ({ message }: { message: string }) => console.log("[FF]", message));
    ff.on("progress", ({ progress: p }: { progress: number }) => {
      opts.onProgress?.(Math.min(1, Math.max(0, isNaN(p) ? 0 : p)));
    });
  } catch { /* ignore */ }

  const ext = opts.inputName.split(".").pop()?.toLowerCase() ?? "mp4";
  const inFile = `in.${ext}`;
  const outFile = "out.mp4";
  const duration = opts.trimEnd - opts.trimStart;

  // Write input files
  console.log("[Export] Writing input:", opts.inputData.length, "bytes");
  await ff.writeFile(inFile, opts.inputData);
  if (opts.bgmData) {
    console.log("[Export] Writing BGM:", opts.bgmData.length, "bytes");
    await ff.writeFile("bgm.mp3", opts.bgmData);
  }

  /* ── Build video filter chain ── */
  const vParts: string[] = [];

  // 1) Crop (normalized 0-1 values → FFmpeg expressions)
  if (opts.cropW < 0.999 || opts.cropH < 0.999 || opts.cropX > 0.001 || opts.cropY > 0.001) {
    vParts.push(
      `crop=iw*${opts.cropW.toFixed(4)}:ih*${opts.cropH.toFixed(4)}:iw*${opts.cropX.toFixed(4)}:ih*${opts.cropY.toFixed(4)}`
    );
  }

  // 2) Scale to output size
  vParts.push(`scale=${opts.outW}:${opts.outH}:force_original_aspect_ratio=disable`);

  // 3) Letterbox (black bars)
  const lbr = opts.letterboxRatio ?? 0;
  if (lbr > 0) {
    const barH = Math.max(1, Math.round(opts.outH * lbr));
    vParts.push(`drawbox=x=0:y=0:w=iw:h=${barH}:c=black:t=fill`);
    vParts.push(`drawbox=x=0:y=ih-${barH}:w=iw:h=${barH}:c=black:t=fill`);
  }

  // 4) Vignette
  if (opts.vignette) {
    vParts.push("vignette=PI/4");
  }

  // 5) Fade in (0.5s) / Fade out (0.6s)
  vParts.push("fade=t=in:d=0.5");
  if (duration > 1.2) {
    vParts.push(`fade=t=out:st=${(duration - 0.6).toFixed(3)}:d=0.6`);
  }

  const vf = vParts.join(",");

  /* ── Quality ── */
  const crf = opts.quality === "high" ? 23 : opts.quality === "medium" ? 28 : 33;
  const preset = "ultrafast";

  const ENCODE_TIMEOUT = 300_000; // 5 min
  let ret: number;

  if (opts.bgmData) {
    /* ── With BGM: use filter_complex for audio mixing ── */
    const bgmVol = (opts.bgmVolume ?? 0.2).toFixed(2);
    const trimDur = duration.toFixed(3);

    // Attempt 1: mix original audio + BGM
    console.log("[Export] Encoding with BGM + original audio mix...");
    const mixFC = [
      `[0:v]${vf}[v]`,
      `[0:a]anull[oa]`,
      `[1:a]atrim=0:${trimDur},asetpts=PTS-STARTPTS,volume=${bgmVol}[ba]`,
      `[oa][ba]amix=inputs=2:duration=first[a]`,
    ].join(";");

    ret = await withTimeout(ff.exec([
      "-ss", opts.trimStart.toFixed(3), "-i", inFile,
      "-i", "bgm.mp3", "-t", trimDur,
      "-filter_complex", mixFC,
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", preset, "-crf", crf.toString(),
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart", "-y", outFile,
    ]), ENCODE_TIMEOUT, "FFmpeg encode (mix)");

    if (ret !== 0) {
      // Attempt 2: no original audio — BGM only
      console.log("[Export] Mix failed (no audio track?), retrying BGM-only...");
      const bgmFC = [
        `[0:v]${vf}[v]`,
        `[1:a]atrim=0:${trimDur},asetpts=PTS-STARTPTS,volume=${bgmVol}[a]`,
      ].join(";");

      ret = await withTimeout(ff.exec([
        "-ss", opts.trimStart.toFixed(3), "-i", inFile,
        "-i", "bgm.mp3", "-t", trimDur,
        "-filter_complex", bgmFC,
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", preset, "-crf", crf.toString(),
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "-y", outFile,
      ]), ENCODE_TIMEOUT, "FFmpeg encode (bgm only)");
    }
  } else {
    /* ── No BGM: simple encode ── */
    console.log("[Export] Encoding (no BGM)...");
    ret = await withTimeout(ff.exec([
      "-ss", opts.trimStart.toFixed(3), "-i", inFile,
      "-t", duration.toFixed(3), "-vf", vf,
      "-c:v", "libx264", "-preset", preset, "-crf", crf.toString(),
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart", "-y", outFile,
    ]), ENCODE_TIMEOUT, "FFmpeg encode");

    if (ret !== 0) {
      // Possibly no audio stream — retry without audio
      console.log("[Export] Encode failed, retrying without audio...");
      ret = await withTimeout(ff.exec([
        "-ss", opts.trimStart.toFixed(3), "-i", inFile,
        "-t", duration.toFixed(3), "-vf", vf,
        "-c:v", "libx264", "-preset", preset, "-crf", crf.toString(),
        "-pix_fmt", "yuv420p", "-an",
        "-movflags", "+faststart", "-y", outFile,
      ]), ENCODE_TIMEOUT, "FFmpeg encode (no audio)");
    }
  }

  if (ret !== 0) {
    try { await ff.deleteFile(inFile); } catch { /* */ }
    if (opts.bgmData) try { await ff.deleteFile("bgm.mp3"); } catch { /* */ }
    throw new Error(`FFmpeg exited with code ${ret}`);
  }

  /* ── Read output ── */
  const data = await ff.readFile(outFile);
  console.log("[Export] Done! Output:", (data as Uint8Array).length, "bytes");

  /* ── Cleanup ── */
  await ff.deleteFile(inFile);
  await ff.deleteFile(outFile);
  if (opts.bgmData) try { await ff.deleteFile("bgm.mp3"); } catch { /* */ }

  return new Blob([new Uint8Array(data as Uint8Array)], { type: "video/mp4" });
}

/* ══════════════════════════════════════════════════════════════
   Encode pre-rendered canvas frames → final video
   ══════════════════════════════════════════════════════════════
   This is the WYSIWYG export pipeline:
   1) Canvas frames (JPEG) with ALL visual effects burned in
   2) FFmpeg encodes image sequence → H.264 video
   3) Audio from original video + optional BGM mixed in
   ══════════════════════════════════════════════════════════════ */

export interface EncodeFramesOptions {
  frames: Uint8Array[];
  fps: number;
  originalVideo?: Uint8Array;
  originalName?: string;
  trimStart: number;
  duration: number;
  bgmData?: Uint8Array;
  bgmVolume?: number;
  quality: "high" | "medium" | "low";
  onProgress?: (ratio: number) => void;
}

export async function encodeFrames(opts: EncodeFramesOptions): Promise<Blob> {
  console.log("[Encode] Starting with", opts.frames.length, "frames @", opts.fps, "fps");
  const ff = await withTimeout(getFFmpeg(), 120_000, "FFmpeg load");

  try {
    ff.on("log", ({ message }: { message: string }) => console.log("[FF]", message));
    ff.on("progress", ({ progress: p }: { progress: number }) => {
      opts.onProgress?.(Math.min(1, Math.max(0, isNaN(p) ? 0 : p)));
    });
  } catch { /* ignore */ }

  const crf = opts.quality === "high" ? 23 : opts.quality === "medium" ? 28 : 33;
  const TIMEOUT = 300_000;

  // 1. Write all frames to virtual FS
  console.log("[Encode] Writing", opts.frames.length, "frames to FS...");
  for (let i = 0; i < opts.frames.length; i++) {
    await ff.writeFile(`f_${String(i + 1).padStart(5, "0")}.jpg`, opts.frames[i]);
  }

  // 2. Encode image sequence → video (no audio)
  console.log("[Encode] Encoding image sequence...");
  let ret = await withTimeout(ff.exec([
    "-framerate", opts.fps.toString(),
    "-i", "f_%05d.jpg",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", crf.toString(),
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-y", "vid.mp4",
  ]), TIMEOUT, "Image sequence encode");

  if (ret !== 0) {
    await cleanupFrameFiles(ff, opts.frames.length);
    throw new Error(`Image sequence encode failed: ${ret}`);
  }

  // 3. Mux audio (original ± BGM) — uses -c:v copy so no re-encode
  let finalFile = "vid.mp4";
  const dur = opts.duration.toFixed(3);
  const ext = (opts.originalName || "mp4").split(".").pop()?.toLowerCase() ?? "mp4";

  if (opts.originalVideo) await ff.writeFile(`orig.${ext}`, opts.originalVideo);
  if (opts.bgmData) await ff.writeFile("bgm.mp3", opts.bgmData);

  if (opts.originalVideo && opts.bgmData) {
    // Mix original audio + BGM
    const bgmVol = (opts.bgmVolume ?? 0.2).toFixed(2);
    const mixFC = [
      `[1:a]anull[oa]`,
      `[2:a]atrim=0:${dur},asetpts=PTS-STARTPTS,volume=${bgmVol}[ba]`,
      `[oa][ba]amix=inputs=2:duration=first[a]`,
    ].join(";");

    ret = await withTimeout(ff.exec([
      "-i", "vid.mp4",
      "-ss", opts.trimStart.toFixed(3), "-i", `orig.${ext}`,
      "-i", "bgm.mp3",
      "-t", dur,
      "-filter_complex", mixFC,
      "-map", "0:v", "-map", "[a]",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart", "-y", "final.mp4",
    ]), TIMEOUT, "Audio mix");

    if (ret !== 0) {
      // Fallback: BGM only (no original audio in video)
      console.log("[Encode] Mix failed, trying BGM only...");
      ret = await withTimeout(ff.exec([
        "-i", "vid.mp4", "-i", "bgm.mp3",
        "-t", dur,
        "-map", "0:v", "-map", "1:a",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest",
        "-movflags", "+faststart", "-y", "final.mp4",
      ]), TIMEOUT, "BGM only");
    }
    if (ret === 0) finalFile = "final.mp4";
  } else if (opts.originalVideo) {
    // Original audio only
    ret = await withTimeout(ff.exec([
      "-i", "vid.mp4",
      "-ss", opts.trimStart.toFixed(3), "-i", `orig.${ext}`,
      "-t", dur,
      "-map", "0:v", "-map", "1:a",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart", "-y", "final.mp4",
    ]), TIMEOUT, "Audio copy");
    if (ret === 0) finalFile = "final.mp4";
  } else if (opts.bgmData) {
    // BGM only
    ret = await withTimeout(ff.exec([
      "-i", "vid.mp4", "-i", "bgm.mp3",
      "-t", dur,
      "-map", "0:v", "-map", "1:a",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest",
      "-movflags", "+faststart", "-y", "final.mp4",
    ]), TIMEOUT, "BGM");
    if (ret === 0) finalFile = "final.mp4";
  }

  // 4. Read output
  const data = await ff.readFile(finalFile);
  console.log("[Encode] Done!", (data as Uint8Array).length, "bytes");

  // 5. Cleanup
  await cleanupFrameFiles(ff, opts.frames.length);
  for (const f of ["vid.mp4", "final.mp4", `orig.${ext}`, "bgm.mp3"]) {
    try { await ff.deleteFile(f); } catch { /* */ }
  }

  return new Blob([new Uint8Array(data as Uint8Array)], { type: "video/mp4" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cleanupFrameFiles(ff: any, count: number) {
  const batch = [];
  for (let i = 0; i < count; i++) {
    batch.push(ff.deleteFile(`f_${String(i + 1).padStart(5, "0")}.jpg`).catch(() => {}));
  }
  await Promise.all(batch);
}
