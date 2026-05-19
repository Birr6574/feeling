/* ===========================
   js/core/api.js
   Google Apps Script API 클라이언트
   배포 후 FEELING_API_URL 을 실제 URL 로 교체하세요.
=========================== */

var FEELING_API_URL = 'https://script.google.com/macros/s/AKfycbzPQOGLVGCaxYMoA43ngc8cgPJW4FMRnJJ0ErUiZyXRRMy4PoajLAiOH4ObYhMQP2YNbA/exec';

async function apiCall(action, params) {
  try {
    var res = await fetch(FEELING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(Object.assign({ action: action }, params || {}))
    });
    if (!res.ok) return { ok: false, error: '서버 오류 (' + res.status + ')' };
    return await res.json();
  } catch (e) {
    return { ok: false, error: '네트워크 오류가 발생했어요. 인터넷 연결을 확인해 주세요.' };
  }
}
