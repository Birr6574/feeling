// ===================================================
// 감정 체크인 — Google Apps Script 백엔드
// 사용 전 아래 SS_ID 를 본인 스프레드시트 ID로 교체하세요.
// ===================================================

var SS_ID = '1pQVq__ff9JZtmijpMgQW6Koa7uQOqrI7EXTrJrCx9lA';

// ============================
// 🔒 보안 모듈
// ============================

/**
 * 세션 비밀키: 최초 실행 시 PropertiesService에 자동 생성·저장.
 * Apps Script 편집기 > 프로젝트 설정 > 스크립트 속성 > SESSION_SECRET 에서 확인 가능.
 */
function getSessionSecret() {
  var props  = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + '-' + Utilities.getUuid();
    props.setProperty('SESSION_SECRET', secret);
  }
  return secret;
}

/**
 * 교사 인증코드: PropertiesService의 TEACHER_AUTH_CODE 속성을 우선 사용.
 * 속성이 없으면 기본값 '6574' 사용 (변경 강력 권장).
 * Apps Script 편집기 > 프로젝트 설정 > 스크립트 속성 > TEACHER_AUTH_CODE 추가.
 */
function getTeacherAuthCode() {
  try {
    var code = PropertiesService.getScriptProperties().getProperty('TEACHER_AUTH_CODE');
    if (code) return code;
  } catch (e) {}
  return '6574';
}

/** HMAC-SHA256 서명 → 소문자 16진수 문자열 */
function hmacSha256Hex(message, secret) {
  var msgBytes    = Utilities.newBlob(message).getBytes();
  var secretBytes = Utilities.newBlob(secret).getBytes();
  var sig = Utilities.computeHmacSha256Signature(msgBytes, secretBytes);
  return sig.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

/** 세션 토큰 유효 기간: 7일 */
var TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 세션 토큰 생성.
 * 형식: base64url(encodeURIComponent(userId)|role|expiry) + "." + HMAC-SHA256
 */
function generateSessionToken(userId, role) {
  var expiry  = Date.now() + TOKEN_EXPIRY_MS;
  var payload = encodeURIComponent(userId) + '|' + role + '|' + expiry;
  var b64     = Utilities.base64EncodeWebSafe(Utilities.newBlob(payload).getBytes());
  return b64 + '.' + hmacSha256Hex(b64, getSessionSecret());
}

/**
 * 세션 토큰 검증.
 * @returns {{ valid:true, userId:string, role:string }}
 *       | {{ valid:false, error:string }}
 */
function validateSessionToken(token) {
  if (!token) return { valid: false, error: '로그인이 필요해요.' };
  var parts = String(token).split('.');
  if (parts.length !== 2) return { valid: false, error: '토큰 형식이 잘못됐어요.' };
  var b64 = parts[0], sig = parts[1];

  // HMAC 서명 검증 (타이밍 공격 방지를 위해 전체 비교)
  if (hmacSha256Hex(b64, getSessionSecret()) !== sig)
    return { valid: false, error: '토큰이 유효하지 않아요.' };

  try {
    var decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(b64)).getDataAsString();
    var f = decoded.split('|'); // [encodedUserId, role, expiry]
    if (f.length !== 3) return { valid: false, error: '토큰 형식이 잘못됐어요.' };
    var expiry = parseInt(f[2], 10);
    if (isNaN(expiry) || Date.now() > expiry)
      return { valid: false, error: '로그인이 만료됐어요. 다시 로그인해 주세요.' };
    return { valid: true, userId: decodeURIComponent(f[0]), role: f[1] };
  } catch (err) {
    return { valid: false, error: '토큰을 읽을 수 없어요.' };
  }
}

/* ── 로그인 실패 횟수 제한 (CacheService, 15분) ── */
var MAX_LOGIN_FAILS = 10;
var FAIL_LOCK_SECS  = 900; // 15분 = 900초

function _failKey(uid) { return 'fail_' + String(uid).substring(0, 50); }

function getLoginFailCount(uid) {
  try {
    var v = CacheService.getScriptCache().get(_failKey(uid));
    return v ? parseInt(v, 10) : 0;
  } catch (e) { return 0; }
}

function incrementLoginFail(uid) {
  try {
    var key = _failKey(uid), cache = CacheService.getScriptCache();
    cache.put(key, String((parseInt(cache.get(key) || '0', 10)) + 1), FAIL_LOCK_SECS);
  } catch (e) {}
}

