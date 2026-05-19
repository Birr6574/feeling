/* ===========================
   js/teacher/teacher-auth.js
   교사 대시보드 로그인·회원가입 (Google Sheets API 기반)
=========================== */

var LS_TEACHER_SESSION_KEY  = 'emotion-checkin-teacher-user';
var LS_TEACHER_NAME_KEY     = 'emotion-checkin-teacher-name';

function setTeacherFormError(form, msg) {
  var id = form === 'signup' ? 'teacher-auth-error-signup' : 'teacher-auth-error-login';
  var el = document.getElementById(id);
  if (el) el.textContent = msg || '';
}

function showTeacherAuthGate() {
  var gate  = document.getElementById('teacher-auth-gate');
  var shell = document.getElementById('teacher-app-shell');
  if (gate)  gate.style.display  = 'flex';
  if (shell) shell.style.display = 'none';
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
  var name = localStorage.getItem(LS_TEACHER_NAME_KEY) || '';
  if (!el) return;
  el.textContent = name ? name + ' · ' : '';
}

function clearTeacherSession() {
  localStorage.removeItem(LS_TEACHER_SESSION_KEY);
  localStorage.removeItem(LS_TEACHER_NAME_KEY);
  if (typeof setTeacherClassCache === 'function') setTeacherClassCache(null);
}

function getValidTeacherSessionId() {
  return localStorage.getItem(LS_TEACHER_SESSION_KEY) || null;
}

function normalizeTeacherUserId(userId) {
  return String(userId).trim().toLowerCase();
}

function validateTeacherUserId(userId) {
  var s = normalizeTeacherUserId(userId);
  if (!/^[a-z0-9._-]{3,30}$/.test(s)) {
    throw new Error('아이디는 영문 소문자·숫자·._- 만, 3~30자여야 해요.');
  }
  return s;
}

async function hashTeacherPassword(password) {
  try {
    if (globalThis.crypto && globalThis.crypto.subtle) {
      var enc = new TextEncoder().encode(password + '|emotion-checkin');
      var buf = await globalThis.crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf))
        .map(function(b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    }
  } catch (e) {}
  var h = 5381;
  var s = password + '|emotion-checkin';
  for (var i = 0; i < s.length; i++) h = (Math.imul(33, h) + s.charCodeAt(i)) | 0;
  return 'fb_' + (h >>> 0).toString(16);
}

function switchTeacherAuthTab(isSignup) {
  var formLogin  = document.getElementById('form-teacher-login');
  var formSignup = document.getElementById('form-teacher-signup');
  var tabLogin   = document.getElementById('teacher-tab-login');
  var tabSignup  = document.getElementById('teacher-tab-signup');
  if (formLogin)  formLogin.style.display  = isSignup ? 'none'  : 'block';
  if (formSignup) formSignup.style.display = isSignup ? 'block' : 'none';
  if (tabLogin)   tabLogin.classList.toggle('active', !isSignup);
  if (tabSignup)  tabSignup.classList.toggle('active', !!isSignup);
  setTeacherFormError('login',  '');
  setTeacherFormError('signup', '');
}

