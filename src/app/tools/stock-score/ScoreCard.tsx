"use client";

import { Share2, ChevronDown, ChevronUp, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { StockLogo } from "../stock-battle/StockLogo";
import { useI18n } from "@/components/i18n/I18nProvider";

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
  verdict: string;
  verdictColor: string;
  strengths: string[];
  risks: string[];
  keyInsight: string;
}

/* ── 분석 텍스트 로케일 ── */
const AL = {
  ko: {
    roeExcellent: (v: number) => `ROE ${v}%로 자본 효율이 뛰어남`,
    roeGood: (v: number) => `ROE ${v}%로 양호한 수익성`,
    roeLow: (v: number) => `ROE ${v}%로 자본 효율 낮음`,
    pmHigh: (v: number) => `순이익률 ${v}%의 고마진 사업`,
    pmLow: (v: number) => `순이익률 ${v}%로 마진 박함`,
    pmNeg: (v: number) => `적자 상태 (순이익률 ${v}%)`,
    omHigh: (v: number) => `영업이익률 ${v}%로 경쟁력 우위`,
    egHigh: (v: number) => `이익 성장률 +${v}%로 빠른 성장 중`,
    egLow: (v: number) => `이익이 ${v}% 감소 중`,
    rgHigh: (v: number) => `매출 +${v}% 성장으로 사업 확장 중`,
    rgLow: (v: number) => `매출이 ${v}% 역성장 중`,
    epsUp: (v: number) => `EPS 전망치 +${v}% → 이익 개선 기대`,
    epsDown: (v: number) => `EPS 전망치 ${v}% → 이익 하락 예상`,
    peLow: (v: string) => `PER ${v}로 저평가 구간`,
    peHigh: (v: string) => `PER ${v}으로 높은 밸류에이션`,
    fwdPeGood: (v: string) => `Forward PE ${v}로 실적 개선 시 밸류 해소 가능`,
    pbLow: (v: string) => `PBR ${v}로 자산가치 대비 저렴`,
    pbHigh: (v: string) => `PBR ${v}로 자산 대비 고평가`,
    pegLow: (v: string) => `PEG ${v}로 성장 대비 저렴 (PEG<1)`,
    pegHigh: (v: string) => `PEG ${v}로 성장 대비 비싼 편`,
    debtLow: (v: string) => `부채비율 ${v}%로 재무구조 건전`,
    debtHigh: (v: string) => `부채비율 ${v}%로 재무 부담 큼`,
    crHigh: (v: string) => `유동비율 ${v}로 단기 지급 능력 충분`,
    crLow: (v: string) => `유동비율 ${v}로 단기 유동성 주의`,
    fcfPos: "잉여현금흐름 양수 → 실질 현금 창출력 보유",
    oversoldProfit: "흑자 기업인데 과매도 → 역발상 매수 기회 가능",
    oversoldLoss: "과매도이나 적자/무이익 → 추가 하락 가능성",
    dropHigh: (v: string) => `고점 대비 ${v}% 하락으로 추세 약화`,
    betaHigh: (v: string) => `Beta ${v}로 시장보다 변동성 높음`,
    divHigh: (v: string) => `배당수익률 ${v}%로 안정적 현금 수익`,
    verdictStrongBuy: "강력 매수",
    verdictBuy: "매수 관심",
    verdictHold: "중립 보유",
    verdictWatch: "관망",
    verdictCaution: "주의",
    hlStrongBuy: "기본기 탄탄한 기업이 과매도 구간에 진입. 반등 시 수익 기회.",
    hlGrowValue: "이익이 성장하면서 수익성도 좋고, 가격도 합리적인 구간.",
    hlGrowExp: "빠르게 성장 중이지만 이미 시장 기대가 높아 가격이 비싼 편.",
    hlStable: "수익성은 좋지만 성장 모멘텀이 둔화. 안정형 투자에 적합.",
    hlDecline: "이익과 매출이 동시에 줄고 있어 실적 바닥 확인 필요.",
    hlOversold: "큰 폭 하락으로 가격은 매력적이나, 하락 이유를 확인해야 함.",
    hlNeutral: "뚜렷한 강점이나 약점이 없는 중립적 상태. 추가 분석 필요.",
    kiFwdPe: (fwd: string, cur: string) => `Forward PE(${fwd})가 현재 PE(${cur})보다 낮아, 시장은 이익 개선을 예상 중.`,
    kiBargain: (s: number) => `저점매수 점수 ${s}점 — 기술적으로 과매도 상태. 역발상 투자자에게 기회일 수 있음.`,
    kiRoe: (v: number) => `ROE ${v}% + 낮은 부채 — 자기자본으로 높은 수익을 내는 우량 기업.`,
    kiGrowth: (v: number) => `이익이 연 ${v}%씩 급성장. 성장 유지 시 밸류에이션 정당화 가능.`,
    kiDiv: (dy: string, pr: string) => `배당수익률 ${dy}% + 배당성향 ${pr}% — 배당 지속 가능성 높음.`,
    kiDefault: (score: number, grade: string) => `종합점수 ${score}점 (${grade}등급). 투자 전 본인의 투자 성향과 목표에 맞는지 확인하세요.`,
  },
  en: {
    roeExcellent: (v: number) => `ROE ${v}% — outstanding capital efficiency`,
    roeGood: (v: number) => `ROE ${v}% — solid profitability`,
    roeLow: (v: number) => `ROE ${v}% — low capital efficiency`,
    pmHigh: (v: number) => `Net margin ${v}% — high-margin business`,
    pmLow: (v: number) => `Net margin ${v}% — thin margins`,
    pmNeg: (v: number) => `Net loss (net margin ${v}%)`,
    omHigh: (v: number) => `Operating margin ${v}% — competitive edge`,
    egHigh: (v: number) => `Earnings growth +${v}% — rapid growth`,
    egLow: (v: number) => `Earnings declining ${v}%`,
    rgHigh: (v: number) => `Revenue +${v}% — business expanding`,
    rgLow: (v: number) => `Revenue declining ${v}%`,
    epsUp: (v: number) => `EPS outlook +${v}% → earnings improvement expected`,
    epsDown: (v: number) => `EPS outlook ${v}% → earnings decline expected`,
    peLow: (v: string) => `PER ${v} — undervalued range`,
    peHigh: (v: string) => `PER ${v} — high valuation`,
    fwdPeGood: (v: string) => `Forward PE ${v} — valuation may ease with earnings`,
    pbLow: (v: string) => `PBR ${v} — cheap vs assets`,
    pbHigh: (v: string) => `PBR ${v} — overvalued vs assets`,
    pegLow: (v: string) => `PEG ${v} — cheap vs growth (PEG<1)`,
    pegHigh: (v: string) => `PEG ${v} — expensive vs growth`,
    debtLow: (v: string) => `D/E ${v}% — sound financials`,
    debtHigh: (v: string) => `D/E ${v}% — heavy debt burden`,
    crHigh: (v: string) => `Current ratio ${v} — strong short-term liquidity`,
    crLow: (v: string) => `Current ratio ${v} — liquidity concern`,
    fcfPos: "Positive free cash flow — real cash generation",
    oversoldProfit: "Profitable yet oversold → contrarian buy opportunity",
    oversoldLoss: "Oversold but unprofitable → further downside possible",
    dropHigh: (v: string) => `${v}% off high — weakening trend`,
    betaHigh: (v: string) => `Beta ${v} — more volatile than market`,
    divHigh: (v: string) => `Dividend yield ${v}% — stable cash income`,
    verdictStrongBuy: "Strong Buy",
    verdictBuy: "Buy Interest",
    verdictHold: "Neutral Hold",
    verdictWatch: "Watch",
    verdictCaution: "Caution",
    hlStrongBuy: "A fundamentally strong company entering oversold territory. Rebound opportunity.",
    hlGrowValue: "Earnings are growing, profitability is good, and the price is reasonable.",
    hlGrowExp: "Growing fast, but market expectations have already driven the price up.",
    hlStable: "Good profitability but slowing growth momentum. Suitable for stable investing.",
    hlDecline: "Earnings and revenue are both declining. Need to confirm the bottom.",
    hlOversold: "A large drop makes the price attractive, but need to verify the reason for the decline.",
    hlNeutral: "No clear strengths or weaknesses. Further analysis needed.",
    kiFwdPe: (fwd: string, cur: string) => `Forward PE (${fwd}) below current PE (${cur}), market expects earnings improvement.`,
    kiBargain: (s: number) => `Bargain score ${s} — technically oversold. Could be an opportunity for contrarian investors.`,
    kiRoe: (v: number) => `ROE ${v}% + low debt — a quality company earning high returns on equity.`,
    kiGrowth: (v: number) => `Earnings growing ${v}% p.a. Valuation may be justified if growth persists.`,
    kiDiv: (dy: string, pr: string) => `Dividend yield ${dy}% + payout ratio ${pr}% — dividend sustainability is high.`,
    kiDefault: (score: number, grade: string) => `Total score ${score} (Grade ${grade}). Consider your investment style and goals before investing.`,
  },
} as const;

