/* ===========================
   js/core/storage.js
   감정 데이터 저장 / 불러오기 — API 기반
   계정·감정·학급·공지 데이터는 Google Sheets(API)에 저장됩니다.
   알림 시각·테마 같은 기기 전용 설정만 localStorage에 남습니다.
=========================== */

// ------------------------------------
// 인메모리 캐시
// ------------------------------------

var _emotionsCache = null;       // 학생 감정 기록 배열
var _teacherNoticeCache = null;  // { text, at } 또는 null
var _studentClassCache = null;   // { id, classCode, className } 또는 null
var _teacherClassCache = null;   // { id, classCode, className, notice } 또는 null

// ------------------------------------
// 탭 간 동기화 알림
// ------------------------------------

function notifyEmotionAppSync(kind, detail) {
  if (typeof postEmotionCheckinSync === 'function') {
    postEmotionCheckinSync(kind, detail);
    return;
  }
  try {
    var ch = new BroadcastChannel('emotion-checkin');
    ch.postMessage({ kind: kind || 'update', ts: Date.now(), detail: detail == null ? null : detail });
    ch.close();
  } catch (e) {}
}

// ------------------------------------
// 감정 기록 (캐시 → API)
// ------------------------------------

function getEmotions() {
  return _emotionsCache || [];
}

async function loadEmotionsForUser(userId) {
  var result = await apiCall('getEmotions', { studentUserId: userId });
  _emotionsCache = (result.ok && Array.isArray(result.emotions)) ? result.emotions : [];
  return _emotionsCache;
}

async function saveEmotion(emo, label, note) {
  var userId = localStorage.getItem('emotion-checkin-logged-user');
  if (!userId) return null;
  var entry = {
    emo: emo,
    label: label,
    note: note || '',
    date: new Date().toISOString()
  };
  var result = await apiCall('saveEmotion', Object.assign({ studentUserId: userId }, entry));
  if (result.ok) {
    entry.id = result.id;
    if (_emotionsCache) _emotionsCache.unshift(entry);
    else _emotionsCache = [entry];
    notifyEmotionAppSync('emotions');
  }
  return result.ok ? entry : null;
}

// ------------------------------------
// 공지 (학생 화면)
// ------------------------------------

function getTeacherMessage() {
  return _teacherNoticeCache;
}

async function loadNoticeForStudent(userId) {
  var result = await apiCall('getNotice', { studentUserId: userId });
  if (result.ok && result.notice) {
    _teacherNoticeCache = { text: result.notice, at: result.notice };
  } else {
    _teacherNoticeCache = null;
  }
  return _teacherNoticeCache;
}

// 교사 화면에서 공지 설정
async function setTeacherMessage(text) {
  var userId = localStorage.getItem('emotion-checkin-teacher-user');
  if (!userId) return;
  var t = String(text || '').trim();
  await apiCall('setNotice', { teacherUserId: userId, notice: t });
  notifyEmotionAppSync('teacher-msg');
}

async function clearTeacherMessage() {
  var userId = localStorage.getItem('emotion-checkin-teacher-user');
  if (!userId) return;
  await apiCall('setNotice', { teacherUserId: userId, notice: '' });
  notifyEmotionAppSync('teacher-msg');
}

// ------------------------------------
// 학급 (학생 쪽)
// ------------------------------------

function getStudentClassInfo() {
  return _studentClassCache;
}

function setStudentClassCache(info) {
  _studentClassCache = info || null;
}

function isStudentClassLinkActive() {
  return !!_studentClassCache;
}

async function tryMatchStudentClassCode(input) {
  var code = String(input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) return { ok: false, error: '학급 코드를 입력해 주세요.' };
  var userId = localStorage.getItem('emotion-checkin-logged-user');
  if (!userId) return { ok: false, error: '로그인이 필요해요.' };
  var result = await apiCall('joinClass', { studentUserId: userId, classCode: code });
  if (!result.ok) return { ok: false, error: result.error || '연결할 수 없어요.' };
  _studentClassCache = { id: result.classId, classCode: code, className: result.className };
  notifyEmotionAppSync('class-room');
  return { ok: true, className: result.className };
}

async function clearStudentLinkedClassCode() {
  var userId = localStorage.getItem('emotion-checkin-logged-user');
  if (userId) await apiCall('leaveClass', { studentUserId: userId });
  _studentClassCache = null;
  notifyEmotionAppSync('class-room');
}

// ------------------------------------
// 학급 (교사 쪽)
// ------------------------------------

