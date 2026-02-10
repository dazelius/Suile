/** 인기 종목 프리셋 */
export interface StockPreset {
  ticker: string;
  name: string;       // 한국어 or 영어 대표 이름
  nameEn?: string;    // 영어 이름 (한국 종목용 검색 보조)
  flag: string;       // 🇺🇸 or 🇰🇷
}

// ── 미국 주요 종목 ──
export const US_PRESETS: StockPreset[] = [
  { ticker: "AAPL", name: "Apple", nameEn: "Apple", flag: "🇺🇸" },
  { ticker: "MSFT", name: "Microsoft", nameEn: "Microsoft", flag: "🇺🇸" },
  { ticker: "GOOGL", name: "Google", nameEn: "Alphabet Google", flag: "🇺🇸" },
  { ticker: "AMZN", name: "Amazon", nameEn: "Amazon", flag: "🇺🇸" },
  { ticker: "NVDA", name: "NVIDIA", nameEn: "NVIDIA", flag: "🇺🇸" },
  { ticker: "TSLA", name: "Tesla", nameEn: "Tesla", flag: "🇺🇸" },
  { ticker: "META", name: "Meta", nameEn: "Meta Facebook", flag: "🇺🇸" },
  { ticker: "NFLX", name: "Netflix", nameEn: "Netflix", flag: "🇺🇸" },
  { ticker: "AMD", name: "AMD", nameEn: "Advanced Micro Devices", flag: "🇺🇸" },
  { ticker: "INTC", name: "Intel", nameEn: "Intel", flag: "🇺🇸" },
  { ticker: "AVGO", name: "Broadcom", nameEn: "Broadcom", flag: "🇺🇸" },
  { ticker: "CRM", name: "Salesforce", nameEn: "Salesforce", flag: "🇺🇸" },
  { ticker: "ORCL", name: "Oracle", nameEn: "Oracle", flag: "🇺🇸" },
  { ticker: "ADBE", name: "Adobe", nameEn: "Adobe", flag: "🇺🇸" },
  { ticker: "CSCO", name: "Cisco", nameEn: "Cisco", flag: "🇺🇸" },
  { ticker: "QCOM", name: "Qualcomm", nameEn: "Qualcomm", flag: "🇺🇸" },
  { ticker: "TXN", name: "Texas Instruments", nameEn: "Texas Instruments", flag: "🇺🇸" },
  { ticker: "UBER", name: "Uber", nameEn: "Uber", flag: "🇺🇸" },
  { ticker: "ABNB", name: "Airbnb", nameEn: "Airbnb", flag: "🇺🇸" },
  { ticker: "COIN", name: "Coinbase", nameEn: "Coinbase", flag: "🇺🇸" },
  { ticker: "SQ", name: "Block", nameEn: "Block Square", flag: "🇺🇸" },
  { ticker: "SHOP", name: "Shopify", nameEn: "Shopify", flag: "🇺🇸" },
  { ticker: "SNAP", name: "Snap", nameEn: "Snap Snapchat", flag: "🇺🇸" },
  { ticker: "SPOT", name: "Spotify", nameEn: "Spotify", flag: "🇺🇸" },
  { ticker: "DIS", name: "Disney", nameEn: "Walt Disney", flag: "🇺🇸" },
  { ticker: "PYPL", name: "PayPal", nameEn: "PayPal", flag: "🇺🇸" },
  { ticker: "V", name: "Visa", nameEn: "Visa", flag: "🇺🇸" },
  { ticker: "MA", name: "Mastercard", nameEn: "Mastercard", flag: "🇺🇸" },
  { ticker: "JPM", name: "JPMorgan", nameEn: "JPMorgan Chase", flag: "🇺🇸" },
  { ticker: "BAC", name: "Bank of America", nameEn: "Bank of America", flag: "🇺🇸" },
  { ticker: "WMT", name: "Walmart", nameEn: "Walmart", flag: "🇺🇸" },
  { ticker: "COST", name: "Costco", nameEn: "Costco", flag: "🇺🇸" },
  { ticker: "NKE", name: "Nike", nameEn: "Nike", flag: "🇺🇸" },
  { ticker: "SBUX", name: "Starbucks", nameEn: "Starbucks", flag: "🇺🇸" },
  { ticker: "MCD", name: "McDonald's", nameEn: "McDonalds", flag: "🇺🇸" },
  { ticker: "KO", name: "Coca-Cola", nameEn: "Coca Cola", flag: "🇺🇸" },
  { ticker: "PEP", name: "PepsiCo", nameEn: "PepsiCo Pepsi", flag: "🇺🇸" },
  { ticker: "JNJ", name: "Johnson & Johnson", nameEn: "Johnson Johnson", flag: "🇺🇸" },
  { ticker: "PFE", name: "Pfizer", nameEn: "Pfizer", flag: "🇺🇸" },
  { ticker: "MRNA", name: "Moderna", nameEn: "Moderna", flag: "🇺🇸" },
  { ticker: "BRK-B", name: "Berkshire", nameEn: "Berkshire Hathaway", flag: "🇺🇸" },
  { ticker: "XOM", name: "ExxonMobil", nameEn: "Exxon Mobil", flag: "🇺🇸" },
  { ticker: "BA", name: "Boeing", nameEn: "Boeing", flag: "🇺🇸" },
  { ticker: "GS", name: "Goldman Sachs", nameEn: "Goldman Sachs", flag: "🇺🇸" },
  { ticker: "MU", name: "Micron", nameEn: "Micron Technology 마이크론", flag: "🇺🇸" },
  { ticker: "PLTR", name: "Palantir", nameEn: "Palantir 팔란티어", flag: "🇺🇸" },
  { ticker: "ARM", name: "ARM Holdings", nameEn: "ARM 암홀딩스", flag: "🇺🇸" },
  { ticker: "MRVL", name: "Marvell", nameEn: "Marvell Technology 마벨", flag: "🇺🇸" },
  { ticker: "SMCI", name: "Super Micro", nameEn: "Super Micro Computer 슈퍼마이크로", flag: "🇺🇸" },
  { ticker: "DELL", name: "Dell", nameEn: "Dell Technologies 델", flag: "🇺🇸" },
  { ticker: "CRWD", name: "CrowdStrike", nameEn: "CrowdStrike 크라우드스트라이크", flag: "🇺🇸" },
  { ticker: "PANW", name: "Palo Alto Networks", nameEn: "Palo Alto 팔로알토", flag: "🇺🇸" },
  { ticker: "NOW", name: "ServiceNow", nameEn: "ServiceNow 서비스나우", flag: "🇺🇸" },
  { ticker: "SNOW", name: "Snowflake", nameEn: "Snowflake 스노우플레이크", flag: "🇺🇸" },
  { ticker: "NET", name: "Cloudflare", nameEn: "Cloudflare 클라우드플레어", flag: "🇺🇸" },
  { ticker: "RBLX", name: "Roblox", nameEn: "Roblox 로블록스", flag: "🇺🇸" },
  { ticker: "RIVN", name: "Rivian", nameEn: "Rivian 리비안", flag: "🇺🇸" },
  { ticker: "LCID", name: "Lucid", nameEn: "Lucid Motors 루시드", flag: "🇺🇸" },
  { ticker: "SOFI", name: "SoFi", nameEn: "SoFi Technologies 소파이", flag: "🇺🇸" },
  { ticker: "SERV", name: "Serve Robotics", nameEn: "Serve Robotics 서브로보틱스", flag: "🇺🇸" },
  { ticker: "RR", name: "Richtech Robotics", nameEn: "Richtech Robotics 리치텍 로보틱스", flag: "🇺🇸" },
  { ticker: "RBOT", name: "Vicarious Surgical", nameEn: "Vicarious Surgical", flag: "🇺🇸" },
  { ticker: "IRBT", name: "iRobot", nameEn: "iRobot 아이로봇", flag: "🇺🇸" },
  { ticker: "TSM", name: "TSMC", nameEn: "Taiwan Semiconductor TSMC 대만반도체", flag: "🇹🇼" },
  { ticker: "ASML", name: "ASML", nameEn: "ASML Holdings", flag: "🇳🇱" },
  { ticker: "BABA", name: "Alibaba", nameEn: "Alibaba 알리바바", flag: "🇨🇳" },
  { ticker: "NIO", name: "NIO", nameEn: "NIO 니오", flag: "🇨🇳" },
  // ETF
  { ticker: "SPY", name: "S&P 500 ETF", nameEn: "SPY S&P 500", flag: "🇺🇸" },
  { ticker: "QQQ", name: "나스닥 100 ETF", nameEn: "QQQ Nasdaq 100", flag: "🇺🇸" },
  { ticker: "VOO", name: "Vanguard S&P 500", nameEn: "VOO Vanguard", flag: "🇺🇸" },
  { ticker: "BTC-USD", name: "비트코인", nameEn: "Bitcoin BTC", flag: "🌐" },
  { ticker: "ETH-USD", name: "이더리움", nameEn: "Ethereum ETH", flag: "🌐" },
];

