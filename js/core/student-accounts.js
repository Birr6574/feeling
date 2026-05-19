/* ===========================
   js/core/student-accounts.js
   비밀번호 해시·학번 유효성 검사 공통 유틸리티
=========================== */

function normalizeUserId(userId) {
  return String(userId).trim().toLowerCase();
}

function validateUserId(userId) {
  var s = normalizeUserId(userId);
  if (!/^[a-z0-9._-]{3,30}$/.test(s)) {
    throw new Error('학번는 영문 소문자·숫자·._- 만, 3~30자여야 해요.');
  }
  return s;
}

async function hashPassword(password) {
  try {
    if (globalThis.crypto && globalThis.crypto.subtle) {
      var enc = new TextEncoder().encode(password + '|emotion-checkin');
      var buf = await globalThis.crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf))
        .map(function(b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    }
  } catch (e) {}
  var h = 5381;
  var s = password + '|emotion-checkin';
  for (var i = 0; i < s.length; i++) h = (Math.imul(33, h) + s.charCodeAt(i)) | 0;
  return 'fb_' + (h >>> 0).toString(16);
}
