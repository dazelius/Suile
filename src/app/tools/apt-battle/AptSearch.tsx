"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, Loader2, X, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getSidoList, getSigunguList, getFullRegionName } from "./region-codes";

const APT_SEARCH_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/aptSearch";

export interface AptSelection {
  lawdCd: string;
  name: string;
  area: number;
  dong: string;
  regionName: string; // "서울 강남구"
}

interface AptSearchProps {
  value: AptSelection | null;
  onChange: (apt: AptSelection | null) => void;
  label?: string;
  color?: string; // 라벨 강조색
}

interface AptResult {
  name: string;
  dong: string;
  area: number;
  buildYear: string;
  recentPrice: number;
  recentDate: string;
  pricePerPyeong: number;
  txCount: number;
}

export function AptSearch({ value, onChange, label, color = "#059669" }: AptSearchProps) {
  const [selectedSido, setSelectedSido] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AptResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sidoList = getSidoList();
  const sigunguList = selectedSido ? getSigunguList(selectedSido) : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 아파트 검색 API 호출
  const searchApt = useCallback(
    async (q: string) => {
      if (!selectedCode) return;
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      try {
        const res = await fetch(
          `${APT_SEARCH_URL}?lawdCd=${selectedCode}&q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("검색 실패");
        const data = await res.json();
        if (!controller.signal.aborted) {
          setResults(data.results || []);
        }
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    },
    [selectedCode]
  );

  const handleQuery = useCallback(
    (q: string) => {
      setQuery(q);
      setIsOpen(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.length >= 1 && selectedCode) {
        debounceRef.current = setTimeout(() => searchApt(q), 400);
      } else if (q.length === 0 && selectedCode) {
        // 빈 검색은 전체 목록
        debounceRef.current = setTimeout(() => searchApt(""), 400);
      } else {
        setResults([]);
      }
    },
    [searchApt, selectedCode]
  );

  // 시군구 선택 시 자동 검색
  useEffect(() => {
    if (selectedCode && !value) {
      searchApt("");
    }
  }, [selectedCode, searchApt, value]);

  const selectApt = (apt: AptResult) => {
    onChange({
      lawdCd: selectedCode,
      name: apt.name,
      area: apt.area,
      dong: apt.dong,
      regionName: getFullRegionName(selectedCode),
    });
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
  };

  // 선택 완료 상태
  if (value) {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-semibold block" style={{ color }}>
            {label}
          </label>
        )}
        <div
          className="flex items-center gap-3 h-14 rounded-xl border bg-white px-3 cursor-pointer hover:bg-zinc-50 transition-colors"
          onClick={clear}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ backgroundColor: color }}
          >
            {value.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold block truncate">{value.name}</span>
            <span className="text-[11px] text-muted-foreground block truncate">
              {value.regionName} · {value.dong} · {value.area}m²
            </span>
          </div>
          <X className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="space-y-2">
      {label && (
        <label className="text-sm font-semibold block" style={{ color }}>
          {label}
        </label>
      )}

      {/* 시도 / 시군구 선택 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <select
            value={selectedSido}
            onChange={(e) => {
              setSelectedSido(e.target.value);
              setSelectedCode("");
              setResults([]);
            }}
            className="w-full h-10 rounded-lg border bg-white px-3 text-sm appearance-none cursor-pointer pr-8"
          >
            <option value="">시/도 선택</option>
            {sidoList.map((sido) => (
              <option key={sido} value={sido}>
                {sido.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "")}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={selectedCode}
            onChange={(e) => {
              setSelectedCode(e.target.value);
              setResults([]);
              setQuery("");
            }}
            disabled={!selectedSido}
            className="w-full h-10 rounded-lg border bg-white px-3 text-sm appearance-none cursor-pointer pr-8 disabled:opacity-50"
          >
            <option value="">시/군/구 선택</option>
            {sigunguList.map((sg) => (
              <option key={sg.code} value={sg.code}>
                {sg.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* 아파트 검색 */}
      {selectedCode && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            placeholder="아파트명 검색... (예: 래미안, 자이)"
            className="h-11 pl-9 text-sm rounded-xl"
            autoComplete="off"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}

          {/* 결과 드롭다운 */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl border bg-white shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              {results.length > 0
                ? results.map((apt, idx) => (
                    <button
                      key={`${apt.name}_${apt.area}_${idx}`}
                      onClick={() => selectApt(apt)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ backgroundColor: color + "cc" }}
                      >
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold block truncate">
                          {apt.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {apt.dong} · {apt.area}m² · {apt.buildYear}년
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold block">
                          {(apt.recentPrice / 10000).toFixed(1)}억
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          평당 {Math.round(apt.pricePerPyeong / 10).toLocaleString()}만
                        </span>
                      </div>
                    </button>
                  ))
                : !isLoading && (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                      {query ? "검색 결과 없음" : "아파트를 검색하세요"}
                    </div>
                  )}
              {isLoading && results.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">검색 중...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