function analyzeStock(d: DetailData, isKo: boolean): Analysis {
  const a = isKo ? AL.ko : AL.en;
  const strengths: string[] = [];
  const risks: string[] = [];

  // ── 수익성 분석 ──
  if (d.returnOnEquity != null && d.returnOnEquity > 0.25)
    strengths.push(a.roeExcellent(+((d.returnOnEquity * 100).toFixed(0))));
  else if (d.returnOnEquity != null && d.returnOnEquity > 0.15)
    strengths.push(a.roeGood(+((d.returnOnEquity * 100).toFixed(0))));
  else if (d.returnOnEquity != null && d.returnOnEquity < 0.05)
    risks.push(a.roeLow(+((d.returnOnEquity * 100).toFixed(1))));

  if (d.profitMargins != null && d.profitMargins > 0.20)
    strengths.push(a.pmHigh(+((d.profitMargins * 100).toFixed(0))));
  else if (d.profitMargins != null && d.profitMargins < 0.05 && d.profitMargins >= 0)
    risks.push(a.pmLow(+((d.profitMargins * 100).toFixed(1))));
  else if (d.profitMargins != null && d.profitMargins < 0)
    risks.push(a.pmNeg(+((d.profitMargins * 100).toFixed(1))));

  if (d.operatingMargins != null && d.operatingMargins > 0.25)
    strengths.push(a.omHigh(+((d.operatingMargins * 100).toFixed(0))));

  // ── 성장성 분석 ──
  if (d.earningsGrowth != null && d.earningsGrowth > 0.2)
    strengths.push(a.egHigh(+((d.earningsGrowth * 100).toFixed(0))));
  else if (d.earningsGrowth != null && d.earningsGrowth < -0.1)
    risks.push(a.egLow(+((d.earningsGrowth * 100).toFixed(0))));

  if (d.revenueGrowth != null && d.revenueGrowth > 0.15)
    strengths.push(a.rgHigh(+((d.revenueGrowth * 100).toFixed(0))));
  else if (d.revenueGrowth != null && d.revenueGrowth < -0.05)
    risks.push(a.rgLow(+((d.revenueGrowth * 100).toFixed(0))));

  if (d.eps != null && d.epsForward != null && d.eps > 0) {
    const epsGrowth = (d.epsForward - d.eps) / d.eps;
    if (epsGrowth > 0.15)
      strengths.push(a.epsUp(+((epsGrowth * 100).toFixed(0))));
    else if (epsGrowth < -0.1)
      risks.push(a.epsDown(+((epsGrowth * 100).toFixed(0))));
  }

  // ── 가치 분석 ──
  if (d.pe != null && d.pe > 0 && d.pe < 15)
    strengths.push(a.peLow(d.pe.toFixed(1)));
  else if (d.pe != null && d.pe > 40)
    risks.push(a.peHigh(d.pe.toFixed(0)));
  else if (d.pe != null && d.pe > 0 && d.forwardPE != null && d.forwardPE > 0 && d.forwardPE < d.pe * 0.8)
    strengths.push(a.fwdPeGood(d.forwardPE.toFixed(1)));

  if (d.pb != null && d.pb > 0 && d.pb < 2)
    strengths.push(a.pbLow(d.pb.toFixed(1)));
  else if (d.pb != null && d.pb > 10)
    risks.push(a.pbHigh(d.pb.toFixed(0)));

  if (d.pegRatio != null && d.pegRatio > 0 && d.pegRatio < 1)
    strengths.push(a.pegLow(d.pegRatio.toFixed(1)));
  else if (d.pegRatio != null && d.pegRatio > 2.5)
    risks.push(a.pegHigh(d.pegRatio.toFixed(1)));

  // ── 재무 건전성 ──
  if (d.debtToEquity != null && d.debtToEquity < 30)
    strengths.push(a.debtLow(d.debtToEquity.toFixed(0)));
  else if (d.debtToEquity != null && d.debtToEquity > 200)
    risks.push(a.debtHigh(d.debtToEquity.toFixed(0)));

  if (d.currentRatio != null && d.currentRatio > 2)
    strengths.push(a.crHigh(d.currentRatio.toFixed(1)));
  else if (d.currentRatio != null && d.currentRatio < 1)
    risks.push(a.crLow(d.currentRatio.toFixed(1)));

  if (d.freeCashflow != null && d.freeCashflow > 0)
    strengths.push(a.fcfPos);

  // ── 주가 위치 ──
  if (d.oversold?.isOversold && d.eps != null && d.eps > 0)
    strengths.push(a.oversoldProfit);
  else if (d.oversold?.isOversold && (d.eps == null || d.eps <= 0))
    risks.push(a.oversoldLoss);

  if (d.oversold && d.oversold.dropFromHigh < -30)
    risks.push(a.dropHigh(d.oversold.dropFromHigh.toFixed(0)));

  if (d.beta != null && d.beta > 1.5)
    risks.push(a.betaHigh(d.beta.toFixed(1)));

  // ── 배당 ──
  if (d.divYield != null && d.divYield > 0.03)
    strengths.push(a.divHigh((d.divYield * 100).toFixed(1)));

  // ── Verdict 판정 ──
  const total = d.scores.total;
  const isOversold = d.oversold?.isOversold || false;
  const hasFundamentals = (d.eps ?? 0) > 0 && (d.returnOnEquity ?? 0) > 0.1;
  const isGrowing = (d.earningsGrowth ?? 0) > 0.1 || (d.revenueGrowth ?? 0) > 0.1;
  const isExpensive = (d.pe ?? 0) > 35;
  const isDeclining = (d.earningsGrowth ?? 0) < -0.1 && (d.revenueGrowth ?? 0) < 0;

  let verdict: string;
  let verdictColor: string;

  if (isOversold && hasFundamentals && total >= 50) {
    verdict = a.verdictStrongBuy;
    verdictColor = "bg-red-600 text-white";
  } else if (total >= 70 && isGrowing && !isExpensive) {
    verdict = a.verdictBuy;
    verdictColor = "bg-emerald-600 text-white";
  } else if (total >= 55 && !isDeclining) {
    verdict = a.verdictHold;
    verdictColor = "bg-blue-600 text-white";
  } else if (isDeclining || (isExpensive && !isGrowing)) {
    verdict = a.verdictCaution;
    verdictColor = "bg-red-100 text-red-700";
  } else {
    verdict = a.verdictWatch;
    verdictColor = "bg-zinc-200 text-zinc-700";
  }

  // ── Headline 생성 ──
  let headline = "";
  if (verdict === a.verdictStrongBuy) {
    headline = a.hlStrongBuy;
  } else if (isGrowing && hasFundamentals && !isExpensive) {
    headline = a.hlGrowValue;
  } else if (isGrowing && isExpensive) {
    headline = a.hlGrowExp;
  } else if (hasFundamentals && !isGrowing) {
    headline = a.hlStable;
  } else if (isDeclining) {
    headline = a.hlDecline;
  } else if (isOversold) {
    headline = a.hlOversold;
  } else {
    headline = a.hlNeutral;
  }

  // ── Key Insight ──
  let keyInsight = "";
  if (d.forwardPE != null && d.pe != null && d.pe > 0 && d.forwardPE > 0 && d.forwardPE < d.pe * 0.85) {
    keyInsight = a.kiFwdPe(d.forwardPE.toFixed(1), d.pe.toFixed(1));
  } else if (d.oversold?.isOversold && (d.bargain?.bargainScore ?? 0) >= 50) {
    keyInsight = a.kiBargain(d.bargain?.bargainScore ?? 0);
  } else if (d.returnOnEquity != null && d.returnOnEquity > 0.3 && d.debtToEquity != null && d.debtToEquity < 50) {
    keyInsight = a.kiRoe(+((d.returnOnEquity * 100).toFixed(0)));
  } else if (d.earningsGrowth != null && d.earningsGrowth > 0.25) {
    keyInsight = a.kiGrowth(+((d.earningsGrowth * 100).toFixed(0)));
  } else if (d.divYield != null && d.divYield > 0.03 && d.payoutRatio != null && d.payoutRatio < 0.7) {
    keyInsight = a.kiDiv((d.divYield * 100).toFixed(1), (d.payoutRatio * 100).toFixed(0));
  } else {
    keyInsight = a.kiDefault(d.scores.total, d.grade);
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

const CATEGORIES_KO = [
  { key: "profit", label: "수익력", max: 30 },
  { key: "growth", label: "성장력", max: 25 },
  { key: "value", label: "가격매력", max: 20 },
  { key: "health", label: "체력", max: 15 },
  { key: "dividend", label: "주주환원", max: 10 },
] as const;

const CATEGORIES_EN = [
  { key: "profit", label: "Profit", max: 30 },
  { key: "growth", label: "Growth", max: 25 },
  { key: "value", label: "Value", max: 20 },
  { key: "health", label: "Health", max: 15 },
  { key: "dividend", label: "Dividend", max: 10 },
] as const;

/** 오각형 레이더 차트 (SVG) */
function RadarChart({ scores, categories }: { scores: { profit: number; growth: number; value: number; health: number; dividend: number; total: number }; categories: readonly { key: string; label: string; max: number }[] }) {
  const total = scores.total;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 75;

  const axes = categories.map((cat, i) => {
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

/* ── 체크리스트 텍스트 로케일 ── */
const CL = {
  ko: {
    profitable: "흑자 기업", noEps: "EPS 데이터 없음", deficit: "적자",
    egLabel: "이익 성장", rgLabel: "매출 성장", noData: "데이터 없음",
    valLabel: "합리적 밸류", overvalued: "고평가", noPe: "PE 데이터 없음",
    healthLabel: "건전한 재무",
    profitLabel: "높은 수익성", netMargin: "순이익률",
    cashLabel: "양의 현금흐름",
    posLabel: "안전한 위치", aboveMA: "이평선 상회 중", below50: "50일선 하회", oversoldZone: "과매도 구간", below200: "200일선 하회",
    volLabel: "낮은 변동성", noBeta: "Beta 데이터 없음",
    erLabel: "실적 일정", erDone: "최근 발표 완료",
    erDays: (d: number) => `${d}일 후 발표`,
    erSoon: (d: number) => `${d}일 후 발표 임박`,
    erNA: "일정 미확인",
    checkTitle: "매수 전 체크리스트",
    pass: "통과",
    summaryGreat: "대부분 항목을 충족합니다. 매수 조건이 양호합니다.",
    summaryGood: "주요 항목은 충족하나 일부 주의가 필요합니다.",
    summaryWarn: "주의 항목이 많습니다. 신중한 판단이 필요합니다.",
    summaryBad: "미충족 항목이 많습니다. 충분한 분석 후 결정하세요.",
  },
  en: {
    profitable: "Profitable", noEps: "No EPS data", deficit: "Loss",
    egLabel: "Earnings Growth", rgLabel: "Revenue Growth", noData: "No data",
    valLabel: "Fair Valuation", overvalued: "Overvalued", noPe: "No PE data",
    healthLabel: "Sound Financials",
    profitLabel: "High Profitability", netMargin: "Net margin",
    cashLabel: "Positive Cash Flow",
    posLabel: "Safe Position", aboveMA: "Above MAs", below50: "Below 50-day MA", oversoldZone: "Oversold zone", below200: "Below 200-day MA",
    volLabel: "Low Volatility", noBeta: "No Beta data",
    erLabel: "Earnings Date", erDone: "Recently reported",
    erDays: (d: number) => `Reports in ${d} days`,
    erSoon: (d: number) => `Reports in ${d} days — imminent`,
    erNA: "Date unknown",
    checkTitle: "Pre-Buy Checklist",
    pass: "passed",
    summaryGreat: "Most criteria are met. Buying conditions look good.",
    summaryGood: "Key criteria are met, but some areas need attention.",
    summaryWarn: "Many warning items. Careful judgment is needed.",
    summaryBad: "Many criteria are unmet. Analyze thoroughly before deciding.",
  },
} as const;

function buildBuyChecklist(d: DetailData, isKo: boolean): CheckItem[] {
  const c = isKo ? CL.ko : CL.en;
  const items: CheckItem[] = [];

  // 1. 흑자 기업인가?
  if (d.eps != null && d.eps > 0) {
    items.push({ label: c.profitable, status: "pass", detail: `EPS $${d.eps.toFixed(2)}` });
  } else if (d.eps == null) {
    items.push({ label: c.profitable, status: "warning", detail: c.noEps });
  } else {
    items.push({ label: c.profitable, status: "fail", detail: `EPS $${d.eps.toFixed(2)} (${c.deficit})` });
  }

  // 2. 이익 성장
  if (d.earningsGrowth != null && d.earningsGrowth > 0.1) {
    items.push({ label: c.egLabel, status: "pass", detail: `+${(d.earningsGrowth * 100).toFixed(1)}%` });
  } else if (d.earningsGrowth != null && d.earningsGrowth > 0) {
    items.push({ label: c.egLabel, status: "warning", detail: `+${(d.earningsGrowth * 100).toFixed(1)}%` });
  } else if (d.earningsGrowth != null) {
    items.push({ label: c.egLabel, status: "fail", detail: `${(d.earningsGrowth * 100).toFixed(1)}%` });
  } else {
    items.push({ label: c.egLabel, status: "warning", detail: c.noData });
  }

  // 3. 매출 성장
  if (d.revenueGrowth != null && d.revenueGrowth > 0.1) {
    items.push({ label: c.rgLabel, status: "pass", detail: `+${(d.revenueGrowth * 100).toFixed(1)}%` });
  } else if (d.revenueGrowth != null && d.revenueGrowth > 0) {
    items.push({ label: c.rgLabel, status: "warning", detail: `+${(d.revenueGrowth * 100).toFixed(1)}%` });
  } else if (d.revenueGrowth != null) {
    items.push({ label: c.rgLabel, status: "fail", detail: `${(d.revenueGrowth * 100).toFixed(1)}%` });
  } else {
    items.push({ label: c.rgLabel, status: "warning", detail: c.noData });
  }

  // 4. 합리적 밸류에이션
  if (d.pe != null && d.pe > 0) {
    if (d.avgPE5Y != null && d.pe < d.avgPE5Y) {
      items.push({ label: c.valLabel, status: "pass", detail: `PE ${d.pe.toFixed(1)} < 5Y ${d.avgPE5Y.toFixed(1)}` });
    } else if (d.pe < 25) {
      items.push({ label: c.valLabel, status: "warning", detail: `PE ${d.pe.toFixed(1)}` });
    } else {
      items.push({ label: c.valLabel, status: "fail", detail: `PE ${d.pe.toFixed(1)}${d.avgPE5Y ? ` > 5Y ${d.avgPE5Y.toFixed(1)}` : ` (${c.overvalued})`}` });
    }
  } else {
    items.push({ label: c.valLabel, status: "warning", detail: c.noPe });
  }

  // 5. 재무 건전성
  const de = d.debtToEquity;
  const cr = d.currentRatio;
  if (de != null && cr != null && de < 100 && cr > 1) {
    items.push({ label: c.healthLabel, status: "pass", detail: `D/E ${de.toFixed(0)}% · CR ${cr.toFixed(1)}` });
  } else if (de != null && de < 200) {
    items.push({ label: c.healthLabel, status: "warning", detail: `D/E ${de.toFixed(0)}%${cr != null ? ` · CR ${cr.toFixed(1)}` : ""}` });
  } else if (de != null) {
    items.push({ label: c.healthLabel, status: "fail", detail: `D/E ${de.toFixed(0)}%${cr != null ? ` · CR ${cr.toFixed(1)}` : ""}` });
  } else {
    items.push({ label: c.healthLabel, status: "warning", detail: c.noData });
  }

  // 6. 수익성
  const roe = d.returnOnEquity;
  const pm = d.profitMargins;
  if (roe != null && pm != null && roe > 0.15 && pm > 0.1) {
    items.push({ label: c.profitLabel, status: "pass", detail: `ROE ${(roe * 100).toFixed(0)}% · ${c.netMargin} ${(pm * 100).toFixed(0)}%` });
  } else if (roe != null && roe > 0.05) {
    items.push({ label: c.profitLabel, status: "warning", detail: `ROE ${(roe * 100).toFixed(0)}%${pm != null ? ` · ${c.netMargin} ${(pm * 100).toFixed(0)}%` : ""}` });
  } else if (roe != null) {
    items.push({ label: c.profitLabel, status: "fail", detail: `ROE ${(roe * 100).toFixed(1)}%${pm != null ? ` · ${c.netMargin} ${(pm * 100).toFixed(1)}%` : ""}` });
  } else {
    items.push({ label: c.profitLabel, status: "warning", detail: c.noData });
  }

  // 7. 현금흐름
  if (d.freeCashflow != null && d.freeCashflow > 0) {
    const fcfStr = d.freeCashflow >= 1e9 ? `$${(d.freeCashflow / 1e9).toFixed(1)}B` : `$${(d.freeCashflow / 1e6).toFixed(0)}M`;
    items.push({ label: c.cashLabel, status: "pass", detail: `FCF ${fcfStr}` });
  } else if (d.freeCashflow == null) {
    items.push({ label: c.cashLabel, status: "warning", detail: c.noData });
  } else {
    const fcfStr = d.freeCashflow <= -1e9 ? `-$${(Math.abs(d.freeCashflow) / 1e9).toFixed(1)}B` : `-$${(Math.abs(d.freeCashflow) / 1e6).toFixed(0)}M`;
    items.push({ label: c.cashLabel, status: "fail", detail: `FCF ${fcfStr}` });
  }

  // 8. 주가 위치
  if (d.oversold) {
    if (!d.oversold.belowMA200 && !d.oversold.belowMA50) {
      items.push({ label: c.posLabel, status: "pass", detail: c.aboveMA });
    } else if (d.oversold.belowMA50 && !d.oversold.belowMA200) {
      items.push({ label: c.posLabel, status: "warning", detail: c.below50 });
    } else {
      items.push({ label: c.posLabel, status: "fail", detail: d.oversold.isOversold ? c.oversoldZone : c.below200 });
    }
  } else {
    items.push({ label: c.posLabel, status: "warning", detail: c.noData });
  }

  // 9. 변동성
  if (d.beta != null) {
    if (d.beta < 1.2) {
      items.push({ label: c.volLabel, status: "pass", detail: `Beta ${d.beta.toFixed(2)}` });
    } else if (d.beta < 1.5) {
      items.push({ label: c.volLabel, status: "warning", detail: `Beta ${d.beta.toFixed(2)}` });
    } else {
      items.push({ label: c.volLabel, status: "fail", detail: `Beta ${d.beta.toFixed(2)}` });
    }
  } else {
    items.push({ label: c.volLabel, status: "warning", detail: c.noBeta });
  }

  // 10. 실적 발표 일정
  if (d.earningsDate) {
    const diff = Math.ceil((new Date(d.earningsDate).getTime() - Date.now()) / 86400000);
    if (diff < 0) {
      items.push({ label: c.erLabel, status: "pass", detail: c.erDone });
    } else if (diff > 30) {
      items.push({ label: c.erLabel, status: "pass", detail: c.erDays(diff) });
    } else if (diff >= 7) {
      items.push({ label: c.erLabel, status: "warning", detail: c.erDays(diff) });
    } else {
      items.push({ label: c.erLabel, status: "fail", detail: c.erSoon(diff) });
    }
  } else {
    items.push({ label: c.erLabel, status: "warning", detail: c.erNA });
  }

  return items;
}

/** 매수 전 체크리스트 UI */
function BuyChecklist({ data, isKo }: { data: DetailData; isKo: boolean }) {
  const c = isKo ? CL.ko : CL.en;
  const items = useMemo(() => buildBuyChecklist(data, isKo), [data, isKo]);
  const passCount = items.filter((i) => i.status === "pass").length;
  const passRate = passCount / items.length;

  const gaugeColor = passRate >= 0.8 ? "bg-emerald-500" : passRate >= 0.5 ? "bg-amber-500" : "bg-red-500";
  const gaugeTextColor = passRate >= 0.8 ? "text-emerald-700" : passRate >= 0.5 ? "text-amber-700" : "text-red-700";
  const statusIcon = (s: CheckStatus) => s === "pass" ? "✅" : s === "warning" ? "⚠️" : "❌";
  const statusColor = (s: CheckStatus) => s === "pass" ? "text-emerald-700" : s === "warning" ? "text-amber-600" : "text-red-600";

  return (
    <div className="mx-4 mb-3">
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-zinc-500">{c.checkTitle}</p>
          <span className={`text-xs font-black ${gaugeTextColor}`}>
            {passCount}/{items.length} {c.pass}
          </span>
        </div>

        <div className="h-2 bg-zinc-200 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full ${gaugeColor} rounded-full transition-all duration-500`}
            style={{ width: `${passRate * 100}%` }}
          />
        </div>

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

        <div className={`mt-2.5 pt-2 border-t border-zinc-200 text-center`}>
          <p className={`text-[10px] font-bold ${gaugeTextColor}`}>
            {passRate >= 0.8
              ? c.summaryGreat
              : passRate >= 0.6
                ? c.summaryGood
                : passRate >= 0.4
                  ? c.summaryWarn
                  : c.summaryBad}
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

/* ── ScoreCard UI 텍스트 로케일 ── */
const SL = {
  ko: {
    peCompare: "P/E 비교",
    peCurrent: "현재 P/E",
    peForward: "Forward P/E",
    pe5y: "5Y 중위 P/E",
    fwdVsCur: "Forward vs 현재",
    earningsImprove: "→ 이익 개선 기대",
    earningsSlightImprove: "→ 약간 개선 기대",
    earningsSlowdown: "→ 이익 둔화 우려",
    earningsMaintain: "→ 유지",
    curVs5y: "현재 vs 5년 평균",
    histUnder: "역사적 저평가",
    under: "저평가",
    fair: "적정 수준",
    over: "고평가",
    histOver: "역사적 고평가",
    fairPriceTitle: "이 가격에 사도 될까?",
    curPrice: "현재가",
    dcfFair: "DCF 적정가",
    analystLabel: "애널리스트",
    gaugeUnder: "저평가",
    gaugeCur: "● 현재가",
    gaugeOver: "고평가",
    dcfUpside: "DCF 기준 상승여력",
    wallSt: "월가 컨센서스 기준",
    analystRange: "애널리스트 목표가 범위",
    dcfAssume: (g: number, d: number) => `DCF 가정: EPS 성장률 ${g}% · 할인율 ${d}%`,
    upsideUnder: "저평가",
    upsideSlightUnder: "약간 저평가",
    upsideFair: "적정",
    upsideOver: "고평가",
    recStrongBuy: "적극 매수",
    recBuy: "매수",
    recHold: "보유",
    recSell: "매도",
    recStrongSell: "적극 매도",
    pegExtreme: "극심한 저평가",
    pegUnder: "저평가",
    pegSlightUnder: "약간 저평가",
    pegFair: "적정",
    pegSlightOver: "약간 고평가",
    pegOver: "고평가",
    pegBelow1: "1 이하 = 성장 대비 저평가",
    pegGaugeLow: "저평가",
    pegGaugeMid: "적정 1.0",
    pegGaugeHigh: "고평가",
    pegChart: "PEG 시계열 차트 보기",
    pegChartDesc: (t: string) => `${t}의 분기별 PEG 추이를 확인하세요`,
    keyLabel: "핵심:",
    strengths: "강점",
    risks: "리스크",
    sig52Drop: (v: string) => `52주 고점 대비 ${v}% 하락.`,
    sigOversold: " 과매도 구간에 진입했습니다. 기술적 반등 가능성이 있습니다.",
    sigBigDrop: " 상당한 하락폭입니다. 실적 확인 후 분할매수를 고려해볼 수 있습니다.",
    sigSmallDrop: " 소폭 조정 중입니다.",
    sigMA200: (v: string) => `200일 이동평균선($${v})을 하회 중. 장기 추세가 약화되고 있으며 추가 하락 가능성에 유의하세요.`,
    sigHealthy: "50일·200일 이평선 모두 상회 중이며 고점 근처에 위치합니다. 기술적으로 양호한 상태입니다.",
    sigVolHigh: (v: string) => `최근 거래량이 평소의 ${v}배로`,
    sigVolBig: " 크게 증가했습니다. 기관·세력의 매매 신호일 수 있습니다.",
    sigVolMed: " 늘었습니다. 관심이 집중되고 있습니다.",
    w52Range: "52주 범위",
    toggleOpen: "세부 지표 보기",
    toggleClose: "접기",
    divYield: "배당수익률",
    w52Return: "52주 수익률",
    opMargin: "영업이익률",
    netMargin: "순이익률",
    debtRatio: "부채비율",
    currentRatio: "유동비율",
    revGrowth: "매출 성장",
    earGrowth: "이익 성장",
    payoutRatio: "배당성향",
    aiBtn: "AI 뉴스 분석 보기",
    aiLoading: "AI가 최신 뉴스를 분석하고 있습니다...",
    aiGemini: "Gemini AI 분석",
    aiTrend: "최근 동향",
    aiStrengths: "투자 매력",
    aiRisks: "리스크",
    aiSources: "참고 뉴스",
    aiRetry: "다시 시도",
    aiFailed: "AI 분석 실패",
    aiErr: "AI 분석 중 오류가 발생했습니다",
    disclaimer: "본 분석은 공개 재무 데이터와 AI 기반 자동 생성이며 투자 권유가 아닙니다. 투자 결정은 본인 판단과 책임 하에 하시기 바랍니다.",
    share: "공유",
    close: "닫기",
    shareTitle: (n: string) => `${n} 투자 성적표`,
    linkCopied: "링크가 복사되었습니다!",
  },
  en: {
    peCompare: "P/E Comparison",
    peCurrent: "Current P/E",
    peForward: "Forward P/E",
    pe5y: "5Y Median P/E",
    fwdVsCur: "Forward vs Current",
    earningsImprove: " → earnings improvement expected",
    earningsSlightImprove: " → slight improvement expected",
    earningsSlowdown: " → earnings slowdown risk",
    earningsMaintain: " → maintained",
    curVs5y: "Current vs 5Y Average",
    histUnder: "Historically undervalued",
    under: "Undervalued",
    fair: "Fair value",
    over: "Overvalued",
    histOver: "Historically overvalued",
    fairPriceTitle: "Is this price worth buying?",
    curPrice: "Current",
    dcfFair: "DCF Fair Value",
    analystLabel: "Analysts",
    gaugeUnder: "Undervalued",
    gaugeCur: "● Current",
    gaugeOver: "Overvalued",
    dcfUpside: "DCF-based Upside",
    wallSt: "Wall St. Consensus",
    analystRange: "Analyst Target Range",
    dcfAssume: (g: number, d: number) => `DCF Assumption: EPS growth ${g}% · Discount rate ${d}%`,
    upsideUnder: "Undervalued",
    upsideSlightUnder: "Slightly undervalued",
    upsideFair: "Fair",
    upsideOver: "Overvalued",
    recStrongBuy: "Strong Buy",
    recBuy: "Buy",
    recHold: "Hold",
    recSell: "Sell",
    recStrongSell: "Strong Sell",
    pegExtreme: "Extremely undervalued",
    pegUnder: "Undervalued",
    pegSlightUnder: "Slightly undervalued",
    pegFair: "Fair",
    pegSlightOver: "Slightly overvalued",
    pegOver: "Overvalued",
    pegBelow1: "Below 1 = cheap vs growth",
    pegGaugeLow: "Undervalued",
    pegGaugeMid: "Fair 1.0",
    pegGaugeHigh: "Overvalued",
    pegChart: "View PEG Time Series",
    pegChartDesc: (t: string) => `Check quarterly PEG trend for ${t}`,
    keyLabel: "Key:",
    strengths: "Strengths",
    risks: "Risks",
    sig52Drop: (v: string) => `${v}% off 52-week high.`,
    sigOversold: " Entered oversold territory. Technical rebound possible.",
    sigBigDrop: " Significant decline. Consider dollar-cost averaging after earnings check.",
    sigSmallDrop: " Minor correction underway.",
    sigMA200: (v: string) => `Below 200-day MA ($${v}). Long-term trend weakening; watch for further downside.`,
    sigHealthy: "Above both 50-day and 200-day MAs, near highs. Technically healthy.",
    sigVolHigh: (v: string) => `Recent volume ${v}x above average`,
    sigVolBig: " — sharply increased. Could signal institutional activity.",
    sigVolMed: " — rising. Attention is gathering.",
    w52Range: "52-Week Range",
    toggleOpen: "View Details",
    toggleClose: "Collapse",
    divYield: "Dividend Yield",
    w52Return: "52W Return",
    opMargin: "Op. Margin",
    netMargin: "Net Margin",
    debtRatio: "Debt Ratio",
    currentRatio: "Current Ratio",
    revGrowth: "Rev. Growth",
    earGrowth: "Earnings Growth",
    payoutRatio: "Payout Ratio",
    aiBtn: "View AI News Analysis",
    aiLoading: "AI is analyzing the latest news...",
    aiGemini: "Gemini AI Analysis",
    aiTrend: "Recent Trend",
    aiStrengths: "Investment Merits",
    aiRisks: "Risks",
    aiSources: "News Sources",
    aiRetry: "Retry",
    aiFailed: "AI analysis failed",
    aiErr: "An error occurred during AI analysis",
    disclaimer: "This analysis is auto-generated from public financial data and AI. It is not investment advice. Investment decisions are at your own risk.",
    share: "Share",
    close: "Close",
    shareTitle: (n: string) => `${n} Stock Score`,
    linkCopied: "Link copied!",
  },
} as const;

export function ScoreCard({ data, onClose }: { data: DetailData; onClose?: () => void }) {
  const { locale } = useI18n();
  const isKo = locale === "ko";
  const t = isKo ? SL.ko : SL.en;
  const categories = isKo ? CATEGORIES_KO : CATEGORIES_EN;

  const [showDetail, setShowDetail] = useState(false);
  const [aiData, setAiData] = useState<AiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const { scores, grade } = data;
  const analysis = useMemo(() => analyzeStock(data, isKo), [data, isKo]);

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
        throw new Error(err.error || t.aiFailed);
      }
      const result: AiAnalysis = await res.json();
      setAiData(result);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : t.aiErr);
    } finally {
      setAiLoading(false);
    }
  }, [data, aiData, aiLoading]);

  const shareUrl = `https://suile-21173.web.app/ss?t=${encodeURIComponent(data.ticker)}&s=${scores.total}&g=${grade}&n=${encodeURIComponent(data.name)}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: t.shareTitle(data.name),
          text: analysis.headline,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert(t.linkCopied);
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
        <RadarChart scores={scores} categories={categories} />
      </div>

      {/* ── 밸류에이션 대시보드 ── */}
      <div className="mx-4 mt-3 space-y-2.5">

        {/* P/E 3종 비교 카드 */}
        {data.pe && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-3">
            <p className="text-[10px] font-bold text-zinc-500 mb-2">{t.peCompare}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-black text-zinc-800">{data.pe.toFixed(1)}</div>
                <div className="text-[9px] text-zinc-400 mt-0.5">{t.peCurrent}</div>
              </div>
              <div>
                <div className={`text-xl font-black ${
                  data.forwardPE && data.forwardPE < data.pe ? "text-emerald-600" : "text-orange-600"
                }`}>
                  {data.forwardPE ? data.forwardPE.toFixed(1) : "-"}
                </div>
                <div className="text-[9px] text-zinc-400 mt-0.5">{t.peForward}</div>
              </div>
              <div>
                <div className="text-xl font-black text-violet-600">
                  {data.avgPE5Y ? data.avgPE5Y.toFixed(1) : "-"}
                </div>
                <div className="text-[9px] text-zinc-400 mt-0.5">{t.pe5y}</div>
              </div>
            </div>

            {/* Forward vs 현재 비교 */}
            {data.forwardPE && data.pe && (
              <div className="mt-2.5 pt-2 border-t border-zinc-200">
                {(() => {
                  const fwdDiff = ((data.forwardPE - data.pe) / data.pe) * 100;
                  return (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">{t.fwdVsCur}</span>
                      <span className={`font-bold ${fwdDiff < -10 ? "text-emerald-600" : fwdDiff < 0 ? "text-blue-600" : "text-zinc-500"}`}>
                        {fwdDiff > 0 ? "+" : ""}{fwdDiff.toFixed(0)}%
                        {fwdDiff < -15 ? t.earningsImprove : fwdDiff < -5 ? t.earningsSlightImprove : fwdDiff > 5 ? t.earningsSlowdown : t.earningsMaintain}
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
                  if (histDiff < -20) { label = t.histUnder; color = "text-emerald-600"; }
                  else if (histDiff < -10) { label = t.under; color = "text-emerald-600"; }
                  else if (histDiff < 10) { label = t.fair; color = "text-zinc-600"; }
                  else if (histDiff < 30) { label = t.over; color = "text-orange-600"; }
                  else { label = t.histOver; color = "text-red-600"; }
                  return (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">{t.curVs5y}</span>
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
            <p className="text-[10px] font-bold text-blue-600 mb-2.5">{t.fairPriceTitle}</p>

            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div>
                <div className="text-lg font-black text-zinc-800">${data.price.toFixed(2)}</div>
                <div className="text-[9px] text-zinc-400 mt-0.5">{t.curPrice}</div>
              </div>
              {data.dcfFairValue && (
                <div>
                  <div className={`text-lg font-black ${
                    data.price < data.dcfFairValue ? "text-emerald-600" : "text-red-600"
                  }`}>${data.dcfFairValue.toFixed(2)}</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">{t.dcfFair}</div>
                </div>
              )}
              {data.targetMeanPrice && (
                <div>
                  <div className={`text-lg font-black ${
                    data.price < data.targetMeanPrice ? "text-emerald-600" : "text-red-600"
                  }`}>${data.targetMeanPrice.toFixed(2)}</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">
                    {t.analystLabel}{data.numberOfAnalysts ? ` (${data.numberOfAnalysts})` : ""}
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
              <span>{t.gaugeUnder}</span>
              <span>{t.gaugeCur}</span>
              <span>{t.gaugeOver}</span>
            </div>

            {/* 상승여력 요약 */}
            <div className="space-y-1 pt-2 border-t border-blue-200/60">
              {data.dcfFairValue && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">{t.dcfUpside}</span>
                  {(() => {
                    const upside = ((data.dcfFairValue - data.price) / data.price) * 100;
                    return (
                      <span className={`font-bold ${upside > 10 ? "text-emerald-600" : upside > 0 ? "text-blue-600" : upside > -10 ? "text-zinc-600" : "text-red-600"}`}>
                        {upside > 0 ? "+" : ""}{upside.toFixed(1)}%
                        {upside > 20 ? ` ${t.upsideUnder}` : upside > 0 ? ` ${t.upsideSlightUnder}` : upside > -10 ? ` ${t.upsideFair}` : ` ${t.upsideOver}`}
                      </span>
                    );
                  })()}
                </div>
              )}
              {data.targetMeanPrice && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">{t.wallSt}</span>
                  {(() => {
                    const upside = ((data.targetMeanPrice - data.price) / data.price) * 100;
                    return (
                      <span className={`font-bold ${upside > 10 ? "text-emerald-600" : upside > 0 ? "text-blue-600" : upside > -10 ? "text-zinc-600" : "text-red-600"}`}>
                        {upside > 0 ? "+" : ""}{upside.toFixed(1)}%
                        {data.recommendationKey ? ` · ${
                          data.recommendationKey === "strongBuy" ? t.recStrongBuy :
                          data.recommendationKey === "buy" ? t.recBuy :
                          data.recommendationKey === "hold" ? t.recHold :
                          data.recommendationKey === "sell" ? t.recSell :
                          data.recommendationKey === "strongSell" ? t.recStrongSell :
                          data.recommendationKey
                        }` : ""}
                      </span>
                    );
                  })()}
                </div>
              )}
              {data.targetLowPrice && data.targetHighPrice && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">{t.analystRange}</span>
                  <span className="font-medium text-zinc-600">
                    ${data.targetLowPrice.toFixed(0)} ~ ${data.targetHighPrice.toFixed(0)}
                  </span>
                </div>
              )}
              {data.dcfGrowthRate != null && data.dcfDiscountRate != null && (
                <div className="text-[9px] text-zinc-400 mt-1">
                  {t.dcfAssume(data.dcfGrowthRate, data.dcfDiscountRate)}
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
                  {data.pegRatio < 0.5 ? t.pegExtreme : data.pegRatio < 1 ? t.pegUnder
                    : data.pegRatio < 1.5 ? t.pegSlightUnder : data.pegRatio < 2 ? t.pegFair
                    : data.pegRatio < 3 ? t.pegSlightOver : t.pegOver}
                </div>
                {data.pegPE != null && data.pegEpsGrowth != null ? (
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    PE {data.pegPE.toFixed(1)} ÷ EPS성장률 {data.pegEpsGrowth.toFixed(1)}%
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-400 mt-0.5">{t.pegBelow1}</div>
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
                <span>{t.pegGaugeLow}</span>
                <span>{t.pegGaugeMid}</span>
                <span>{t.pegGaugeHigh}</span>
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
            <p className="text-[11px] font-bold text-violet-700">{t.pegChart}</p>
            <p className="text-[9px] text-violet-500">{t.pegChartDesc(data.ticker)}</p>
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
            <span className="font-bold">{t.keyLabel}</span> {analysis.keyInsight}
          </p>
        </div>
      </div>

      {/* 강점 / 리스크 */}
      {(analysis.strengths.length > 0 || analysis.risks.length > 0) && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2.5">
          {analysis.strengths.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-emerald-700">{t.strengths}</p>
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
              <p className="text-[10px] font-bold text-red-700">{t.risks}</p>
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
      <BuyChecklist data={data} isKo={isKo} />

      {/* 주요 시그널 */}
      <div className="mx-4 mb-3 space-y-1.5">
        {/* 과매도 시그널 */}
        {data.oversold && data.oversold.dropFromHigh < -5 && (
          <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] ${
            data.oversold.isOversold ? "bg-red-50 text-red-700" : data.oversold.dropFromHigh < -15 ? "bg-amber-50 text-amber-700" : "bg-zinc-50 text-zinc-600"
          }`}>
            <span className="shrink-0 mt-px">{data.oversold.isOversold ? "🔻" : "📉"}</span>
            <span>
              <strong>{t.sig52Drop(data.oversold.dropFromHigh.toFixed(1))}</strong>
              {data.oversold.isOversold
                ? t.sigOversold
                : data.oversold.dropFromHigh < -20
                  ? t.sigBigDrop
                  : t.sigSmallDrop
              }
            </span>
          </div>
        )}
        {/* 이평선 시그널 */}
        {data.oversold?.belowMA200 && data.oversold.ma200 && data.price && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-[11px]">
            <span className="shrink-0 mt-px">⚠️</span>
            <span>
              {t.sigMA200(data.oversold.ma200.toFixed(0))}
            </span>
          </div>
        )}
        {data.oversold && !data.oversold.belowMA50 && !data.oversold.belowMA200 && data.oversold.dropFromHigh >= -5 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-[11px]">
            <span className="shrink-0 mt-px">✅</span>
            <span>
              {t.sigHealthy}
            </span>
          </div>
        )}
        {/* 거래량 시그널 */}
        {data.bargain && data.bargain.volumeRatio > 1.5 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-50 text-orange-700 text-[11px]">
            <span className="shrink-0 mt-px">📊</span>
            <span>
              {t.sigVolHigh(data.bargain.volumeRatio.toFixed(1))}
              {data.bargain.volumeRatio > 2 ? t.sigVolBig : t.sigVolMed}
            </span>
          </div>
        )}
        {/* 52주 가격 위치 */}
        {data.w52high != null && data.w52low != null && data.price != null && (
          <div className="px-3 py-2 rounded-lg bg-zinc-50 text-[11px] text-zinc-600">
            <div className="flex justify-between mb-1">
              <span>{t.w52Range}</span>
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
          {showDetail ? t.toggleClose : t.toggleOpen}
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
              <Metric label={t.divYield} value={fmtPct(data.divYield)} />
              <Metric label={t.w52Return} value={fmtPct(data.w52change)} />
              <Metric label="ROE" value={fmtPct(data.returnOnEquity)} />
              <Metric label="ROA" value={fmtPct(data.returnOnAssets)} />
              <Metric label={t.opMargin} value={fmtPct(data.operatingMargins)} />
              <Metric label={t.netMargin} value={fmtPct(data.profitMargins)} />
              <Metric label={t.debtRatio} value={data.debtToEquity != null ? `${data.debtToEquity.toFixed(0)}%` : "-"} />
              <Metric label={t.currentRatio} value={fmtNum(data.currentRatio)} />
              <Metric label={t.revGrowth} value={fmtPct(data.revenueGrowth)} />
              <Metric label={t.earGrowth} value={fmtPct(data.earningsGrowth)} />
              <Metric label="Beta" value={fmtNum(data.beta)} />
              <Metric label={t.payoutRatio} value={fmtPct(data.payoutRatio)} />
              {data.avgPE5Y && <Metric label={t.pe5y} value={data.avgPE5Y.toFixed(1)} />}
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
            {t.aiBtn}
          </button>
        )}

        {aiLoading && (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              <span className="text-xs text-violet-600 font-medium">{t.aiLoading}</span>
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
              {t.aiRetry}
            </button>
          </div>
        )}

        {aiData && (
          <div className="px-4 py-3 space-y-3 animate-in fade-in-0 duration-300">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-xs font-bold text-violet-700">{t.aiGemini}</span>
              <span className="text-[9px] text-zinc-400 ml-auto">{aiData.date}</span>
            </div>

            {/* 최근 동향 */}
            {aiData.recentTrend && (
              <div className="bg-zinc-50 rounded-lg px-3 py-2">
                <p className="text-[10px] font-bold text-zinc-600 mb-1">{t.aiTrend}</p>
                <p className="text-[11px] text-zinc-700 leading-relaxed">
                  <MdText text={aiData.recentTrend} />
                </p>
              </div>
            )}

            {/* 매력 + 리스크 */}
            <div className="grid grid-cols-2 gap-2.5">
              {aiData.strengths.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-emerald-700">{t.aiStrengths}</p>
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
                  <p className="text-[10px] font-bold text-red-700">{t.aiRisks}</p>
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
                <p className="text-[9px] font-bold text-zinc-500">{t.aiSources}</p>
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
          {t.disclaimer}
        </p>
      </div>
      <div className="px-3 pb-3 flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-medium hover:bg-zinc-50 transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" />
          {t.share}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors"
          >
            {t.close}
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