function clearLoginFail(uid) {
  try { CacheService.getScriptCache().remove(_failKey(uid)); } catch (e) {}
}

/**
 * HTML 태그 제거 + 길이 제한.
 * 저장 전 모든 사용자 입력에 적용하여 Stored XSS 방지.
 */
function sanitizeText(s, maxLen) {
  var str = String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim();
  return (maxLen && str.length > maxLen) ? str.substring(0, maxLen) : str;
}

// ============================
// 진입점
// ============================

function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action;
    if (typeof action !== 'string') return json({ ok: false, error: '잘못된 요청이에요.' });

    // ── 공개 액션 (토큰 불필요) ──
    var publicActions = ['login', 'signup', 'teacherLogin', 'studentLogin', 'teacherSignup', 'studentSignup'];
    if (publicActions.indexOf(action) !== -1) {
      if (action === 'signup' || action === 'teacherSignup' || action === 'studentSignup')
        return json(unifiedSignup(body));
      return json(unifiedLogin(body)); // login / teacherLogin / studentLogin
    }

    // ── 나머지 모든 액션: 세션 토큰 필수 ──
    var session = validateSessionToken(body._token);
    if (!session.valid) return json({ ok: false, error: session.error || '로그인이 필요해요.' });

    if (action === 'saveEmotion')             return json(saveEmotion(body, session));
    if (action === 'getEmotions')             return json(getEmotions(body, session));
    if (action === 'getAllStudentsForTeacher') return json(getAllStudentsForTeacher(body, session));
    if (action === 'createClass')             return json(createClass(body, session));
    if (action === 'deleteClass')             return json(deleteClass(body, session));
    if (action === 'getClassByCode')          return json(getClassByCode(body, session));
    if (action === 'getClassByTeacher')       return json(getClassByTeacher(body, session));
    if (action === 'joinClass')               return json(joinClass(body, session));
    if (action === 'leaveClass')             return json(leaveClass(body, session));
    if (action === 'setNotice')               return json(setNotice(body, session));
    if (action === 'getNotice')               return json(getNotice(body, session));
    if (action === 'deleteStudentAccount')    return json(deleteStudentAccount(body, session));
    if (action === 'deleteTeacherAccount')    return json(deleteTeacherAccount(body, session));
    if (action === 'resetClassRoster')        return json(resetClassRoster(body, session));
    if (action === 'changeStudentPassword')   return json(changeStudentPassword(body, session));

    return json({ ok: false, error: '알 수 없는 요청이에요.' });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function doGet(e) {
  return json({ ok: true, message: '감정 체크인 API' });
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================
// 시트 헬퍼
// ============================

function getSpreadsheet() {
  return SpreadsheetApp.openById(SS_ID);
}

function getSheetRows(sheetName) {
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row, i) {
    var obj = { _row: i + 2 };
    headers.forEach(function(h, j) {
      var v = row[j];
      obj[h] = (v === null || v === undefined) ? '' : String(v);
    });
    return obj;
  });
}

function appendSheetRow(sheetName, obj) {
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; }));
}

function updateSheetRow(sheetName, rowNum, patch) {
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach(function(h, i) {
    if (patch[h] !== undefined) sheet.getRange(rowNum, i + 1).setValue(patch[h]);
  });
}

function deleteSheetRow(sheetName, rowNum) {
  getSpreadsheet().getSheetByName(sheetName).deleteRow(rowNum);
}

function generateId() {
  return Utilities.getUuid();
}

// ============================
// 월별 감정 탭 헬퍼
// ============================

/** "YYYY_MM" 형식의 월 키 반환 */
function getMonthKey(date) {
  var d = date || new Date();
  return d.getFullYear() + '_' + String(d.getMonth() + 1).padStart(2, '0');
}

/** 최근 n개월의 월 키 배열 반환 (이번 달 포함) */
function getRecentMonthKeys(n) {
  var keys = [], d = new Date();
  for (var i = 0; i < n; i++)
    keys.push(getMonthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return keys;
}

/** 월별 탭이 없으면 생성 후 반환 */
function getOrCreateMonthSheet(monthKey) {
  var ss = getSpreadsheet(), name = 'emo_' + monthKey;
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(['id', 'studentUserId', 'emo', 'label', 'note', 'date', 'createdAt']);
  }
  return sheet;
}

