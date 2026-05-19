/* ===========================
   학생 앱 — 학급 코드로 연결 (API 기반)
=========================== */

function setStudentClassUiMsg(elId, msg, isError) {
  var el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('auth-msg--error', !!isError);
}

function updateStudentClassLinkUiAll() {
  var linked  = typeof isStudentClassLinkActive === 'function' && isStudentClassLinkActive();
  var info    = typeof getStudentClassInfo === 'function' ? getStudentClassInfo() : null;

  var settingsLinked = document.getElementById('settings-class-linked');
  var settingsForm   = document.getElementById('settings-class-form-wrap');
  var badge          = document.getElementById('home-class-badge');

  if (linked && info) {
    var text = '연결됨 · ' + info.className;
    if (settingsLinked) { settingsLinked.style.display = 'block'; settingsLinked.textContent = text; }
    if (settingsForm)   settingsForm.style.display = 'none';
    if (badge)          { badge.style.display = 'block'; badge.textContent = '🏫 ' + info.className; }
  } else {
    if (settingsLinked) settingsLinked.style.display = 'none';
    if (settingsForm)   settingsForm.style.display = 'block';
    if (badge)          badge.style.display = 'none';
  }
}

function wireStudentClassLinkForms() {
  var setBtn = document.getElementById('settings-class-link-btn');
  if (setBtn && setBtn.dataset.wired !== '1') {
    setBtn.dataset.wired = '1';
    setBtn.addEventListener('click', async function() {
      var input = document.getElementById('settings-class-code-input');
      var raw   = (input && input.value) || '';
      setStudentClassUiMsg('settings-class-msg', '', false);
      setBtn.disabled = true;
      var res = await tryMatchStudentClassCode(raw);
      setBtn.disabled = false;
      if (!res.ok) {
        setStudentClassUiMsg('settings-class-msg', res.error || '연결할 수 없어요.', true);
        return;
      }
      if (input) input.value = '';
      setStudentClassUiMsg('settings-class-msg', '연결했어요: ' + res.className, false);
      updateStudentClassLinkUiAll();
    });
  }

  var unlinkBtn = document.getElementById('settings-class-unlink-btn');
  if (unlinkBtn && unlinkBtn.dataset.wired !== '1') {
    unlinkBtn.dataset.wired = '1';
    unlinkBtn.addEventListener('click', async function() {
      unlinkBtn.disabled = true;
      if (typeof clearStudentLinkedClassCode === 'function') await clearStudentLinkedClassCode();
      unlinkBtn.disabled = false;
      setStudentClassUiMsg('settings-class-msg', '학급 연결을 해제했어요.', false);
      updateStudentClassLinkUiAll();
    });
  }
}

window.updateStudentClassLinkUiAll = updateStudentClassLinkUiAll;

document.addEventListener('DOMContentLoaded', function() {
  wireStudentClassLinkForms();
  updateStudentClassLinkUiAll();
});
