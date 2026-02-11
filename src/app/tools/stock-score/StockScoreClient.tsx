"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, X, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSearchParams } from "next/navigation";
import { ScoreCard } from "./ScoreCard";
import { StockLogo } from "../stock-battle/StockLogo";

const API_URL = "https://asia-northeast3-suile-21173.cloudfunctions.net/stockScore";
const SEARCH_API = "https://asia-northeast3-suile-21173.cloudfunctions.net/stockSearch";

const POPULAR = [
  { ticker: "AAPL", name: "Apple" },
  { ticker: "NVDA", name: "NVIDIA" },
  { ticker: "MSFT", name: "Microsoft" },
  { ticker: "TSLA", name: "Tesla" },
  { ticker: "GOOGL", name: "Google" },
  { ticker: "AMZN", name: "Amazon" },
  { ticker: "META", name: "Meta" },
  { ticker: "NFLX", name: "Netflix" },
];

export default function StockScoreClient() {
  const searchParams = useSearchParams();
  const urlTicker = searchParams.get("ticker");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ ticker: string; name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // URL 파라미터로 자동 조회
  useEffect(() => {
    if (urlTicker) loadDetail(urlTicker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTicker]);

  // 개별 상세 로드
  const loadDetail = useCallback(async (ticker: string) => {
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`${API_URL}?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("종목 데이터 조회 실패");
      const data = await res.json();
      setDetailData(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      alert(err.message || "오류가 발생했습니다");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // 종목 검색
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.results || []).slice(0, 8).map((r: any) => ({
            ticker: r.ticker || r.symbol,
            name: r.name || r.shortName || r.ticker,
          }))
        );
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* 헤더 */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-2 bg-violet-50 px-4 py-1.5 rounded-full">
          <BarChart3 className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-bold text-violet-700">주식 성적표</span>
        </div>
        <p className="text-xs text-muted-foreground">
          종목을 검색하면 밸류에이션 · 과매도 · AI 분석까지 한눈에
        </p>
      </div>

      {/* 검색 */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="종목 검색 (예: AAPL, Tesla, 삼성전자)"
            className="pl-9 h-11 rounded-xl text-sm"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchResults([]); setSearchOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        {searchOpen && (searchResults.length > 0 || isSearching) && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl border shadow-lg max-h-60 overflow-y-auto">
            {isSearching && (
              <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 검색중...
              </div>
            )}
            {searchResults.map((r) => (
              <button
                key={r.ticker}
                onClick={() => { setSearchOpen(false); setSearchQuery(""); loadDetail(r.ticker); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-50 transition-colors text-left"
              >
                <StockLogo ticker={r.ticker} name={r.name} size={28} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{r.ticker}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{r.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 로딩 */}
      {detailLoading && (
        <div className="flex flex-col items-center gap-2 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          <span className="text-sm text-muted-foreground">분석 중...</span>
        </div>
      )}

      {/* 성적표 */}
      {detailData && !detailLoading && (
        <ScoreCard data={detailData} onClose={() => setDetailData(null)} />
      )}

      {/* 성적표가 없을 때: 인기 종목 바로가기 */}
      {!detailData && !detailLoading && (
        <div className="space-y-3">
          <p className="text-[11px] text-zinc-400 font-medium text-center">인기 종목</p>
          <div className="grid grid-cols-4 gap-2">
            {POPULAR.map((item) => (
              <button
                key={item.ticker}
                onClick={() => loadDetail(item.ticker)}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border hover:border-violet-300 hover:shadow-sm transition-all bg-white"
              >
                <StockLogo ticker={item.ticker} name={item.name} size={32} />
                <span className="text-[10px] font-bold text-zinc-700">{item.ticker}</span>
                <span className="text-[8px] text-zinc-400 truncate w-full text-center">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
