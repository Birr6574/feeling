/* ===========================
   js/teacher/teacher-auth.js
   교사 대시보드 세션 관리
   로그인은 index.html 에서 통합 처리됩니다.
   세션이 없으면 index.html 로 리디렉트합니다.
=========================== */

var LS_TEACHER_SESSION_KEY = 'emotion-checkin-teacher-user';
var LS_TEACHER_NAME_KEY    = 'emotion-checkin-teacher-name';

/* localStorage(상태유지) 또는 sessionStorage(탭 유지) 둘 다 확인 */
function getValidTeacherSessionId() {
  return localStorage.getItem(LS_TEACHER_SESSION_KEY) || sessionStorage.getItem(LS_TEACHER_SESSION_KEY) || null;
}

function clearTeacherSession() {
  localStorage.removeItem(LS_TEACHER_SESSION_KEY);
  localStorage.removeItem(LS_TEACHER_NAME_KEY);
  sessionStorage.removeItem(LS_TEACHER_SESSION_KEY);
  sessionStorage.removeItem(LS_TEACHER_NAME_KEY);
  if (typeof setTeacherClassCache === 'function') setTeacherClassCache(null);
}

function showTeacherAppShell() {
  var gate  = document.getElementById('teacher-auth-gate');
  var shell = document.getElementById('teacher-app-shell');
  if (gate)  gate.style.display  = 'none';
  if (shell) shell.style.display = 'block';
  refreshTeacherSessionLabel();
  if (typeof updateTeacherHeaderClassLabel === 'function') updateTeacherHeaderClassLabel();
}

function refreshTeacherSessionLabel() {
  var el   = document.getElementById('teacher-session-label');
  var name = localStorage.getItem(LS_TEACHER_NAME_KEY) || sessionStorage.getItem(LS_TEACHER_NAME_KEY) || '';
  if (el) el.textContent = name ? name + ' · ' : '';
}

window.teacherSignOut = function() {
  clearTeacherSession();
  location.href = 'index.html';
};

// 교사 계정 삭제
window.deleteTeacherAccountAction = async function(password) {
  var userId = getValidTeacherSessionId();
  if (!userId) return { ok: false, error: '로그인이 필요해요.' };
  var h = await (async function() {
    try {
      if (globalThis.crypto && globalThis.crypto.subtle) {
        var enc = new TextEncoder().encode(password + '|emotion-checkin');
        var buf = await globalThis.crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      }
    } catch (e) {}
    var hash = 5381;
    var s = password + '|emotion-checkin';
    for (var i = 0; i < s.length; i++) hash = (Math.imul(33, hash) + s.charCodeAt(i)) | 0;
    return 'fb_' + (hash >>> 0).toString(16);
  })();
  var result = await apiCall('deleteTeacherAccount', { teacherUserId: userId, passwordHash: h });
  if (result.ok) {
    clearTeacherSession();
    try { sessionStorage.setItem('emotion-teacher-account-deleted', '1'); } catch (e) {}
    location.href = 'index.html';
  }
  return result;
};

document.addEventListener('DOMContentLoaded', function() {
  var saved = getValidTeacherSessionId();
  if (!saved) {
    // 세션 없음 → 로그인 페이지로
    location.href = 'index.html';
    return;
  }
  showTeacherAppShell();
  if (typeof initTeacherDashboard === 'function') void initTeacherDashboard();

  var logoutBtn = document.getElementById('teacher-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      clearTeacherSession();
      location.href = 'index.html';
    });
  }
});
