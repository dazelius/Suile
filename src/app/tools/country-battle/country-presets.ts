export interface CountryPreset {
  iso3: string;   // "KOR"
  iso2: string;   // "kr" (lowercase for flagcdn)
  name: { ko: string; en: string };
  flag: string;   // emoji
  region: "asia" | "americas" | "europe" | "other";
}

export const COUNTRIES: CountryPreset[] = [
  // ── Asia ──
  { iso3: "KOR", iso2: "kr", name: { ko: "한국",     en: "South Korea" },  flag: "🇰🇷", region: "asia" },
  { iso3: "JPN", iso2: "jp", name: { ko: "일본",     en: "Japan" },        flag: "🇯🇵", region: "asia" },
  { iso3: "CHN", iso2: "cn", name: { ko: "중국",     en: "China" },        flag: "🇨🇳", region: "asia" },
  { iso3: "IND", iso2: "in", name: { ko: "인도",     en: "India" },        flag: "🇮🇳", region: "asia" },
  { iso3: "TWN", iso2: "tw", name: { ko: "대만",     en: "Taiwan" },       flag: "🇹🇼", region: "asia" },
  { iso3: "IDN", iso2: "id", name: { ko: "인도네시아", en: "Indonesia" },   flag: "🇮🇩", region: "asia" },
  { iso3: "SGP", iso2: "sg", name: { ko: "싱가포르",  en: "Singapore" },    flag: "🇸🇬", region: "asia" },
  { iso3: "THA", iso2: "th", name: { ko: "태국",     en: "Thailand" },     flag: "🇹🇭", region: "asia" },
  { iso3: "VNM", iso2: "vn", name: { ko: "베트남",    en: "Vietnam" },     flag: "🇻🇳", region: "asia" },
  { iso3: "SAU", iso2: "sa", name: { ko: "사우디",    en: "Saudi Arabia" }, flag: "🇸🇦", region: "asia" },
  { iso3: "ARE", iso2: "ae", name: { ko: "UAE",      en: "UAE" },          flag: "🇦🇪", region: "asia" },
  { iso3: "MYS", iso2: "my", name: { ko: "말레이시아", en: "Malaysia" },    flag: "🇲🇾", region: "asia" },
  { iso3: "PHL", iso2: "ph", name: { ko: "필리핀",    en: "Philippines" }, flag: "🇵🇭", region: "asia" },

  // ── Americas ──
  { iso3: "USA", iso2: "us", name: { ko: "미국",      en: "United States" }, flag: "🇺🇸", region: "americas" },
  { iso3: "CAN", iso2: "ca", name: { ko: "캐나다",    en: "Canada" },        flag: "🇨🇦", region: "americas" },
  { iso3: "BRA", iso2: "br", name: { ko: "브라질",    en: "Brazil" },        flag: "🇧🇷", region: "americas" },
  { iso3: "MEX", iso2: "mx", name: { ko: "멕시코",    en: "Mexico" },        flag: "🇲🇽", region: "americas" },
  { iso3: "ARG", iso2: "ar", name: { ko: "아르헨티나", en: "Argentina" },     flag: "🇦🇷", region: "americas" },
  { iso3: "CHL", iso2: "cl", name: { ko: "칠레",      en: "Chile" },         flag: "🇨🇱", region: "americas" },
  { iso3: "COL", iso2: "co", name: { ko: "콜롬비아",  en: "Colombia" },      flag: "🇨🇴", region: "americas" },

  // ── Europe ──
  { iso3: "DEU", iso2: "de", name: { ko: "독일",     en: "Germany" },       flag: "🇩🇪", region: "europe" },
  { iso3: "GBR", iso2: "gb", name: { ko: "영국",     en: "United Kingdom" }, flag: "🇬🇧", region: "europe" },
  { iso3: "FRA", iso2: "fr", name: { ko: "프랑스",    en: "France" },        flag: "🇫🇷", region: "europe" },
  { iso3: "ITA", iso2: "it", name: { ko: "이탈리아",  en: "Italy" },         flag: "🇮🇹", region: "europe" },
  { iso3: "ESP", iso2: "es", name: { ko: "스페인",    en: "Spain" },         flag: "🇪🇸", region: "europe" },
  { iso3: "NLD", iso2: "nl", name: { ko: "네덜란드",  en: "Netherlands" },   flag: "🇳🇱", region: "europe" },
  { iso3: "CHE", iso2: "ch", name: { ko: "스위스",    en: "Switzerland" },   flag: "🇨🇭", region: "europe" },
  { iso3: "SWE", iso2: "se", name: { ko: "스웨덴",    en: "Sweden" },        flag: "🇸🇪", region: "europe" },
  { iso3: "NOR", iso2: "no", name: { ko: "노르웨이",  en: "Norway" },        flag: "🇳🇴", region: "europe" },
  { iso3: "POL", iso2: "pl", name: { ko: "폴란드",    en: "Poland" },        flag: "🇵🇱", region: "europe" },
  { iso3: "TUR", iso2: "tr", name: { ko: "튀르키예",  en: "Turkey" },        flag: "🇹🇷", region: "europe" },
  { iso3: "IRL", iso2: "ie", name: { ko: "아일랜드",  en: "Ireland" },       flag: "🇮🇪", region: "europe" },
  { iso3: "DNK", iso2: "dk", name: { ko: "덴마크",    en: "Denmark" },       flag: "🇩🇰", region: "europe" },

  // ── Other ──
  { iso3: "AUS", iso2: "au", name: { ko: "호주",     en: "Australia" },      flag: "🇦🇺", region: "other" },
  { iso3: "RUS", iso2: "ru", name: { ko: "러시아",    en: "Russia" },        flag: "🇷🇺", region: "other" },
  { iso3: "ZAF", iso2: "za", name: { ko: "남아공",    en: "South Africa" },  flag: "🇿🇦", region: "other" },
  { iso3: "EGY", iso2: "eg", name: { ko: "이집트",    en: "Egypt" },         flag: "🇪🇬", region: "other" },
  { iso3: "NGA", iso2: "ng", name: { ko: "나이지리아", en: "Nigeria" },       flag: "🇳🇬", region: "other" },
  { iso3: "ISR", iso2: "il", name: { ko: "이스라엘",  en: "Israel" },        flag: "🇮🇱", region: "other" },
  { iso3: "NZL", iso2: "nz", name: { ko: "뉴질랜드",  en: "New Zealand" },   flag: "🇳🇿", region: "other" },
];
