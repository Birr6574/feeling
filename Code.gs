// ===================================================
// 감정 체크인 — Google Apps Script 백엔드
// 사용 전 아래 SS_ID 를 본인 스프레드시트 ID로 교체하세요.
// ===================================================

var SS_ID = '1pQVq__ff9JZtmijpMgQW6Koa7uQOqrI7EXTrJrCx9lA';

// ------------------------------------
// 진입점
// ------------------------------------

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var handlers = {
      login:                  function() { return unifiedLogin(body); },
      signup:                 function() { return unifiedSignup(body); },
      teacherSignup:          function() { return teacherSignup(body); },
      teacherLogin:           function() { return teacherLogin(body); },
      studentSignup:          function() { return studentSignup(body); },
      studentLogin:           function() { return studentLogin(body); },
      saveEmotion:            function() { return saveEmotion(body); },
      getEmotions:            function() { return getEmotions(body); },
      getAllStudentsForTeacher:function() { return getAllStudentsForTeacher(body); },
      createClass:            function() { return createClass(body); },
      deleteClass:            function() { return deleteClass(body); },
      getClassByCode:         function() { return getClassByCode(body); },
      getClassByTeacher:      function() { return getClassByTeacher(body); },
      joinClass:              function() { return joinClass(body); },
      leaveClass:             function() { return leaveClass(body); },
      setNotice:              function() { return setNotice(body); },
      getNotice:              function() { return getNotice(body); },
      deleteStudentAccount:   function() { return deleteStudentAccount(body); },
      deleteTeacherAccount:   function() { return deleteTeacherAccount(body); },
      resetClassRoster:       function() { return resetClassRoster(body); }
    };
    if (!handlers[action]) return json({ ok: false, error: '알 수 없는 요청이에요.' });
    return json(handlers[action]());
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

// ------------------------------------
// 시트 헬퍼
// ------------------------------------

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
      // Google Sheets가 숫자처럼 생긴 값을 number로 변환하는 것을 방지
      var v = row[j];
      obj[h] = (v === null || v === undefined) ? '' : String(v);
    });
    return obj;
  });
}

function appendSheetRow(sheetName, obj) {
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
}

function updateSheetRow(sheetName, rowNum, patch) {
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach(function(h, i) {
    if (patch[h] !== undefined) {
      sheet.getRange(rowNum, i + 1).setValue(patch[h]);
    }
  });
}

function deleteSheetRow(sheetName, rowNum) {
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  sheet.deleteRow(rowNum);
}

function generateId() {
  return Utilities.getUuid();
}

