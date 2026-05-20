/* ===========================
   js/core/api.js
   Google Apps Script API 클라이언트
   배포 후 FEELING_API_URL 을 실제 URL 로 교체하세요.
=========================== */

var FEELING_API_URL = 'https://script.google.com/macros/s/AKfycbzPQOGLVGCaxYMoA43ngc8cgPJW4FMRnJJ0ErUiZyXRRMy4PoajLAiOH4ObYhMQP2YNbA/exec';

// 토큰 없이 호출 가능한 공개 액션
var _API_PUBLIC_ACTIONS = ['login', 'signup', 'teacherLogin', 'studentLogin', 'teacherSignup', 'studentSignup'];

// 세션 토큰 키 (localStorage / sessionStorage 공통)
var _SESSION_TOKEN_KEY = 'emotion-checkin-session-token';

function _getStoredToken() {
  try {
    return localStorage.getItem(_SESSION_TOKEN_KEY)
        || sessionStorage.getItem(_SESSION_TOKEN_KEY)
        || null;
  } catch (e) { return null; }
}

async function apiCall(action, params) {
  var body = Object.assign({ action: action }, params || {});

  // 공개 액션이 아니면 세션 토큰 자동 첨부
  if (_API_PUBLIC_ACTIONS.indexOf(action) === -1) {
    var token = _getStoredToken();
    if (token) body._token = token;
  }

  try {
    var res = await fetch(FEELING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return { ok: false, error: '서버 오류 (' + res.status + ')' };
    var data = await res.json();

    // 토큰 만료 시 저장된 토큰 제거 (다음 요청에서 재로그인 유도)
    if (!data.ok && data.error && data.error.indexOf('만료') !== -1) {
      try {
        localStorage.removeItem(_SESSION_TOKEN_KEY);
        sessionStorage.removeItem(_SESSION_TOKEN_KEY);
      } catch (e2) {}
    }
    return data;
  } catch (e) {
    return { ok: false, error: '네트워크 오류가 발생했어요. 인터넷 연결을 확인해 주세요.' };
  }
}
