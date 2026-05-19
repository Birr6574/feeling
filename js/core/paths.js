/* ===========================
   js/core/paths.js
   teacher.html·index.html 기준으로 data/*.json 등 상대 경로를 절대 URL로 맞춤
   (Live Server·GitHub Pages·하위 폴더 배포 시 404 방지)
=========================== */

window.emotionCheckinResolve = function emotionCheckinResolve(relativePath) {
  if (!relativePath) return relativePath;
  if (/^https?:\/\//i.test(relativePath) || relativePath.startsWith('//')) {
    return relativePath;
  }
  try {
    return new URL(relativePath, window.location.href).href;
  } catch (e) {
    return relativePath;
  }
};
