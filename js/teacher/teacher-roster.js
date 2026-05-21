/* ===========================
   교사 > 설정: 명단 관리·학생 로그인 계정 만들기
=========================== */

let teacherRosterEditingId = null;

function escTeacherRoster(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function resetTeacherRosterForm() {
  teacherRosterEditingId = null;
  const ids = [
    'teacher-roster-userid',
    'teacher-roster-name',
    'teacher-roster-number',
    'teacher-roster-grade',
    'teacher-roster-class',
  ];
  ids.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const uid = document.getElementById('teacher-roster-userid');
  if (uid) uid.disabled = false;
  const submit = document.getElementById('teacher-roster-submit');
  if (submit) submit.textContent = '학생 추가';
}

/* 학생 계정 만들기 (Google Sheets API 기반) */
async function createStudentLoginAccount({ name, userId, password, password2 }) {
  if (!name || !name.trim()) return { ok: false, error: '이름을 입력해 주세요.' };
  const uid = (userId || '').trim().toLowerCase();
  if (!/^\d+$/.test(uid) || uid.length < 1 || uid.length > 20) return { ok: false, error: '학번은 숫자만 입력할 수 있어요.' };
  if (!password || password.length < 6) return { ok: false, error: '비밀번호는 6자 이상이에요.' };
  if (password !== password2) return { ok: false, error: '비밀번호가 서로 달라요.' };

  var passwordHash = await hashPassword(password);
  var result = await apiCall('studentSignup', { name: name.trim(), userId: uid, passwordHash: passwordHash });
  if (!result.ok) return result;

  // 현재 학급이 있으면 교사 권한으로 자동 연결
  // (서버에서 session.role === 'teacher'로 처리, studentUserId를 body로 전달)
  var room = typeof getClassRoom === 'function' ? getClassRoom() : null;
  if (room && room.code) {
    await apiCall('joinClass', { studentUserId: uid });
  }
  return { ok: true };
}

function renderTeacherManageList(students) {
  const wrap = document.getElementById('teacher-manage-list');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!students || students.length === 0) {
    wrap.innerHTML =
      '<p class="teacher-manage-empty">등록된 학생이 없어요. 학급 코드를 학생에게 알려 주면 학생이 직접 설정에서 연결할 수 있어요. 또는 <strong>학생 계정 생성</strong> 탭에서 교사가 직접 계정을 만들어 줄 수 있어요.</p>';
    return;
  }

  const list = [...students].sort(function (a, b) {
    return String(a.name).localeCompare(String(b.name), 'ko');
  });

  list.forEach(function (s) {
    const row = document.createElement('div');
    row.className = 'teacher-manage-row';
    const uid = (s.userId || '').trim();
    row.innerHTML = `
      <div class="teacher-manage-row-main">
        <span class="teacher-manage-badge">학생</span>
        <span class="teacher-manage-row-name">${escTeacherRoster(s.name)}</span>
        <span class="teacher-manage-row-meta">${escTeacherRoster(String(s.number || ''))}${uid ? ' · ' + escTeacherRoster(uid) : ''}</span>
      </div>
      <div class="teacher-manage-row-actions">
        <button type="button" class="teacher-manage-action teacher-manage-action--danger" data-action="remove">연결 해제</button>
      </div>
    `;
    const sid = s.userId || s.id;
    row.querySelector('[data-action="remove"]').onclick = async function () {
      if (!confirm(escTeacherRoster(s.name) + ' 학생을 학급에서 연결 해제할까요?')) return;
      await apiCall('leaveClass', { studentUserId: sid });
      if (typeof refreshDashboard === 'function') await refreshDashboard();
    };
    wrap.appendChild(row);
  });
}

function resetTeacherStudentAccountForm() {
  [
    'teacher-acct-name',
    'teacher-acct-userid',
    'teacher-acct-password',
    'teacher-acct-password2',
  ].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const err = document.getElementById('teacher-acct-error');
  if (err) err.textContent = '';
}

