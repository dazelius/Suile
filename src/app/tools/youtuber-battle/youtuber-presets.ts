export interface YouTuberPreset {
  channelId: string;
  name: string;
  category: "kr-ent" | "kr-edu" | "global" | "gaming" | "music";
}

export const YOUTUBERS: YouTuberPreset[] = [
  // ── 한국 엔터 ──
  { channelId: "UCUj6rrhMTR9pipbAWBAMvUQ", name: "침착맨", category: "kr-ent" },
  { channelId: "UCyJ68aqTzEMCsJg5nYRjvOQ", name: "쯔양", category: "kr-ent" },
  { channelId: "UC-Ax48vMVkCkeNz5YZjbTDg", name: "피식대학", category: "kr-ent" },
  { channelId: "UCynGrMaI2GiFwGNLfdTm4cg", name: "빠니보틀", category: "kr-ent" },
  { channelId: "UClRNDVO8093rmRTtNtEzMaQ", name: "곽튜브", category: "kr-ent" },
  { channelId: "UCQ2O-iftmnlfrBuNsUUTofQ", name: "보겸TV", category: "kr-ent" },
  { channelId: "UC5BMQOsAB8hKUyHu9KI6yig", name: "워크맨", category: "kr-ent" },
  { channelId: "UCw5QTuWsaPNnJJIXxp7-VDQ", name: "문복희", category: "kr-ent" },
  { channelId: "UCOQVkMSqUBQbHEOEFXeVQjA", name: "영국남자", category: "kr-ent" },
  { channelId: "UCIG7D2ZhP1Oi8hdNs1BmwgA", name: "성시경", category: "kr-ent" },

  // ── 한국 교육/정보 ──
  { channelId: "UCsJ6RuBiTVWRX156FVbeaGg", name: "슈카월드", category: "kr-edu" },
  { channelId: "UCX4bAxGcrCJKdvOo0Rp41Rw", name: "신사임당", category: "kr-edu" },
  { channelId: "UC2jEaVniHkI0X44OjdLJQ7A", name: "안될과학", category: "kr-edu" },
  { channelId: "UChlgI3UHCOnwUGzWzbJ3H5A", name: "삼프로TV", category: "kr-edu" },
  { channelId: "UCUpAPsO_pCYKMaRekRkFUUg", name: "너덜트", category: "kr-edu" },

  // ── 글로벌 ──
  { channelId: "UCX6OQ3DkcsbYNE6H8uQQuVA", name: "MrBeast", category: "global" },
  { channelId: "UC-lHJZR3Gqxm24_Vd_AJ5Yw", name: "PewDiePie", category: "global" },
  { channelId: "UCq-Fj5jknLsUf-MWSy4_brA", name: "T-Series", category: "global" },
  { channelId: "UCbCmjCuTUZos6Inko4u57UQ", name: "Cocomelon", category: "global" },
  { channelId: "UCJ5v_MCY6GNUBTO8-D3XoAg", name: "WWE", category: "global" },
  { channelId: "UCk1SpWNzOs4MYmr0uICEntg", name: "Like Nastya", category: "global" },
  { channelId: "UCVHFbqXqoYvEWM1Ddxl0QDg", name: "A4", category: "global" },
  { channelId: "UCFFbwnve3yF62-tVXkTyHqg", name: "Stokes Twins", category: "global" },
  { channelId: "UCiGm_E4ZwYSHV3bcW1pnSeQ", name: "Dude Perfect", category: "global" },
  { channelId: "UCHnyfMqiRRG1u-2MsSQLbXA", name: "Veritasium", category: "global" },

  // ── 게임 ──
  { channelId: "UCBkyj16n2snkRg1BAzpovXQ", name: "풍월량", category: "gaming" },
  { channelId: "UCzh4yY8rl38knH33XpNqXbQ", name: "우왁굳", category: "gaming" },
  { channelId: "UCEdh-FnknJnmgOF3SRPP0ug", name: "도티", category: "gaming" },
  { channelId: "UC2-_WWPT_124LE0K2bGpXRw", name: "김블루", category: "gaming" },
  { channelId: "UC7_YxT-KID8kRbqZo7MyscQ", name: "Markiplier", category: "gaming" },
  { channelId: "UCY30JRSgfhYXA6i6xX1erWg", name: "DreamWastaken", category: "gaming" },
  { channelId: "UCIPPMRA040LQr5QPyJEbmXA", name: "MrBeast Gaming", category: "gaming" },
  { channelId: "UCOpNcN46UbXVtpKMrmU4Abg", name: "LazarBeam", category: "gaming" },

  // ── 음악 ──
  { channelId: "UCOmHUn--16B90oW2L6FRR3A", name: "BLACKPINK", category: "music" },
  { channelId: "UC3IZKseVpdzPSBo2Mk4c5cg", name: "HYBE LABELS", category: "music" },
  { channelId: "UCEf_Bc-KVd7onSeifS3py9g", name: "SMTOWN", category: "music" },
  { channelId: "UC-9-kyTW8ZkZNDHQJ6FgpwQ", name: "BANGTANTV", category: "music" },
  { channelId: "UCbW18JZRgko_mOGm5er8Yzg", name: "Ed Sheeran", category: "music" },
  { channelId: "UCuHzBCaKmtaLcRAOoazhCPA", name: "JYP Entertainment", category: "music" },
  { channelId: "UCaO6TYtlC8U5ttz62hTrZgg", name: "JYPNATION", category: "music" },
  { channelId: "UCGwv_ECIfCLPCIjHobILNMw", name: "1MILLION Dance", category: "music" },
];
