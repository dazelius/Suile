/**
 * QR 비밀 메시지 카드 이미지 생성기
 *
 * Canvas API로 상품권 스타일의 예쁜 카드 이미지를 생성합니다.
 * - 상단: SUILE 브랜딩
 * - 중앙: "XXX님이 EEE에게 보내는 비밀 메시지" 문구
 * - QR코드
 * - 하단: 안내 문구
 */

interface CardOptions {
  qrDataUrl: string;
  from: string;
  to: string;
}

const CARD_WIDTH = 600;
const CARD_HEIGHT = 820;
const PADDING = 40;
const RADIUS = 24;

/** 둥근 모서리 사각형 그리기 */
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

/** 점선 구분선 그리기 */
function dashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number
) {
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y1);
  ctx.stroke();
  ctx.restore();
}

export async function generateQrCard({
  qrDataUrl,
  from,
  to,
}: CardOptions): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // ── 배경 (약간의 그림자 효과를 위한 외부) ──
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // ── 카드 본체 (흰색 둥근 사각형) ──
  const cardX = 16;
  const cardY = 16;
  const cardW = CARD_WIDTH - 32;
  const cardH = CARD_HEIGHT - 32;

  // 그림자
  ctx.shadowColor = "rgba(0,0,0,0.08)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, cardY, cardW, cardH, RADIUS);
  ctx.fill();

  // 그림자 제거
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 카드 테두리
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 1;
  roundRect(ctx, cardX, cardY, cardW, cardH, RADIUS);
  ctx.stroke();

  // ── 상단: SUILE 브랜딩 ──
  let y = cardY + PADDING + 8;

  ctx.fillStyle = "#18181b";
  ctx.font = "bold 28px 'Geist', 'Pretendard', -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SUILE", CARD_WIDTH / 2, y);
  y += 12;

  ctx.fillStyle = "#a1a1aa";
  ctx.font = "13px 'Geist', 'Pretendard', -apple-system, sans-serif";
  ctx.fillText("QR 비밀 메시지", CARD_WIDTH / 2, y + 16);
  y += 40;

  // ── 점선 구분선 ──
  dashedLine(ctx, cardX + PADDING, y, cardX + cardW - PADDING);
  y += 28;

  // ── 메시지 문구 ──
  const hasFrom = from && from !== "익명" && from.length > 0;
  const hasTo = to && to.length > 0;

  ctx.fillStyle = "#18181b";
  ctx.font = "bold 22px 'Geist', 'Pretendard', -apple-system, sans-serif";
  ctx.textAlign = "center";

  if (hasFrom && hasTo) {
    ctx.fillText(`${from}님이`, CARD_WIDTH / 2, y);
    y += 32;
    ctx.fillText(`${to}님에게 보내는`, CARD_WIDTH / 2, y);
    y += 32;
    ctx.fillText("비밀 메시지에요 💌", CARD_WIDTH / 2, y);
    y += 20;
  } else if (hasFrom) {
    ctx.fillText(`${from}님이 보내는`, CARD_WIDTH / 2, y);
    y += 32;
    ctx.fillText("비밀 메시지에요 💌", CARD_WIDTH / 2, y);
    y += 20;
  } else if (hasTo) {
    ctx.fillText(`${to}님에게 도착한`, CARD_WIDTH / 2, y);
    y += 32;
    ctx.fillText("비밀 메시지에요 💌", CARD_WIDTH / 2, y);
    y += 20;
  } else {
    ctx.fillText("비밀 메시지가", CARD_WIDTH / 2, y);
    y += 32;
    ctx.fillText("도착했어요 💌", CARD_WIDTH / 2, y);
    y += 20;
  }

  y += 16;

  // ── 점선 구분선 ──
  dashedLine(ctx, cardX + PADDING, y, cardX + cardW - PADDING);
  y += 28;

  // ── QR코드 ──
  const qrSize = 260;
  const qrX = (CARD_WIDTH - qrSize) / 2;

  // QR 배경 (약간의 패딩)
  const qrPad = 16;
  ctx.fillStyle = "#fafafa";
  roundRect(
    ctx,
    qrX - qrPad,
    y - qrPad,
    qrSize + qrPad * 2,
    qrSize + qrPad * 2,
    16
  );
  ctx.fill();
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 1;
  roundRect(
    ctx,
    qrX - qrPad,
    y - qrPad,
    qrSize + qrPad * 2,
    qrSize + qrPad * 2,
    16
  );
  ctx.stroke();

  // QR 이미지 로드 & 그리기
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, y, qrSize, qrSize);
  y += qrSize + qrPad;

  // ── 하단 안내 ──
  y += 24;
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "14px 'Geist', 'Pretendard', -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("QR코드를 스캔하면 비밀 메시지가 열려요", CARD_WIDTH / 2, y);

  y += 28;
  ctx.fillStyle = "#d4d4d8";
  ctx.font = "12px 'Geist', 'Pretendard', -apple-system, sans-serif";
  ctx.fillText("suile-21173.web.app", CARD_WIDTH / 2, y);

  return canvas.toDataURL("image/png");
}

/** 이미지 로드 헬퍼 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
