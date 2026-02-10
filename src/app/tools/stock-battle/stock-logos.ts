/**
 * 종목 로고 URL 매핑
 * 여러 소스를 시도하여 가장 먼저 로드되는 로고를 사용합니다.
 */

const LOGO_DOMAINS: Record<string, string> = {
  // ── 미국 ──
  AAPL: "apple.com", MSFT: "microsoft.com", GOOGL: "google.com",
  AMZN: "amazon.com", NVDA: "nvidia.com", TSLA: "tesla.com",
  META: "meta.com", NFLX: "netflix.com", AMD: "amd.com",
  INTC: "intel.com", AVGO: "broadcom.com", CRM: "salesforce.com",
  ORCL: "oracle.com", ADBE: "adobe.com", CSCO: "cisco.com",
  QCOM: "qualcomm.com", TXN: "ti.com", UBER: "uber.com",
  ABNB: "airbnb.com", COIN: "coinbase.com", SQ: "squareup.com",
  SHOP: "shopify.com", SNAP: "snap.com", SPOT: "spotify.com",
  DIS: "disney.com", PYPL: "paypal.com", V: "visa.com",
  MA: "mastercard.com", JPM: "jpmorgan.com", BAC: "bankofamerica.com",
  WMT: "walmart.com", COST: "costco.com", NKE: "nike.com",
  SBUX: "starbucks.com", MCD: "mcdonalds.com", KO: "coca-cola.com",
  PEP: "pepsico.com", JNJ: "jnj.com", PFE: "pfizer.com",
  MRNA: "modernatx.com", "BRK-B": "berkshirehathaway.com",
  XOM: "exxonmobil.com", BA: "boeing.com", GS: "goldmansachs.com",
  MU: "micron.com", PLTR: "palantir.com", ARM: "arm.com",
  MRVL: "marvell.com", SMCI: "supermicro.com", DELL: "dell.com",
  CRWD: "crowdstrike.com", PANW: "paloaltonetworks.com",
  NOW: "servicenow.com", SNOW: "snowflake.com", NET: "cloudflare.com",
  RBLX: "roblox.com", RIVN: "rivian.com", LCID: "lucidmotors.com",
  SOFI: "sofi.com", TSM: "tsmc.com", ASML: "asml.com",
  BABA: "alibaba.com", NIO: "nio.com",
  SPY: "ssga.com", QQQ: "invesco.com", VOO: "vanguard.com",
  "BTC-USD": "bitcoin.org", "ETH-USD": "ethereum.org",
  // ── 한국 ──
  "005930.KS": "samsung.com", "000660.KS": "skhynix.com",
  "373220.KS": "lgensol.com", "005380.KS": "hyundai.com",
  "000270.KS": "kia.com", "035420.KS": "navercorp.com",
  "035720.KS": "kakaocorp.com", "051910.KS": "lgchem.com",
  "006400.KS": "samsungsdi.com", "068270.KS": "celltrion.com",
  "105560.KS": "kbfg.com", "055550.KS": "shinhan.com",
  "066570.KS": "lge.co.kr", "003670.KS": "poscofuturem.com",
  "247540.KS": "ecoprobm.co.kr", "086520.KS": "ecopro.co.kr",
  "028260.KS": "samsungcnt.com", "012330.KS": "mobis.co.kr",
  "034730.KS": "sk.com", "030200.KS": "kt.com",
  "017670.KS": "sktelecom.com", "032830.KS": "samsunglife.com",
  "003490.KS": "koreanair.com", "009150.KS": "samsungsem.com",
  "018260.KS": "samsungsds.com", "352820.KS": "hybecorp.com",
  "259960.KS": "krafton.com", "263750.KS": "pearlabyss.com",
  "036570.KS": "ncsoft.com", "251270.KS": "netmarble.com",
};

/**
 * 로고 URL 후보 배열 반환 (순서대로 시도)
 * 1. Google 고화질 favicon
 * 2. DuckDuckGo 아이콘
 */
export function getLogoUrls(ticker: string): string[] {
  const domain = LOGO_DOMAINS[ticker];
  if (!domain) return [];
  return [
    // Google's favicon service (고화질, 항상 작동)
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
    // DuckDuckGo 아이콘 (백업)
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
}

/** 로고 유무 확인 */
export function hasLogo(ticker: string): boolean {
  return !!LOGO_DOMAINS[ticker];
}

/** 티커 기반 고유 색상 생성 (폴백 아바타용) */
export function getTickerColor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}
