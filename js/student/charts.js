/* ===========================
   js/student/charts.js
   통계 화면의 차트를 그려요
=========================== */

// 감정별 색상
const EMO_COLOR = {
  '😊': '#a78bfa',
  '😐': '#888',
  '😢': '#60a5fa',
  '😡': '#f87171',
  '😴': '#fbbf24'
};

function studentChartMutedBarColor() {
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? '#cbd5e1'
    : '#2a2a38';
}

// 요일 이름
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 주간 막대 차트를 그려요
function renderWeekChart() {
  const container = document.getElementById('week-chart');
  if (!container) return;

  const emotions = getEmotions();
  const today = new Date();

  // 이번 주 월~일 날짜 배열 만들기
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }

  container.innerHTML = '';

  days.forEach(day => {
    // 해당 날짜의 기록 개수 세기
    const count = emotions.filter(e => {
      const ed = new Date(e.date);
      return ed.toDateString() === day.toDateString();
    }).length;

    const maxHeight = 70; // 최대 높이 (px)
    const height = count > 0 ? Math.min(count * 20, maxHeight) : 4;
    const color = count > 0 ? '#a78bfa' : studentChartMutedBarColor();
    const dayName = DAY_NAMES[day.getDay()];

    const wrap = document.createElement('div');
    wrap.className = 'bar-wrap';
    wrap.innerHTML = `
      <div class="bar" style="height:${height}px; background:${color};"></div>
      <span class="bar-lbl">${dayName}</span>
    `;
    container.appendChild(wrap);
  });
}

// 감정 비율 차트를 그려요
function renderRatioChart() {
  const container = document.getElementById('ratio-chart');
  if (!container) return;

  const emotions = getEmotions();
  container.innerHTML = '';

  if (emotions.length === 0) {
    container.innerHTML =
      '<p class="empty-state-hint" style="padding:10px 0;">아직 기록이 없어요</p>';
    return;
  }

  // 이모지별 개수 세기
  const count = {};
  const emoList = ['😊', '😐', '😢', '😡', '😴'];
  emoList.forEach(e => count[e] = 0);
  emotions.forEach(e => {
    if (count[e.emo] !== undefined) count[e.emo]++;
  });

  const total = emotions.length;

  emoList.forEach(emo => {
    const pct = Math.round((count[emo] / total) * 100);
    if (pct === 0) return; // 0%는 안 보여줘요

    const row = document.createElement('div');
    row.className = 'ratio-row';
    row.innerHTML = `
      <span class="ratio-emo">${emo}</span>
      <div class="ratio-bar-bg">
        <div class="ratio-bar-fill" style="width:${pct}%; background:${EMO_COLOR[emo]};"></div>
      </div>
      <span class="ratio-pct">${pct}%</span>
    `;
    container.appendChild(row);
  });
}

// =====================
// 통계 — 감정 달력
// =====================

let studentCalYear = new Date().getFullYear();
let studentCalMonth = new Date().getMonth();
let studentCalSelectedDayStr = null;

function buildStudentDayMap() {
  const map = {};
  getEmotions().forEach(e => {
    const k = new Date(e.date).toDateString();
    if (!map[k]) map[k] = [];
    map[k].push(e);
  });
  Object.keys(map).forEach(k => {
    map[k].sort((a, b) => new Date(b.date) - new Date(a.date));
  });
  return map;
}