/** 월별 탭의 행 데이터 반환 (탭 없으면 빈 배열) */
function getMonthSheetRows(monthKey) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('emo_' + monthKey);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row, i) {
    var obj = { _row: i + 2, _sheetName: 'emo_' + monthKey };
    headers.forEach(function(h, j) {
      var v = row[j];
      obj[h] = (v === null || v === undefined) ? '' : String(v);
    });
    return obj;
  });
}

/** emo_ 탭에서 특정 학생 행 전체 삭제 */
function deleteEmotionsForStudent(studentUserId) {
  var ss = getSpreadsheet();
  ss.getSheets().forEach(function(sheet) {
    if (!sheet.getName().match(/^emo_\d{4}_\d{2}$/)) return;
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;
    var uidCol = data[0].indexOf('studentUserId');
    if (uidCol === -1) return;
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][uidCol]) === studentUserId) sheet.deleteRow(i + 1);
    }
  });
}

function generateClassCode() {
  var chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ', s = '';
  for (var i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ============================
// 통합 로그인 / 회원가입
// ============================

function unifiedLogin(p) {
  var userId       = sanitizeText(p.userId, 100).toLowerCase();
  var passwordHash = String(p.passwordHash || '').trim();
  if (!userId || !passwordHash) return { ok: false, error: '아이디와 비밀번호를 입력해 주세요.' };

  // 브루트포스 방어: 실패 횟수 초과 시 잠금
  if (getLoginFailCount(userId) >= MAX_LOGIN_FAILS)
    return { ok: false, error: '로그인 시도가 너무 많아요. 15분 후에 다시 시도해 주세요.' };

  // 학생 확인
  var students = getSheetRows('students');
  var student  = students.find(function(r) { return r.userId === userId; });
  if (student && student.passwordHash === passwordHash) {
    clearLoginFail(userId);
    var classInfo = null;
    if (student.classId) {
      var cls = getSheetRows('classes').find(function(c) { return c.id === student.classId; });
      if (cls) classInfo = { id: cls.id, classCode: cls.classCode, className: cls.className, notice: cls.notice || '' };
    }
    var token = generateSessionToken(userId, 'student');
    return { ok: true, role: 'student', userId: userId, name: student.name, classInfo: classInfo, token: token };
  }

  // 교사 확인
  var teachers = getSheetRows('teachers');
  var teacher  = teachers.find(function(r) { return r.userId === userId; });
  if (teacher && teacher.passwordHash === passwordHash) {
    clearLoginFail(userId);
    var classRoom = null;
    if (teacher.classId) {
      var cls2 = getSheetRows('classes').find(function(c) { return c.id === teacher.classId; });
      if (cls2) classRoom = { id: cls2.id, classCode: cls2.classCode, className: cls2.className, notice: cls2.notice || '' };
    }
    var token2 = generateSessionToken(userId, 'teacher');
    return { ok: true, role: 'teacher', userId: userId, name: teacher.name, classRoom: classRoom, token: token2 };
  }

  // 실패 횟수 누적 (학생/교사 구분 없이 같은 userId 키 사용)
  incrementLoginFail(userId);
  return { ok: false, error: '아이디 또는 비밀번호가 맞지 않아요.' };
}

function unifiedSignup(p) {
  if (p.isTeacher) {
    if (sanitizeText(p.teacherAuthCode, 50) !== getTeacherAuthCode())
      return { ok: false, error: '교사 인증코드가 올바르지 않아요.' };
    var r = teacherSignup(p);
    if (r.ok) r.role = 'teacher';
    return r;
  }
  var r2 = studentSignup(p);
  if (r2.ok) r2.role = 'student';
  return r2;
}

// ============================
// 교사 계정
// ============================

function teacherSignup(p) {
  var userId       = sanitizeText(p.userId, 50).toLowerCase();
  var name         = sanitizeText(p.name, 30);
  var passwordHash = String(p.passwordHash || '').trim();
  if (!userId || !name || !passwordHash) return { ok: false, error: '필수 정보가 부족해요.' };

  var rows = getSheetRows('teachers');
  if (rows.find(function(r) { return r.userId === userId; }))
    return { ok: false, error: '이미 사용 중인 아이디예요.' };

  appendSheetRow('teachers', {
    id: generateId(), name: name, userId: userId,
    passwordHash: passwordHash, classId: '',
    createdAt: new Date().toISOString()
  });
  var token = generateSessionToken(userId, 'teacher');
  return { ok: true, userId: userId, name: name, classRoom: null, token: token };
}

function teacherLogin(p) {
  return unifiedLogin(p); // 레거시 → 통합 로그인으로 위임
}

// ============================
// 학생 계정
// ============================

function studentSignup(p) {
  var userId       = sanitizeText(p.userId, 50).toLowerCase();
  var name         = sanitizeText(p.name, 30);
  var passwordHash = String(p.passwordHash || '').trim();
  if (!userId || !name || !passwordHash) return { ok: false, error: '필수 정보가 부족해요.' };

  var rows = getSheetRows('students');
  if (rows.find(function(r) { return r.userId === userId; }))
    return { ok: false, error: '이미 사용 중인 아이디예요.' };

  appendSheetRow('students', {
    id: generateId(), name: name, userId: userId,
    passwordHash: passwordHash, classId: '',
    createdAt: new Date().toISOString()
  });
  var token = generateSessionToken(userId, 'student');
  return { ok: true, userId: userId, name: name, token: token };
}

function studentLogin(p) {
  return unifiedLogin(p); // 레거시 → 통합 로그인으로 위임
}

// ============================
// 감정 기록
// ============================

function saveEmotion(p, session) {
  if (session.role !== 'student') return { ok: false, error: '학생만 감정을 기록할 수 있어요.' };
  var studentUserId = session.userId; // 토큰에서 추출 — 클라이언트 제공 값 무시

  var now   = new Date();
  var sheet = getOrCreateMonthSheet(getMonthKey(now));
  var id    = generateId();
  var obj   = {
    id:            id,
    studentUserId: studentUserId,
    emo:           sanitizeText(p.emo,   10),
    label:         sanitizeText(p.label, 50),
    note:          sanitizeText(p.note,  500),
    date:          String(p.date || now.toISOString()),
    createdAt:     now.toISOString()
  };
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; }));
  return { ok: true, id: id };
}

