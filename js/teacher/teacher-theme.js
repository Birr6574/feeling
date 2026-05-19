/* ===========================
   교사 화면 전용 테마 (학생 앱과 키 분리)
=========================== */

const LS_TEACHER_THEME_KEY = 'emotion-checkin-teacher-theme';

function getTeacherTheme() {
  try {
    return localStorage.getItem(LS_TEACHER_THEME_KEY) === 'light'
      ? 'light'
      : 'dark';
  } catch (e) {
    return 'dark';
  }
}

function syncTeacherThemeToDom(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  const root = document.documentElement;
  if (t === 'light') {
    root.setAttribute('data-teacher-theme', 'light');
  } else {
    root.removeAttribute('data-teacher-theme');
  }
  const toggle = document.getElementById('teacher-settings-dark-toggle');
  if (toggle) {
    toggle.classList.toggle('on', t === 'dark');
    toggle.setAttribute('aria-checked', t === 'dark' ? 'true' : 'false');
  }
  try {
    const ov = document.getElementById('insight-overlay');
    if (
      ov &&
      ov.style.display === 'flex' &&
      typeof window.renderInsightGraph === 'function'
    ) {
      window.renderInsightGraph();
    }
  } catch (e) {}
  if (typeof renderTeacherClassRoomCard === 'function') renderTeacherClassRoomCard();
}

function applyTeacherTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  try {
    localStorage.setItem(LS_TEACHER_THEME_KEY, t);
  } catch (e) {}
  syncTeacherThemeToDom(t);
  if (typeof postEmotionCheckinSync === 'function') postEmotionCheckinSync('theme-teacher');
}

function initTeacherTheme() {
  syncTeacherThemeToDom(getTeacherTheme());
  const el = document.getElementById('teacher-settings-dark-toggle');
  if (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      const next = getTeacherTheme() === 'dark' ? 'light' : 'dark';
      applyTeacherTheme(next);
    });
  }
}

window.addEventListener('storage', function (e) {
  if (e.key !== LS_TEACHER_THEME_KEY) return;
  syncTeacherThemeToDom(getTeacherTheme());
});