function escStudentCal(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearStudentDayDetail() {
  const el = document.getElementById('student-day-detail');
  if (el) {
    el.innerHTML = '<p class="student-day-placeholder">날짜를 선택해 주세요</p>';
  }
}

function renderStudentDayEmpty(d) {
  const el = document.getElementById('student-day-detail');
  if (!el) return;
  const head = `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]})`;
  el.innerHTML =
    `<p class="student-day-head">${head}</p><p class="student-day-empty">이 날 기록이 없어요</p>`;
}

function renderStudentDayDetail(d, entries) {
  const el = document.getElementById('student-day-detail');
  if (!el) return;
  const head = `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]}) · ${entries.length}건`;
  let html = `<p class="student-day-head">${head}</p>`;
  entries.forEach(e => {
    html += `
      <div class="student-day-entry">
        <div class="student-day-entry-top">
          <span class="student-day-entry-emo">${e.emo}</span>
          <span class="student-day-entry-label">${escStudentCal(e.label)}</span>
          <span class="student-day-entry-time">${formatRecordDateTime(e.date)}</span>
        </div>
        <p class="student-day-entry-note">${e.note ? escStudentCal(e.note) : '메모 없음'}</p>
      </div>
    `;
  });
  el.innerHTML = html;
}

function studentCalPrevMonth() {
  if (studentCalMonth === 0) {
    studentCalYear--;
    studentCalMonth = 11;
  } else {
    studentCalMonth--;
  }
  studentCalSelectedDayStr = null;
  renderStudentCalendar();
  clearStudentDayDetail();
}

function studentCalNextMonth() {
  if (studentCalMonth === 11) {
    studentCalYear++;
    studentCalMonth = 0;
  } else {
    studentCalMonth++;
  }
  studentCalSelectedDayStr = null;
  renderStudentCalendar();
  clearStudentDayDetail();
}

function renderStudentCalendar() {
  const container = document.getElementById('student-calendar');
  const labelEl = document.getElementById('student-cal-label');
  if (!container) return;

  const dayMap = buildStudentDayMap();

  if (labelEl) {
    labelEl.textContent = `${studentCalYear}년 ${studentCalMonth + 1}월`;
  }

  const first = new Date(studentCalYear, studentCalMonth, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(studentCalYear, studentCalMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toDateString();

  container.innerHTML = '';

  for (let i = 0; i < startPad; i++) {
    const cell = document.createElement('div');
    cell.className = 'student-cal-cell student-cal-out';
    container.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(studentCalYear, studentCalMonth, day);
    const dayStr = d.toDateString();
    const entries = dayMap[dayStr] || [];
    const has = entries.length > 0;
    const showEmo = has ? entries[0].emo : '';

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'student-cal-cell';
    if (!has) cell.classList.add('student-cal-disabled');
    if (dayStr === todayStr) cell.classList.add('student-cal-today');
    if (studentCalSelectedDayStr === dayStr) cell.classList.add('student-cal-selected');

    cell.innerHTML = `
      <span class="student-cal-daynum">${day}</span>
      <span class="student-cal-emo">${has ? showEmo : '·'}</span>
    `;

    cell.addEventListener('click', function () {
      studentCalSelectedDayStr = dayStr;
      renderStudentCalendar();
      if (has) {
        renderStudentDayDetail(d, entries);
      } else {
        renderStudentDayEmpty(d);
      }
    });

    container.appendChild(cell);
  }
}

(function wireStudentCalendarNav() {
  if (typeof window !== 'undefined' && window.__studentCalNavWired) return;
  if (typeof window !== 'undefined') window.__studentCalNavWired = true;

  document.addEventListener('DOMContentLoaded', function () {
    const prev = document.getElementById('student-cal-prev');
    const next = document.getElementById('student-cal-next');
    if (prev) prev.addEventListener('click', studentCalPrevMonth);
    if (next) next.addEventListener('click', studentCalNextMonth);
  });
})();

// 통계 숫자 카드 업데이트
function renderStats() {
  const emotions = getEmotions();
  const totalEl = document.getElementById('total-count');
  const topEl = document.getElementById('top-emo');
  const streakEl = document.getElementById('streak');

  if (totalEl) totalEl.textContent = emotions.length;
  if (topEl) topEl.textContent = getTopEmotion();
  if (streakEl) streakEl.textContent = getStreak();

  renderWeekChart();
  renderRatioChart();
  renderStudentCalendar();
  if (!studentCalSelectedDayStr) {
    clearStudentDayDetail();
  } else {
    const map = buildStudentDayMap();
    const entries = map[studentCalSelectedDayStr];
    const d = new Date(studentCalSelectedDayStr);
    if (entries && entries.length) renderStudentDayDetail(d, entries);
    else renderStudentDayEmpty(d);
  }
}