function getEmotions(p, session) {
  var studentUserId = session.userId; // 토큰에서 추출

  var allRows = [];
  getRecentMonthKeys(6).forEach(function(key) {
    allRows = allRows.concat(getMonthSheetRows(key));
  });
  allRows = allRows.concat(getSheetRows('emotions')); // 레거시

  var filtered = allRows
    .filter(function(r) { return r.studentUserId === studentUserId; })
    .map(function(r) { return { id: r.id, emo: r.emo, label: r.label, note: r.note, date: r.date }; })
    .sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

  return { ok: true, emotions: filtered };
}

// ============================
// 학급
// ============================

function createClass(p, session) {
  if (session.role !== 'teacher') return { ok: false, error: '교사만 학급을 만들 수 있어요.' };
  var teacherUserId = session.userId;
  var className     = sanitizeText(p.className, 50) || '우리 학급';

  var teachers = getSheetRows('teachers');
  var teacher  = teachers.find(function(r) { return r.userId === teacherUserId; });
  if (!teacher) return { ok: false, error: '교사 계정을 찾을 수 없어요.' };

  var existing = getSheetRows('classes');
  var prev = existing.find(function(r) { return r.teacherId === teacherUserId; });
  if (prev) deleteSheetRow('classes', prev._row);

  var allCls = getSheetRows('classes'), classCode;
  do { classCode = generateClassCode(); }
  while (allCls.find(function(r) { return r.classCode === classCode; }));

  var id = generateId();
  appendSheetRow('classes', {
    id: id, teacherId: teacherUserId, classCode: classCode,
    className: className, notice: '', createdAt: new Date().toISOString()
  });
  updateSheetRow('teachers', teacher._row, { classId: id });
  return { ok: true, classId: id, classCode: classCode, className: className };
}

function deleteClass(p, session) {
  if (session.role !== 'teacher') return { ok: false, error: '교사만 학급을 삭제할 수 있어요.' };
  var teacherUserId = session.userId;
  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.teacherId === teacherUserId; });
  if (!cls) return { ok: false, error: '학급이 없어요.' };

  var students = getSheetRows('students');
  students
    .filter(function(s) { return s.classId === cls.id; })
    .sort(function(a, b) { return b._row - a._row; })
    .forEach(function(s) { updateSheetRow('students', s._row, { classId: '' }); });

  deleteSheetRow('classes', cls._row);

  var teachers = getSheetRows('teachers');
  var teacher  = teachers.find(function(r) { return r.userId === teacherUserId; });
  if (teacher) updateSheetRow('teachers', teacher._row, { classId: '' });
  return { ok: true };
}

