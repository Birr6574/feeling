/* ===========================
   js/student/auth.js
   통합 로그인·회원가입 (학생·교사 공통)
   로그인 후 역할에 따라 학생 화면 또는 teacher.html 으로 이동
   상태유지 체크 시 → localStorage (영구)
   미체크 시 → sessionStorage (탭 닫거나 새로고침하면 로그아웃)
=========================== */

var LS_SESSION_USER_KEY = 'emotion-checkin-logged-user';
var LS_SESSION_NAME_KEY = 'emotion-checkin-user-name';

var currentLoginId = null;

/* sessionStorage / localStorage 둘 다에서 값 읽기 */
function _getSession(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key) || null;
}

function setAuthError(elId, msg) {
  var el = document.getElementById(elId);
  if (el) el.textContent = msg || '';
}

function setStudentAuthTab(mode) {
  var isSignup  = mode === 'signup';
  var tabLogin  = document.getElementById('auth-tab-login');
  var tabSignup = document.getElementById('auth-tab-signup');
  var panelLogin  = document.getElementById('auth-panel-login');
  var panelSignup = document.getElementById('auth-panel-signup');
  if (tabLogin)  { tabLogin.classList.toggle('active', !isSignup); tabLogin.setAttribute('aria-selected', !isSignup ? 'true' : 'false'); }
  if (tabSignup) { tabSignup.classList.toggle('active', isSignup); tabSignup.setAttribute('aria-selected', isSignup ? 'true' : 'false'); }
  if (panelLogin)  panelLogin.style.display  = isSignup ? 'none' : 'block';
  if (panelSignup) panelSignup.style.display = isSignup ? 'block' : 'none';
  setAuthError('auth-error-login', '');
  setAuthError('auth-error-signup', '');
}

function showAuthGate() {
  var gate  = document.getElementById('auth-gate');
  var phone = document.getElementById('phone');
  if (gate)  gate.style.display  = 'flex';
  if (phone) phone.style.display = 'none';
}

function showStudentPhone() {
  var gate  = document.getElementById('auth-gate');
  var phone = document.getElementById('phone');
  if (gate)  gate.style.display  = 'none';
  if (phone) phone.style.display = 'flex';
  if (typeof initStudentStatusBarClock === 'function') initStudentStatusBarClock();
}

/* remember=true → localStorage(영구), false → sessionStorage(탭 유지) */
function applyStudentSession(userId, name, classInfo, remember) {
  currentLoginId = userId;
  var store = remember ? localStorage : sessionStorage;
  store.setItem(LS_SESSION_USER_KEY, userId);
  store.setItem(LS_SESSION_NAME_KEY, name || '학생');
  updateHomeAndSettings(name, userId);
  if (typeof setStudentClassCache === 'function') setStudentClassCache(classInfo || null);
  if (typeof updateStudentClassLinkUiAll === 'function') updateStudentClassLinkUiAll();
}

function applyTeacherSession(userId, name, classRoom, remember) {
  var store = remember ? localStorage : sessionStorage;
  store.setItem('emotion-checkin-teacher-user', userId);
  store.setItem('emotion-checkin-teacher-name', name || '');
  if (typeof setTeacherClassCache === 'function') setTeacherClassCache(classRoom || null);
}

function clearSession() {
  currentLoginId = null;
  localStorage.removeItem(LS_SESSION_USER_KEY);
  localStorage.removeItem(LS_SESSION_NAME_KEY);
  sessionStorage.removeItem(LS_SESSION_USER_KEY);
  sessionStorage.removeItem(LS_SESSION_NAME_KEY);
  if (typeof setStudentClassCache === 'function') setStudentClassCache(null);
  if (typeof updateStudentClassLinkUiAll === 'function') updateStudentClassLinkUiAll();
}

function updateHomeAndSettings(name, loginId) {
  var displayName = (name || '학생').trim();
  var homeName  = document.getElementById('home-display-name');
  var titleEl   = document.getElementById('settings-profile-name');
  var summaryEl = document.getElementById('profile-readonly-summary');
  if (homeName)  homeName.textContent  = displayName;
  if (titleEl)   titleEl.textContent   = displayName;
  if (summaryEl) summaryEl.textContent = loginId ? '로그인 ID · ' + loginId : '';
}

