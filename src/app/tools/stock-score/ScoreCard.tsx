"use client";

import { Share2, ChevronDown, ChevronUp, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { StockLogo } from "../stock-battle/StockLogo";

interface OversoldInfo {
  dropFromHigh: number;
  belowMA50: boolean;
  belowMA200: boolean;
  ma50: number | null;
  ma200: number | null;
  isOversold: boolean;
}

interface DetailData {
  ticker: string;
  name: string;
  price?: number;
  marketCap?: number;
  pe?: number | null;
  forwardPE?: number | null;
  pb?: number | null;
  divYield?: number | null;
  eps?: number | null;
  epsForward?: number | null;
  w52change?: number | null;
  w52high?: number | null;
  w52low?: number | null;
  ma50?: number | null;
  ma200?: number | null;
  pegRatio?: number | null;
  beta?: number | null;
  returnOnEquity?: number | null;
  returnOnAssets?: number | null;
  debtToEquity?: number | null;
  currentRatio?: number | null;
  operatingMargins?: number | null;
  profitMargins?: number | null;
  revenueGrowth?: number | null;
  earningsGrowth?: number | null;
  freeCashflow?: number | null;
  payoutRatio?: number | null;
  pegPE?: number | null;
  pegEpsGrowth?: number | null;
  avgPE5Y?: number | null;
  yearlyPEs?: number[];
  scores: { value: number; growth: number; profit: number; health: number; dividend: number; total: number };
  grade: string;
  oversold?: OversoldInfo;
  bargain?: { bargainScore: number; volumeRatio: number; near52Low: number };
  earningsDate?: string | null;
  targetMeanPrice?: number | null;
  targetHighPrice?: number | null;
  targetLowPrice?: number | null;
  numberOfAnalysts?: number | null;
  recommendationKey?: string | null;
  dcfFairValue?: number | null;
  dcfGrowthRate?: number | null;
  dcfDiscountRate?: number | null;
  categoryGrades: { value: string; growth: string; profit: string; health: string; dividend: string };
}

// ── 자동 진단 엔진 ──
interface Analysis {
  headline: string;
  verdict: "강력 매수" | "매수 관심" | "중립 보유" | "관망" | "주의";
  verdictColor: string;
  strengths: string[];
  risks: string[];
  keyInsight: string;
}

function analyzeStock(d: DetailData): Analysis {
  const strengths: string[] = [];
  const risks: string[] = [];

  // ── 수익성 분석 ──
  if (d.returnOnEquity != null && d.returnOnEquity > 0.25)
    strengths.push(`ROE ${(d.returnOnEquity * 100).toFixed(0)}%로 자본 효율이 뛰어남`);
  else if (d.returnOnEquity != null && d.returnOnEquity > 0.15)
    strengths.push(`ROE ${(d.returnOnEquity * 100).toFixed(0)}%로 양호한 수익성`);
  else if (d.returnOnEquity != null && d.returnOnEquity < 0.05)
    risks.push(`ROE ${(d.returnOnEquity * 100).toFixed(1)}%로 자본 효율 낮음`);

  if (d.profitMargins != null && d.profitMargins > 0.20)
    strengths.push(`순이익률 ${(d.profitMargins * 100).toFixed(0)}%의 고마진 사업`);
  else if (d.profitMargins != null && d.profitMargins < 0.05 && d.profitMargins >= 0)
    risks.push(`순이익률 ${(d.profitMargins * 100).toFixed(1)}%로 마진 박함`);
  else if (d.profitMargins != null && d.profitMargins < 0)
    risks.push(`적자 상태 (순이익률 ${(d.profitMargins * 100).toFixed(1)}%)`);

  if (d.operatingMargins != null && d.operatingMargins > 0.25)
    strengths.push(`영업이익률 ${(d.operatingMargins * 100).toFixed(0)}%로 경쟁력 우위`);

  // ── 성장성 분석 ──
  if (d.earningsGrowth != null && d.earningsGrowth > 0.2)
    strengths.push(`이익 성장률 +${(d.earningsGrowth * 100).toFixed(0)}%로 빠른 성장 중`);
  else if (d.earningsGrowth != null && d.earningsGrowth < -0.1)
    risks.push(`이익이 ${(d.earningsGrowth * 100).toFixed(0)}% 감소 중`);

  if (d.revenueGrowth != null && d.revenueGrowth > 0.15)
    strengths.push(`매출 +${(d.revenueGrowth * 100).toFixed(0)}% 성장으로 사업 확장 중`);
  else if (d.revenueGrowth != null && d.revenueGrowth < -0.05)
    risks.push(`매출이 ${(d.revenueGrowth * 100).toFixed(0)}% 역성장 중`);

  if (d.eps != null && d.epsForward != null && d.eps > 0) {
    const epsGrowth = (d.epsForward - d.eps) / d.eps;
    if (epsGrowth > 0.15)
      strengths.push(`EPS 전망치 +${(epsGrowth * 100).toFixed(0)}% → 이익 개선 기대`);
    else if (epsGrowth < -0.1)
      risks.push(`EPS 전망치 ${(epsGrowth * 100).toFixed(0)}% → 이익 하락 예상`);
  }

  // ── 가치 분석 ──
  if (d.pe != null && d.pe > 0 && d.pe < 15)
    strengths.push(`PER ${d.pe.toFixed(1)}로 저평가 구간`);
  else if (d.pe != null && d.pe > 40)
    risks.push(`PER ${d.pe.toFixed(0)}으로 높은 밸류에이션`);
  else if (d.pe != null && d.pe > 0 && d.forwardPE != null && d.forwardPE > 0 && d.forwardPE < d.pe * 0.8)
    strengths.push(`Forward PE ${d.forwardPE.toFixed(1)}로 실적 개선 시 밸류 해소 가능`);

  if (d.pb != null && d.pb > 0 && d.pb < 2)
    strengths.push(`PBR ${d.pb.toFixed(1)}로 자산가치 대비 저렴`);
  else if (d.pb != null && d.pb > 10)
    risks.push(`PBR ${d.pb.toFixed(0)}로 자산 대비 고평가`);

  if (d.pegRatio != null && d.pegRatio > 0 && d.pegRatio < 1)
    strengths.push(`PEG ${d.pegRatio.toFixed(1)}로 성장 대비 저렴 (PEG<1)`);
  else if (d.pegRatio != null && d.pegRatio > 2.5)
    risks.push(`PEG ${d.pegRatio.toFixed(1)}로 성장 대비 비싼 편`);

  // ── 재무 건전성 ──
  if (d.debtToEquity != null && d.debtToEquity < 30)
    strengths.push(`부채비율 ${d.debtToEquity.toFixed(0)}%로 재무구조 건전`);
  else if (d.debtToEquity != null && d.debtToEquity > 200)
    risks.push(`부채비율 ${d.debtToEquity.toFixed(0)}%로 재무 부담 큼`);

  if (d.currentRatio != null && d.currentRatio > 2)
    strengths.push(`유동비율 ${d.currentRatio.toFixed(1)}로 단기 지급 능력 충분`);
  else if (d.currentRatio != null && d.currentRatio < 1)
    risks.push(`유동비율 ${d.currentRatio.toFixed(1)}로 단기 유동성 주의`);

  if (d.freeCashflow != null && d.freeCashflow > 0)
    strengths.push(`잉여현금흐름 양수 → 실질 현금 창출력 보유`);

  // ── 주가 위치 ──
  if (d.oversold?.isOversold && d.eps != null && d.eps > 0)
    strengths.push(`흑자 기업인데 과매도 → 역발상 매수 기회 가능`);
  else if (d.oversold?.isOversold && (d.eps == null || d.eps <= 0))
    risks.push(`과매도이나 적자/무이익 → 추가 하락 가능성`);

  if (d.oversold && d.oversold.dropFromHigh < -30)
    risks.push(`고점 대비 ${d.oversold.dropFromHigh.toFixed(0)}% 하락으로 추세 약화`);

  if (d.beta != null && d.beta > 1.5)
    risks.push(`Beta ${d.beta.toFixed(1)}로 시장보다 변동성 높음`);

  // ── 배당 ──
  if (d.divYield != null && d.divYield > 0.03)
    strengths.push(`배당수익률 ${(d.divYield * 100).toFixed(1)}%로 안정적 현금 수익`);

  // ── Verdict 판정 ──
  const total = d.scores.total;
  const isOversold = d.oversold?.isOversold || false;
  const hasFundamentals = (d.eps ?? 0) > 0 && (d.returnOnEquity ?? 0) > 0.1;
  const isGrowing = (d.earningsGrowth ?? 0) > 0.1 || (d.revenueGrowth ?? 0) > 0.1;
  const isExpensive = (d.pe ?? 0) > 35;
  const isDeclining = (d.earningsGrowth ?? 0) < -0.1 && (d.revenueGrowth ?? 0) < 0;

  let verdict: Analysis["verdict"];
  let verdictColor: string;

  if (isOversold && hasFundamentals && total >= 50) {
    verdict = "강력 매수";
    verdictColor = "bg-red-600 text-white";
  } else if (total >= 70 && isGrowing && !isExpensive) {
    verdict = "매수 관심";
    verdictColor = "bg-emerald-600 text-white";
  } else if (total >= 55 && !isDeclining) {
    verdict = "중립 보유";
    verdictColor = "bg-blue-600 text-white";
  } else if (isDeclining || (isExpensive && !isGrowing)) {
    verdict = "주의";
    verdictColor = "bg-red-100 text-red-700";
  } else {
    verdict = "관망";
    verdictColor = "bg-zinc-200 text-zinc-700";
  }

  // ── Headline 생성 ──
  let headline = "";
  if (verdict === "강력 매수") {
    headline = `기본기 탄탄한 기업이 과매도 구간에 진입. 반등 시 수익 기회.`;
  } else if (isGrowing && hasFundamentals && !isExpensive) {
    headline = `이익이 성장하면서 수익성도 좋고, 가격도 합리적인 구간.`;
  } else if (isGrowing && isExpensive) {
    headline = `빠르게 성장 중이지만 이미 시장 기대가 높아 가격이 비싼 편.`;
  } else if (hasFundamentals && !isGrowing) {
    headline = `수익성은 좋지만 성장 모멘텀이 둔화. 안정형 투자에 적합.`;
  } else if (isDeclining) {
    headline = `이익과 매출이 동시에 줄고 있어 실적 바닥 확인 필요.`;
  } else if (isOversold) {
    headline = `큰 폭 하락으로 가격은 매력적이나, 하락 이유를 확인해야 함.`;
  } else {
    headline = `뚜렷한 강점이나 약점이 없는 중립적 상태. 추가 분석 필요.`;
  }

  // ── Key Insight ──
  let keyInsight = "";
  if (d.forwardPE != null && d.pe != null && d.pe > 0 && d.forwardPE > 0 && d.forwardPE < d.pe * 0.85) {
    keyInsight = `Forward PE(${d.forwardPE.toFixed(1)})가 현재 PE(${d.pe.toFixed(1)})보다 낮아, 시장은 이익 개선을 예상 중.`;
  } else if (d.oversold?.isOversold && (d.bargain?.bargainScore ?? 0) >= 50) {
    keyInsight = `저점매수 점수 ${d.bargain?.bargainScore}점 — 기술적으로 과매도 상태. 역발상 투자자에게 기회일 수 있음.`;
  } else if (d.returnOnEquity != null && d.returnOnEquity > 0.3 && d.debtToEquity != null && d.debtToEquity < 50) {
    keyInsight = `ROE ${(d.returnOnEquity * 100).toFixed(0)}% + 낮은 부채 — 자기자본으로 높은 수익을 내는 우량 기업.`;
  } else if (d.earningsGrowth != null && d.earningsGrowth > 0.25) {
    keyInsight = `이익이 연 ${(d.earningsGrowth * 100).toFixed(0)}%씩 급성장. 성장 유지 시 밸류에이션 정당화 가능.`;
  } else if (d.divYield != null && d.divYield > 0.03 && d.payoutRatio != null && d.payoutRatio < 0.7) {
    keyInsight = `배당수익률 ${(d.divYield * 100).toFixed(1)}% + 배당성향 ${(d.payoutRatio * 100).toFixed(0)}% — 배당 지속 가능성 높음.`;
  } else {
    keyInsight = `종합점수 ${d.scores.total}점 (${d.grade}등급). 투자 전 본인의 투자 성향과 목표에 맞는지 확인하세요.`;
  }

  return {
    headline,
    verdict,
    verdictColor,
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 4),
    keyInsight,
  };
}