function getClassByCode(p, session) {
  // session 유효성 이미 검증됨 — 로그인한 사용자만 학급 코드 조회 가능
  var classCode = sanitizeText(p.classCode, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!classCode) return { ok: false, error: '학급 코드를 입력해 주세요.' };

  var rows = getSheetRows('classes');
  var cls  = rows.find(function(r) { return r.classCode === classCode; });
  if (!cls)  return { ok: false, error: '코드가 맞지 않아요. 선생님께 다시 확인해 주세요.' };
  return { ok: true, classId: cls.id, classCode: cls.classCode, className: cls.className, notice: cls.notice || '' };
}

function getClassByTeacher(p, session) {
  if (session.role !== 'teacher') return { ok: false, error: '교사만 조회할 수 있어요.' };
  var teacherUserId = session.userId;
  var rows = getSheetRows('classes');
  var cls  = rows.find(function(r) { return r.teacherId === teacherUserId; });
  if (!cls) return { ok: true, classRoom: null };
  return { ok: true, classRoom: { id: cls.id, classCode: cls.classCode, className: cls.className, notice: cls.notice || '' } };
}

function joinClass(p, session) {
  if (session.role !== 'student') return { ok: false, error: '학생만 학급에 참여할 수 있어요.' };
  var studentUserId = session.userId;
  var classCode     = sanitizeText(p.classCode, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');

  var classes = getSheetRows('classes');
  var cls     = classes.find(function(r) { return r.classCode === classCode; });
  if (!cls)   return { ok: false, error: '코드가 맞지 않아요. 선생님께 다시 확인해 주세요.' };

  var students = getSheetRows('students');
  var student  = students.find(function(r) { return r.userId === studentUserId; });
  if (!student) return { ok: false, error: '학생 계정을 찾을 수 없어요.' };

  updateSheetRow('students', student._row, { classId: cls.id });
  return { ok: true, className: cls.className, classId: cls.id };
}

function leaveClass(p, session) {
  if (session.role !== 'student') return { ok: false, error: '학생만 학급을 나갈 수 있어요.' };
  var studentUserId = session.userId;

  var students = getSheetRows('students');
  var student  = students.find(function(r) { return r.userId === studentUserId; });
  if (!student) return { ok: false, error: '학생 계정을 찾을 수 없어요.' };

  updateSheetRow('students', student._row, { classId: '' });
  return { ok: true };
}

// ============================
// 공지
// ============================

function setNotice(p, session) {
  if (session.role !== 'teacher') return { ok: false, error: '교사만 공지를 설정할 수 있어요.' };
  var teacherUserId = session.userId;
  var notice        = sanitizeText(p.notice, 500);

  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.teacherId === teacherUserId; });
  if (!cls) return { ok: false, error: '학급이 없어요. 먼저 학급을 만들어 주세요.' };

  updateSheetRow('classes', cls._row, { notice: notice });
  return { ok: true };
}

function getNotice(p, session) {
  var studentUserId = session.userId;

  var students = getSheetRows('students');
  var student  = students.find(function(r) { return r.userId === studentUserId; });
  if (!student || !student.classId) return { ok: true, notice: '' };

  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.id === student.classId; });
  if (!cls) return { ok: true, notice: '' };

  return { ok: true, notice: cls.notice || '', className: cls.className };
}

// ============================
// 교사 대시보드 — 전체 학생 조회
// ============================

function getAllStudentsForTeacher(p, session) {
  if (session.role !== 'teacher') return { ok: false, error: '교사만 조회할 수 있어요.' };
  var teacherUserId = session.userId;

  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.teacherId === teacherUserId; });
  if (!cls) return { ok: true, students: [], classInfo: null };

  var allStudents   = getSheetRows('students');
  var classStudents = allStudents.filter(function(s) { return s.classId === cls.id; });

  // 최근 2개월 탭 + 레거시 탭
  var allEmotions = [];
  getRecentMonthKeys(2).forEach(function(key) {
    allEmotions = allEmotions.concat(getMonthSheetRows(key));
  });
  allEmotions = allEmotions.concat(getSheetRows('emotions')); // 레거시

  var result = classStudents.map(function(s) {
    var emotions = allEmotions
      .filter(function(e) { return e.studentUserId === s.userId; })
      .map(function(e) { return { id: e.id, emo: e.emo, label: e.label, note: e.note, date: e.date }; })
      .sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    return { id: s.id, name: s.name, userId: s.userId, emotions: emotions };
  });

  return {
    ok: true,
    students: result,
    classInfo: { id: cls.id, classCode: cls.classCode, className: cls.className, notice: cls.notice || '' }
  };
}

// ============================
// 계정 삭제
// ============================

