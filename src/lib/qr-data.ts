/**
 * QR 편지 데이터 인코딩/디코딩
 *
 * 메시지 데이터를 URL-safe한 형태로 인코딩하여
 * QR코드 URL에 포함시킵니다.
 * 데이터베이스 없이 동작하는 구조입니다.
 */

export interface QrLetterData {
  /** 보내는 사람 이름 */
  from: string;
  /** 받는 사람 이름 */
  to: string;
  /** 메시지 본문 */
  message: string;
  /** 테마 ID */
  theme: string;
}

/** 데이터를 base64 URL-safe 문자열로 인코딩 */
export function encodeLetterData(data: QrLetterData): string {
  const json = JSON.stringify(data);
  // TextEncoder로 UTF-8 바이트 배열 생성 후 base64 인코딩
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** base64 URL-safe 문자열을 데이터로 디코딩 */
export function decodeLetterData(encoded: string): QrLetterData | null {
  try {
    // URL-safe base64를 표준 base64로 복원
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    // 패딩 추가
    while (base64.length % 4) base64 += "=";

    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);

    // 유효성 검증
    if (
      typeof data.from === "string" &&
      typeof data.to === "string" &&
      typeof data.message === "string" &&
      typeof data.theme === "string"
    ) {
      return data as QrLetterData;
    }
    return null;
  } catch {
    return null;
  }
}
