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
  uploadStatus?: string;   // "uploaded" | "processed" | "rejected" | etc.
  rejectionReason?: string;
  privacyStatus?: string;
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

  console.log("[YT-Upload] Step 1: Starting resumable session...");
  console.log("[YT-Upload] Blob size:", blob.size, "type:", blob.type || "video/mp4");
  console.log("[YT-Upload] Metadata:", JSON.stringify(metadata));

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
    const errBody = await initRes.text().catch(() => "");
    console.error("[YT-Upload] Init failed:", initRes.status, errBody);
    let msg = `Upload init failed: ${initRes.status}`;
    try {
      const err = JSON.parse(errBody);
      msg = err?.error?.message || msg;
    } catch { /* not json */ }
    throw new Error(msg);
  }

  const uploadUrl = initRes.headers.get("Location");
  console.log("[YT-Upload] Upload URL:", uploadUrl ? "obtained" : "MISSING");
  if (!uploadUrl) {
    throw new Error("YouTube did not return an upload URL");
  }

  // ── Step 2: 영상 blob 업로드 (XMLHttpRequest for progress) ──
  console.log("[YT-Upload] Step 2: Uploading video blob...");
  const result = await new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", blob.type || "video/mp4");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    };

    xhr.onload = () => {
      console.log("[YT-Upload] XHR onload, status:", xhr.status);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          console.log("[YT-Upload] Success! Response:", JSON.stringify(data).slice(0, 500));
          const videoId = data.id;
          if (!videoId) {
            reject(new Error("YouTube returned success but no video ID"));
            return;
          }
          resolve({
            videoId,
            url: `https://youtube.com/shorts/${videoId}`,
          });
        } catch {
          console.error("[YT-Upload] Failed to parse response:", xhr.responseText?.slice(0, 500));
          reject(new Error("Failed to parse YouTube response"));
        }
      } else {
        console.error("[YT-Upload] Upload failed:", xhr.status, xhr.responseText?.slice(0, 500));
        let msg = `Upload failed: ${xhr.status}`;
        try {
          const err = JSON.parse(xhr.responseText);
          msg = err?.error?.message || msg;
          // Common errors
          if (xhr.status === 403) msg = "YouTube API quota exceeded or upload permission denied. " + msg;
          if (xhr.status === 401) msg = "Authentication expired. Please try again. " + msg;
        } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = 600_000; // 10 minutes

    xhr.send(blob);
  });

  // ── Step 3: Verify the upload by checking video status ──
  console.log("[YT-Upload] Step 3: Verifying upload status...");
  try {
    const checkRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${result.videoId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      console.log("[YT-Upload] Video status check:", JSON.stringify(checkData));
      const item = checkData.items?.[0];
      if (item) {
        result.uploadStatus = item.status?.uploadStatus;
        result.privacyStatus = item.status?.privacyStatus;
        result.rejectionReason = item.status?.rejectionReason;
        console.log("[YT-Upload] Upload status:", item.status?.uploadStatus);
        console.log("[YT-Upload] Privacy:", item.status?.privacyStatus);
        console.log("[YT-Upload] Processing:", item.processingDetails?.processingStatus);
        if (item.status?.uploadStatus === "rejected") {
          console.error("[YT-Upload] Video was REJECTED. Reason:", item.status?.rejectionReason);
        }
        if (item.status?.uploadStatus === "failed") {
          console.error("[YT-Upload] Video FAILED. Reason:", item.status?.failureReason);
          result.rejectionReason = item.status?.failureReason;
        }
      } else {
        console.warn("[YT-Upload] Video not found in status check — may still be processing");
      }
    }
  } catch (e) {
    console.warn("[YT-Upload] Status check failed (non-critical):", e);
  }

  return result;
}
