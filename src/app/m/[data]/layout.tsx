/**
 * 메시지 열람 페이지는 TopBar/Footer 없이
 * 풀스크린으로 표시합니다.
 * (root layout의 TopBar/Footer를 숨기기 위해 별도 레이아웃 사용)
 */
export default function MessageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
