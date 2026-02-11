"use client";

import { useState, useMemo } from "react";
import {
  Calculator,
  Users,
  Baby,
  Wallet,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

// ══════════════════════════════════════════════
// 2026년 확정 요율 (상수)
// ══════════════════════════════════════════════
const RATES = {
  year: 2026,
  nationalPension: 0.0475,
  nationalPensionCap: 6_370_000,
  healthInsurance: 0.03545,
  longTermCare: 0.1295,
  employmentInsurance: 0.009,
  localIncomeTaxRate: 0.1,
};

const TAX_BRACKETS = [
  { limit: 14_000_000, rate: 0.06, deduction: 0 },
  { limit: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { limit: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { limit: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { limit: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { limit: 500_000_000, rate: 0.40, deduction: 25_940_000 },
  { limit: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { limit: Infinity, rate: 0.45, deduction: 65_940_000 },
];

const EMPLOYMENT_DEDUCTION_BRACKETS = [
  { limit: 5_000_000, rate: 0.7, base: 0, threshold: 0 },
  { limit: 15_000_000, rate: 0.4, base: 3_500_000, threshold: 5_000_000 },
  { limit: 45_000_000, rate: 0.15, base: 7_500_000, threshold: 15_000_000 },
  { limit: 100_000_000, rate: 0.05, base: 12_000_000, threshold: 45_000_000 },
  { limit: Infinity, rate: 0.02, base: 14_750_000, threshold: 100_000_000 },
];

function getOtherDeduction(annualGross: number): number {
  if (annualGross <= 30_000_000) return 3_100_000;
  if (annualGross <= 45_000_000)
    return 3_100_000 - (annualGross - 30_000_000) * 0.05;
  if (annualGross <= 70_000_000) return 2_350_000;
  if (annualGross <= 120_000_000)
    return 2_350_000 - (annualGross - 70_000_000) * 0.005;
  return 2_100_000;
}

function getEarnedIncomeTaxCredit(
  computedTax: number,
  annualGross: number
): number {
  let credit: number;
  if (computedTax <= 1_300_000) {
    credit = computedTax * 0.55;
  } else {
    credit = 715_000 + (computedTax - 1_300_000) * 0.3;
  }
  let cap: number;
  if (annualGross <= 33_000_000) {
    cap = 740_000;
  } else if (annualGross <= 70_000_000) {
    cap = Math.max(660_000, 740_000 - (annualGross - 33_000_000) * 0.008);
  } else if (annualGross <= 120_000_000) {
    cap = Math.max(500_000, 660_000 - (annualGross - 70_000_000) * 0.5 / 100);
  } else {
    cap = Math.max(200_000, 500_000 - (annualGross - 120_000_000) * 0.5 / 100);
  }
  return Math.min(credit, cap);
}

function getChildTaxCredit(children: number): number {
  if (children <= 0) return 0;
  if (children === 1) return 250_000;
  if (children === 2) return 550_000;
  return 550_000 + (children - 2) * 400_000;
}

// ══════════════════════════════════════════════
// 계산 함수
// ══════════════════════════════════════════════
interface SalaryResult {
  monthlyGross: number;
  monthlyTaxable: number;
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  insuranceTotal: number;
  incomeTax: number;
  localIncomeTax: number;
  taxTotal: number;
  totalDeduction: number;
  monthlyNet: number;
  annualNet: number;
  deductionRate: number;
}

function calculateSalary(
  annualSalary: number,
  dependents: number,
  childrenUnder20: number,
  nonTaxableMonthly: number
): SalaryResult {
  const monthlyGross = Math.round(annualSalary / 12);
  const monthlyTaxable = Math.max(0, monthlyGross - nonTaxableMonthly);

  const pensionBase = Math.min(monthlyTaxable, RATES.nationalPensionCap);
  const nationalPension = Math.round(pensionBase * RATES.nationalPension);
  const healthInsurance = Math.round(monthlyTaxable * RATES.healthInsurance);
  const longTermCare = Math.round(healthInsurance * RATES.longTermCare);
  const employmentInsurance = Math.round(
    monthlyTaxable * RATES.employmentInsurance
  );
  const insuranceTotal =
    nationalPension + healthInsurance + longTermCare + employmentInsurance;

  const annualGross = monthlyTaxable * 12;

  let employmentDeduction = 0;
  for (const b of EMPLOYMENT_DEDUCTION_BRACKETS) {
    if (annualGross <= b.limit) {
      employmentDeduction = b.base + (annualGross - b.threshold) * b.rate;
      break;
    }
  }

  const earnedIncome = annualGross - employmentDeduction;
  const personalExemption = 1_500_000 * Math.max(1, dependents);
  const pensionDeduction = nationalPension * 12;
  const insuranceDeduction =
    (healthInsurance + longTermCare + employmentInsurance) * 12;
  const otherDeduction = getOtherDeduction(annualGross);
  const totalSoDeduction =
    personalExemption + pensionDeduction + insuranceDeduction + otherDeduction;

  const taxBase = Math.max(0, earnedIncome - totalSoDeduction);

  let computedTax = 0;
  for (const b of TAX_BRACKETS) {
    if (taxBase <= b.limit) {
      computedTax = taxBase * b.rate - b.deduction;
      break;
    }
  }
  computedTax = Math.max(0, computedTax);

  const earnedCredit = getEarnedIncomeTaxCredit(computedTax, annualGross);
  const childCredit = getChildTaxCredit(childrenUnder20);
  const finalTax = Math.max(0, computedTax - earnedCredit - childCredit);

  const incomeTax = Math.max(0, Math.round(finalTax / 12));
  const localIncomeTax = Math.round(incomeTax * RATES.localIncomeTaxRate);
  const taxTotal = incomeTax + localIncomeTax;

  const totalDeduction = insuranceTotal + taxTotal;
  const monthlyNet = monthlyGross - totalDeduction;
  const annualNet = monthlyNet * 12;
  const deductionRate =
    monthlyGross > 0 ? (totalDeduction / monthlyGross) * 100 : 0;

  return {
    monthlyGross,
    monthlyTaxable,
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    insuranceTotal,
    incomeTax,
    localIncomeTax,
    taxTotal,
    totalDeduction,
    monthlyNet,
    annualNet,
    deductionRate,
  };
}

// ── 숫자 포맷 ──
function fmt(n: number, locale: string): string {
  return Math.round(n).toLocaleString(locale === "ko" ? "ko-KR" : "en-US");
}

function fmtMan(n: number, isKo: boolean): string {
  if (isKo) {
    const man = n / 10000;
    return man >= 10000
      ? `${(man / 10000).toFixed(1)}억`
      : `${Math.round(man).toLocaleString()}만`;
  }
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("en-US")}K`;
  return n.toLocaleString("en-US");
}

// ══════════════════════════════════════════════
// 로컬라이즈 텍스트
// ══════════════════════════════════════════════
const L = {
  ko: {
    title: "연봉 실수령액 계산기",
    subtitle: (y: number) => `${y}년 확정 요율 기준 · 국세청 간이세액표 공식 적용`,
    salaryLabel: "연봉 (세전)",
    won: "원",
    rangeMin: "2,000만",
    rangeMax: "2억",
    dependents: "부양가족",
    childrenLabel: "20세이하 자녀",
    nonTaxable: "비과세(월)",
    ppl: "명",
    self: " (본인)",
    none: "없음",
    man10: "10만원",
    man20: "20만원",
    man30: "30만원",
    monthlyNet: "월 실수령액",
    preTax: (v: string) => `세전 ${v}원`,
    deduction: (v: string) => `공제 ${v}원`,
    deductionRate: (r: string, net: string) =>
      `공제율 ${r}% · 연간 실수령 ${net}원`,
    monthlyDeduction: "월 공제 내역",
    insurance4: (v: string) => `4대보험 (${v}원)`,
    tax: (v: string) => `세금 (${v}원)`,
    nationalPension: "국민연금",
    healthIns: "건강보험",
    longTermCare: "장기요양",
    employmentIns: "고용보험",
    incomeTax: "소득세",
    localIncomeTax: "지방소득세",
    detailCalc: "상세 계산 과정",
    annualSalary: "연봉",
    monthlyPreTax: "월 세전",
    taxableAfterExempt: "비과세 제외 과세급여",
    perMonth: "/월",
    ins4Calc: "4대보험 계산",
    incomeTaxCalc: "소득세 계산 (간이세액표 공식)",
    incomeTaxDetail: (personal: string, tax: string) =>
      `연간 과세급여 → 근로소득공제 → 종합소득공제(인적 ${personal}원 + 연금·보험료 + 기타) → 과세표준 → 세율 적용 → 세액공제 → 월 소득세 ${tax}원`,
    localTaxDetail: (v: string) => `지방소득세: 소득세의 10% = ${v}원`,
    compTable: "연봉별 실수령액 비교표",
    thSalary: "연봉",
    thGross: "월 세전",
    thDeduct: "공제",
    thNet: "실수령",
    thRate: "공제율",
    note1: (y: number) =>
      `· ${y}년 확정 요율 기준 (국민연금 ${RATES.nationalPension * 100}%, 건강보험 ${RATES.healthInsurance * 100}%, 장기요양 ${RATES.longTermCare * 100}%, 고용보험 ${RATES.employmentInsurance * 100}%)`,
    note2: "· 소득세는 국세청 근로소득 간이세액표 공식 기반으로 계산됩니다",
    note3: "· 실제 원천징수액은 회사 급여 방식에 따라 소폭 차이가 있을 수 있습니다",
    note4: "· 비과세 식대 기본 월 20만원 (2023년 개정 기준)",
  },
  en: {
    title: "Salary Take-Home Calculator",
    subtitle: (y: number) =>
      `Based on ${y} confirmed rates · Korean NTS simplified tax table`,
    salaryLabel: "Annual Salary (Pre-tax)",
    won: "KRW",
    rangeMin: "20M",
    rangeMax: "200M",
    dependents: "Dependents",
    childrenLabel: "Children ≤20",
    nonTaxable: "Non-taxable",
    ppl: "",
    self: " (self)",
    none: "None",
    man10: "₩100K",
    man20: "₩200K",
    man30: "₩300K",
    monthlyNet: "Monthly Take-Home",
    preTax: (v: string) => `Pre-tax ${v} KRW`,
    deduction: (v: string) => `Deductions ${v} KRW`,
    deductionRate: (r: string, net: string) =>
      `Deduction rate ${r}% · Annual net ${net} KRW`,
    monthlyDeduction: "Monthly Deductions",
    insurance4: (v: string) => `Social Insurance (${v} KRW)`,
    tax: (v: string) => `Tax (${v} KRW)`,
    nationalPension: "National Pension",
    healthIns: "Health Insurance",
    longTermCare: "Long-term Care",
    employmentIns: "Employment Ins.",
    incomeTax: "Income Tax",
    localIncomeTax: "Local Income Tax",
    detailCalc: "Calculation Details",
    annualSalary: "Annual Salary",
    monthlyPreTax: "Monthly Pre-tax",
    taxableAfterExempt: "Taxable income (after exemption)",
    perMonth: "/mo",
    ins4Calc: "Social Insurance Calculation",
    incomeTaxCalc: "Income Tax Calculation (NTS formula)",
    incomeTaxDetail: (personal: string, tax: string) =>
      `Annual taxable → Employment deduction → Comprehensive deduction (personal ₩${personal} + pension/insurance + others) → Tax base → Tax rate → Tax credit → Monthly income tax ₩${tax}`,
    localTaxDetail: (v: string) => `Local income tax: 10% of income tax = ₩${v}`,
    compTable: "Salary Comparison Table",
    thSalary: "Salary",
    thGross: "Gross/mo",
    thDeduct: "Deduct",
    thNet: "Net",
    thRate: "Rate",
    note1: (y: number) =>
      `· Based on ${y} rates (NP ${RATES.nationalPension * 100}%, HI ${RATES.healthInsurance * 100}%, LTC ${RATES.longTermCare * 100}%, EI ${RATES.employmentInsurance * 100}%)`,
    note2: "· Income tax is calculated based on the Korean NTS simplified wage tax table",
    note3: "· Actual withholding may differ slightly depending on employer payroll method",
    note4: "· Default non-taxable meal allowance: ₩200,000/month (revised 2023)",
  },
} as const;

// ══════════════════════════════════════════════
// 컴포넌트
// ══════════════════════════════════════════════
export default function SalaryClient() {
  const { locale } = useI18n();
  const isKo = locale === "ko";
  const t = isKo ? L.ko : L.en;

  const [salary, setSalary] = useState(50_000_000);
  const [dependents, setDependents] = useState(1);
  const [children, setChildren] = useState(0);
  const [nonTaxable, setNonTaxable] = useState(200_000);
  const [showDetail, setShowDetail] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const result = useMemo(
    () => calculateSalary(salary, dependents, children, nonTaxable),
    [salary, dependents, children, nonTaxable]
  );

  const comparisonTable = useMemo(() => {
    const salaries = [
      20_000_000, 25_000_000, 30_000_000, 35_000_000, 40_000_000,
      45_000_000, 50_000_000, 55_000_000, 60_000_000, 70_000_000,
      80_000_000, 90_000_000, 100_000_000, 120_000_000, 150_000_000,
    ];
    return salaries.map((s) => {
      const r = calculateSalary(s, dependents, children, nonTaxable);
      return { salary: s, ...r };
    });
  }, [dependents, children, nonTaxable]);

  const deductionItems = [
    { label: t.nationalPension, amount: result.nationalPension, color: "bg-blue-500" },
    { label: t.healthIns, amount: result.healthInsurance, color: "bg-emerald-500" },
    { label: t.longTermCare, amount: result.longTermCare, color: "bg-teal-500" },
    { label: t.employmentIns, amount: result.employmentInsurance, color: "bg-cyan-500" },
    { label: t.incomeTax, amount: result.incomeTax, color: "bg-amber-500" },
    { label: t.localIncomeTax, amount: result.localIncomeTax, color: "bg-orange-500" },
  ];

  const f = (n: number) => fmt(n, locale);
  const fm = (n: number) => fmtMan(n, isKo);
  const curr = isKo ? "원" : " KRW";

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-black text-center">{t.title}</h1>
      <p className="text-sm text-zinc-500 text-center">
        {t.subtitle(RATES.year)}
      </p>

      {/* ── 입력 ── */}
      <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-zinc-700 flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-violet-500" />
              {t.salaryLabel}
            </label>
            <span className="text-sm font-bold text-violet-600">
              {fm(salary)}{curr}
            </span>
          </div>
          <input
            type="range"
            min={20_000_000}
            max={200_000_000}
            step={1_000_000}
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value))}
            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
            <span>{t.rangeMin}</span>
            <span>{t.rangeMax}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              value={salary}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 0 && v <= 1_000_000_000) setSalary(v);
              }}
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            <span className="text-xs text-zinc-500">{t.won}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-zinc-600 flex items-center gap-1 mb-1">
              <Users className="h-3 w-3" />
              {t.dependents}
            </label>
            <select
              value={dependents}
              onChange={(e) => setDependents(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}{t.ppl}{n === 1 ? t.self : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-600 flex items-center gap-1 mb-1">
              <Baby className="h-3 w-3" />
              {t.childrenLabel}
            </label>
            <select
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}{t.ppl}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-600 flex items-center gap-1 mb-1">
              <Calculator className="h-3 w-3" />
              {t.nonTaxable}
            </label>
            <select
              value={nonTaxable}
              onChange={(e) => setNonTaxable(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value={0}>{t.none}</option>
              <option value={100_000}>{t.man10}</option>
              <option value={200_000}>{t.man20}</option>
              <option value={300_000}>{t.man30}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 결과 ── */}
      <div className="bg-gradient-to-br from-violet-600 to-blue-600 rounded-2xl p-6 text-white text-center shadow-lg">
        <p className="text-xs font-medium opacity-80 mb-1">{t.monthlyNet}</p>
        <p className="text-4xl font-black tracking-tight">
          {f(result.monthlyNet)}
          <span className="text-lg font-bold ml-1">{curr}</span>
        </p>
        <div className="flex justify-center gap-4 mt-3 text-xs opacity-80">
          <span>{t.preTax(f(result.monthlyGross))}</span>
          <span>{t.deduction(f(result.totalDeduction))}</span>
        </div>
        <div className="mt-2 text-[10px] opacity-60">
          {t.deductionRate(
            result.deductionRate.toFixed(1),
            fm(result.annualNet)
          )}
        </div>
      </div>

      {/* ── 공제 내역 ── */}
      <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-800">
            {t.monthlyDeduction}
          </h3>
          <span className="text-sm font-bold text-red-500">
            -{f(result.totalDeduction)}{curr}
          </span>
        </div>

        <div className="flex h-3 rounded-full overflow-hidden bg-zinc-100">
          {deductionItems.map((item) => {
            const pct =
              result.totalDeduction > 0
                ? (item.amount / result.totalDeduction) * 100
                : 0;
            return pct > 0 ? (
              <div
                key={item.label}
                className={`${item.color} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${item.label}: ${f(item.amount)}${curr}`}
              />
            ) : null;
          })}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold text-zinc-500">
            {t.insurance4(f(result.insuranceTotal))}
          </p>
          {deductionItems.slice(0, 4).map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-zinc-600">
                <span className={`w-2 h-2 rounded-full ${item.color}`} />
                {item.label}
              </span>
              <span className="font-mono text-zinc-800">
                {f(item.amount)}{curr}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 pt-1 border-t">
          <p className="text-xs font-bold text-zinc-500">
            {t.tax(f(result.taxTotal))}
          </p>
          {deductionItems.slice(4).map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-zinc-600">
                <span className={`w-2 h-2 rounded-full ${item.color}`} />
                {item.label}
              </span>
              <span className="font-mono text-zinc-800">
                {f(item.amount)}{curr}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 상세 계산 과정 ── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors"
        >
          <span className="text-sm font-bold text-zinc-600 flex items-center gap-1.5">
            <Info className="h-4 w-4" />
            {t.detailCalc}
          </span>
          {showDetail ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </button>
        {showDetail && (
          <div className="px-5 pb-4 border-t space-y-2 text-xs text-zinc-600 mt-3">
            <p>
              <b>{t.annualSalary}:</b> {f(salary)}{curr} → <b>{t.monthlyPreTax}:</b>{" "}
              {f(result.monthlyGross)}{curr}
            </p>
            <p>
              <b>{t.taxableAfterExempt}:</b> {f(result.monthlyTaxable)}{curr}{t.perMonth}
            </p>
            <div className="border-t pt-2">
              <p className="font-bold text-zinc-700 mb-1">{t.ins4Calc}</p>
              <p>
                {t.nationalPension}: min({f(result.monthlyTaxable)},{" "}
                {f(RATES.nationalPensionCap)}) × {RATES.nationalPension * 100}%
                = {f(result.nationalPension)}{curr}
              </p>
              <p>
                {t.healthIns}: {f(result.monthlyTaxable)} ×{" "}
                {RATES.healthInsurance * 100}% = {f(result.healthInsurance)}{curr}
              </p>
              <p>
                {t.longTermCare}: {f(result.healthInsurance)} ×{" "}
                {RATES.longTermCare * 100}% = {f(result.longTermCare)}{curr}
              </p>
              <p>
                {t.employmentIns}: {f(result.monthlyTaxable)} ×{" "}
                {RATES.employmentInsurance * 100}% ={" "}
                {f(result.employmentInsurance)}{curr}
              </p>
            </div>
            <div className="border-t pt-2">
              <p className="font-bold text-zinc-700 mb-1">{t.incomeTaxCalc}</p>
              <p>
                {t.incomeTaxDetail(
                  f(1_500_000 * dependents),
                  f(result.incomeTax)
                )}
              </p>
              <p>{t.localTaxDetail(f(result.localIncomeTax))}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 비교표 ── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <button
          onClick={() => setShowTable(!showTable)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors"
        >
          <span className="text-sm font-bold text-zinc-600">
            {t.compTable}
          </span>
          {showTable ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </button>
        {showTable && (
          <div className="border-t overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-50 text-zinc-500">
                  <th className="px-3 py-2 text-left font-bold">{t.thSalary}</th>
                  <th className="px-3 py-2 text-right font-bold">{t.thGross}</th>
                  <th className="px-3 py-2 text-right font-bold">{t.thDeduct}</th>
                  <th className="px-3 py-2 text-right font-bold">{t.thNet}</th>
                  <th className="px-3 py-2 text-right font-bold">{t.thRate}</th>
                </tr>
              </thead>
              <tbody>
                {comparisonTable.map((row) => {
                  const isActive = row.salary === salary;
                  return (
                    <tr
                      key={row.salary}
                      className={`border-t cursor-pointer hover:bg-violet-50 transition-colors ${
                        isActive ? "bg-violet-50 font-bold" : ""
                      }`}
                      onClick={() => setSalary(row.salary)}
                    >
                      <td className="px-3 py-2 text-zinc-700">
                        {fm(row.salary)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-600">
                        {f(row.monthlyGross)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-red-500">
                        -{f(row.totalDeduction)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-violet-700 font-bold">
                        {f(row.monthlyNet)}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500">
                        {row.deductionRate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 안내 ── */}
      <div className="bg-zinc-50 rounded-xl px-4 py-3 space-y-1">
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          {t.note1(RATES.year)}
        </p>
        <p className="text-[10px] text-zinc-500 leading-relaxed">{t.note2}</p>
        <p className="text-[10px] text-zinc-500 leading-relaxed">{t.note3}</p>
        <p className="text-[10px] text-zinc-500 leading-relaxed">{t.note4}</p>
      </div>
    </div>
  );
}