function deleteStudentAccount(p, session) {
  if (session.role !== 'student') return { ok: false, error: '학생 계정만 삭제할 수 있어요.' };
  var studentUserId = session.userId; // 토큰에서 추출 — 클라이언트 값 무시
  var passwordHash  = String(p.passwordHash || '').trim();

  var students = getSheetRows('students');
  var student  = students.find(function(r) { return r.userId === studentUserId; });
  if (!student) return { ok: false, error: '계정을 찾을 수 없어요.' };
  if (student.passwordHash !== passwordHash) return { ok: false, error: '비밀번호가 맞지 않아요.' };

  deleteSheetRow('students', student._row);

  // 레거시 emotions 탭에서도 삭제
  var legacyEmotions = getSheetRows('emotions');
  legacyEmotions
    .filter(function(e) { return e.studentUserId === studentUserId; })
    .map(function(e) { return e._row; })
    .sort(function(a, b) { return b - a; })
    .forEach(function(rowNum) { deleteSheetRow('emotions', rowNum); });

  // 월별 탭 전체에서 삭제
  deleteEmotionsForStudent(studentUserId);
  return { ok: true };
}

function deleteTeacherAccount(p, session) {
  if (session.role !== 'teacher') return { ok: false, error: '교사 계정만 삭제할 수 있어요.' };
  var teacherUserId = session.userId; // 토큰에서 추출
  var passwordHash  = String(p.passwordHash || '').trim();

  var teachers = getSheetRows('teachers');
  var teacher  = teachers.find(function(r) { return r.userId === teacherUserId; });
  if (!teacher) return { ok: false, error: '계정을 찾을 수 없어요.' };
  if (teacher.passwordHash !== passwordHash) return { ok: false, error: '비밀번호가 맞지 않아요.' };

  deleteSheetRow('teachers', teacher._row);

  // 학급 삭제 + 소속 학생 연결 해제
  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.teacherId === teacherUserId; });
  if (cls) {
    var students = getSheetRows('students');
    students
      .filter(function(s) { return s.classId === cls.id; })
      .sort(function(a, b) { return b._row - a._row; })
      .forEach(function(s) { updateSheetRow('students', s._row, { classId: '' }); });
    deleteSheetRow('classes', cls._row);
  }
  return { ok: true };
}

// 학급 명단 초기화 (학생 연결 해제, 계정·기록은 유지)
function resetClassRoster(p, session) {
  if (session.role !== 'teacher') return { ok: false, error: '교사만 명단을 초기화할 수 있어요.' };
  var teacherUserId = session.userId;

  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.teacherId === teacherUserId; });
  if (!cls) return { ok: false, error: '학급이 없어요.' };

  var students = getSheetRows('students');
  students
    .filter(function(s) { return s.classId === cls.id; })
    .sort(function(a, b) { return b._row - a._row; })
    .forEach(function(s) { updateSheetRow('students', s._row, { classId: '' }); });

  return { ok: true };
}

function changeStudentPassword(p, session) {
  if (session.role !== 'teacher') return { ok: false, error: '교사만 비밀번호를 변경할 수 있어요.' };
  var teacherUserId   = session.userId;
  var studentUserId   = sanitizeText(p.studentUserId, 50).toLowerCase();
  var studentName     = sanitizeText(p.studentName, 30);
  var newPasswordHash = String(p.newPasswordHash || '').trim();

  if (!studentUserId || !studentName || !newPasswordHash)
    return { ok: false, error: '필수 정보가 부족해요.' };

  // 교사의 학급 확인
  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.teacherId === teacherUserId; });
  if (!cls) return { ok: false, error: '학급이 없어요.' };

  // 학생 찾기 및 검증
  var students = getSheetRows('students');
  var student  = students.find(function(s) { return s.userId === studentUserId; });
  if (!student) return { ok: false, error: '해당 학번의 학생이 없어요.' };
  if (student.name !== studentName) return { ok: false, error: '이름이 맞지 않아요.' };
  if (student.classId !== cls.id)   return { ok: false, error: '이 학급에 속한 학생이 아니에요.' };

  updateSheetRow('students', student._row, { passwordHash: newPasswordHash });
  return { ok: true };
}

// ============================
// 부하 시뮬레이션 (개발자 전용 — 편집기에서 직접 실행)
// ============================

var SIM_PREFIX             = 'sim_';
var SIM_TEACHER_COUNT      = 12;
var SIM_STUDENTS_PER_CLASS = 30;   // 30 × 12 = 360명
var SIM_DAYS               = 2;
var SIM_PW_HASH            = 'simulation_test_hash_00000000';

