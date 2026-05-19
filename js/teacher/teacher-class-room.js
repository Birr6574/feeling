/* ===========================
   교사 설정 — 학급 만들기 · 코드 안내 (API 기반)
=========================== */

function updateTeacherHeaderClassLabel() {
  var el   = document.getElementById('teacher-class-label');
  var room = typeof getClassRoom === 'function' ? getClassRoom() : null;
  if (el) el.textContent = room && room.name ? room.name : '학급 미설정';
}

function setTeacherClassMsg(elId, msg, isError) {
  var el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('teacher-auth-msg--error', !!isError);
}

function renderTeacherClassRoomCard() {
  var room       = typeof getClassRoom === 'function' ? getClassRoom() : null;
  var createWrap = document.getElementById('teacher-class-room-create');
  var activeWrap = document.getElementById('teacher-class-room-active');
  if (!createWrap || !activeWrap) return;

  if (room) {
    createWrap.style.display = 'none';
    activeWrap.style.display = 'block';
    var nameEl = document.getElementById('teacher-class-room-name');
    var codeEl = document.getElementById('teacher-class-room-code');
    if (nameEl) nameEl.textContent = room.name;
    if (codeEl) {
      codeEl.textContent = '';
      var span = document.createElement('span');
      span.className = 'teacher-class-code-text';
      span.textContent = room.code;
      codeEl.appendChild(span);
    }
  } else {
    createWrap.style.display = 'block';
    activeWrap.style.display = 'none';
  }
  setTeacherClassMsg('teacher-class-room-msg', '', false);
  if (typeof window.updateTeacherRosterClassPageTitle === 'function') {
    window.updateTeacherRosterClassPageTitle();
  }
}

async function copyTeacherClassCode() {
  var room = typeof getClassRoom === 'function' ? getClassRoom() : null;
  if (!room) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(room.code);
      setTeacherClassMsg('teacher-class-room-msg', '코드를 복사했어요.', false);
    } else throw new Error('clipboard');
  } catch (e) {
    setTeacherClassMsg('teacher-class-room-msg', '복사에 실패했어요. 코드를 직접 선택해 복사해 주세요.', true);
  }
}

function initTeacherClassRoomPanel() {
  updateTeacherHeaderClassLabel();
  renderTeacherClassRoomCard();

  var createBtn = document.getElementById('teacher-class-create-btn');
  if (createBtn && createBtn.dataset.wired !== '1') {
    createBtn.dataset.wired = '1';
    createBtn.addEventListener('click', async function() {
      var nameEl = document.getElementById('teacher-class-name-input');
      var name   = (nameEl && nameEl.value) || '';
      createBtn.disabled = true;
      var ok = typeof setClassRoom === 'function' && await setClassRoom(name);
      createBtn.disabled = false;
      if (ok) {
        renderTeacherClassRoomCard();
        updateTeacherHeaderClassLabel();
        setTeacherClassMsg('teacher-class-room-msg', '학급이 만들어졌어요. 아래 코드를 학생에게 알려 주세요.', false);
      } else {
        setTeacherClassMsg('teacher-class-room-msg', '학급을 만들 수 없어요.', true);
      }
    });
  }

  var copyBtn = document.getElementById('teacher-class-copy-btn');
  if (copyBtn && copyBtn.dataset.wired !== '1') {
    copyBtn.dataset.wired = '1';
    copyBtn.addEventListener('click', function() { void copyTeacherClassCode(); });
  }

  var removeBtn = document.getElementById('teacher-class-remove-btn');
  if (removeBtn && removeBtn.dataset.wired !== '1') {
    removeBtn.dataset.wired = '1';
    removeBtn.addEventListener('click', async function() {
      if (!confirm('학급을 없앨까요? 소속 학생 연결도 함께 해제돼요.')) return;
      removeBtn.disabled = true;
      if (typeof clearClassRoom === 'function') await clearClassRoom();
      removeBtn.disabled = false;
      renderTeacherClassRoomCard();
      updateTeacherHeaderClassLabel();
      setTeacherClassMsg('teacher-class-room-msg', '학급을 없앴어요.', false);
    });
  }
}
