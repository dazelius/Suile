/**
 * 주식배틀 효과음 — WAV 파일 기반 재생
 * public/sfx/ 에 있는 WAV 파일을 로드하여 AudioBuffer 로 디코딩 후 재생
 */

let ctx: AudioContext | null = null;

const buffers: Record<string, AudioBuffer | null> = {
  beep: null,
  "beep-go": null,
  crash: null,
  reversal: null,
  fanfare: null,
};

let loaded = false;

/** AudioContext 초기화 + WAV 프리로드 (사용자 인터랙션 후 호출) */
export async function initAudio() {
  if (ctx && loaded) return;

  if (!ctx) {
    ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
  }
  if (ctx.state === "suspended") await ctx.resume();

  // 병렬 로드
  const names = Object.keys(buffers) as (keyof typeof buffers)[];
  await Promise.all(
    names.map(async (name) => {
      try {
        const res = await fetch(`/sfx/${name}.wav`);
        const ab = await res.arrayBuffer();
        buffers[name] = await ctx!.decodeAudioData(ab);
      } catch (e) {
        console.warn(`[sfx] ${name}.wav 로드 실패:`, e);
      }
    })
  );
  loaded = true;
}

function play(name: keyof typeof buffers, volume = 1) {
  if (!ctx || !buffers[name]) return;
  if (ctx.state === "suspended") ctx.resume();

  const source = ctx.createBufferSource();
  source.buffer = buffers[name]!;

  const gain = ctx.createGain();
  gain.gain.value = volume;

  source.connect(gain).connect(ctx.destination);
  source.start(0);
}

// ── 1. 카운트다운 비프 ──
export function playBeep(isLast = false) {
  play(isLast ? "beep-go" : "beep", isLast ? 0.9 : 0.7);
}

// ── 2. 충돌 (그래프 교차) ──
export function playCrash() {
  play("crash", 0.8);
}

// ── 3. 역전 ──
export function playReversal() {
  play("reversal", 0.85);
}

// ── 4. 위너 팡파레 ──
export function playFanfare() {
  play("fanfare", 0.9);
}
