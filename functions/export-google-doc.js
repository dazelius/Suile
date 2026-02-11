/**
 * Google Docs 회의록 내보내기 Cloud Function
 *
 * 사용자의 OAuth access_token으로 Google Drive에 "SUILE 회의록" 폴더를 만들고,
 * 포맷된 Google Doc을 생성합니다.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { google } = require("googleapis");

const FOLDER_NAME = "SUILE 회의록";

// ── Google Docs 본문 구성 ──
function buildDocRequests(result, transcript, audioUrl) {
  const requests = [];
  const segments = [];
  const styles = [];
  let pos = 0;

  function addText(text) {
    segments.push(text);
    pos += text.length;
  }

  function addHeading(text, level) {
    const startPos = pos;
    addText(text + "\n");
    styles.push({
      type: "heading",
      startIndex: startPos + 1,
      endIndex: pos + 1,
      level,
    });
  }

  function addLine(text) {
    addText(text + "\n");
  }

  function addBlank() {
    addText("\n");
  }

  function addLink(text, url) {
    const startPos = pos;
    addText(text);
    styles.push({
      type: "link",
      startIndex: startPos + 1,
      endIndex: pos + 1,
      url,
    });
    addText("\n");
  }

  // ── 문서 본문 구성 ──

  // 제목
  addHeading(result.title, 1);

  // 메타 정보
  const kwText =
    result.keywords && result.keywords.length > 0
      ? result.keywords.join(", ")
      : "";
  addLine(
    `소요 시간: ${result.duration || "-"}  |  키워드: ${kwText}`
  );

  // 녹음 파일 링크
  if (audioUrl) {
    addLink("🔊 녹음 파일 듣기", audioUrl);
  }

  addBlank();

  // 핵심 요약
  addHeading("핵심 요약", 2);
  addLine(result.summary || "");
  addBlank();

  // 액션 아이템
  if (result.actionItems && result.actionItems.length > 0) {
    addHeading("액션 아이템", 2);
    result.actionItems.forEach((item, i) => {
      const deadline = item.deadline ? ` (기한: ${item.deadline})` : "";
      addLine(`${i + 1}. [${item.who}] ${item.what}${deadline}`);
    });
    addBlank();
  }

  // 결정사항
  if (result.decisions && result.decisions.length > 0) {
    addHeading("결정사항", 2);
    result.decisions.forEach((d) => addLine(`• ${d}`));
    addBlank();
  }

  // 후속조치
  if (result.followUps && result.followUps.length > 0) {
    addHeading("후속조치", 2);
    result.followUps.forEach((f) => addLine(`→ ${f}`));
    addBlank();
  }

  // 원본 텍스트
  if (transcript) {
    addHeading("원본 텍스트", 2);
    addLine(transcript);
  }

  const fullText = segments.join("");

  // 1. 텍스트 삽입
  requests.push({
    insertText: {
      location: { index: 1 },
      text: fullText,
    },
  });

  // 2. 스타일 적용
  styles.forEach((s) => {
    if (s.type === "heading") {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: s.startIndex, endIndex: s.endIndex },
          paragraphStyle: {
            namedStyleType: s.level === 1 ? "HEADING_1" : "HEADING_2",
          },
          fields: "namedStyleType",
        },
      });
    } else if (s.type === "link") {
      requests.push({
        updateTextStyle: {
          range: { startIndex: s.startIndex, endIndex: s.endIndex },
          textStyle: {
            link: { url: s.url },
          },
          fields: "link",
        },
      });
    }
  });

  return requests;
}

// ── 메인 함수 ──
exports.exportGoogleDoc = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

    res.set("Access-Control-Allow-Origin", "*");

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { accessToken, meetingResult, transcript, audioFileId } = req.body;

    if (!accessToken || !meetingResult) {
      return res
        .status(400)
        .json({ error: "accessToken과 meetingResult가 필요합니다." });
    }

    try {
      // OAuth2 클라이언트 (사용자 토큰 사용)
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const drive = google.drive({ version: "v3", auth });
      const docs = google.docs({ version: "v1", auth });

      // 1. "SUILE 회의록" 폴더 찾기 또는 생성
      let folderId;
      const folderSearch = await drive.files.list({
        q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id)",
        spaces: "drive",
      });

      if (
        folderSearch.data.files &&
        folderSearch.data.files.length > 0
      ) {
        folderId = folderSearch.data.files[0].id;
      } else {
        const folder = await drive.files.create({
          requestBody: {
            name: FOLDER_NAME,
            mimeType: "application/vnd.google-apps.folder",
          },
          fields: "id",
        });
        folderId = folder.data.id;
      }

      // 2. Google Doc 생성
      const today = new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const docTitle = `[회의록] ${meetingResult.title} - ${today}`;

      const doc = await docs.documents.create({
        requestBody: { title: docTitle },
      });
      const docId = doc.data.documentId;

      // 3. 폴더로 이동
      const file = await drive.files.get({
        fileId: docId,
        fields: "parents",
      });
      const previousParents = (file.data.parents || []).join(",");

      await drive.files.update({
        fileId: docId,
        addParents: folderId,
        removeParents: previousParents,
        fields: "id, parents",
      });

      // 4. 오디오 파일을 같은 폴더로 이동 + 링크 URL 생성
      let audioUrl = null;
      if (audioFileId) {
        try {
          const audioFile = await drive.files.get({
            fileId: audioFileId,
            fields: "parents, webViewLink",
          });
          const audioPrevParents = (audioFile.data.parents || []).join(",");

          const updatedAudio = await drive.files.update({
            fileId: audioFileId,
            addParents: folderId,
            removeParents: audioPrevParents,
            fields: "id, webViewLink",
          });

          audioUrl =
            updatedAudio.data.webViewLink ||
            `https://drive.google.com/file/d/${audioFileId}/view`;
        } catch (audioErr) {
          console.log(
            "[exportGoogleDoc] 오디오 이동 실패:",
            audioErr.message
          );
        }
      }

      // 5. 본문 포맷팅
      const requests = buildDocRequests(meetingResult, transcript, audioUrl);

      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests },
        });
      }

      return res.json({
        docUrl: `https://docs.google.com/document/d/${docId}/edit`,
        docId,
      });
    } catch (err) {
      console.error("[exportGoogleDoc] Error:", err.message || err);

      if (
        err.code === 401 ||
        err.message?.includes("invalid_grant") ||
        err.message?.includes("Invalid Credentials")
      ) {
        return res.status(401).json({
          error: "Google 인증이 만료되었습니다.",
          code: "AUTH_EXPIRED",
          tip: "다시 로그인해주세요.",
        });
      }

      if (err.code === 403) {
        return res.status(403).json({
          error: "Google Drive/Docs 접근 권한이 부족합니다.",
          code: "PERMISSION_DENIED",
          tip: "권한을 다시 허용해주세요.",
        });
      }

      return res.status(500).json({
        error: "Google Docs 문서 생성에 실패했습니다.",
        tip: "잠시 후 다시 시도해주세요.",
      });
    }
  }
);
