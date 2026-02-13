/**
 * YouTube Data API v3 — Channel statistics & search
 *
 * Uses a simple API key (no OAuth) to read public channel data.
 * Quota: channels.list = 1 unit, search.list = 100 units.
 */

const API_KEY = process.env.NEXT_PUBLIC_YT_API_KEY ?? "";
const BASE = "https://www.googleapis.com/youtube/v3";

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */

export interface ChannelData {
  channelId: string;
  name: string;
  thumbnailUrl: string;
  publishedAt: string;       // ISO date
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  // Derived
  avgViewsPerVideo: number;
  yearsActive: number;
}

export interface ChannelSearchResult {
  channelId: string;
  name: string;
  thumbnailUrl: string;
}

/* ═══════════════════════════════════════════════
   FETCH CHANNEL DATA (batch, up to 50 IDs)
   ═══════════════════════════════════════════════ */

export async function fetchChannelData(
  channelIds: string[],
): Promise<Map<string, ChannelData>> {
  const result = new Map<string, ChannelData>();
  if (!API_KEY || channelIds.length === 0) return result;

  // YouTube allows max 50 IDs per request
  const batches: string[][] = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    batches.push(channelIds.slice(i, i + 50));
  }

  const now = Date.now();

  for (const batch of batches) {
    const ids = batch.join(",");
    const url = `${BASE}/channels?part=snippet,statistics&id=${ids}&key=${API_KEY}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("[YT-API] channels.list failed:", res.status, await res.text().catch(() => ""));
        continue;
      }

      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of (data.items ?? []) as any[]) {
        const stats = item.statistics ?? {};
        const snippet = item.snippet ?? {};
        const subs = parseInt(stats.subscriberCount ?? "0", 10);
        const views = parseInt(stats.viewCount ?? "0", 10);
        const videos = parseInt(stats.videoCount ?? "0", 10);
        const publishedAt = snippet.publishedAt ?? "2020-01-01T00:00:00Z";
        const yearsActive = Math.max(0.5, (now - new Date(publishedAt).getTime()) / (365.25 * 86400000));

        result.set(item.id, {
          channelId: item.id,
          name: snippet.title ?? "Unknown",
          thumbnailUrl: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? "",
          publishedAt,
          subscriberCount: subs,
          viewCount: views,
          videoCount: Math.max(1, videos),
          avgViewsPerVideo: videos > 0 ? Math.round(views / videos) : views,
          yearsActive,
        });
      }
    } catch (err) {
      console.error("[YT-API] fetch error:", err);
    }
  }

  return result;
}

/* ═══════════════════════════════════════════════
   SEARCH CHANNELS BY KEYWORD
   ═══════════════════════════════════════════════ */

export async function searchChannels(
  query: string,
  maxResults = 8,
): Promise<ChannelSearchResult[]> {
  if (!API_KEY || !query.trim()) return [];

  const url = `${BASE}/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=${maxResults}&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("[YT-API] search failed:", res.status);
      return [];
    }

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data.items ?? []) as any[]).map((item) => ({
      channelId: item.snippet?.channelId ?? item.id?.channelId ?? "",
      name: item.snippet?.title ?? "Unknown",
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
    })).filter((r) => r.channelId);
  } catch (err) {
    console.error("[YT-API] search error:", err);
    return [];
  }
}
