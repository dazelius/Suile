/**
 * 주식배틀 효과음 WAV 생성 스크립트
 * Node.js 로 실행: node scripts/generate-sfx.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "sfx");
mkdirSync(outDir, { recursive: true });

const SAMPLE_RATE = 44100;

/** WAV 파일 작성 (16-bit PCM) */
function writeWav(filename, samples) {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * 2; // 16-bit mono
  const blockAlign = 2;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  // fmt
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 30);
  buffer.writeUInt16LE(16, 32);
  // data
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }

  const path = join(outDir, filename);
  writeFileSync(path, buffer);
  console.log(`✓ ${filename} (${(buffer.length / 1024).toFixed(1)} KB, ${(numSamples / SAMPLE_RATE).toFixed(2)}s)`);
}

/** 유틸: 엔벨로프 */
function adsr(t, a, d, s, r, total) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < total - r) return s;
  return s * (1 - (t - (total - r)) / r);
}

/** 유틸: 노이즈 */
function noise() { return Math.random() * 2 - 1; }

/** 유틸: 사인파 */
function sin(phase) { return Math.sin(2 * Math.PI * phase); }

// ════════════════════════════════════════════════
// 1. 카운트다운 비프 (0.15s)
// ════════════════════════════════════════════════
function generateBeep() {
  const dur = 0.15;
  const len = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float64Array(len);
  const freq = 880;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, 0.005, 0.02, 0.6, 0.06, dur);
    // 기본 사인 + 2배 배음 + 3배 배음
    const phase = freq * t;
    const sig = sin(phase) * 0.6 + sin(phase * 2) * 0.2 + sin(phase * 3) * 0.1;
    samples[i] = sig * env * 0.7;
  }
  writeWav("beep.wav", samples);
}

// ════════════════════════════════════════════════
// 1-1. 카운트다운 GO 비프 (0.25s, 더 높고 강렬)
// ════════════════════════════════════════════════
function generateBeepGo() {
  const dur = 0.25;
  const len = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float64Array(len);
  const freq = 1320; // E6

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, 0.003, 0.03, 0.5, 0.12, dur);
    const phase = freq * t;
    const sig = sin(phase) * 0.5 + sin(phase * 2) * 0.25 + sin(phase * 1.5) * 0.15;
    samples[i] = sig * env * 0.8;
  }
  writeWav("beep-go.wav", samples);
}

// ════════════════════════════════════════════════
// 2. 충돌 — 유리 깨짐 + 메탈릭 임팩트 (0.3s)
// ════════════════════════════════════════════════
function generateCrash() {
  const dur = 0.3;
  const len = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float64Array(len);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // 1) 초기 임팩트 (노이즈 버스트, 0~30ms)
    let sig = 0;
    if (t < 0.03) {
      const impEnv = 1 - t / 0.03;
      sig += noise() * impEnv * 0.8;
    }

    // 2) 유리 잔향 (고주파 노이즈, 서서히 감쇠)
    const glassEnv = Math.exp(-t * 20);
    // 밴드패스 효과: 고주파 노이즈만
    const n = noise();
    // 간단한 1-pole 하이패스
    sig += n * glassEnv * 0.3;

    // 3) 메탈릭 링 (여러 비조화 주파수)
    const ringFreqs = [2800, 3700, 4900, 6100];
    const ringEnv = Math.exp(-t * 15);
    for (const f of ringFreqs) {
      sig += sin(f * t) * ringEnv * 0.08;
    }

    // 4) 서브 임팩트 (저주파 펀치)
    if (t < 0.05) {
      const subFreq = 100 * (1 - t / 0.05) + 40;
      const subEnv = 1 - t / 0.05;
      sig += sin(subFreq * t) * subEnv * 0.4;
    }

    samples[i] = Math.max(-1, Math.min(1, sig * 0.7));
  }

  writeWav("crash.wav", samples);
}

// ════════════════════════════════════════════════
// 3. 역전 — 상승 스윕 + 임팩트 (0.35s)
// ════════════════════════════════════════════════
function generateReversal() {
  const dur = 0.35;
  const len = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float64Array(len);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    let sig = 0;

    // 상승 스윕 (300 → 2000 Hz)
    const sweepProgress = Math.min(t / 0.2, 1);
    const sweepFreq = 300 * Math.pow(2000 / 300, sweepProgress);
    const sweepEnv = adsr(t, 0.01, 0.05, 0.7, 0.15, dur);

    // 톱니파 + 사인파 레이어
    const phase = sweepFreq * t;
    const sawVal = 2 * ((phase % 1) - 0.5);
    sig += sawVal * 0.15 * sweepEnv;
    sig += sin(phase) * 0.2 * sweepEnv;

    // 임팩트 (0.15s 부근)
    if (t > 0.12 && t < 0.25) {
      const impT = t - 0.12;
      const impEnv = Math.exp(-impT * 20);
      sig += sin(1200 * t) * impEnv * 0.3;
      sig += noise() * impEnv * 0.15;
    }

    // 꼬리 반짝 (고음 사인)
    if (t > 0.15) {
      const tailEnv = Math.exp(-(t - 0.15) * 10);
      sig += sin(2400 * t) * tailEnv * 0.1;
    }

    samples[i] = Math.max(-1, Math.min(1, sig * 0.8));
  }

  writeWav("reversal.wav", samples);
}

// ════════════════════════════════════════════════
// 4. 위너 팡파레 — 3음 브라스 (0.8s)
// ════════════════════════════════════════════════
function generateFanfare() {
  const dur = 0.9;
  const len = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float64Array(len);

  // C5(523), E5(659), G5(784) 연속 후 코드
  const notes = [
    { freq: 523.25, start: 0, end: 0.2 },
    { freq: 659.25, start: 0.18, end: 0.38 },
    { freq: 783.99, start: 0.35, end: 0.9 },
    // 코드 (마지막에 같이 울림)
    { freq: 523.25, start: 0.55, end: 0.9 },
    { freq: 659.25, start: 0.55, end: 0.9 },
  ];

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    let sig = 0;

    for (const note of notes) {
      if (t < note.start || t > note.end) continue;
      const nt = t - note.start;
      const noteDur = note.end - note.start;
      const env = adsr(nt, 0.015, 0.03, 0.65, 0.08, noteDur);

      const f = note.freq;
      const phase = f * t;

      // 브라스: 기본 삼각파 + 배음들
      const tri = 2 * Math.abs(2 * ((phase % 1) - 0.5)) - 1;
      sig += tri * 0.12 * env;
      sig += sin(phase) * 0.08 * env;
      sig += sin(phase * 2) * 0.04 * env;
      sig += sin(phase * 3) * 0.02 * env;
    }

    // 간단한 리버브 (딜레이 믹스)
    const delayIdx = i - Math.floor(SAMPLE_RATE * 0.03);
    if (delayIdx >= 0) {
      sig += samples[delayIdx] * 0.15;
    }
    const delayIdx2 = i - Math.floor(SAMPLE_RATE * 0.07);
    if (delayIdx2 >= 0) {
      sig += samples[delayIdx2] * 0.08;
    }

    samples[i] = Math.max(-1, Math.min(1, sig));
  }

  writeWav("fanfare.wav", samples);
}

// ── 실행 ──
console.log("🎵 효과음 WAV 생성 중...\n");
generateBeep();
generateBeepGo();
generateCrash();
generateReversal();
generateFanfare();
console.log("\n✅ 모든 효과음 생성 완료! → public/sfx/");