function wireTeacherAuth() {
  var tabLogin  = document.getElementById('teacher-tab-login');
  var tabSignup = document.getElementById('teacher-tab-signup');
  if (tabLogin)  tabLogin.addEventListener('click',  function() { switchTeacherAuthTab(false); });
  if (tabSignup) tabSignup.addEventListener('click', function() { switchTeacherAuthTab(true);  });

  // 로그인
  var formLogin = document.getElementById('form-teacher-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async function(e) {
      e.preventDefault();
      setTeacherFormError('login', '');
      var userId;
      try { userId = validateTeacherUserId(document.getElementById('teacher-login-userid').value); }
      catch (err) { setTeacherFormError('login', err.message); return; }

      var password = document.getElementById('teacher-login-password').value;
      var submitBtn = formLogin.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var passwordHash = await hashTeacherPassword(password);
      var result = await apiCall('teacherLogin', { userId: userId, passwordHash: passwordHash });

      if (submitBtn) submitBtn.disabled = false;

      if (!result.ok) { setTeacherFormError('login', result.error || '로그인할 수 없어요.'); return; }

      localStorage.setItem(LS_TEACHER_SESSION_KEY, result.userId);
      localStorage.setItem(LS_TEACHER_NAME_KEY, result.name || '');
      if (typeof setTeacherClassCache === 'function') setTeacherClassCache(result.classRoom || null);

      showTeacherAppShell();
      if (typeof initTeacherDashboard === 'function') await initTeacherDashboard();
    });
  }

  // 회원가입
  var formSignup = document.getElementById('form-teacher-signup');
  if (formSignup) {
    formSignup.addEventListener('submit', async function(e) {
      e.preventDefault();
      setTeacherFormError('signup', '');
      var name = document.getElementById('teacher-signup-name').value.trim();
      var userId;
      try { userId = validateTeacherUserId(document.getElementById('teacher-signup-userid').value); }
      catch (err) { setTeacherFormError('signup', err.message); return; }

      var password  = document.getElementById('teacher-signup-password').value;
      var password2 = document.getElementById('teacher-signup-password2').value;

      if (name.length < 1 || name.length > 30) { setTeacherFormError('signup', '이름은 1~30자로 입력해 주세요.'); return; }
      if (password.length < 6) { setTeacherFormError('signup', '비밀번호는 6자 이상이에요.'); return; }
      if (password !== password2) { setTeacherFormError('signup', '비밀번호가 서로 달라요.'); return; }

      var submitBtn = formSignup.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      // 인증코드 입력란이 있으면 제거 (더 이상 필요 없음)
      var authCodeInput = document.getElementById('teacher-signup-auth-code');
      if (authCodeInput) authCodeInput.closest('.teacher-auth-label + input, label + input') && (authCodeInput.value = 'skip');

      var passwordHash = await hashTeacherPassword(password);
      var result = await apiCall('teacherSignup', { name: name, userId: userId, passwordHash: passwordHash });

      if (submitBtn) submitBtn.disabled = false;

      if (!result.ok) { setTeacherFormError('signup', result.error || '가입할 수 없어요.'); return; }

      localStorage.setItem(LS_TEACHER_SESSION_KEY, result.userId);
      localStorage.setItem(LS_TEACHER_NAME_KEY, result.name || '');
      if (typeof setTeacherClassCache === 'function') setTeacherClassCache(null);

      showTeacherAppShell();
      if (typeof initTeacherDashboard === 'function') await initTeacherDashboard();
    });
  }

  // 로그아웃
  var logoutBtn = document.getElementById('teacher-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      clearTeacherSession();
      location.reload();
    });
  }
}

window.teacherSignOut = function() {
  clearTeacherSession();
  location.reload();
};

// 교사 계정 삭제 (teacher-app.js 또는 roster에서 호출 가능하도록 전역 노출)
window.deleteTeacherAccountAction = async function(password) {
  var userId = getValidTeacherSessionId();
  if (!userId) return { ok: false, error: '로그인이 필요해요.' };
  var passwordHash = await hashTeacherPassword(password);
  var result = await apiCall('deleteTeacherAccount', { teacherUserId: userId, passwordHash: passwordHash });
  if (result.ok) {
    clearTeacherSession();
    try { sessionStorage.setItem('emotion-teacher-account-deleted', '1'); } catch (e) {}
    location.reload();
  }
  return result;
};

document.addEventListener('DOMContentLoaded', function() {
  wireTeacherAuth();
  try {
    if (sessionStorage.getItem('emotion-teacher-account-deleted') === '1') {
      sessionStorage.removeItem('emotion-teacher-account-deleted');
      var hint = document.getElementById('teacher-auth-post-delete-hint');
      if (hint) {
        hint.removeAttribute('hidden');
        hint.textContent = '계정이 삭제되어 로그아웃되었어요.';
        hint.classList.remove('teacher-auth-msg--error');
      }
    }
  } catch (e) {}

  var saved = getValidTeacherSessionId();
  if (saved) {
    showTeacherAppShell();
    if (typeof initTeacherDashboard === 'function') void initTeacherDashboard();
  } else {
    showTeacherAuthGate();
  }
});