function generateClassCode() {
  var chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  var s = '';
  for (var i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

// ------------------------------------
// 통합 로그인 / 회원가입
// ------------------------------------

var TEACHER_AUTH_CODE = '6574';

function unifiedLogin(p) {
  var userId       = String(p.userId       || '').trim().toLowerCase();
  var passwordHash = String(p.passwordHash || '').trim();
  if (!userId || !passwordHash) return { ok: false, error: '아이디와 비밀번호를 입력해 주세요.' };

  // 학생 확인
  var students = getSheetRows('students');
  var student  = students.find(function(r) { return r.userId === userId; });
  if (student && student.passwordHash === passwordHash) {
    var classInfo = null;
    if (student.classId) {
      var cls = getSheetRows('classes').find(function(c) { return c.id === student.classId; });
      if (cls) classInfo = { id: cls.id, classCode: cls.classCode, className: cls.className, notice: cls.notice || '' };
    }
    return { ok: true, role: 'student', userId: userId, name: student.name, classInfo: classInfo };
  }

  // 교사 확인
  var teachers = getSheetRows('teachers');
  var teacher  = teachers.find(function(r) { return r.userId === userId; });
  if (teacher && teacher.passwordHash === passwordHash) {
    var classRoom = null;
    if (teacher.classId) {
      var cls2 = getSheetRows('classes').find(function(c) { return c.id === teacher.classId; });
      if (cls2) classRoom = { id: cls2.id, classCode: cls2.classCode, className: cls2.className, notice: cls2.notice || '' };
    }
    return { ok: true, role: 'teacher', userId: userId, name: teacher.name, classRoom: classRoom };
  }

  return { ok: false, error: '아이디 또는 비밀번호가 맞지 않아요.' };
}

function unifiedSignup(p) {
  if (p.isTeacher) {
    if (String(p.teacherAuthCode || '').trim() !== TEACHER_AUTH_CODE) {
      return { ok: false, error: '교사 인증코드가 올바르지 않아요.' };
    }
    var r = teacherSignup(p);
    if (r.ok) r.role = 'teacher';
    return r;
  }
  var r2 = studentSignup(p);
  if (r2.ok) r2.role = 'student';
  return r2;
}

// ------------------------------------
// 교사 계정
// ------------------------------------

function teacherSignup(p) {
  var userId = String(p.userId || '').trim().toLowerCase();
  var name   = String(p.name || '').trim();
  var passwordHash = String(p.passwordHash || '').trim();
  if (!userId || !name || !passwordHash) return { ok: false, error: '필수 정보가 부족해요.' };

  var rows = getSheetRows('teachers');
  if (rows.find(function(r) { return r.userId === userId; })) {
    return { ok: false, error: '이미 사용 중인 아이디예요.' };
  }
  appendSheetRow('teachers', {
    id: generateId(), name: name, userId: userId,
    passwordHash: passwordHash, classId: '',
    createdAt: new Date().toISOString()
  });
  return { ok: true, userId: userId, name: name, classRoom: null };
}

function teacherLogin(p) {
  var userId = String(p.userId || '').trim().toLowerCase();
  var passwordHash = String(p.passwordHash || '').trim();

  var rows = getSheetRows('teachers');
  var row = rows.find(function(r) { return r.userId === userId; });
  if (!row || row.passwordHash !== passwordHash) {
    return { ok: false, error: '아이디 또는 비밀번호가 맞지 않아요.' };
  }

  var classRoom = null;
  if (row.classId) {
    var classes = getSheetRows('classes');
    var cls = classes.find(function(c) { return c.id === row.classId; });
    if (cls) classRoom = { id: cls.id, classCode: cls.classCode, className: cls.className, notice: cls.notice || '' };
  }
  return { ok: true, userId: userId, name: row.name, classRoom: classRoom };
}

// ------------------------------------
// 학생 계정
// ------------------------------------

function studentSignup(p) {
  var userId = String(p.userId || '').trim().toLowerCase();
  var name   = String(p.name || '').trim();
  var passwordHash = String(p.passwordHash || '').trim();
  if (!userId || !name || !passwordHash) return { ok: false, error: '필수 정보가 부족해요.' };

  var rows = getSheetRows('students');
  if (rows.find(function(r) { return r.userId === userId; })) {
    return { ok: false, error: '이미 사용 중인 아이디예요.' };
  }
  appendSheetRow('students', {
    id: generateId(), name: name, userId: userId,
    passwordHash: passwordHash, classId: '',
    createdAt: new Date().toISOString()
  });
  return { ok: true, userId: userId, name: name };
}

function studentLogin(p) {
  var userId = String(p.userId || '').trim().toLowerCase();
  var passwordHash = String(p.passwordHash || '').trim();

  var rows = getSheetRows('students');
  var row = rows.find(function(r) { return r.userId === userId; });
  if (!row || row.passwordHash !== passwordHash) {
    return { ok: false, error: '아이디 또는 비밀번호가 맞지 않아요. 처음이면 회원가입으로 계정을 만들 수 있어요.' };
  }

  var classInfo = null;
  if (row.classId) {
    var classes = getSheetRows('classes');
    var cls = classes.find(function(c) { return c.id === row.classId; });
    if (cls) classInfo = { id: cls.id, classCode: cls.classCode, className: cls.className, notice: cls.notice || '' };
  }
  return { ok: true, userId: userId, name: row.name, classInfo: classInfo };
}

// ------------------------------------
// 감정 기록
// ------------------------------------

function saveEmotion(p) {
  var studentUserId = String(p.studentUserId || '').trim().toLowerCase();
  if (!studentUserId) return { ok: false, error: '학생 아이디가 없어요.' };

  var id = generateId();
  appendSheetRow('emotions', {
    id: id,
    studentUserId: studentUserId,
    emo:   String(p.emo   || ''),
    label: String(p.label || ''),
    note:  String(p.note  || ''),
    date:  String(p.date  || new Date().toISOString()),
    createdAt: new Date().toISOString()
  });
  return { ok: true, id: id };
}

function getEmotions(p) {
  var studentUserId = String(p.studentUserId || '').trim().toLowerCase();
  if (!studentUserId) return { ok: false, error: '학생 아이디가 없어요.' };

  var rows = getSheetRows('emotions');
  var filtered = rows
    .filter(function(r) { return r.studentUserId === studentUserId; })
    .map(function(r) { return { id: r.id, emo: r.emo, label: r.label, note: r.note, date: r.date }; })
    .sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

  return { ok: true, emotions: filtered };
}

// ------------------------------------
// 학급
// ------------------------------------

function createClass(p) {
  var teacherUserId = String(p.teacherUserId || '').trim().toLowerCase();
  var className     = String(p.className || '').trim() || '우리 학급';
  if (!teacherUserId) return { ok: false, error: '교사 아이디가 없어요.' };

  var teachers = getSheetRows('teachers');
  var teacher  = teachers.find(function(r) { return r.userId === teacherUserId; });
  if (!teacher) return { ok: false, error: '교사 계정을 찾을 수 없어요.' };

  // 기존 학급 삭제
  var existing = getSheetRows('classes');
  var prev = existing.find(function(r) { return r.teacherId === teacherUserId; });
  if (prev) deleteSheetRow('classes', prev._row);

  // 중복 없는 코드 생성
  var allCls = getSheetRows('classes');
  var classCode;
  do { classCode = generateClassCode(); }
  while (allCls.find(function(r) { return r.classCode === classCode; }));

  var id = generateId();
  appendSheetRow('classes', {
    id: id, teacherId: teacherUserId, classCode: classCode,
    className: className, notice: '',
    createdAt: new Date().toISOString()
  });
  updateSheetRow('teachers', teacher._row, { classId: id });

  return { ok: true, classId: id, classCode: classCode, className: className };
}

function deleteClass(p) {
  var teacherUserId = String(p.teacherUserId || '').trim().toLowerCase();
  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.teacherId === teacherUserId; });
  if (!cls) return { ok: false, error: '학급이 없어요.' };

  // 소속 학생 연결 해제
  var students = getSheetRows('students');
  students
    .filter(function(s) { return s.classId === cls.id; })
    .sort(function(a, b) { return b._row - a._row; })
    .forEach(function(s) { updateSheetRow('students', s._row, { classId: '' }); });

  deleteSheetRow('classes', cls._row);

  // 교사 classId 초기화
  var teachers = getSheetRows('teachers');
  var teacher  = teachers.find(function(r) { return r.userId === teacherUserId; });
  if (teacher) updateSheetRow('teachers', teacher._row, { classId: '' });

  return { ok: true };
}

