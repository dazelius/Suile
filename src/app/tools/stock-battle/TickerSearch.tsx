"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchStocks, type StockPreset } from "./presets";
import { StockLogo } from "./StockLogo";

const SEARCH_API_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/stockSearch";

interface TickerSearchProps {
  value: string;
  onChange: (ticker: string, name?: string) => void;
  placeholder?: string;
  label?: string;
}

interface ApiResult {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

export function TickerSearch({ value, onChange, placeholder, label }: TickerSearchProps) {
  const [query, setQuery] = useState("");
  const [presetResults, setPresetResults] = useState<StockPreset[]>([]);
  const [apiResults, setApiResults] = useState<ApiResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<StockPreset | null>(null);
  const [focusIdx, setFocusIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 외부 value 바뀌면 프리셋 업데이트
  useEffect(() => {
    if (value) {
      const found = searchStocks(value).find((p) => p.ticker === value);
      if (found) setSelectedPreset(found);
      else setSelectedPreset({ ticker: value, name: value, flag: "📈" });
    } else {
      setSelectedPreset(null);
    }
  }, [value]);

  // 외부 클릭시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Yahoo Finance API 검색
  const searchApi = useCallback(async (q: string) => {
    // 이전 요청 취소
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    try {
      const res = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (!controller.signal.aborted) {
        setApiResults(data.results || []);
      }
    } catch {
      if (!controller.signal.aborted) {
        setApiResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      setFocusIdx(-1);

      if (q.length >= 1) {
        // 프리셋 즉시 검색
        const found = searchStocks(q);
        setPresetResults(found);
        setIsOpen(true);

        // API 검색 debounce (300ms)
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (q.length >= 2) {
          debounceRef.current = setTimeout(() => searchApi(q), 300);
        } else {
          setApiResults([]);
          setIsSearching(false);
        }
      } else {
        setPresetResults([]);
        setApiResults([]);
        setIsOpen(false);
        setIsSearching(false);
      }
    },
    [searchApi]
  );

  const selectItem = useCallback(
    (ticker: string, name: string) => {
      onChange(ticker, name);
      setSelectedPreset({ ticker, name, flag: "📈" });
      setQuery("");
      setPresetResults([]);
      setApiResults([]);
      setIsOpen(false);
    },
    [onChange]
  );

  // 프리셋에 이미 있는 API 결과는 제외
  const presetTickers = new Set(presetResults.map((p) => p.ticker));
  const filteredApi = apiResults.filter((r) => !presetTickers.has(r.ticker));
  const totalOptions = presetResults.length + filteredApi.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((prev) => Math.min(prev + 1, totalOptions - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusIdx >= 0 && focusIdx < presetResults.length) {
        const p = presetResults[focusIdx];
        selectItem(p.ticker, p.name);
      } else if (focusIdx >= presetResults.length && focusIdx < totalOptions) {
        const api = filteredApi[focusIdx - presetResults.length];
        selectItem(api.ticker, api.name);
      } else if (query.trim().length >= 1) {
        // 직접 입력
        selectItem(query.trim().toUpperCase(), query.trim().toUpperCase());
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const clear = () => {
    onChange("");
    setSelectedPreset(null);
    setQuery("");
    setPresetResults([]);
    setApiResults([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative">
      {label && <label className="text-sm font-medium mb-1.5 block">{label}</label>}

      {/* 선택된 상태 */}
      {value && selectedPreset && !isOpen ? (
        <div
          className="flex items-center gap-3 h-12 rounded-xl border bg-white px-3 cursor-pointer hover:bg-zinc-50 transition-colors"
          onClick={clear}
        >
          <StockLogo ticker={selectedPreset.ticker} name={selectedPreset.name} size={28} />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold">{selectedPreset.name}</span>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">{selectedPreset.ticker}</span>
          <X className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      ) : (
        /* 검색 입력 */
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => query.length >= 1 && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "종목명 또는 티커 검색..."}
            className="h-12 pl-9 text-sm rounded-xl"
            autoComplete="off"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>
      )}

      {/* 드롭다운 결과 */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl border bg-white shadow-xl overflow-hidden max-h-80 overflow-y-auto">
          {/* 프리셋 결과 */}
          {presetResults.map((preset, idx) => (
            <button
              key={preset.ticker}
              onClick={() => selectItem(preset.ticker, preset.name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                idx === focusIdx ? "bg-zinc-100" : "hover:bg-zinc-50"
              }`}
            >
              <StockLogo ticker={preset.ticker} name={preset.name} size={32} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold block truncate">{preset.name}</span>
                {preset.nameEn && preset.nameEn !== preset.name && (
                  <span className="text-[11px] text-muted-foreground block truncate">{preset.nameEn}</span>
                )}
              </div>
              <span className="text-xs font-mono text-muted-foreground shrink-0">{preset.ticker}</span>
            </button>
          ))}

          {/* 구분선 + API 결과 */}
          {filteredApi.length > 0 && (
            <>
              {presetResults.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border-y">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Yahoo Finance 검색 결과</span>
                </div>
              )}
              {filteredApi.map((item, idx) => {
                const globalIdx = presetResults.length + idx;
                return (
                  <button
                    key={item.ticker}
                    onClick={() => selectItem(item.ticker, item.name)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      globalIdx === focusIdx ? "bg-zinc-100" : "hover:bg-zinc-50"
                    }`}
                  >
                    <StockLogo ticker={item.ticker} name={item.name} size={32} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold block truncate">{item.name}</span>
                      <span className="text-[10px] text-muted-foreground block truncate">{item.exchange}</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground shrink-0">{item.ticker}</span>
                  </button>
                );
              })}
            </>
          )}

          {/* 검색 중 표시 */}
          {isSearching && presetResults.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">검색 중...</span>
            </div>
          )}

          {/* 결과 없음 + 직접 입력 */}
          {!isSearching && presetResults.length === 0 && filteredApi.length === 0 && query.trim().length >= 1 && (
            <button
              onClick={() => selectItem(query.trim().toUpperCase(), query.trim().toUpperCase())}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-zinc-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center text-zinc-500 text-xs font-bold shrink-0">?</div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold block">&quot;{query.trim().toUpperCase()}&quot; 직접 입력</span>
                <span className="text-[11px] text-muted-foreground block">티커를 직접 입력하여 검색</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
