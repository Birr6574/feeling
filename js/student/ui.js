/* ===========================
   js/student/ui.js
   모달 열고 닫기, 기록 목록 그리기
=========================== */

// 현재 선택된 감정 (기본값: 😊)
let selectedEmo = '😊';
let selectedLabel = '기분 좋음';

// 감정 이모지 선택하기
function pickEmo(el) {
  // 기존 선택 해제
  document.querySelectorAll('.emo-opt').forEach(e => e.classList.remove('selected'));
  // 새 선택 적용
  el.classList.add('selected');
  selectedEmo = el.dataset.emo;
  selectedLabel = el.dataset.label;
}

// 모달 열기
function openModal() {
  document.getElementById('modal').classList.add('open');
}

// 모달 닫기
function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.getElementById('note-input').value = '';
  // 이모지 선택 초기화
  document.querySelectorAll('.emo-opt').forEach(e => e.classList.remove('selected'));
  document.querySelector('[data-emo="😊"]').classList.add('selected');
  selectedEmo = '😊';
  selectedLabel = '기분 좋음';
}

// 감정 저장하기
var _saveEmoLock = false;
async function saveEmo() {
  if (_saveEmoLock) return;
  _saveEmoLock = true;
  const btn = document.querySelector('.save-btn');
  if (btn) btn.disabled = true;
  try {
    const note = document.getElementById('note-input').value.trim();
    await saveEmotion(selectedEmo, selectedLabel, note);
    closeModal();
    renderAll();
    showScreen('home');
  } finally {
    _saveEmoLock = false;
    if (btn) btn.disabled = false;
  }
}

// 홈 화면 오늘 기분 카드 업데이트
function renderTodayCard() {
  const emotions = getEmotions();
  const today = new Date().toDateString();
  const todayEmo = emotions.find(e => new Date(e.date).toDateString() === today);
  const timeEl = document.getElementById('today-time');
  const emoEl = document.getElementById('today-emo');
  const labelEl = document.getElementById('today-label');

  if (todayEmo) {
    if (emoEl) emoEl.textContent = todayEmo.emo;
    if (labelEl) labelEl.textContent = todayEmo.label;
    if (timeEl) timeEl.textContent = '오늘 · ' + formatRecordDateTime(todayEmo.date);
  } else {
    if (emoEl) emoEl.textContent = '😊';
    if (labelEl) labelEl.textContent = '아직 기록 없음';
    if (timeEl) timeEl.textContent = '오늘 · ' + (typeof formatClockNow24 === 'function' ? formatClockNow24() : '--:--');
  }
}

function applyRemindSettingsToDom() {
  const input = document.getElementById('settings-remind-time');
  const wrap = document.getElementById('settings-remind-time-wrap');
  const toggle = document.getElementById('t-notify');
  const hhmm =
    typeof getRemindTimeHHmm === 'function' ? getRemindTimeHHmm() : '09:00';
  const on = typeof isRemindNotifyEnabled === 'function' ? isRemindNotifyEnabled() : true;
  if (input) {
    input.value = hhmm;
    input.disabled = !on;
    input.setAttribute('aria-disabled', on ? 'false' : 'true');
  }
  if (wrap) {
    wrap.classList.toggle('remind-time-block--off', !on);
    wrap.setAttribute('aria-disabled', on ? 'false' : 'true');
  }
  if (toggle) {
    toggle.classList.toggle('on', on);
    toggle.setAttribute('aria-checked', on ? 'true' : 'false');
  }
}

function tickStatusBarClock() {
  const el = document.getElementById('status-bar-clock');
  if (!el) return;
  if (typeof formatStatusBarTime24 === 'function') {
    el.textContent = formatStatusBarTime24();
    return;
  }
  const d = new Date();
  el.textContent =
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0');
}

function initStudentStatusBarClock() {
  tickStatusBarClock();
  if (typeof window.__emotionStatusClockInterval === 'number') {
    clearInterval(window.__emotionStatusClockInterval);
  }
  window.__emotionStatusClockInterval = window.setInterval(tickStatusBarClock, 1000);
}

function initStudentRemindSettings() {
  if (typeof getRemindTimeHHmm === 'function') getRemindTimeHHmm();
  applyRemindSettingsToDom();

  const input = document.getElementById('settings-remind-time');
  if (input && input.dataset.wiredRemind !== '1') {
    input.dataset.wiredRemind = '1';
    input.addEventListener('change', function () {
      if (typeof setRemindTimeHHmm === 'function') setRemindTimeHHmm(input.value);
      applyRemindSettingsToDom();
    });
  }

  const toggle = document.getElementById('t-notify');
  if (toggle && toggle.dataset.wiredRemind !== '1') {
    toggle.dataset.wiredRemind = '1';
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      const next = !toggle.classList.contains('on');
      toggle.classList.toggle('on', next);
      toggle.setAttribute('aria-checked', next ? 'true' : 'false');
      if (typeof setRemindNotifyEnabled === 'function') setRemindNotifyEnabled(next);
      applyRemindSettingsToDom();
    });
  }
}

// 홈 화면 최근 기록 목록
function renderRecentLogs() {
  const container = document.getElementById('recent-logs');
  if (!container) return;

  const emotions = getEmotions().slice(0, 3); // 최근 3개만
  container.innerHTML = '';

  if (emotions.length === 0) {
    container.innerHTML =
      '<p class="empty-state-hint" style="padding:20px 0;">아직 기록이 없어요! ➕ 버튼을 눌러보세요</p>';
    return;
  }

  emotions.forEach(e => {
    const div = document.createElement('div');
    div.className = 'log-card';
    div.innerHTML = `
      <div class="log-emo">${escHtml(e.emo)}</div>
      <div class="log-info">
        <p class="log-title">${escHtml(e.label)}</p>
        <p class="log-sub">${e.note ? escHtml(e.note) : '메모 없음'}</p>
      </div>
      <p class="log-time">${escHtml(formatRecordDateTime(e.date))}</p>
    `;
    container.appendChild(div);
  });
}

// 기록 화면 전체 목록
function renderHistoryList() {
  const container = document.getElementById('history-list');
  if (!container) return;

  const emotions = getEmotions();
  container.innerHTML = '';

  if (emotions.length === 0) {
    container.innerHTML =
      '<p class="empty-state-hint" style="padding:30px 0;">아직 기록이 없어요</p>';
    return;
  }

  emotions.forEach(e => {
    const div = document.createElement('div');
    div.className = 'hist-item';
    div.innerHTML = `
      <div class="log-emo">${escHtml(e.emo)}</div>
      <div class="log-info" style="flex:1;">
        <p class="log-title">${escHtml(e.label)}</p>
        <p class="log-sub">${e.note ? escHtml(e.note) : '메모 없음'}</p>
      </div>
      <span class="hist-date">${escHtml(formatRecordDateTime(e.date))}</span>
    `;
    container.appendChild(div);
  });
}

/** HTML 특수문자 이스케이프 (XSS 방지) */
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// 모든 화면 한 번에 업데이트
function renderAll() {
  renderTodayCard();
  renderRecentLogs();
  renderHistoryList();
  renderStats();
}