// ── 한국 주요 종목 ──
export const KR_PRESETS: StockPreset[] = [
  { ticker: "005930.KS", name: "삼성전자", nameEn: "Samsung Electronics", flag: "🇰🇷" },
  { ticker: "000660.KS", name: "SK하이닉스", nameEn: "SK Hynix", flag: "🇰🇷" },
  { ticker: "373220.KS", name: "LG에너지솔루션", nameEn: "LG Energy Solution", flag: "🇰🇷" },
  { ticker: "005380.KS", name: "현대자동차", nameEn: "Hyundai Motor", flag: "🇰🇷" },
  { ticker: "000270.KS", name: "기아", nameEn: "Kia", flag: "🇰🇷" },
  { ticker: "035420.KS", name: "NAVER", nameEn: "Naver", flag: "🇰🇷" },
  { ticker: "035720.KS", name: "카카오", nameEn: "Kakao", flag: "🇰🇷" },
  { ticker: "051910.KS", name: "LG화학", nameEn: "LG Chem", flag: "🇰🇷" },
  { ticker: "006400.KS", name: "삼성SDI", nameEn: "Samsung SDI", flag: "🇰🇷" },
  { ticker: "068270.KS", name: "셀트리온", nameEn: "Celltrion", flag: "🇰🇷" },
  { ticker: "105560.KS", name: "KB금융", nameEn: "KB Financial", flag: "🇰🇷" },
  { ticker: "055550.KS", name: "신한지주", nameEn: "Shinhan Financial", flag: "🇰🇷" },
  { ticker: "066570.KS", name: "LG전자", nameEn: "LG Electronics", flag: "🇰🇷" },
  { ticker: "003670.KS", name: "포스코퓨처엠", nameEn: "POSCO Future M", flag: "🇰🇷" },
  { ticker: "247540.KS", name: "에코프로비엠", nameEn: "EcoPro BM", flag: "🇰🇷" },
  { ticker: "086520.KS", name: "에코프로", nameEn: "EcoPro", flag: "🇰🇷" },
  { ticker: "028260.KS", name: "삼성물산", nameEn: "Samsung C&T", flag: "🇰🇷" },
  { ticker: "012330.KS", name: "현대모비스", nameEn: "Hyundai Mobis", flag: "🇰🇷" },
  { ticker: "034730.KS", name: "SK", nameEn: "SK Inc", flag: "🇰🇷" },
  { ticker: "030200.KS", name: "KT", nameEn: "KT Corp", flag: "🇰🇷" },
  { ticker: "017670.KS", name: "SK텔레콤", nameEn: "SK Telecom", flag: "🇰🇷" },
  { ticker: "032830.KS", name: "삼성생명", nameEn: "Samsung Life", flag: "🇰🇷" },
  { ticker: "003490.KS", name: "대한항공", nameEn: "Korean Air", flag: "🇰🇷" },
  { ticker: "009150.KS", name: "삼성전기", nameEn: "Samsung Electro", flag: "🇰🇷" },
  { ticker: "018260.KS", name: "삼성에스디에스", nameEn: "Samsung SDS", flag: "🇰🇷" },
  { ticker: "352820.KS", name: "하이브", nameEn: "HYBE BTS", flag: "🇰🇷" },
  { ticker: "259960.KS", name: "크래프톤", nameEn: "Krafton PUBG", flag: "🇰🇷" },
  { ticker: "263750.KS", name: "펄어비스", nameEn: "Pearl Abyss", flag: "🇰🇷" },
  { ticker: "036570.KS", name: "엔씨소프트", nameEn: "NCSoft", flag: "🇰🇷" },
  { ticker: "251270.KS", name: "넷마블", nameEn: "Netmarble", flag: "🇰🇷" },
];

export const ALL_PRESETS = [...US_PRESETS, ...KR_PRESETS];

/** 티커로 이름 찾기 */
export function getStockName(ticker: string): string {
  const found = ALL_PRESETS.find((p) => p.ticker === ticker);
  return found ? found.name : ticker;
}

/** 검색 (이름, 영문명, 티커 모두 매칭) */
export function searchStocks(query: string): StockPreset[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  return ALL_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.ticker.toLowerCase().includes(q) ||
      (p.nameEn && p.nameEn.toLowerCase().includes(q))
  ).slice(0, 8);
}
