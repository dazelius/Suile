/**
 * YouTube Data API v3 — Resumable Upload (client-side)
 *
 * 브라우저에서 직접 YouTube에 영상을 업로드합니다.
 * OAuth access_token만 있으면 Cloud Function 없이 동작합니다.
 */

const YT_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

export type PrivacyStatus = "public" | "unlisted" | "private";

export interface UploadParams {
  token: string;
  blob: Blob;
  title: string;
  description?: string;
  privacy?: PrivacyStatus;
  onProgress?: (ratio: number) => void;
}

export interface UploadResult {
  videoId: string;
  url: string;
}

/**
 * YouTube Shorts 영상을 업로드합니다.
 *
 * 1) POST — resumable upload 세션 시작 (메타데이터 전송)
 * 2) PUT  — 실제 영상 blob 전송 (progress 이벤트 지원)
 */
export async function uploadToYouTube({
  token,
  blob,
  title,
  description = "",
  privacy = "private",
  onProgress,
}: UploadParams): Promise<UploadResult> {
  // Shorts 인식을 위해 #Shorts 태그 확인/추가
  const shortsTitle = title.includes("#Shorts") ? title : `${title} #Shorts`;

  // ── Step 1: Resumable upload 세션 시작 ──
  const metadata = {
    snippet: {
      title: shortsTitle,
      description: description || `${shortsTitle} — Made with SUILE`,
      categoryId: "22", // People & Blogs
    },
    status: {
      privacyStatus: privacy,
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(YT_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": blob.size.toString(),
      "X-Upload-Content-Type": blob.type || "video/mp4",
    },
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({ error: { message: `HTTP ${initRes.status}` } }));
    const msg = err?.error?.message || `Upload init failed: ${initRes.status}`;
    throw new Error(msg);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("YouTube did not return an upload URL");
  }

  // ── Step 2: 영상 blob 업로드 (XMLHttpRequest for progress) ──
  const result = await new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", blob.type || "video/mp4");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const videoId = data.id;
          resolve({
            videoId,
            url: `https://youtube.com/shorts/${videoId}`,
          });
        } catch {
          reject(new Error("Failed to parse YouTube response"));
        }
      } else {
        let msg = `Upload failed: ${xhr.status}`;
        try {
          const err = JSON.parse(xhr.responseText);
          msg = err?.error?.message || msg;
        } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = 600_000; // 10 minutes

    xhr.send(blob);
  });

  return result;
}
