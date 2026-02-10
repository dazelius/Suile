import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "SUILE 이용약관",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-bold mb-8">이용약관</h1>

      <div className="prose prose-sm prose-neutral max-w-none space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            제1조 (목적)
          </h2>
          <p>
            본 약관은 SUILE(이하 &quot;서비스&quot;)가 제공하는 온라인 도구
            서비스의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및
            책임 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            제2조 (정의)
          </h2>
          <ul className="list-decimal pl-5 space-y-1">
            <li>
              &quot;서비스&quot;란 SUILE가 제공하는 웹 기반 온라인 도구 및 관련
              부가 서비스를 말합니다.
            </li>
            <li>
              &quot;이용자&quot;란 본 약관에 따라 서비스를 이용하는 자를
              말합니다.
            </li>
            <li>
              &quot;콘텐츠&quot;란 이용자가 서비스를 통해 생성한 QR코드,
              메시지 등 모든 자료를 말합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            제3조 (약관의 효력 및 변경)
          </h2>
          <ul className="list-decimal pl-5 space-y-1">
            <li>본 약관은 서비스 화면에 게시하여 공시합니다.</li>
            <li>
              서비스는 관련 법령에 위배되지 않는 범위에서 약관을 변경할 수
              있으며, 변경 시 적용일 7일 전부터 서비스 내에 공지합니다.
            </li>
            <li>
              이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을
              중단할 수 있습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            제4조 (서비스의 제공)
          </h2>
          <ul className="list-decimal pl-5 space-y-1">
            <li>
              서비스는 별도의 회원가입 없이 무료로 제공됩니다.
            </li>
            <li>
              서비스는 다음을 포함합니다.
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>QR코드 비밀 메시지 생성 및 공유</li>
                <li>기타 온라인 유틸리티 도구</li>
                <li>향후 추가되는 각종 서비스</li>
              </ul>
            </li>
            <li>
              서비스는 연중무휴 24시간 제공을 원칙으로 하되, 시스템 점검 등의
              사유로 일시 중단될 수 있습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            제5조 (이용자의 의무)
          </h2>
          <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>타인의 명예를 훼손하거나 불이익을 주는 행위</li>
            <li>불법적이거나 공공질서에 반하는 내용의 메시지 생성</li>
            <li>서비스의 안정적 운영을 방해하는 행위</li>
            <li>서비스를 이용한 영리 목적의 광고 행위</li>
            <li>자동화된 수단을 이용한 대량 데이터 수집</li>
            <li>기타 관련 법령에 위반되는 행위</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            제6조 (콘텐츠에 대한 책임)
          </h2>
          <ul className="list-decimal pl-5 space-y-1">
            <li>
              이용자가 생성한 콘텐츠(메시지, QR코드 등)에 대한 책임은
              전적으로 이용자에게 있습니다.
            </li>
            <li>
              서비스는 이용자가 생성한 콘텐츠를 별도로 저장하거나 관리하지
              않습니다. QR코드에 포함된 데이터는 URL에 인코딩되어 있으며,
              서비스는 이를 복호화하여 표시할 뿐입니다.
            </li>
            <li>
              서비스는 관련 법령에 위반되는 콘텐츠에 대해 접근을 제한할 수
              있습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            제7조 (지식재산권)
          </h2>
          <ul className="list-decimal pl-5 space-y-1">
            <li>
              서비스의 디자인, 코드, 로고 등에 대한 지식재산권은 서비스
              운영자에게 귀속됩니다.
            </li>
            <li>
              이용자가 생성한 콘텐츠에 대한 권리는 이용자에게 귀속됩니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            제8조 (면책 사항)
          </h2>
          <ul className="list-decimal pl-5 space-y-1">
            <li>
              서비스는 무료로 제공되며, 서비스 이용으로 인해 발생하는
              손해에 대해 법적 책임을 지지 않습니다.
            </li>
            <li>
              천재지변, 시스템 장애 등 불가항력으로 인한 서비스 중단에
              대해서는 책임을 지지 않습니다.
            </li>
            <li>
              이용자 간 또는 이용자와 제3자 간의 분쟁에 대해 서비스는
              개입하지 않으며 책임을 지지 않습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            제9조 (광고 게재)
          </h2>
          <p>
            서비스는 운영을 위해 서비스 화면에 광고를 게재할 수 있습니다.
            광고와 관련한 거래는 광고주와 이용자 간의 문제이며, 서비스는
            이에 대해 책임을 지지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            제10조 (준거법 및 관할)
          </h2>
          <p>
            본 약관의 해석 및 적용에 관해서는 대한민국 법률을 준거법으로
            하며, 분쟁 발생 시 관할 법원은 민사소송법에 따릅니다.
          </p>
          <p className="mt-4 text-xs">시행일자: 2026년 2월 10일</p>
        </section>
      </div>
    </div>
  );
}