function getClassByCode(p) {
  var classCode = String(p.classCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!classCode) return { ok: false, error: '학급 코드를 입력해 주세요.' };

  var rows = getSheetRows('classes');
  var cls  = rows.find(function(r) { return r.classCode === classCode; });
  if (!cls)  return { ok: false, error: '코드가 맞지 않아요. 선생님께 다시 확인해 주세요.' };

  return { ok: true, classId: cls.id, classCode: cls.classCode, className: cls.className, notice: cls.notice || '' };
}

function getClassByTeacher(p) {
  var teacherUserId = String(p.teacherUserId || '').trim().toLowerCase();
  var rows = getSheetRows('classes');
  var cls  = rows.find(function(r) { return r.teacherId === teacherUserId; });
  if (!cls)  return { ok: true, classRoom: null };
  return { ok: true, classRoom: { id: cls.id, classCode: cls.classCode, className: cls.className, notice: cls.notice || '' } };
}

function joinClass(p) {
  var studentUserId = String(p.studentUserId || '').trim().toLowerCase();
  var classCode     = String(p.classCode    || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!studentUserId) return { ok: false, error: '학생 아이디가 없어요.' };

  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.classCode === classCode; });
  if (!cls) return { ok: false, error: '코드가 맞지 않아요. 선생님께 다시 확인해 주세요.' };

  var students = getSheetRows('students');
  var student  = students.find(function(r) { return r.userId === studentUserId; });
  if (!student) return { ok: false, error: '학생 계정을 찾을 수 없어요.' };

  updateSheetRow('students', student._row, { classId: cls.id });
  return { ok: true, className: cls.className, classId: cls.id };
}

