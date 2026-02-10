/**
 * 블라인드 메시지 카드 이미지 생성기
 *
 * Canvas API로 다크 테마 카드 이미지를 생성합니다.
 * - 잠금 아이콘 + 헤더
 * - "제가 하고 싶은 말은..."
 * - 블라인드 처리된 메시지 (■■■■ ■■■) — 대형 텍스트
 * - 하단 SUILE 브랜딩
 */

interface CardOptions {
  from: string;
  to: string;
  message: string;
}

const CARD_WIDTH = 600;
const RADIUS = 20;
const FONT =
  "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

/** 둥근 모서리 사각형 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 메시지를 블라인드 처리: 약 20%만 원본 노출, 나머지 ■ */
function blindMessage(msg: string): string {
  const chars = [...msg];
  // 공백/줄바꿈이 아닌 글자의 인덱스 수집
  const textIndices = chars
    .map((c, i) => (/\s/.test(c) ? -1 : i))
    .filter((i) => i !== -1);
  // 20% 랜덤 선택 (시드 기반: 메시지 길이로 결정적 랜덤)
  const revealCount = Math.max(1, Math.floor(textIndices.length * 0.2));
  const seed = msg.length * 7 + (msg.charCodeAt(0) || 0) * 13;
  const shuffled = textIndices.slice().sort((a, b) => {
    const ha = ((a + seed) * 2654435761) >>> 0;
    const hb = ((b + seed) * 2654435761) >>> 0;
    return ha - hb;
  });
  const revealSet = new Set(shuffled.slice(0, revealCount));
  return chars
    .map((c, i) => (/\s/.test(c) ? c : revealSet.has(i) ? c : "■"))
    .join("");
}

/** 블라인드 텍스트를 줄바꿈 처리 */
function splitBlindLines(blind: string, maxChars = 12): string[] {
  const rawLines = blind.split(/\n/);
  const result: string[] = [];
  for (const raw of rawLines) {
    if (raw.length <= maxChars) {
      result.push(raw);
    } else {
      const words = raw.split(" ");
      let current = "";
      for (const word of words) {
        if (
          current.length + word.length + 1 > maxChars &&
          current.length > 0
        ) {
          result.push(current);
          current = word;
        } else {
          current = current ? current + " " + word : word;
        }
      }
      if (current) result.push(current);
    }
  }
  return result.slice(0, 5); // 최대 5줄
}

export async function generateQrCard({
  from,
  to,
  message,
}: CardOptions): Promise<string> {
  const blind = blindMessage(message);
  const blindLines = splitBlindLines(blind);
  const lineHeight = 56;
  const blindStartY = 230;
  const footerY = Math.max(blindStartY + blindLines.length * lineHeight + 36, 420);
  const CARD_HEIGHT = footerY + 50;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // ── 배경 ──
  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // ── 카드 본체 ──
  ctx.fillStyle = "#27272a";
  roundRect(ctx, 20, 20, CARD_WIDTH - 40, CARD_HEIGHT - 40, RADIUS);
  ctx.fill();

  const cx = CARD_WIDTH / 2;

  // ── 잠금 아이콘 ──
  ctx.fillStyle = "#3f3f46";
  ctx.beginPath();
  ctx.arc(cx, 68, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#a1a1aa";
  roundRect(ctx, cx - 10, 62, 20, 14, 3);
  ctx.fill();

  ctx.strokeStyle = "#a1a1aa";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, 57, 6, Math.PI, 0);
  ctx.stroke();

  // ── 헤더 문구 (큰 텍스트) ──
  const hasFrom = from && from !== "익명" && from.length > 0;
  const hasTo = to && to.length > 0;

  ctx.textAlign = "center";
  ctx.fillStyle = "#fafafa";
  ctx.font = `bold 26px ${FONT}`;

  let headerText = "블라인드 메시지가 도착했어요";
  if (hasFrom && hasTo) {
    headerText = `${from}님이 ${to}님에게`;
  } else if (hasFrom) {
    headerText = `${from}님이 보낸 메시지`;
  } else if (hasTo) {
    headerText = `${to}님에게 온 메시지`;
  }
  ctx.fillText(headerText, cx, 130);

  // ── 구분선 ──
  ctx.strokeStyle = "#3f3f46";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 155);
  ctx.lineTo(CARD_WIDTH - 50, 155);
  ctx.stroke();

  // ── "제가 하고 싶은 말은..." ──
  ctx.fillStyle = "#71717a";
  ctx.font = `18px ${FONT}`;
  ctx.fillText("제가 하고 싶은 말은...", cx, 190);

  // ── 블라인드 메시지 (대형) ──
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `bold 42px monospace`;
  ctx.letterSpacing = "4px";

  for (let i = 0; i < blindLines.length; i++) {
    ctx.fillText(blindLines[i], cx, blindStartY + i * lineHeight);
  }

  // ── 하단 안내 ──
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#52525b";
  ctx.font = `14px ${FONT}`;
  ctx.fillText("링크를 열어 비밀 메시지를 확인하세요", cx, footerY);

  ctx.fillStyle = "#3f3f46";
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText("SUILE", cx, footerY + 24);

  return canvas.toDataURL("image/png");
}
