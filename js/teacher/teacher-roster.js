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

function isTeacherCustomStudentId(id) {
  return String(id).indexOf('tc-') === 0;
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

function fillTeacherRosterFormFromStudent(s) {
  teacherRosterEditingId = s.id;
  const uid = document.getElementById('teacher-roster-userid');
  const name = document.getElementById('teacher-roster-name');
  const num = document.getElementById('teacher-roster-number');
  const gr = document.getElementById('teacher-roster-grade');
  const cl = document.getElementById('teacher-roster-class');
  if (uid) {
    uid.value = (s.userId || '').trim();
    uid.disabled = !isTeacherCustomStudentId(s.id);
  }
  if (name) name.value = (s.name || '').trim();
  if (num) num.value = (s.number || '').trim();
  if (gr) gr.value = (s.gradeLabel || '').trim();
  if (cl) cl.value = (s.classLabel || '').trim();
  const submit = document.getElementById('teacher-roster-submit');
  if (submit) submit.textContent = '수정 저장';
}

async function submitTeacherRosterForm() {
  const uidEl = document.getElementById('teacher-roster-userid');
  const nameEl = document.getElementById('teacher-roster-name');
  const rawUid = uidEl && !uidEl.disabled ? (uidEl.value || '').trim().toLowerCase() : '';
  const lockedUid = uidEl && uidEl.disabled ? (uidEl.value || '').trim().toLowerCase() : '';
  const fields = {
    userId: uidEl && uidEl.disabled ? lockedUid : rawUid,
    name: (nameEl && nameEl.value) || '',
    number: (document.getElementById('teacher-roster-number') || {}).value || '',
    gradeLabel: (document.getElementById('teacher-roster-grade') || {}).value || '',
    classLabel: (document.getElementById('teacher-roster-class') || {}).value || '',
  };

  if (teacherRosterEditingId != null) {
    const id = teacherRosterEditingId;
    if (isTeacherCustomStudentId(id)) {
      const ok = updateTeacherCustomRosterRow(id, {
        userId: fields.userId,
        name: fields.name.trim(),
        number: fields.number.trim(),
        gradeLabel: fields.gradeLabel.trim(),
        classLabel: fields.classLabel.trim(),
      });
      if (!ok) {
        alert('이름은 필수예요. 학생 아이디 형식을 확인해 주세요.');
        return;
      }
    } else {
      if (!fields.name.trim()) {
        alert('이름을 입력해 주세요.');
        return;
      }
      if (
        fields.userId &&
        !/^[a-z0-9._-]{3,30}$/.test(fields.userId)
      ) {
        alert('학생 아이디는 영문 소문자·숫자·._- 만 3~30자예요.');
        return;
      }
      if (typeof mergeRosterStudentProfile === 'function') {
        mergeRosterStudentProfile(id, {
          name: fields.name.trim(),
          number: fields.number.trim(),
          gradeLabel: fields.gradeLabel.trim(),
          classLabel: fields.classLabel.trim(),
          userId: fields.userId || undefined,
        });
      }
      const loginId = fields.userId;
      if (loginId && typeof patchLocalAccount === 'function') {
        patchLocalAccount(loginId, {
          name: fields.name.trim(),
          studentNumber: fields.number.trim(),
          gradeLabel: fields.gradeLabel.trim(),
          classLabel: fields.classLabel.trim(),
        });
      }
    }
    resetTeacherRosterForm();
    if (typeof refreshDashboard === 'function') await refreshDashboard();
    return;
  }

  const res = addTeacherCustomRosterRow(fields);
  if (!res.ok) {
    alert(res.error || '추가할 수 없어요.');
    return;
  }
  resetTeacherRosterForm();
  if (typeof refreshDashboard === 'function') await refreshDashboard();
}

function renderTeacherManageList(students) {
  const wrap = document.getElementById('teacher-manage-list');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!students || students.length === 0) {
    wrap.innerHTML =
      '<p class="teacher-manage-empty">등록된 학생이 없어요. 위 양식에서 추가하거나 data/students.json 명단을 확인하세요. 로그인만 쓰게 하려면 <strong>학생 계정 생성</strong> 탭을 이용해 주세요.</p>';
    return;
  }

  const list = [...students].sort(function (a, b) {
    return String(a.name).localeCompare(String(b.name), 'ko');
  });

  list.forEach(function (s) {
    const row = document.createElement('div');
    row.className = 'teacher-manage-row';
    const custom = isTeacherCustomStudentId(s.id);
    const badge = '<span class="teacher-manage-badge">명단</span>';
    const uid = (s.userId || '').trim();
    row.innerHTML = `
      <div class="teacher-manage-row-main">
        ${badge}
        <span class="teacher-manage-row-name">${escTeacherRoster(s.name)}</span>
        <span class="teacher-manage-row-meta">${escTeacherRoster(String(s.number || ''))}${uid ? ' · ' + escTeacherRoster(uid) : ''}</span>
      </div>
      <div class="teacher-manage-row-actions">
        <button type="button" class="teacher-manage-action" data-action="edit">수정</button>
        <button type="button" class="teacher-manage-action teacher-manage-action--danger" data-action="remove">삭제</button>
      </div>
    `;
    const id = s.id;
    row.querySelector('[data-action="edit"]').onclick = function () {
      fillTeacherRosterFormFromStudent(
        students.find(function (x) {
          return x.id === id;
        }) || s
      );
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    row.querySelector('[data-action="remove"]').onclick = function () {
      if (custom) {
        if (!confirm('이 학생을 목록에서 삭제할까요?')) return;
        removeTeacherCustomRosterRow(id);
      } else {
        if (!confirm('JSON 명단에서 이 학생을 대시보드에 숨길까요? (데이터 파일은 바뀌지 않아요)')) return;
        hideTeacherJsonStudent(id);
      }
      resetTeacherRosterForm();
      void refreshDashboard();
    };
    wrap.appendChild(row);
  });
}

function resetTeacherStudentAccountForm() {
  [
    'teacher-acct-name',
    'teacher-acct-student-number',
    'teacher-acct-grade',
    'teacher-acct-class',
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
    if (typeof createStudentLoginAccount !== 'function') {
      if (errEl) errEl.textContent = '계정 기능을 불러오지 못했어요. 페이지를 새로고침해 주세요.';
      return;
    }
    const res = await createStudentLoginAccount({
      name: (document.getElementById('teacher-acct-name') || {}).value,
      studentNumber: (document.getElementById('teacher-acct-student-number') || {}).value,
      gradeLabel: (document.getElementById('teacher-acct-grade') || {}).value,
      classLabel: (document.getElementById('teacher-acct-class') || {}).value,
      userId: (document.getElementById('teacher-acct-userid') || {}).value,
      password: (document.getElementById('teacher-acct-password') || {}).value,
      password2: (document.getElementById('teacher-acct-password2') || {}).value,
    });
    if (!res.ok) {
      if (errEl) errEl.textContent = res.error || '만들 수 없어요.';
      return;
    }
    resetTeacherStudentAccountForm();
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

function initTeacherRosterPanel() {
  const form = document.getElementById('teacher-roster-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      void submitTeacherRosterForm();
    });
  }
  const cancel = document.getElementById('teacher-roster-cancel-edit');
  if (cancel) {
    cancel.addEventListener('click', function () {
      resetTeacherRosterForm();
    });
  }
  initTeacherStudentAccountForm();
  updateTeacherRosterClassPageTitle();
}

window.updateTeacherRosterClassPageTitle = updateTeacherRosterClassPageTitle;