/**
 * 1단계: 교사 12명 · 학급 12개 · 학생 360명 · 감정 720건 생성
 * Apps Script 편집기에서 simulateInsertData 선택 후 ▶ 실행
 */
function simulateInsertData() {
  var ss  = getSpreadsheet();
  var t0  = Date.now();
  var log = [];
  var now = new Date();

  var teacherSheet  = ss.getSheetByName('teachers');
  var classSheet    = ss.getSheetByName('classes');
  var studentSheet  = ss.getSheetByName('students');

  var thH = teacherSheet.getRange(1,1,1,teacherSheet.getLastColumn()).getValues()[0];
  var clH = classSheet.getRange(1,1,1,classSheet.getLastColumn()).getValues()[0];
  var stH = studentSheet.getRange(1,1,1,studentSheet.getLastColumn()).getValues()[0];

  var teacherRows = [], classRows = [], studentRows = [];
  var emotionsByMonth = {};

  var emos = ['😊','😐','😢','😡','😴'];

  for (var t = 1; t <= SIM_TEACHER_COUNT; t++) {
    var teacherUserId = SIM_PREFIX + 'teacher_' + String(t).padStart(2,'0');
    var classId       = generateId();
    var classCode     = 'SIM' + String(t).padStart(3,'0');

    var tObj = { id: generateId(), name: '시뮬교사'+t, userId: teacherUserId,
                 passwordHash: SIM_PW_HASH, classId: classId, createdAt: now.toISOString() };
    teacherRows.push(thH.map(function(h){ return tObj[h]||''; }));

    var cObj = { id: classId, teacherId: teacherUserId, classCode: classCode,
                 className: '시뮬학급'+t, notice: '', createdAt: now.toISOString() };
    classRows.push(clH.map(function(h){ return cObj[h]||''; }));

    for (var s = 1; s <= SIM_STUDENTS_PER_CLASS; s++) {
      var sNum          = (t - 1) * SIM_STUDENTS_PER_CLASS + s;
      var studentUserId = SIM_PREFIX + String(sNum).padStart(5,'0');

      var sObj = { id: generateId(), name: '시뮬학생'+sNum, userId: studentUserId,
                   passwordHash: SIM_PW_HASH, classId: classId, createdAt: now.toISOString() };
      studentRows.push(stH.map(function(h){ return sObj[h]||''; }));

      for (var d = 0; d < SIM_DAYS; d++) {
        var dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
        var dateStr = dayDate.toISOString().substring(0,10);
        var mKey    = getMonthKey(dayDate);
        if (!emotionsByMonth[mKey]) emotionsByMonth[mKey] = [];
        emotionsByMonth[mKey].push({
          id: generateId(), studentUserId: studentUserId,
          emo: emos[sNum % emos.length], label: '테스트', note: '',
          date: dateStr, createdAt: now.toISOString()
        });
      }
    }
  }

  // 일괄 삽입 (setValues가 appendRow보다 10~50배 빠름)
  teacherSheet.getRange(teacherSheet.getLastRow()+1,1,teacherRows.length,thH.length).setValues(teacherRows);
  log.push('교사 ' + teacherRows.length + '명 삽입 (' + (Date.now()-t0) + 'ms)');

  classSheet.getRange(classSheet.getLastRow()+1,1,classRows.length,clH.length).setValues(classRows);
  log.push('학급 ' + classRows.length + '개 삽입 (' + (Date.now()-t0) + 'ms)');

  studentSheet.getRange(studentSheet.getLastRow()+1,1,studentRows.length,stH.length).setValues(studentRows);
  log.push('학생 ' + studentRows.length + '명 삽입 (' + (Date.now()-t0) + 'ms)');

  Object.keys(emotionsByMonth).forEach(function(mKey) {
    var emoSheet = getOrCreateMonthSheet(mKey);
    var eH = emoSheet.getRange(1,1,1,emoSheet.getLastColumn()).getValues()[0];
    var rows = emotionsByMonth[mKey].map(function(obj){
      return eH.map(function(h){ return obj[h]!==undefined ? obj[h] : ''; });
    });
    emoSheet.getRange(emoSheet.getLastRow()+1,1,rows.length,eH.length).setValues(rows);
    log.push('감정 ' + rows.length + '건 삽입 [' + mKey + '] (' + (Date.now()-t0) + 'ms)');
  });

  log.push('');
  log.push('✅ 전체 삽입 완료 — 총 소요: ' + (Date.now()-t0) + 'ms');
  Logger.log(log.join('\n'));
}

