/* ===========================
   js/core/cross-tab.js
   학생(index)·교사(teacher) 탭이 같은 브라우저에서 서로 상태를 맞추기 위한
   BroadcastChannel 단일 채널 송신.

   • localStorage 변경은 다른 탭에만 storage 이벤트가 오므로,
     같은 탭에서의 즉시 반영·누락 보완은 storage.js 의 notify + 여기 post 로 처리합니다.
   • paths.js 다음, storage.js 이전에 로드하세요.
=========================== */

(function (global) {
  var CHANNEL_NAME = 'emotion-checkin';
  var bc = null;

  function getEmotionCheckinBroadcast() {
    if (bc) return bc;
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      bc = null;
    }
    return bc;
  }

  /**
   * @param {string} [kind] - emotions | profile | teacher-msg | class-room | teacher-roster | theme-student | theme-teacher | teacher-accounts …
   * @param {*} [detail] - 선택. 수신 측 ev.data.detail
   */
  function postEmotionCheckinSync(kind, detail) {
    var ch = getEmotionCheckinBroadcast();
    if (!ch) return;
    try {
      ch.postMessage({
        kind: kind || 'update',
        ts: Date.now(),
        detail: detail === undefined ? null : detail,
      });
    } catch (e) {}
  }

  global.postEmotionCheckinSync = postEmotionCheckinSync;
})(typeof window !== 'undefined' ? window : globalThis);
