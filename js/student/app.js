/* ===========================
   js/student/app.js
   앱 시작, 화면 전환 제어
   가장 먼저 실행되는 파일이에요
=========================== */

// 화면 전환 함수
// id 예: 'home', 'hist', 'stat', 'set'
function showScreen(id) {
  // 모든 화면 숨기기
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  // 모든 네비 버튼 비활성화
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // 선택한 화면 보이기
  document.getElementById('s-' + id).classList.add('active');

  // 선택한 네비 버튼 활성화
  const navBtn = document.getElementById('nb-' + id);
  if (navBtn) navBtn.classList.add('active');

  // 통계 화면 열 때 차트 다시 그리기
  if (id === 'stat') renderStats();
  if (id === 'set' && typeof applyRemindSettingsToDom === 'function') applyRemindSettingsToDom();
}

// 로그인 직후 (auth.js에서 호출)
function onStudentLogin() {
  renderAll();
}

// 앱이 처음 실행될 때
document.addEventListener('DOMContentLoaded', function () {
  if (typeof initStudentStatusBarClock === 'function') initStudentStatusBarClock();

  setupStudentSync();

  if (typeof initStudentTheme === 'function') initStudentTheme();
  if (typeof initStudentRemindSettings === 'function') initStudentRemindSettings();

  renderAll();
});

function syncProfileUiFromAccounts() {
  const uid = (typeof _getSessionValue === 'function')
    ? _getSessionValue('emotion-checkin-logged-user')
    : localStorage.getItem('emotion-checkin-logged-user');
  if (
    !uid ||
    typeof getLocalAccounts !== 'function' ||
    typeof updateHomeAndSettings !== 'function'
  )
    return;
  const acc = getLocalAccounts()[uid];
  if (acc) updateHomeAndSettings(acc, uid);
}

function scheduleStudentCrossTabRefresh() {
  if (scheduleStudentCrossTabRefresh._t) clearTimeout(scheduleStudentCrossTabRefresh._t);
  scheduleStudentCrossTabRefresh._t = setTimeout(function () {
    scheduleStudentCrossTabRefresh._t = null;
    if (document.visibilityState !== 'visible') return;
    try {
      if (typeof window.updateStudentClassLinkUiAll === 'function') {
        window.updateStudentClassLinkUiAll();
      }
      syncProfileUiFromAccounts();
      if (typeof renderAll === 'function') renderAll();
      if (typeof applyRemindSettingsToDom === 'function') applyRemindSettingsToDom();
      if (typeof tickStatusBarClock === 'function') tickStatusBarClock();
    } catch (err) {}
  }, 120);
}

function setupStudentSync() {
  window.addEventListener('storage', function (e) {
    if (!e.key) return;
    if (e.key === 'emotions' || (e.key.indexOf('emotions_') === 0)) renderAll();
    if (e.key === 'emotion-checkin-theme') {
      if (typeof syncStudentThemeFromOtherTab === 'function') syncStudentThemeFromOtherTab();
    }
    if (
      e.key === 'emotion-checkin-user-name' ||
      e.key === 'emotion-checkin-active-uid' ||
      e.key === 'emotion-checkin-roster-profiles' ||
      e.key === 'emotion-checkin-accounts' ||
      e.key === 'emotion-checkin-student-number' ||
      e.key === 'emotion-checkin-grade-label' ||
      e.key === 'emotion-checkin-class-label' ||
      e.key === 'emotion-checkin-class-room' ||
      e.key === 'emotion-checkin-student-linked-class-code' ||
      e.key === 'emotion-checkin-teacher-custom-roster' ||
      e.key === 'emotion-checkin-teacher-hidden-json-ids'
    ) {
      if (
        e.key === 'emotion-checkin-accounts' ||
        e.key === 'emotion-checkin-roster-profiles'
      )
        syncProfileUiFromAccounts();
      if (typeof window.updateStudentClassLinkUiAll === 'function') {
        window.updateStudentClassLinkUiAll();
      }
      renderAll();
    }
    if (e.key === 'emotion-checkin-remind-time' || e.key === 'emotion-checkin-remind-on') {
      if (typeof applyRemindSettingsToDom === 'function') applyRemindSettingsToDom();
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') scheduleStudentCrossTabRefresh();
  });
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) scheduleStudentCrossTabRefresh();
  });
  try {
    const ch = new BroadcastChannel('emotion-checkin');
    ch.onmessage = function (ev) {
      const k = ev.data && ev.data.kind;
      if (k === 'teacher-msg') return;
      if (k === 'theme-student') {
        if (typeof syncStudentThemeFromOtherTab === 'function') syncStudentThemeFromOtherTab();
        return;
      }
      if (k === 'theme-teacher' || k === 'teacher-accounts') return;
      if (k === 'remind-settings') {
        if (typeof applyRemindSettingsToDom === 'function') applyRemindSettingsToDom();
        return;
      }
      if (k === 'class-room') {
        if (typeof window.updateStudentClassLinkUiAll === 'function') {
          window.updateStudentClassLinkUiAll();
        }
        renderAll();
        return;
      }
      if (k === 'emotions') {
        renderAll();
        return;
      }
      if (k === 'profile') {
        syncProfileUiFromAccounts();
        renderAll();
        return;
      }
      if (k === 'teacher-roster') {
        syncProfileUiFromAccounts();
        renderAll();
        return;
      }
      if (typeof window.updateStudentClassLinkUiAll === 'function') {
        window.updateStudentClassLinkUiAll();
      }
      syncProfileUiFromAccounts();
      renderAll();
    };
  } catch (e) {}
}