const AI_API = "https://asia-northeast3-suile-21173.cloudfunctions.net/stockAiAnalysis";

interface AiAnalysis {
  ticker: string;
  name: string;
  date: string;
  recentTrend: string;
  strengths: string[];
  risks: string[];
  conclusion: string;
  sources: { title: string; url: string }[];
}

/** 마크다운 인라인 파싱 (**bold**, *italic*) */
function parseInline(text: string): React.ReactNode[] {
  // **bold** 와 *italic* 처리
  const parts = text.split(/(\*\*.*?\*\*|\*[^*]+?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

/** 마크다운 → React 변환 (bold, italic, 리스트, 줄바꿈) */
function MdText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="space-y-0.5 my-1">
        {listBuffer.map((item, li) => (
          <li key={li} className="flex gap-1.5 items-start">
            <span className="text-zinc-400 shrink-0 mt-px">•</span>
            <span>{parseInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 리스트 항목: -, *, •, 숫자.
    const listMatch = line.match(/^\s*(?:[-*•]|\d+[.)]) +(.+)/);
    if (listMatch) {
      listBuffer.push(listMatch[1]);
      continue;
    }
    flushList();
    if (line.trim() === "") {
      if (i > 0 && i < lines.length - 1) {
        elements.push(<br key={`br-${i}`} />);
      }
      continue;
    }
    if (elements.length > 0) {
      elements.push(<br key={`br-${i}`} />);
    }
    elements.push(<span key={`line-${i}`}>{parseInline(line)}</span>);
  }
  flushList();

  return <span className={className}>{elements}</span>;
}

const CATEGORIES = [
  { key: "profit", label: "수익력", max: 30 },
  { key: "growth", label: "성장력", max: 25 },
  { key: "value", label: "가격매력", max: 20 },
  { key: "health", label: "체력", max: 15 },
  { key: "dividend", label: "주주환원", max: 10 },
] as const;

/** 오각형 레이더 차트 (SVG) */
function RadarChart({ scores }: { scores: { profit: number; growth: number; value: number; health: number; dividend: number; total: number } }) {
  const total = scores.total;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 75; // 반지름

  // 5개 축: 수익력, 성장력, 가격매력, 체력, 주주환원 (시계방향, 12시 시작)
  const axes = CATEGORIES.map((cat, i) => {
    const pct = scores[cat.key as keyof typeof scores] / cat.max; // 0~1
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2; // 12시부터 시작
    return { ...cat, pct: Math.min(pct, 1), angle };
  });

  // 배경 격자 (20%, 40%, 60%, 80%, 100%)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const gridPolygons = gridLevels.map((level) =>
    axes.map((a) => {
      const x = cx + r * level * Math.cos(a.angle);
      const y = cy + r * level * Math.sin(a.angle);
      return `${x},${y}`;
    }).join(" ")
  );

  // 데이터 폴리곤
  const dataPoints = axes.map((a) => {
    const x = cx + r * a.pct * Math.cos(a.angle);
    const y = cy + r * a.pct * Math.sin(a.angle);
    return { x, y };
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // 총점 기반 색상
  const color = total >= 80 ? "#10b981" : total >= 60 ? "#3b82f6" : total >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 배경 격자 */}
        {gridPolygons.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="#e4e4e7"
            strokeWidth={i === gridPolygons.length - 1 ? 1.5 : 0.5}
          />
        ))}
        {/* 축선 */}
        {axes.map((a, i) => (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + r * Math.cos(a.angle)}
            y2={cy + r * Math.sin(a.angle)}
            stroke="#e4e4e7" strokeWidth={0.5}
          />
        ))}
        {/* 데이터 영역 */}
        <polygon
          points={dataPolygon}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={2}
        />
        {/* 데이터 포인트 */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
        {/* 라벨 */}
        {axes.map((a, i) => {
          const labelR = r + 18;
          const x = cx + labelR * Math.cos(a.angle);
          const y = cy + labelR * Math.sin(a.angle);
          const score = scores[a.key as keyof typeof scores];
          return (
            <text
              key={i}
              x={x} y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-zinc-600"
              fontSize={10}
              fontWeight={600}
            >
              {a.label} {score}
            </text>
          );
        })}
        {/* 중앙 총점 */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-zinc-800" fontSize={22} fontWeight={900}>
          {total}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-zinc-400" fontSize={9}>
          / 100
        </text>
      </svg>
    </div>
  );
}

// ── 매수 전 체크리스트 엔진 ──
type CheckStatus = "pass" | "warning" | "fail";
interface CheckItem {
  label: string;
  status: CheckStatus;
  detail: string;
}

function buildBuyChecklist(d: DetailData): CheckItem[] {
  const items: CheckItem[] = [];

  // 1. 흑자 기업인가?
  if (d.eps != null && d.eps > 0) {
    items.push({ label: "흑자 기업", status: "pass", detail: `EPS $${d.eps.toFixed(2)}` });
  } else if (d.eps == null) {
    items.push({ label: "흑자 기업", status: "warning", detail: "EPS 데이터 없음" });
  } else {
    items.push({ label: "흑자 기업", status: "fail", detail: `EPS $${d.eps.toFixed(2)} (적자)` });
  }

  // 2. 이익 성장
  if (d.earningsGrowth != null && d.earningsGrowth > 0.1) {
    items.push({ label: "이익 성장", status: "pass", detail: `+${(d.earningsGrowth * 100).toFixed(1)}%` });
  } else if (d.earningsGrowth != null && d.earningsGrowth > 0) {
    items.push({ label: "이익 성장", status: "warning", detail: `+${(d.earningsGrowth * 100).toFixed(1)}%` });
  } else if (d.earningsGrowth != null) {
    items.push({ label: "이익 성장", status: "fail", detail: `${(d.earningsGrowth * 100).toFixed(1)}%` });
  } else {
    items.push({ label: "이익 성장", status: "warning", detail: "데이터 없음" });
  }

  // 3. 매출 성장
  if (d.revenueGrowth != null && d.revenueGrowth > 0.1) {
    items.push({ label: "매출 성장", status: "pass", detail: `+${(d.revenueGrowth * 100).toFixed(1)}%` });
  } else if (d.revenueGrowth != null && d.revenueGrowth > 0) {
    items.push({ label: "매출 성장", status: "warning", detail: `+${(d.revenueGrowth * 100).toFixed(1)}%` });
  } else if (d.revenueGrowth != null) {
    items.push({ label: "매출 성장", status: "fail", detail: `${(d.revenueGrowth * 100).toFixed(1)}%` });
  } else {
    items.push({ label: "매출 성장", status: "warning", detail: "데이터 없음" });
  }

  // 4. 합리적 밸류에이션
  if (d.pe != null && d.pe > 0) {
    if (d.avgPE5Y != null && d.pe < d.avgPE5Y) {
      items.push({ label: "합리적 밸류", status: "pass", detail: `PE ${d.pe.toFixed(1)} < 5Y ${d.avgPE5Y.toFixed(1)}` });
    } else if (d.pe < 25) {
      items.push({ label: "합리적 밸류", status: "warning", detail: `PE ${d.pe.toFixed(1)}` });
    } else {
      items.push({ label: "합리적 밸류", status: "fail", detail: `PE ${d.pe.toFixed(1)}${d.avgPE5Y ? ` > 5Y ${d.avgPE5Y.toFixed(1)}` : " (고평가)"}` });
    }
  } else {
    items.push({ label: "합리적 밸류", status: "warning", detail: "PE 데이터 없음" });
  }

  // 5. 재무 건전성
  const de = d.debtToEquity;
  const cr = d.currentRatio;
  if (de != null && cr != null && de < 100 && cr > 1) {
    items.push({ label: "건전한 재무", status: "pass", detail: `D/E ${de.toFixed(0)}% · CR ${cr.toFixed(1)}` });
  } else if (de != null && de < 200) {
    items.push({ label: "건전한 재무", status: "warning", detail: `D/E ${de.toFixed(0)}%${cr != null ? ` · CR ${cr.toFixed(1)}` : ""}` });
  } else if (de != null) {
    items.push({ label: "건전한 재무", status: "fail", detail: `D/E ${de.toFixed(0)}%${cr != null ? ` · CR ${cr.toFixed(1)}` : ""}` });
  } else {
    items.push({ label: "건전한 재무", status: "warning", detail: "데이터 없음" });
  }

  // 6. 수익성
  const roe = d.returnOnEquity;
  const pm = d.profitMargins;
  if (roe != null && pm != null && roe > 0.15 && pm > 0.1) {
    items.push({ label: "높은 수익성", status: "pass", detail: `ROE ${(roe * 100).toFixed(0)}% · 순이익률 ${(pm * 100).toFixed(0)}%` });
  } else if (roe != null && roe > 0.05) {
    items.push({ label: "높은 수익성", status: "warning", detail: `ROE ${(roe * 100).toFixed(0)}%${pm != null ? ` · 순이익률 ${(pm * 100).toFixed(0)}%` : ""}` });
  } else if (roe != null) {
    items.push({ label: "높은 수익성", status: "fail", detail: `ROE ${(roe * 100).toFixed(1)}%${pm != null ? ` · 순이익률 ${(pm * 100).toFixed(1)}%` : ""}` });
  } else {
    items.push({ label: "높은 수익성", status: "warning", detail: "데이터 없음" });
  }

  // 7. 현금흐름
  if (d.freeCashflow != null && d.freeCashflow > 0) {
    const fcfStr = d.freeCashflow >= 1e9 ? `$${(d.freeCashflow / 1e9).toFixed(1)}B` : `$${(d.freeCashflow / 1e6).toFixed(0)}M`;
    items.push({ label: "양의 현금흐름", status: "pass", detail: `FCF ${fcfStr}` });
  } else if (d.freeCashflow == null) {
    items.push({ label: "양의 현금흐름", status: "warning", detail: "데이터 없음" });
  } else {
    const fcfStr = d.freeCashflow <= -1e9 ? `-$${(Math.abs(d.freeCashflow) / 1e9).toFixed(1)}B` : `-$${(Math.abs(d.freeCashflow) / 1e6).toFixed(0)}M`;
    items.push({ label: "양의 현금흐름", status: "fail", detail: `FCF ${fcfStr}` });
  }

  // 8. 주가 위치
  if (d.oversold) {
    if (!d.oversold.belowMA200 && !d.oversold.belowMA50) {
      items.push({ label: "안전한 위치", status: "pass", detail: "이평선 상회 중" });
    } else if (d.oversold.belowMA50 && !d.oversold.belowMA200) {
      items.push({ label: "안전한 위치", status: "warning", detail: "50일선 하회" });
    } else {
      items.push({ label: "안전한 위치", status: "fail", detail: d.oversold.isOversold ? "과매도 구간" : "200일선 하회" });
    }
  } else {
    items.push({ label: "안전한 위치", status: "warning", detail: "데이터 없음" });
  }

  // 9. 변동성
  if (d.beta != null) {
    if (d.beta < 1.2) {
      items.push({ label: "낮은 변동성", status: "pass", detail: `Beta ${d.beta.toFixed(2)}` });
    } else if (d.beta < 1.5) {
      items.push({ label: "낮은 변동성", status: "warning", detail: `Beta ${d.beta.toFixed(2)}` });
    } else {
      items.push({ label: "낮은 변동성", status: "fail", detail: `Beta ${d.beta.toFixed(2)}` });
    }
  } else {
    items.push({ label: "낮은 변동성", status: "warning", detail: "Beta 데이터 없음" });
  }

  // 10. 실적 발표 일정
  if (d.earningsDate) {
    const diff = Math.ceil((new Date(d.earningsDate).getTime() - Date.now()) / 86400000);
    if (diff < 0) {
      items.push({ label: "실적 일정", status: "pass", detail: "최근 발표 완료" });
    } else if (diff > 30) {
      items.push({ label: "실적 일정", status: "pass", detail: `${diff}일 후 발표` });
    } else if (diff >= 7) {
      items.push({ label: "실적 일정", status: "warning", detail: `${diff}일 후 발표` });
    } else {
      items.push({ label: "실적 일정", status: "fail", detail: `${diff}일 후 발표 임박` });
    }
  } else {
    items.push({ label: "실적 일정", status: "warning", detail: "일정 미확인" });
  }

  return items;
}

/** 매수 전 체크리스트 UI */
function BuyChecklist({ data }: { data: DetailData }) {
  const items = useMemo(() => buildBuyChecklist(data), [data]);
  const passCount = items.filter((i) => i.status === "pass").length;
  const passRate = passCount / items.length;

  const gaugeColor = passRate >= 0.8 ? "bg-emerald-500" : passRate >= 0.5 ? "bg-amber-500" : "bg-red-500";
  const gaugeTextColor = passRate >= 0.8 ? "text-emerald-700" : passRate >= 0.5 ? "text-amber-700" : "text-red-700";
  const statusIcon = (s: CheckStatus) => s === "pass" ? "✅" : s === "warning" ? "⚠️" : "❌";
  const statusColor = (s: CheckStatus) => s === "pass" ? "text-emerald-700" : s === "warning" ? "text-amber-600" : "text-red-600";

  return (
    <div className="mx-4 mb-3">
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-zinc-500">매수 전 체크리스트</p>
          <span className={`text-xs font-black ${gaugeTextColor}`}>
            {passCount}/{items.length} 통과
          </span>
        </div>

        {/* 게이지 바 */}
        <div className="h-2 bg-zinc-200 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full ${gaugeColor} rounded-full transition-all duration-500`}
            style={{ width: `${passRate * 100}%` }}
          />
        </div>

        {/* 항목 리스트 */}
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="text-xs shrink-0 w-4 text-center">{statusIcon(item.status)}</span>
              <span className={`text-[11px] font-semibold min-w-[72px] ${statusColor(item.status)}`}>
                {item.label}
              </span>
              <span className="text-[10px] text-zinc-500 truncate">{item.detail}</span>
            </div>
          ))}
        </div>

        {/* 요약 한줄 */}
        <div className={`mt-2.5 pt-2 border-t border-zinc-200 text-center`}>
          <p className={`text-[10px] font-bold ${gaugeTextColor}`}>
            {passRate >= 0.8
              ? "대부분 항목을 충족합니다. 매수 조건이 양호합니다."
              : passRate >= 0.6
                ? "주요 항목은 충족하나 일부 주의가 필요합니다."
                : passRate >= 0.4
                  ? "주의 항목이 많습니다. 신중한 판단이 필요합니다."
                  : "미충족 항목이 많습니다. 충분한 분석 후 결정하세요."}
          </p>
        </div>
      </div>
    </div>
  );
}

