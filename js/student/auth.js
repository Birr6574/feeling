/* ===========================
   js/student/auth.js
   학생 로그인·회원가입 (Google Sheets API 기반)
=========================== */

var LS_SESSION_USER_KEY = 'emotion-checkin-logged-user';
var LS_SESSION_NAME_KEY = 'emotion-checkin-user-name';

var currentLoginId = null;

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

function applyStudentSession(userId, name, classInfo) {
  currentLoginId = userId;
  localStorage.setItem(LS_SESSION_USER_KEY, userId);
  localStorage.setItem(LS_SESSION_NAME_KEY, name || '학생');
  updateHomeAndSettings(name, userId);
  // 학급 정보 캐시
  if (typeof setStudentClassCache === 'function') setStudentClassCache(classInfo || null);
  if (typeof updateStudentClassLinkUiAll === 'function') updateStudentClassLinkUiAll();
}

function clearSession() {
  currentLoginId = null;
  localStorage.removeItem(LS_SESSION_USER_KEY);
  localStorage.removeItem(LS_SESSION_NAME_KEY);
  if (typeof setStudentClassCache === 'function') setStudentClassCache(null);
  if (typeof setEmotionStorageUid === 'function') setEmotionStorageUid(null);
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
      var userId, password;
      try { userId = validateUserId(document.getElementById('login-userid').value); }
      catch (err) { setAuthError('auth-error-login', err.message); return; }
      password = document.getElementById('login-password').value;

      var submitBtn = formLogin.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var passwordHash = await hashPassword(password);
      var result = await apiCall('studentLogin', { userId: userId, passwordHash: passwordHash });

      if (submitBtn) submitBtn.disabled = false;

      if (!result.ok) { setAuthError('auth-error-login', result.error || '로그인할 수 없어요.'); return; }

      applyStudentSession(result.userId, result.name, result.classInfo || null);
      await loadEmotionsForUser(result.userId);
      if (result.classInfo) {
        await loadNoticeForStudent(result.userId);
      }
      onAuthOk();
    });
  }

  // 회원가입
  var formSignup = document.getElementById('form-signup');
  if (formSignup) {
    formSignup.addEventListener('submit', async function(e) {
      e.preventDefault();
      setAuthError('auth-error-signup', '');
      var name     = document.getElementById('signup-name').value.trim();
      var password = document.getElementById('signup-password').value;
      var password2= document.getElementById('signup-password2').value;
      var userId;
      try { userId = validateUserId(document.getElementById('signup-userid').value); }
      catch (err) { setAuthError('auth-error-signup', err.message); return; }

      if (name.length < 1 || name.length > 30) { setAuthError('auth-error-signup', '이름은 1~30자로 입력해 주세요.'); return; }
      if (password.length < 6) { setAuthError('auth-error-signup', '비밀번호는 6자 이상이에요.'); return; }
      if (password !== password2) { setAuthError('auth-error-signup', '비밀번호가 서로 달라요.'); return; }

      var submitBtn = formSignup.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var passwordHash = await hashPassword(password);
      var result = await apiCall('studentSignup', { name: name, userId: userId, passwordHash: passwordHash });

      if (submitBtn) submitBtn.disabled = false;

      if (!result.ok) { setAuthError('auth-error-signup', result.error || '가입할 수 없어요.'); return; }

      formSignup.reset();
      setStudentAuthTab('login');
      var loginIdEl = document.getElementById('login-userid');
      if (loginIdEl) loginIdEl.value = userId;
      var loginPwEl = document.getElementById('login-password');
      if (loginPwEl) loginPwEl.focus();

      applyStudentSession(result.userId, result.name, null);
      await loadEmotionsForUser(result.userId);
      onAuthOk();
    });
  }
}

function wireDeleteStudentAccount() {
  var btn = document.getElementById('settings-delete-account-btn');
  var pw  = document.getElementById('settings-delete-account-password');
  var msg = document.getElementById('settings-delete-account-msg');
  if (!btn || !pw) return;

  btn.addEventListener('click', async function() {
    if (msg) msg.textContent = '';
    var loginId = currentLoginId || (localStorage.getItem(LS_SESSION_USER_KEY) || '').trim();
    if (!loginId) return;
    if (!confirm('이 기기에서 계정과 감정 기록을 모두 삭제할까요? 되돌릴 수 없어요.')) return;
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

  var saved = localStorage.getItem(LS_SESSION_USER_KEY);
  var savedName = localStorage.getItem(LS_SESSION_NAME_KEY) || '';
  if (saved) {
    applyStudentSession(saved, savedName, null);
    // 감정 기록과 공지를 서버에서 불러온 뒤 화면 갱신
    (async function() {
      await loadEmotionsForUser(saved);
      await loadNoticeForStudent(saved);
      onAuthOk();
    })();
  } else {
    clearSession();
    showAuthGate();
  }
});
