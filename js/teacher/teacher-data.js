/* ===========================
   js/teacher/teacher-data.js
   학생 목록 + 감정 기록 — Google Sheets API 기반
=========================== */

async function fetchAllStudents() {
  var teacherUserId = _getSessionValue('emotion-checkin-teacher-user');
  if (!teacherUserId) return [];
  var result = await apiCall('getAllStudentsForTeacher', { teacherUserId: teacherUserId });
  if (!result.ok) return [];
  // 학급 정보도 캐시 갱신
  if (typeof setTeacherClassCache === 'function') setTeacherClassCache(result.classInfo || null);
  return Array.isArray(result.students) ? result.students : [];
}

async function fetchStudent(studentId) {
  var list = await fetchAllStudents();
  return list.find(function(s) { return s.id === studentId; });
}

function isAlertStudent(student) {
  var alertEmos = ['😢', '😡'];
  var recent = (student.emotions || []).slice(0, 3);
  return recent.length >= 3 && recent.every(function(e) { return alertEmos.includes(e.emo); });
}

function hasTodayRecord(student) {
  var emo = student.emotions || [];
  if (emo.length === 0) return false;
  return new Date(emo[0].date).toDateString() === new Date().toDateString();
}