function onAuthOk() {
  showStudentPhone();
  if (typeof onStudentLogin === 'function') onStudentLogin();
}

function wireTeacherCheckbox() {
  var checkbox  = document.getElementById('signup-is-teacher');
  var codeWrap  = document.getElementById('signup-teacher-code-wrap');
  var idWrap    = document.getElementById('signup-userid-wrap');
  var teacherNote = document.getElementById('signup-teacher-id-note');
  var nameInput = document.getElementById('signup-name');
  if (!checkbox || !codeWrap) return;

  function syncTeacherFields() {
    var on = checkbox.checked;
    codeWrap.style.display = on ? 'block' : 'none';
    var codeInput = document.getElementById('signup-teacher-code');
    if (codeInput) codeInput.required = on;
    // 교사 체크 시 학번 입력 숨기고 이름을 ID로 사용
    if (idWrap)      idWrap.style.display      = on ? 'none' : 'block';
    if (teacherNote) teacherNote.style.display = on ? 'block' : 'none';
    // 숨김 시 required 해제해야 폼 제출 가능
    var uidInput = document.getElementById('signup-userid');
    if (uidInput) uidInput.required = !on;
  }

  checkbox.addEventListener('change', syncTeacherFields);
}

function wireAuthForms() {
  document.querySelectorAll('[data-auth-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var m = btn.getAttribute('data-auth-tab');
      if (m === 'login' || m === 'signup') setStudentAuthTab(m);
    });
  });

  // 로그인
  var formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async function(e) {
      e.preventDefault();
      setAuthError('auth-error-login', '');
      var userId = (document.getElementById('login-userid').value || '').trim();
      if (!userId) { setAuthError('auth-error-login', '학번 또는 이름을 입력해 주세요.'); return; }

      var password    = document.getElementById('login-password').value;
      var rememberMe  = !!(document.getElementById('login-remember') || {}).checked;
      var submitBtn   = formLogin.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var passwordHash = await hashPassword(password);
      var result = await apiCall('login', { userId: userId, passwordHash: passwordHash });

      if (submitBtn) submitBtn.disabled = false;

      if (!result.ok) {
        setAuthError('auth-error-login', result.error || '로그인할 수 없어요.');
        return;
      }

      if (result.role === 'teacher') {
        applyTeacherSession(result.userId, result.name, result.classRoom || null, rememberMe);
        location.href = 'teacher.html';
        return;
      }

      // 학생
      applyStudentSession(result.userId, result.name, result.classInfo || null, rememberMe);
      await loadEmotionsForUser(result.userId);
      onAuthOk();
    });
  }

  // 회원가입 (상태유지 없이 항상 sessionStorage — 가입 직후는 그 기기에서 유지)
  var formSignup = document.getElementById('form-signup');
  if (formSignup) {
    formSignup.addEventListener('submit', async function(e) {
      e.preventDefault();
      setAuthError('auth-error-signup', '');

      var name      = document.getElementById('signup-name').value.trim();
      var password  = document.getElementById('signup-password').value;
      var password2 = document.getElementById('signup-password2').value;
      var isTeacher = !!(document.getElementById('signup-is-teacher') || {}).checked;
      var teacherAuthCode = isTeacher
        ? ((document.getElementById('signup-teacher-code') || {}).value || '').trim()
        : '';
      var userId;
      if (isTeacher) {
        if (!name) { setAuthError('auth-error-signup', '이름을 입력해 주세요.'); return; }
        userId = name;
      } else {
        try { userId = validateUserId(document.getElementById('signup-userid').value); }
        catch (err) { setAuthError('auth-error-signup', err.message); return; }
      }

      if (name.length < 1 || name.length > 30) { setAuthError('auth-error-signup', '이름은 1~30자로 입력해 주세요.'); return; }
      if (password.length < 6)  { setAuthError('auth-error-signup', '비밀번호는 6자 이상이에요.'); return; }
      if (password !== password2) { setAuthError('auth-error-signup', '비밀번호가 서로 달라요.'); return; }

      var submitBtn = formSignup.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var passwordHash = await hashPassword(password);
      var result = await apiCall('signup', {
        name: name, userId: userId, passwordHash: passwordHash,
        isTeacher: isTeacher, teacherAuthCode: teacherAuthCode
      });

      if (submitBtn) submitBtn.disabled = false;

      if (!result.ok) { setAuthError('auth-error-signup', result.error || '가입할 수 없어요.'); return; }

      if (result.role === 'teacher') {
        applyTeacherSession(result.userId, result.name, null, false);
        location.href = 'teacher.html';
        return;
      }

      // 학생 가입 완료 → 바로 로그인 (sessionStorage)
      formSignup.reset();
      var codeWrap = document.getElementById('signup-teacher-code-wrap');
      if (codeWrap) codeWrap.style.display = 'none';
      applyStudentSession(result.userId, result.name, null, false);
      await loadEmotionsForUser(result.userId);
      onAuthOk();
    });
  }

  wireTeacherCheckbox();
}