/**
 * 2단계: 읽기 성능 측정
 * simulateInsertData() 실행 후 이 함수를 실행하세요.
 */
function simulateReadTest() {
  var log = [];
  var t0, elapsed;

  var teachers = getSheetRows('teachers');
  var simTeacher = teachers.find(function(r){ return r.userId.indexOf(SIM_PREFIX) === 0; });
  if (simTeacher) {
    t0 = Date.now();
    var fakeSession = { valid: true, userId: simTeacher.userId, role: 'teacher' };
    var dashResult = getAllStudentsForTeacher({}, fakeSession);
    elapsed = Date.now() - t0;
    var totalEmo = (dashResult.students||[]).reduce(function(sum,s){ return sum + s.emotions.length; }, 0);
    log.push('📊 교사 대시보드 조회');
    log.push('   학생 수: ' + (dashResult.students||[]).length + '명');
    log.push('   감정 건수: ' + totalEmo + '건');
    log.push('   응답 시간: ' + elapsed + 'ms');
    log.push('');
  }

  var students = getSheetRows('students');
  var simStudent = students.find(function(r){ return r.userId.indexOf(SIM_PREFIX) === 0; });
  if (simStudent) {
    t0 = Date.now();
    var fakeSession2 = { valid: true, userId: simStudent.userId, role: 'student' };
    var emoResult = getEmotions({}, fakeSession2);
    elapsed = Date.now() - t0;
    log.push('📱 학생 감정 조회');
    log.push('   감정 건수: ' + (emoResult.emotions||[]).length + '건');
    log.push('   응답 시간: ' + elapsed + 'ms');
  }

  Logger.log(log.join('\n'));
}

/**
 * 3단계: 시뮬레이션 데이터 정리
 * 테스트 완료 후 반드시 실행하세요.
 */
function simulateCleanup() {
  var ss  = getSpreadsheet();
  var t0  = Date.now();
  var log = [];

  ['teachers','students','classes'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var col     = Math.max(headers.indexOf('userId'), headers.indexOf('teacherId'));
    if (col < 0) return;
    var toDelete = [];
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][col]).indexOf(SIM_PREFIX) === 0) toDelete.push(i + 1);
    }
    toDelete.forEach(function(row){ sheet.deleteRow(row); });
    log.push(name + ': ' + toDelete.length + '행 삭제');
  });

  ss.getSheets().forEach(function(sheet) {
    if (!sheet.getName().match(/^emo_\d{4}_\d{2}$/)) return;
    var data   = sheet.getDataRange().getValues();
    if (data.length <= 1) return;
    var uidCol = data[0].indexOf('studentUserId');
    if (uidCol < 0) return;
    var toDelete = [];
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][uidCol]).indexOf(SIM_PREFIX) === 0) toDelete.push(i + 1);
    }
    toDelete.forEach(function(row){ sheet.deleteRow(row); });
    if (toDelete.length) log.push(sheet.getName() + ': ' + toDelete.length + '행 삭제');
  });

  log.push('');
  log.push('🧹 정리 완료 — 총 소요: ' + (Date.now()-t0) + 'ms');
  Logger.log(log.join('\n'));
}

// ============================
// 초기 시트 구조 생성 (최초 1회 직접 실행)
// ============================

/** 개발자용: 전체 데이터 초기화 (Apps Script 편집기에서 직접 실행) */
function resetAllData() {
  var ss = getSpreadsheet();
  ['teachers', 'students', 'emotions', 'classes'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
  });
  ss.getSheets().forEach(function(sheet) {
    if (sheet.getName().match(/^emo_\d{4}_\d{2}$/)) ss.deleteSheet(sheet);
  });
  Logger.log('전체 초기화 완료');
}

function setupSheets() {
  var ss = getSpreadsheet();
  var sheets = {
    teachers: ['id', 'name', 'userId', 'passwordHash', 'classId', 'createdAt'],
    students: ['id', 'name', 'userId', 'passwordHash', 'classId', 'createdAt'],
    emotions: ['id', 'studentUserId', 'emo', 'label', 'note', 'date', 'createdAt'],
    classes:  ['id', 'teacherId', 'classCode', 'className', 'notice', 'createdAt']
  };
  Object.keys(sheets).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    var headers = sheets[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  });
  Logger.log('시트 구조 생성 완료');
}
