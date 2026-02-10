/**
 * 메시지 열람 페이지는 TopBar/Footer 없이
 * 풀스크린으로 표시합니다.
 */
export default function MessageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