function wireDeleteStudentAccount() {
  var btn = document.getElementById('settings-delete-account-btn');
  var pw  = document.getElementById('settings-delete-account-password');
  var msg = document.getElementById('settings-delete-account-msg');
  if (!btn || !pw) return;
  btn.addEventListener('click', async function() {
    if (msg) msg.textContent = '';
    var loginId = currentLoginId || (_getSession(LS_SESSION_USER_KEY) || '').trim();
    if (!loginId) return;
    if (!confirm('계정과 감정 기록을 모두 삭제할까요? 되돌릴 수 없어요.')) return;
    if (!confirm('정말 삭제할까요? 마지막 확인이에요.')) return;
    var passwordHash = await hashPassword(pw.value);
    var result = await apiCall('deleteStudentAccount', { studentUserId: loginId, passwordHash: passwordHash });
    if (!result.ok) { if (msg) msg.textContent = result.error || '삭제할 수 없어요.'; return; }
    pw.value = '';
    clearSession();
    try { sessionStorage.setItem('emotion-student-account-deleted', '1'); } catch (e) {}
    location.reload();
  });
}

window.signOutStudent = function() {
  clearSession();
  showAuthGate();
  setAuthError('auth-error-global', '');
  setStudentAuthTab('login');
  if (typeof updateStudentClassLinkUiAll === 'function') updateStudentClassLinkUiAll();
};

document.addEventListener('DOMContentLoaded', function() {
  var globalErr = document.getElementById('auth-error-global');
  if (globalErr) {
    globalErr.textContent = '';
    globalErr.classList.remove('auth-msg--info');
    globalErr.classList.add('auth-msg--error');
  }
  try {
    if (sessionStorage.getItem('emotion-student-account-deleted') === '1') {
      sessionStorage.removeItem('emotion-student-account-deleted');
      if (globalErr) {
        globalErr.textContent = '계정이 삭제되어 로그아웃되었어요. 필요하면 다시 가입할 수 있어요.';
        globalErr.classList.remove('auth-msg--error');
        globalErr.classList.add('auth-msg--info');
      }
    }
  } catch (e) {}

  wireAuthForms();
  wireDeleteStudentAccount();

  // 새로고침 여부 감지 (reload면 sessionStorage 세션 무시)
  var _isReload = false;
  try {
    var _nav = performance.getEntriesByType('navigation');
    _isReload = _nav.length > 0
      ? _nav[0].type === 'reload'
      : !!(performance.navigation && performance.navigation.type === 1);
  } catch (e) {}

  // remember-me(localStorage)는 항상 복원, sessionStorage는 새로고침이 아닐 때만 복원
  var saved = localStorage.getItem(LS_SESSION_USER_KEY)
           || (!_isReload ? sessionStorage.getItem(LS_SESSION_USER_KEY) : null);
  var savedName = (saved && (localStorage.getItem(LS_SESSION_NAME_KEY) || sessionStorage.getItem(LS_SESSION_NAME_KEY))) || '';

  if (saved) {
    var savedClass = typeof restoreStudentClassCache === 'function' ? restoreStudentClassCache() : null;
    applyStudentSession(saved, savedName, savedClass, !!localStorage.getItem(LS_SESSION_USER_KEY));
    (async function() {
      await loadEmotionsForUser(saved);
      onAuthOk();
    })();
  } else {
    clearSession();
    showAuthGate();
  }
});