function initTeacherStudentAccountForm() {
  const form = document.getElementById('form-teacher-create-student-account');
  if (!form || form.dataset.acctWired === '1') return;
  form.dataset.acctWired = '1';
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const errEl = document.getElementById('teacher-acct-error');
    if (errEl) errEl.textContent = '';
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const res = await createStudentLoginAccount({
      name:          (document.getElementById('teacher-acct-name') || {}).value || '',
      userId:        (document.getElementById('teacher-acct-userid') || {}).value || '',
      password:      (document.getElementById('teacher-acct-password') || {}).value || '',
      password2:     (document.getElementById('teacher-acct-password2') || {}).value || '',
    });

    if (submitBtn) submitBtn.disabled = false;

    if (!res.ok) {
      if (errEl) errEl.textContent = res.error || '만들 수 없어요.';
      return;
    }
    resetTeacherStudentAccountForm();
    if (errEl) { errEl.textContent = '계정이 만들어졌어요!'; errEl.style.color = '#86efac'; }
    if (typeof refreshDashboard === 'function') await refreshDashboard();
  });
}

function updateTeacherRosterClassPageTitle() {
  const el = document.getElementById('teacher-roster-class-page-title');
  if (!el) return;
  const room = typeof getClassRoom === 'function' ? getClassRoom() : null;
  const name = room && room.name ? String(room.name).trim() : '';
  el.textContent = name || '학급 미설정';
}

function initTeacherPasswordChangeForm() {
  const form = document.getElementById('form-teacher-change-student-pw');
  if (!form || form.dataset.pwWired === '1') return;
  form.dataset.pwWired = '1';

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const msgEl = document.getElementById('teacher-pw-change-msg');
    if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const userId = ((document.getElementById('teacher-pw-change-userid') || {}).value || '').trim();
    const name   = ((document.getElementById('teacher-pw-change-name')   || {}).value || '').trim();
    const newPw  =  (document.getElementById('teacher-pw-change-new')    || {}).value || '';
    const newPw2 =  (document.getElementById('teacher-pw-change-new2')   || {}).value || '';

    if (!/^\d+$/.test(userId) || userId.length < 1) {
      if (msgEl) msgEl.textContent = '학번은 숫자만 입력할 수 있어요.';
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (!name) {
      if (msgEl) msgEl.textContent = '이름을 입력해 주세요.';
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (newPw.length < 6) {
      if (msgEl) msgEl.textContent = '비밀번호는 6자 이상이에요.';
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (newPw !== newPw2) {
      if (msgEl) msgEl.textContent = '비밀번호가 서로 달라요.';
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    // teacherUserId는 서버에서 세션 토큰으로 확인
    const newPasswordHash = await hashPassword(newPw);
    const result = await apiCall('changeStudentPassword', {
      studentUserId: userId,
      studentName:   name,
      newPasswordHash,
    });

    if (submitBtn) submitBtn.disabled = false;

    if (!result.ok) {
      if (msgEl) msgEl.textContent = result.error || '변경할 수 없어요.';
      return;
    }
    form.reset();
    if (msgEl) { msgEl.textContent = '비밀번호가 변경됐어요!'; msgEl.style.color = '#86efac'; }
  });
}

function initTeacherRosterPanel() {
  // 수동추가 폼은 새 API 구조에서 지원하지 않으므로 숨김
  const rosterForm = document.getElementById('teacher-roster-form');
  if (rosterForm) {
    const card = rosterForm.closest('.teacher-manage-card');
    if (card) card.style.display = 'none';
  }
  const cancel = document.getElementById('teacher-roster-cancel-edit');
  if (cancel) cancel.style.display = 'none';

  // 명단 초기화 버튼
  const resetBtn = document.getElementById('teacher-roster-reset-btn');
  if (resetBtn && resetBtn.dataset.wired !== '1') {
    resetBtn.dataset.wired = '1';
    resetBtn.addEventListener('click', async function () {
      if (!confirm('학급의 모든 학생 연결을 해제할까요? 학생 계정과 감정 기록은 유지돼요.')) return;
      if (!confirm('정말 초기화할까요? 되돌릴 수 없어요.')) return;
      resetBtn.disabled = true;
      const result = await apiCall('resetClassRoster', {});
      resetBtn.disabled = false;
      if (!result.ok) { alert(result.error || '초기화할 수 없어요.'); return; }
      alert('명단이 초기화됐어요.');
      if (typeof refreshDashboard === 'function') await refreshDashboard();
    });
  }

  initTeacherStudentAccountForm();
  initTeacherPasswordChangeForm();
  updateTeacherRosterClassPageTitle();
}

window.updateTeacherRosterClassPageTitle = updateTeacherRosterClassPageTitle;