function leaveClass(p) {
  var studentUserId = String(p.studentUserId || '').trim().toLowerCase();
  if (!studentUserId) return { ok: false, error: '학생 아이디가 없어요.' };

  var students = getSheetRows('students');
  var student  = students.find(function(r) { return r.userId === studentUserId; });
  if (!student) return { ok: false, error: '학생 계정을 찾을 수 없어요.' };

  updateSheetRow('students', student._row, { classId: '' });
  return { ok: true };
}

// ------------------------------------
// 공지
// ------------------------------------

function setNotice(p) {
  var teacherUserId = String(p.teacherUserId || '').trim().toLowerCase();
  var notice = String(p.notice || '').trim();

  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.teacherId === teacherUserId; });
  if (!cls) return { ok: false, error: '학급이 없어요. 먼저 학급을 만들어 주세요.' };

  updateSheetRow('classes', cls._row, { notice: notice });
  return { ok: true };
}

function getNotice(p) {
  var studentUserId = String(p.studentUserId || '').trim().toLowerCase();
  if (!studentUserId) return { ok: true, notice: '' };

  var students = getSheetRows('students');
  var student  = students.find(function(r) { return r.userId === studentUserId; });
  if (!student || !student.classId) return { ok: true, notice: '' };

  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.id === student.classId; });
  if (!cls) return { ok: true, notice: '' };

  return { ok: true, notice: cls.notice || '', className: cls.className };
}

// ------------------------------------
// 교사 대시보드 — 전체 학생 조회
// ------------------------------------

function getAllStudentsForTeacher(p) {
  var teacherUserId = String(p.teacherUserId || '').trim().toLowerCase();
  if (!teacherUserId) return { ok: false, error: '교사 아이디가 없어요.' };

  var classes = getSheetRows('classes');
  var cls = classes.find(function(r) { return r.teacherId === teacherUserId; });
  if (!cls) return { ok: true, students: [], classInfo: null };

  var allStudents = getSheetRows('students');
  var classStudents = allStudents.filter(function(s) { return s.classId === cls.id; });

  var allEmotions = getSheetRows('emotions');

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

// ------------------------------------
// 계정 삭제
// ------------------------------------

function deleteStudentAccount(p) {
  var studentUserId = String(p.studentUserId || '').trim().toLowerCase();
  var passwordHash  = String(p.passwordHash  || '').trim();

  var students = getSheetRows('students');
  var student  = students.find(function(r) { return r.userId === studentUserId; });
  if (!student) return { ok: false, error: '계정을 찾을 수 없어요.' };
  if (student.passwordHash !== passwordHash) return { ok: false, error: '비밀번호가 맞지 않아요.' };

  deleteSheetRow('students', student._row);

  // 감정 기록 삭제 (행 번호가 바뀌므로 다시 조회 후 역순 삭제)
  var emotions = getSheetRows('emotions');
  emotions
    .filter(function(e) { return e.studentUserId === studentUserId; })
    .map(function(e) { return e._row; })
    .sort(function(a, b) { return b - a; })
    .forEach(function(rowNum) { deleteSheetRow('emotions', rowNum); });

  return { ok: true };
}

function deleteTeacherAccount(p) {
  var teacherUserId = String(p.teacherUserId || '').trim().toLowerCase();
  var passwordHash  = String(p.passwordHash  || '').trim();

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
function resetClassRoster(p) {
  var teacherUserId = String(p.teacherUserId || '').trim().toLowerCase();
  if (!teacherUserId) return { ok: false, error: '교사 아이디가 없어요.' };

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

// ------------------------------------
// 초기 시트 구조 생성 (최초 1회 직접 실행)
// ------------------------------------

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
