import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "SUILE 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-bold mb-8">개인정보처리방침</h1>

      <div className="prose prose-sm prose-neutral max-w-none space-y-8 text-sm leading-relaxed text-muted-foreground">
        <p>
          SUILE(이하 &quot;서비스&quot;)는 이용자의 개인정보를 중요시하며,
          「개인정보 보호법」 등 관련 법령을 준수합니다. 본 개인정보처리방침은
          서비스가 수집하는 개인정보의 항목, 수집 목적, 보유 기간 등을
          안내합니다.
        </p>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            1. 수집하는 개인정보 항목
          </h2>
          <p>
            SUILE는 별도의 회원가입 없이 이용 가능한 서비스로, 이용자로부터
            직접적으로 개인정보를 수집하지 않습니다.
          </p>
          <p className="mt-2">
            다만, 서비스 이용 과정에서 아래 정보가 자동으로 생성 및 수집될 수
            있습니다.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>접속 IP 주소, 브라우저 종류 및 버전</li>
            <li>접속 일시, 서비스 이용 기록</li>
            <li>기기 정보 (운영체제, 화면 해상도 등)</li>
            <li>쿠키(Cookie) 정보</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            2. 개인정보의 수집 및 이용 목적
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>서비스 제공 및 운영</li>
            <li>서비스 이용 통계 분석 및 개선</li>
            <li>광고 게재 및 맞춤형 광고 제공 (Google AdSense)</li>
            <li>부정 이용 방지 및 서비스 안정성 확보</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            3. 개인정보의 보유 및 이용 기간
          </h2>
          <p>
            자동 수집되는 정보는 수집 목적 달성 후 지체 없이 파기합니다.
            다만, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>서비스 이용 기록: 3개월</li>
            <li>접속 로그: 3개월 (통신비밀보호법)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            4. 쿠키(Cookie)의 사용
          </h2>
          <p>
            SUILE는 서비스 개선 및 광고 제공을 위해 쿠키를 사용합니다.
            쿠키는 이용자의 브라우저에 저장되는 소량의 텍스트 파일로,
            이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다.
          </p>
          <p className="mt-2">
            다만, 쿠키 저장을 거부할 경우 일부 서비스 이용에 어려움이 있을 수
            있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            5. 광고 서비스 (Google AdSense)
          </h2>
          <p>
            SUILE는 Google AdSense를 통해 광고를 게재합니다.
            Google은 이용자의 관심사에 기반한 광고를 제공하기 위해 쿠키를
            사용할 수 있습니다. 이에 대한 자세한 내용은{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline"
            >
              Google 개인정보처리방침
            </a>
            을 참고해 주세요.
          </p>
          <p className="mt-2">
            맞춤형 광고를 원하지 않는 경우{" "}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline"
            >
              Google 광고 설정
            </a>
            에서 비활성화할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            6. 개인정보의 제3자 제공
          </h2>
          <p>
            SUILE는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다.
            다만, 법령에 의해 요구되는 경우에는 예외로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            7. 이용자의 권리
          </h2>
          <p>
            이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제를
            요청할 수 있으며, 쿠키 설정 변경을 통해 자동 수집을 거부할 수
            있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            8. 개인정보 보호책임자
          </h2>
          <p>
            개인정보 처리에 관한 문의는 아래 연락처로 문의해 주세요.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>서비스명: SUILE</li>
            <li>이메일: dazelius86@gmail.com</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            9. 개인정보처리방침의 변경
          </h2>
          <p>
            본 개인정보처리방침은 관련 법령 및 서비스 정책 변경에 따라
            수정될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.
          </p>
          <p className="mt-4 text-xs">시행일자: 2026년 2월 10일</p>
        </section>
      </div>
    </div>
  );
}
