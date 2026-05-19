/* ===========================
   js/student/theme.js
   설정 > 다크 모드 — localStorage 저장·DOM 반영
=========================== */

const LS_STUDENT_THEME_KEY = 'emotion-checkin-theme';

function getStudentTheme() {
  try {
    return localStorage.getItem(LS_STUDENT_THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch (e) {
    return 'dark';
  }
}

function syncStudentThemeToDom(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  if (t === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const toggle = document.getElementById('t-dark');
  if (toggle) {
    toggle.classList.toggle('on', t === 'dark');
    toggle.setAttribute('aria-checked', t === 'dark' ? 'true' : 'false');
  }
}

function refreshStatsIfVisible() {
  const statScreen = document.getElementById('s-stat');
  if (
    statScreen &&
    statScreen.classList.contains('active') &&
    typeof renderStats === 'function'
  ) {
    renderStats();
  }
}

function applyStudentTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  try {
    localStorage.setItem(LS_STUDENT_THEME_KEY, t);
  } catch (e) {}
  syncStudentThemeToDom(t);
  refreshStatsIfVisible();
  if (typeof postEmotionCheckinSync === 'function') postEmotionCheckinSync('theme-student');
}

function syncStudentThemeFromOtherTab() {
  syncStudentThemeToDom(getStudentTheme());
  refreshStatsIfVisible();
}

function initStudentTheme() {
  syncStudentThemeToDom(getStudentTheme());
  const el = document.getElementById('t-dark');
  if (el) {
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      const next = getStudentTheme() === 'dark' ? 'light' : 'dark';
      applyStudentTheme(next);
    });
  }
}