function fmtMC(n?: number) {
  if (!n) return "-";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(v?: number | null) {
  if (v == null) return "-";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v?: number | null, digits = 1) {
  if (v == null) return "-";
  return v.toFixed(digits);
}

export function ScoreCard({ data, onClose }: { data: DetailData; onClose?: () => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const [aiData, setAiData] = useState<AiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const { scores, grade } = data;
  const analysis = useMemo(() => analyzeStock(data), [data]);

  const loadAiAnalysis = useCallback(async () => {
    if (aiData || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      const financials = {
        name: data.name,
        price: data.price,
        marketCap: data.marketCap,
        pe: data.pe,
        forwardPE: data.forwardPE,
        pb: data.pb,
        divYield: data.divYield,
        w52change: data.w52change,
        returnOnEquity: data.returnOnEquity,
        profitMargins: data.profitMargins,
        revenueGrowth: data.revenueGrowth,
        earningsGrowth: data.earningsGrowth,
        debtToEquity: data.debtToEquity,
      };
      const url = `${AI_API}?ticker=${encodeURIComponent(data.ticker)}&data=${encodeURIComponent(JSON.stringify(financials))}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "AI 분석 실패");
      }
      const result: AiAnalysis = await res.json();
      setAiData(result);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "AI 분석 중 오류가 발생했습니다");
    } finally {
      setAiLoading(false);
    }
  }, [data, aiData, aiLoading]);

  const shareUrl = `https://suile-21173.web.app/ss?t=${encodeURIComponent(data.ticker)}&s=${scores.total}&g=${grade}&n=${encodeURIComponent(data.name)}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${data.name} 투자 성적표`,
          text: analysis.headline,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("링크가 복사되었습니다!");
      }
    } catch { /* cancelled */ }
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
      {/* 헤더 — 종목 정보 */}
      <div className="bg-zinc-900 p-5">
        <div className="flex items-center gap-3">
          <StockLogo ticker={data.ticker} name={data.name} size={52} className="ring-2 ring-white/20" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white text-lg font-black">{data.name}</p>
              <span className="text-zinc-400 text-xs">{data.ticker}</span>
            </div>
            {data.price && (
              <p className="text-zinc-300 text-sm font-bold mt-0.5">
                ${data.price.toFixed(2)} <span className="text-zinc-500 text-xs font-normal">· {fmtMC(data.marketCap)}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 레이더 차트 */}
      <div className="px-4 pt-4 pb-2">
        <RadarChart scores={scores} />
      </div>

      {/* ── 밸류에이션 대시보드 ── */}
      <div className="mx-4 mt-3 space-y-2.5">

        {/* P/E 3종 비교 카드 */}
        {data.pe && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-3">
            <p className="text-[10px] font-bold text-zinc-500 mb-2">P/E 비교</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-black text-zinc-800">{data.pe.toFixed(1)}</div>
                <div className="text-[9px] text-zinc-400 mt-0.5">현재 P/E</div>
              </div>
              <div>
                <div className={`text-xl font-black ${
                  data.forwardPE && data.forwardPE < data.pe ? "text-emerald-600" : "text-orange-600"
                }`}>
                  {data.forwardPE ? data.forwardPE.toFixed(1) : "-"}
                </div>
                <div className="text-[9px] text-zinc-400 mt-0.5">Forward P/E</div>
              </div>
              <div>
                <div className="text-xl font-black text-violet-600">
                  {data.avgPE5Y ? data.avgPE5Y.toFixed(1) : "-"}
                </div>
                <div className="text-[9px] text-zinc-400 mt-0.5">5Y 중위 P/E</div>
              </div>
            </div>

            {/* Forward vs 현재 비교 */}
            {data.forwardPE && data.pe && (
              <div className="mt-2.5 pt-2 border-t border-zinc-200">
                {(() => {
                  const fwdDiff = ((data.forwardPE - data.pe) / data.pe) * 100;
                  return (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">Forward vs 현재</span>
                      <span className={`font-bold ${fwdDiff < -10 ? "text-emerald-600" : fwdDiff < 0 ? "text-blue-600" : "text-zinc-500"}`}>
                        {fwdDiff > 0 ? "+" : ""}{fwdDiff.toFixed(0)}%
                        {fwdDiff < -15 ? " → 이익 개선 기대" : fwdDiff < -5 ? " → 약간 개선 기대" : fwdDiff > 5 ? " → 이익 둔화 우려" : " → 유지"}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 5Y 평균 대비 */}
            {data.avgPE5Y && data.pe && (
              <div className="mt-1.5">
                {(() => {
                  const histDiff = ((data.pe - data.avgPE5Y) / data.avgPE5Y) * 100;
                  let label = ""; let color = "";
                  if (histDiff < -20) { label = "역사적 저평가"; color = "text-emerald-600"; }
                  else if (histDiff < -10) { label = "저평가"; color = "text-emerald-600"; }
                  else if (histDiff < 10) { label = "적정 수준"; color = "text-zinc-600"; }
                  else if (histDiff < 30) { label = "고평가"; color = "text-orange-600"; }
                  else { label = "역사적 고평가"; color = "text-red-600"; }
                  return (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">현재 vs 5년 평균</span>
                      <span className={`font-bold ${color}`}>
                        {histDiff > 0 ? "+" : ""}{histDiff.toFixed(0)}% · {label}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── 적정가격 대시보드 ── */}
        {data.price && (data.dcfFairValue || data.targetMeanPrice) && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-3 py-3">
            <p className="text-[10px] font-bold text-blue-600 mb-2.5">이 가격에 사도 될까?</p>

            {/* 현재가 vs 적정가 비교 */}
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div>
                <div className="text-lg font-black text-zinc-800">${data.price.toFixed(2)}</div>
                <div className="text-[9px] text-zinc-400 mt-0.5">현재가</div>
              </div>
              {data.dcfFairValue && (
                <div>
                  <div className={`text-lg font-black ${
                    data.price < data.dcfFairValue ? "text-emerald-600" : "text-red-600"
                  }`}>${data.dcfFairValue.toFixed(2)}</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">DCF 적정가</div>
                </div>
              )}
              {data.targetMeanPrice && (
                <div>
                  <div className={`text-lg font-black ${
                    data.price < data.targetMeanPrice ? "text-emerald-600" : "text-red-600"
                  }`}>${data.targetMeanPrice.toFixed(2)}</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">
                    애널리스트{data.numberOfAnalysts ? ` (${data.numberOfAnalysts}명)` : ""}
                  </div>
                </div>
              )}
            </div>

            {/* 가격 범위 게이지 */}
            {(() => {
              const prices = [
                data.targetLowPrice,
                data.dcfFairValue,
                data.targetMeanPrice,
                data.targetHighPrice,
              ].filter((v): v is number => v != null && v > 0);
              const lo = Math.min(...prices, data.price) * 0.95;
              const hi = Math.max(...prices, data.price) * 1.05;
              const range = hi - lo;
              const pos = (v: number) => `${Math.max(2, Math.min(98, ((v - lo) / range) * 100))}%`;

              return (
                <div className="relative h-3 bg-gradient-to-r from-emerald-200 via-blue-100 to-red-200 rounded-full mb-1">
                  {/* 애널리스트 범위 */}
                  {data.targetLowPrice && data.targetHighPrice && (
                    <div
                      className="absolute top-0.5 h-2 bg-blue-300/40 rounded-full"
                      style={{
                        left: pos(data.targetLowPrice),
                        width: `${((data.targetHighPrice - data.targetLowPrice) / range) * 100}%`,
                      }}
                    />
                  )}
                  {/* DCF 마커 */}
                  {data.dcfFairValue && (
                    <div
                      className="absolute top-[-2px] w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-indigo-500"
                      style={{ left: pos(data.dcfFairValue), transform: "translateX(-50%)" }}
                      title={`DCF $${data.dcfFairValue.toFixed(0)}`}
                    />
                  )}
                  {/* 현재가 마커 */}
                  <div
                    className="absolute top-[-3px] w-3.5 h-3.5 bg-zinc-800 rounded-full border-2 border-white shadow"
                    style={{ left: pos(data.price), transform: "translateX(-50%)" }}
                  />
                </div>
              );
            })()}
            <div className="flex justify-between text-[8px] text-zinc-400 mb-2.5">
              <span>저평가</span>
              <span>● 현재가</span>
              <span>고평가</span>
            </div>

            {/* 상승여력 요약 */}
            <div className="space-y-1 pt-2 border-t border-blue-200/60">
              {data.dcfFairValue && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">DCF 기준 상승여력</span>
                  {(() => {
                    const upside = ((data.dcfFairValue - data.price) / data.price) * 100;
                    return (
                      <span className={`font-bold ${upside > 10 ? "text-emerald-600" : upside > 0 ? "text-blue-600" : upside > -10 ? "text-zinc-600" : "text-red-600"}`}>
                        {upside > 0 ? "+" : ""}{upside.toFixed(1)}%
                        {upside > 20 ? " 저평가" : upside > 0 ? " 약간 저평가" : upside > -10 ? " 적정" : " 고평가"}
                      </span>
                    );
                  })()}
                </div>
              )}
              {data.targetMeanPrice && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">월가 컨센서스 기준</span>
                  {(() => {
                    const upside = ((data.targetMeanPrice - data.price) / data.price) * 100;
                    return (
                      <span className={`font-bold ${upside > 10 ? "text-emerald-600" : upside > 0 ? "text-blue-600" : upside > -10 ? "text-zinc-600" : "text-red-600"}`}>
                        {upside > 0 ? "+" : ""}{upside.toFixed(1)}%
                        {data.recommendationKey ? ` · ${
                          data.recommendationKey === "strongBuy" ? "적극 매수" :
                          data.recommendationKey === "buy" ? "매수" :
                          data.recommendationKey === "hold" ? "보유" :
                          data.recommendationKey === "sell" ? "매도" :
                          data.recommendationKey === "strongSell" ? "적극 매도" :
                          data.recommendationKey
                        }` : ""}
                      </span>
                    );
                  })()}
                </div>
              )}
              {data.targetLowPrice && data.targetHighPrice && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">애널리스트 목표가 범위</span>
                  <span className="font-medium text-zinc-600">
                    ${data.targetLowPrice.toFixed(0)} ~ ${data.targetHighPrice.toFixed(0)}
                  </span>
                </div>
              )}
              {data.dcfGrowthRate != null && data.dcfDiscountRate != null && (
                <div className="text-[9px] text-zinc-400 mt-1">
                  DCF 가정: EPS 성장률 {data.dcfGrowthRate}% · 할인율 {data.dcfDiscountRate}%
                </div>
              )}
            </div>
          </div>
        )}

        {/* PEG 카드 */}
        {data.pegRatio != null && (
          <div className={`rounded-xl border overflow-hidden ${
            data.pegRatio < 1 ? "bg-emerald-50 border-emerald-200"
              : data.pegRatio < 2 ? "bg-zinc-50 border-zinc-200"
              : "bg-red-50 border-red-200"
          }`}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="text-center shrink-0">
                <div className={`text-2xl font-black ${
                  data.pegRatio < 1 ? "text-emerald-600" : data.pegRatio < 2 ? "text-zinc-700" : "text-red-600"
                }`}>{data.pegRatio.toFixed(2)}</div>
                <div className="text-[9px] text-zinc-400">PEG</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold ${
                  data.pegRatio < 0.5 ? "text-emerald-700" : data.pegRatio < 1 ? "text-emerald-600"
                    : data.pegRatio < 1.5 ? "text-blue-600" : data.pegRatio < 2 ? "text-zinc-600"
                    : data.pegRatio < 3 ? "text-orange-600" : "text-red-600"
                }`}>
                  {data.pegRatio < 0.5 ? "극심한 저평가" : data.pegRatio < 1 ? "저평가"
                    : data.pegRatio < 1.5 ? "약간 저평가" : data.pegRatio < 2 ? "적정"
                    : data.pegRatio < 3 ? "약간 고평가" : "고평가"}
                </div>
                {data.pegPE != null && data.pegEpsGrowth != null ? (
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    PE {data.pegPE.toFixed(1)} ÷ EPS성장률 {data.pegEpsGrowth.toFixed(1)}%
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-400 mt-0.5">1 이하 = 성장 대비 저평가</div>
                )}
              </div>
            </div>
            {/* 게이지 */}
            <div className="px-3 pb-2">
              <div className="relative h-1.5 bg-gradient-to-r from-emerald-300 via-zinc-200 to-red-300 rounded-full">
                <div
                  className="absolute top-[-3px] w-3 h-3 bg-white border-2 border-zinc-700 rounded-full shadow"
                  style={{ left: `${Math.min(Math.max((data.pegRatio / 4) * 100, 2), 98)}%`, transform: "translateX(-50%)" }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[8px] text-zinc-400">
                <span>저평가</span>
                <span>적정 1.0</span>
                <span>고평가</span>
              </div>
            </div>
          </div>
        )}

        {/* PEG 시계열 차트 링크 */}
        <a
          href={`/tools/peg-chart?tickers=${data.ticker}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors"
        >
          <span className="text-lg">📈</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-violet-700">PEG 시계열 차트 보기</p>
            <p className="text-[9px] text-violet-500">{data.ticker}의 분기별 PEG 추이를 확인하세요</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-violet-400 shrink-0" />
        </a>
      </div>

      {/* 투자 의견 */}
      <div className="px-4 pt-4 pb-3 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-black ${analysis.verdictColor}`}>
            {analysis.verdict}
          </span>
          <p className="text-xs text-zinc-700 leading-relaxed pt-0.5">{analysis.headline}</p>
        </div>

        {/* 핵심 인사이트 */}
        <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
          <p className="text-[11px] text-violet-800 leading-relaxed">
            <span className="font-bold">핵심:</span> {analysis.keyInsight}
          </p>
        </div>
      </div>

      {/* 강점 / 리스크 */}
      {(analysis.strengths.length > 0 || analysis.risks.length > 0) && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2.5">
          {analysis.strengths.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-emerald-700">강점</p>
              {analysis.strengths.map((s, i) => (
                <p key={i} className="text-[10px] text-zinc-600 leading-snug flex gap-1">
                  <span className="text-emerald-500 shrink-0">+</span>
                  {s}
                </p>
              ))}
            </div>
          )}
          {analysis.risks.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-red-700">리스크</p>
              {analysis.risks.map((r, i) => (
                <p key={i} className="text-[10px] text-zinc-600 leading-snug flex gap-1">
                  <span className="text-red-500 shrink-0">-</span>
                  {r}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 매수 전 체크리스트 */}
      <BuyChecklist data={data} />

      {/* 주요 시그널 */}
      <div className="mx-4 mb-3 space-y-1.5">
        {/* 과매도 시그널 */}
        {data.oversold && data.oversold.dropFromHigh < -5 && (
          <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] ${
            data.oversold.isOversold ? "bg-red-50 text-red-700" : data.oversold.dropFromHigh < -15 ? "bg-amber-50 text-amber-700" : "bg-zinc-50 text-zinc-600"
          }`}>
            <span className="shrink-0 mt-px">{data.oversold.isOversold ? "🔻" : "📉"}</span>
            <span>
              <strong>52주 고점 대비 {data.oversold.dropFromHigh.toFixed(1)}% 하락.</strong>
              {data.oversold.isOversold
                ? " 과매도 구간에 진입했습니다. 기술적 반등 가능성이 있습니다."
                : data.oversold.dropFromHigh < -20
                  ? " 상당한 하락폭입니다. 실적 확인 후 분할매수를 고려해볼 수 있습니다."
                  : " 소폭 조정 중입니다."
              }
            </span>
          </div>
        )}
        {/* 이평선 시그널 */}
        {data.oversold?.belowMA200 && data.oversold.ma200 && data.price && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-[11px]">
            <span className="shrink-0 mt-px">⚠️</span>
            <span>
              200일 이동평균선(${data.oversold.ma200.toFixed(0)})을 하회 중.
              장기 추세가 약화되고 있으며 추가 하락 가능성에 유의하세요.
            </span>
          </div>
        )}
        {data.oversold && !data.oversold.belowMA50 && !data.oversold.belowMA200 && data.oversold.dropFromHigh >= -5 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-[11px]">
            <span className="shrink-0 mt-px">✅</span>
            <span>
              50일·200일 이평선 모두 상회 중이며 고점 근처에 위치합니다. 기술적으로 양호한 상태입니다.
            </span>
          </div>
        )}
        {/* 거래량 시그널 */}
        {data.bargain && data.bargain.volumeRatio > 1.5 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-50 text-orange-700 text-[11px]">
            <span className="shrink-0 mt-px">📊</span>
            <span>
              최근 거래량이 평소의 <strong>{data.bargain.volumeRatio.toFixed(1)}배</strong>로
              {data.bargain.volumeRatio > 2 ? " 크게 증가했습니다. 기관·세력의 매매 신호일 수 있습니다." : " 늘었습니다. 관심이 집중되고 있습니다."}
            </span>
          </div>
        )}
        {/* 52주 가격 위치 */}
        {data.w52high != null && data.w52low != null && data.price != null && (
          <div className="px-3 py-2 rounded-lg bg-zinc-50 text-[11px] text-zinc-600">
            <div className="flex justify-between mb-1">
              <span>52주 범위</span>
              <span className="font-bold">${data.w52low.toFixed(2)} ~ ${data.w52high.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-gradient-to-r from-red-200 via-amber-200 to-green-200 rounded-full overflow-hidden relative">
              <div
                className="absolute top-0 h-full w-1.5 bg-zinc-800 rounded"
                style={{ left: `${Math.max(0, Math.min(100, ((data.price - data.w52low) / (data.w52high - data.w52low)) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 세부 지표 토글 */}
      <div className="border-t">
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="w-full flex items-center justify-center gap-1 py-2.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          {showDetail ? "접기" : "세부 지표 보기"}
          {showDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showDetail && (
          <div className="animate-in fade-in-0 duration-200">
            {/* 세부 숫자 지표 */}
            <div className="px-4 pb-4 pt-2 border-t border-dashed border-zinc-100 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <Metric label="PER" value={fmtNum(data.pe)} />
              <Metric label="Forward PE" value={fmtNum(data.forwardPE)} />
              <Metric label="PBR" value={fmtNum(data.pb)} />
              <Metric label="PEG" value={fmtNum(data.pegRatio)} />
              <Metric label="EPS (TTM)" value={fmtNum(data.eps, 2)} />
              <Metric label="EPS (Forward)" value={fmtNum(data.epsForward, 2)} />
              <Metric label="배당수익률" value={fmtPct(data.divYield)} />
              <Metric label="52주 수익률" value={fmtPct(data.w52change)} />
              <Metric label="ROE" value={fmtPct(data.returnOnEquity)} />
              <Metric label="ROA" value={fmtPct(data.returnOnAssets)} />
              <Metric label="영업이익률" value={fmtPct(data.operatingMargins)} />
              <Metric label="순이익률" value={fmtPct(data.profitMargins)} />
              <Metric label="부채비율" value={data.debtToEquity != null ? `${data.debtToEquity.toFixed(0)}%` : "-"} />
              <Metric label="유동비율" value={fmtNum(data.currentRatio)} />
              <Metric label="매출 성장" value={fmtPct(data.revenueGrowth)} />
              <Metric label="이익 성장" value={fmtPct(data.earningsGrowth)} />
              <Metric label="Beta" value={fmtNum(data.beta)} />
              <Metric label="배당성향" value={fmtPct(data.payoutRatio)} />
              {data.avgPE5Y && <Metric label="5Y 중위 P/E" value={data.avgPE5Y.toFixed(1)} />}
            </div>
          </div>
        )}
      </div>

      {/* AI 분석 섹션 */}
      <div className="border-t">
        {!aiData && !aiLoading && !aiError && (
          <button
            onClick={loadAiAnalysis}
            className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-violet-600 hover:bg-violet-50 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI 뉴스 분석 보기
          </button>
        )}

        {aiLoading && (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              <span className="text-xs text-violet-600 font-medium">AI가 최신 뉴스를 분석하고 있습니다...</span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {aiError && (
          <div className="px-4 py-3 text-center">
            <p className="text-xs text-red-500">{aiError}</p>
            <button
              onClick={() => { setAiError(""); setAiData(null); loadAiAnalysis(); }}
              className="text-[10px] text-violet-600 mt-1 underline"
            >
              다시 시도
            </button>
          </div>
        )}

        {aiData && (
          <div className="px-4 py-3 space-y-3 animate-in fade-in-0 duration-300">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-xs font-bold text-violet-700">Gemini AI 분석</span>
              <span className="text-[9px] text-zinc-400 ml-auto">{aiData.date}</span>
            </div>

            {/* 최근 동향 */}
            {aiData.recentTrend && (
              <div className="bg-zinc-50 rounded-lg px-3 py-2">
                <p className="text-[10px] font-bold text-zinc-600 mb-1">최근 동향</p>
                <p className="text-[11px] text-zinc-700 leading-relaxed">
                  <MdText text={aiData.recentTrend} />
                </p>
              </div>
            )}

            {/* 매력 + 리스크 */}
            <div className="grid grid-cols-2 gap-2.5">
              {aiData.strengths.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-emerald-700">투자 매력</p>
                  {aiData.strengths.map((s, i) => (
                    <p key={i} className="text-[10px] text-zinc-600 leading-snug flex gap-1">
                      <span className="text-emerald-500 shrink-0">+</span>
                      <MdText text={s} />
                    </p>
                  ))}
                </div>
              )}
              {aiData.risks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-red-700">리스크</p>
                  {aiData.risks.map((r, i) => (
                    <p key={i} className="text-[10px] text-zinc-600 leading-snug flex gap-1">
                      <span className="text-red-500 shrink-0">-</span>
                      <MdText text={r} />
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* 종합 의견 */}
            {aiData.conclusion && (
              <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                <p className="text-[11px] text-violet-800 font-medium leading-relaxed">
                  <MdText text={aiData.conclusion} />
                </p>
              </div>
            )}

            {/* 뉴스 출처 - 인라인 썸네일 */}
            {aiData.sources.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[9px] font-bold text-zinc-500">참고 뉴스</p>
                {aiData.sources.map((src, i) => {
                  let domain = "";
                  try { domain = new URL(src.url).hostname.replace("www.", ""); } catch { /* */ }
                  const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
                  return (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-zinc-100 bg-white hover:bg-zinc-50 hover:border-zinc-200 transition-colors group"
                    >
                      {/* 파비콘 */}
                      <div className="shrink-0 w-8 h-8 rounded-md bg-zinc-100 flex items-center justify-center overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={faviconUrl}
                          alt=""
                          width={20}
                          height={20}
                          className="rounded-sm"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                      {/* 텍스트 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-zinc-800 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
                          {src.title || src.url}
                        </p>
                        <p className="text-[9px] text-zinc-400 mt-0.5 flex items-center gap-1">
                          <span>{domain}</span>
                          <ExternalLink className="h-2 w-2" />
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 면책 + 액션 */}
      <div className="border-t px-4 pt-2 pb-1">
        <p className="text-[8px] text-zinc-400 text-center leading-relaxed">
          본 분석은 공개 재무 데이터와 AI 기반 자동 생성이며 투자 권유가 아닙니다.
          투자 결정은 본인 판단과 책임 하에 하시기 바랍니다.
        </p>
      </div>
      <div className="px-3 pb-3 flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-medium hover:bg-zinc-50 transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" />
          공유
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors"
          >
            닫기
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-800">{value}</span>
    </div>
  );
}
