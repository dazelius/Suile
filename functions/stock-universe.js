/**
 * S&P 500 종목 유니버스
 * 
 * GICS 섹터별로 정리. 연 수회 변경되므로 필요시 업데이트.
 * 약 503개 종목 (일부 듀얼 클래스 포함)
 */

const SP500 = [
  // ── Information Technology ──
  "AAPL","MSFT","NVDA","AVGO","ORCL","CRM","ADBE","AMD","CSCO","ACN",
  "IBM","INTC","INTU","NOW","QCOM","TXN","AMAT","MU","LRCX","ADI",
  "KLAC","SNPS","CDNS","MCHP","FTNT","PANW","CRWD","ANSS","KEYS","ON",
  "MPWR","GEN","EPAM","CTSH","IT","AKAM","JNPR","FFIV","SWKS","QRVO",
  "TRMB","TER","ZBRA","PTC","NTAP","WDC","HPQ","HPE","STX","DELL",
  "MSCI","FIS","FISV","GPN","PYPL","ADP","PAYX","BR","GDDY","VRSN",
  "FSLR","ENPH","ROP","NDSN","TYL","MANH","FICO",

  // ── Communication Services ──
  "META","GOOGL","GOOG","NFLX","DIS","CMCSA","T","VZ","TMUS","CHTR",
  "EA","TTWO","WBD","LYV","MTCH","IPG","OMC","PARA","FOX","FOXA",
  "NWSA","NWS",

  // ── Consumer Discretionary ──
  "AMZN","TSLA","HD","MCD","NKE","SBUX","LOW","TJX","BKNG","CMG",
  "MAR","HLT","RCL","DHI","LEN","ORLY","AZO","ROST","EBAY","POOL",
  "BBY","GRMN","DRI","YUM","APTV","GM","F","EXPE","LVS","WYNN",
  "MGM","CCL","NCLH","ULTA","TPR","RL","PVH","HAS","NVR","PHM",
  "KMX","GPC","TSCO","ABNB","DKNG","DECK","BWA","CZR",

  // ── Consumer Staples ──
  "PG","KO","PEP","COST","WMT","PM","MO","MDLZ","CL","KMB",
  "GIS","SJM","CAG","HSY","TSN","HRL","CPB","MKC","CHD","CLX",
  "EL","KR","SYY","ADM","STZ","TAP","MNST","KDP","WBA","TGT",
  "KHC","LAMB","BG",

  // ── Health Care ──
  "UNH","JNJ","LLY","ABBV","MRK","TMO","ABT","DHR","PFE","AMGN",
  "MDT","ISRG","ELV","CI","HCA","BSX","SYK","GILD","VRTX","REGN",
  "ZTS","BDX","IDXX","EW","IQV","A","BAX","MTD","HOLX","TECH",
  "ALGN","DGX","RVTY","XRAY","HSIC","CRL","INCY","BIIB","MOH",
  "HUM","CNC","DXCM","PODD","ILMN","WAT","BIO","GEHC","SOLV",

  // ── Financials ──
  "BRK-B","JPM","V","MA","BAC","WFC","GS","MS","SCHW","BLK",
  "AXP","C","SPGI","MMC","PGR","CB","CME","ICE","AON","MET",
  "AFL","PRU","AIG","TRV","ALL","HIG","CINF","FI","COF","USB",
  "PNC","TFC","BK","STT","FITB","MTB","RF","HBAN","CFG","KEY",
  "NTRS","DFS","SYF","NDAQ","FDS","MKTX","CBOE","WRB","RJF",
  "GL","AIZ","BEN","TROW","IVZ","RE","L","AJG","ACGL","EG",

  // ── Industrials ──
  "GE","CAT","HON","UNP","UPS","RTX","DE","BA","LMT","GD",
  "NOC","TT","EMR","ETN","ROK","PH","CMI","FAST","GWW","ITW",
  "AME","IR","DOV","OTIS","CARR","XYL","GNRC","AOS","WM","RSG",
  "VRSK","CPRT","CTAS","PCAR","DAL","UAL","LUV","CSX","NSC",
  "ODFL","JBHT","CHRW","EXPD","FDX","URI","PWR","HUBB","J",
  "LDOS","BAH","AXON","TDG","HWM","WAB","IEX","SWK","SNA",
  "ALLE","GWW","PAYC","NDSN","RHI","MAS","EME","TXT","LHX",
  "HII","BLDR",

  // ── Energy ──
  "XOM","CVX","COP","EOG","SLB","MPC","PSX","VLO","OXY","WMB",
  "KMI","FANG","DVN","HAL","HES","CTRA","BKR","TRGP","OKE","APA",
  "MRO","EQT","DINO",

  // ── Real Estate ──
  "PLD","AMT","EQIX","CCI","PSA","O","SPG","WELL","DLR","VICI",
  "ARE","AVB","EQR","MAA","UDR","ESS","IRM","SBAC","CPT","REG",
  "FRT","KIM","HST","BXP","VTR","INVH","PEAK",

  // ── Utilities ──
  "NEE","DUK","SO","D","AEP","SRE","EXC","XEL","ED","WEC",
  "ES","EIX","DTE","PPL","AEE","CMS","AWK","EVRG","CNP","NI",
  "ATO","PNW","LNT","NRG","CEG",

  // ── Materials ──
  "LIN","APD","SHW","ECL","FCX","NUE","NEM","CTVA","DD","DOW",
  "IFF","PPG","VMC","MLM","ALB","CE","EMN","PKG","IP","CF",
  "MOS","FMC","AVY","SEE","AMCR","BLL","WRK","RPM","BALL","SW",

  // ── 추가 S&P 500 구성종목 ──
  "PLTR","SMCI","CEG","ABNB","UBER","VST","LULU","COIN","ARM",
  "MSTR","APP","DASH","SPOT","SNAP","SQ","HOOD","ROKU","TTD",
  "VEEV","ZS","OKTA","DDOG","NET","MDB","SNOW","BILL","HUBS",
];

// 중복 제거
const SP500_UNIQUE = [...new Set(SP500)];

module.exports = { SP500: SP500_UNIQUE };