function getClassRoom() {
  if (!_teacherClassCache) return null;
  return { name: _teacherClassCache.className, code: _teacherClassCache.classCode, createdAt: null };
}

function setTeacherClassCache(info) {
  _teacherClassCache = info || null;
}

async function setClassRoom(name, _ignored) {
  var userId = localStorage.getItem('emotion-checkin-teacher-user');
  if (!userId) return false;
  var result = await apiCall('createClass', { teacherUserId: userId, className: name });
  if (!result.ok) return false;
  _teacherClassCache = { id: result.classId, classCode: result.classCode, className: result.className, notice: '' };
  notifyEmotionAppSync('class-room');
  return true;
}

async function clearClassRoom() {
  var userId = localStorage.getItem('emotion-checkin-teacher-user');
  if (userId) await apiCall('deleteClass', { teacherUserId: userId });
  _teacherClassCache = null;
  notifyEmotionAppSync('class-room');
}

function normalizeClassJoinCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ------------------------------------
// 통계 계산 (캐시 데이터 기반, 동기)
// ------------------------------------

function getWeekEmotions() {
  var emotions = getEmotions();
  var now = new Date();
  var dayOfWeek = now.getDay();
  var monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  return emotions.filter(function(e) { return new Date(e.date) >= monday; });
}

function getTopEmotion() {
  var emotions = getEmotions();
  if (emotions.length === 0) return '-';
  var count = {};
  emotions.forEach(function(e) { count[e.emo] = (count[e.emo] || 0) + 1; });
  return Object.entries(count).sort(function(a, b) { return b[1] - a[1]; })[0][0];
}

function getStreak() {
  var emotions = getEmotions();
  if (emotions.length === 0) return 0;
  var dates = [...new Set(emotions.map(function(e) {
    return new Date(e.date).toLocaleDateString('ko-KR');
  }))];
  var streak = 1;
  for (var i = 0; i < dates.length - 1; i++) {
    var d1 = new Date(emotions.find(function(e) { return new Date(e.date).toLocaleDateString('ko-KR') === dates[i]; }).date);
    var d2 = new Date(emotions.find(function(e) { return new Date(e.date).toLocaleDateString('ko-KR') === dates[i + 1]; }).date);
    if (Math.round((d1 - d2) / (1000 * 60 * 60 * 24)) === 1) streak++;
    else break;
  }
  return streak;
}

// ------------------------------------
// 날짜·시간 포맷 유틸리티
// ------------------------------------

function formatDate(isoString) {
  var d = new Date(isoString);
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}

function formatTime(isoString) {
  var d = new Date(isoString);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function formatRecordDateTime(isoString) {
  if (!isoString) return '';
  return formatDate(isoString) + ' ' + formatTime(isoString);
}

function formatClockNow24() {
  var d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function formatStatusBarTime24() {
  var d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// ------------------------------------
// 알림 설정 (기기 전용 — localStorage 유지)
// ------------------------------------

var LS_REMIND_TIME_KEY = 'emotion-checkin-remind-time';
var LS_REMIND_ON_KEY   = 'emotion-checkin-remind-on';

function getRemindTimeHHmm() {
  try {
    var v = localStorage.getItem(LS_REMIND_TIME_KEY);
    if (v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return v;
  } catch (e) {}
  var now = formatClockNow24();
  try { localStorage.setItem(LS_REMIND_TIME_KEY, now); } catch (e2) {}
  return now;
}

function setRemindTimeHHmm(hhmm) {
  var s = String(hhmm || '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return;
  localStorage.setItem(LS_REMIND_TIME_KEY, s);
  notifyEmotionAppSync('remind-settings');
}

function isRemindNotifyEnabled() {
  try {
    var v = localStorage.getItem(LS_REMIND_ON_KEY);
    if (v === null || v === '') return true;
    return v === '1';
  } catch (e) { return true; }
}

function setRemindNotifyEnabled(on) {
  localStorage.setItem(LS_REMIND_ON_KEY, on ? '1' : '0');
  notifyEmotionAppSync('remind-settings');
}

// ------------------------------------
// 하위 호환 — 더 이상 사용하지 않지만 호출 시 오류 방지
// ------------------------------------

function setEmotionStorageUid() {}
function getLocalAccounts()      { return {}; }
function setLocalAccounts()      {}
function patchLocalAccount()     {}
function getTeacherAccounts()    { return {}; }
function setTeacherAccounts()    {}
function storageUidForStudentLogin(id) { return id; }
