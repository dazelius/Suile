/**
 * SUILE Cloud Functions - 진입점
 *
 * 각 도구의 Cloud Function은 별도 파일에 분리되어 있습니다.
 * 새 도구 추가 시 해당 파일을 만들고 여기서 re-export 하세요.
 *
 * 구조:
 *   functions/
 *     index.js             ← 이 파일 (진입점)
 *     blind-message.js     ← 블라인드 메시지 (ogImage, messageView)
 *     stock-battle.js      ← 주식 배틀 (stockBattle, stockBattleOg, stockBattleView)
 */

// ── 블라인드 메시지 ──
const blindMessage = require("./blind-message");
exports.ogImage = blindMessage.ogImage;
exports.messageView = blindMessage.messageView;

// ── 주식 (공용 API) ──
const stockBattle = require("./stock-battle");
exports.stockSearch = stockBattle.stockSearch;
exports.stockHistory = stockBattle.stockHistory;

// ── 주식 배틀 ──
exports.stockBattle = stockBattle.stockBattle;
exports.stockBattleOg = stockBattle.stockBattleOg;
exports.stockBattleView = stockBattle.stockBattleView;

// ── 몬테카를로 시뮬레이터 ──
const monteCarlo = require("./monte-carlo");
exports.monteCarloOg = monteCarlo.monteCarloOg;
exports.monteCarloView = monteCarlo.monteCarloView;

// ── PEG 비율 차트 ──
const pegChart = require("./peg-chart");
exports.pegHistory = pegChart.pegHistory;

// ── 아파트 배틀 ──
const aptBattle = require("./apt-battle");
exports.aptSearch = aptBattle.aptSearch;
exports.aptBattle = aptBattle.aptBattle;
exports.aptBattleView = aptBattle.aptBattleView;

// ── 주식 성적표 ──
const stockScore = require("./stock-score");
exports.stockScore = stockScore.stockScore;
exports.stockScoreView = stockScore.stockScoreView;

// ── 주식 AI 분석 ──
const stockAi = require("./stock-ai");
exports.stockAiAnalysis = stockAi.stockAiAnalysis;

// ── 얼굴 평가 ──
const faceScore = require("./face-score");
exports.faceScore = faceScore.faceScore;
exports.faceScoreOg = faceScore.faceScoreOg;
exports.faceScoreView = faceScore.faceScoreView;

// ── 심박수 측정기 ──
const heartRate = require("./heart-rate");
exports.heartRateOg = heartRate.heartRateOg;
exports.heartRateView = heartRate.heartRateView;

// ── 회의록 AI 정리 ──
const meetingNote = require("./meeting-note");
exports.meetingAi = meetingNote.meetingAi;

// ── 회의록 Google Docs 내보내기 ──
const exportGoogleDoc = require("./export-google-doc");
exports.exportGoogleDoc = exportGoogleDoc.exportGoogleDoc;

// ── 음성 파일 전사 ──
const transcribeAudio = require("./transcribe-audio");
exports.transcribeAudio = transcribeAudio.transcribeAudio;

// ── 숏폼 타임스탬프 자막 전사 ──
const transcribeTimestamps = require("./transcribe-timestamps");
exports.transcribeWithTimestamps = transcribeTimestamps.transcribeWithTimestamps;
