/* 업무 허브 - 최소 서비스워커
 * 이 허브는 각 앱으로 "링크만" 여는 관문이라 오프라인 캐시가 필수는 아니다.
 * 다만 폰 "홈화면에 추가(설치)" 조건을 충족시키기 위해 서비스워커를 등록한다.
 * 허브 자체 파일(껍데기)만 가볍게 캐시해 두 번째 실행부터 즉시 뜨게 한다.
 */
const CACHE = 'office-hub-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // 같은 출처(허브 껍데기)만 다룬다. 외부 앱 링크는 그대로 네트워크로 통과.
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).catch(() => hit))
  );
});
