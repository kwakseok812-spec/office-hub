/* 업무 허브 - 서비스워커 (캐시 전략 개선판)
 * 이 허브는 각 앱으로 "링크만" 여는 관문이라 오프라인 캐시가 필수는 아니다.
 * 다만 폰 "홈화면에 추가(설치)" 조건을 충족시키기 위해 서비스워커를 등록한다.
 *
 * 캐시 전략 (2026-09-20 개편):
 *  - HTML/네비게이션(index.html, './', navigate 요청): network-first
 *    → 앱 목록을 바꿔 재배포하면 폰이 즉시 최신본을 받는다. (옛 버그: cache-first라
 *      삭제한 앱이 폰에 계속 남던 문제 해결)
 *  - 아이콘·manifest 등 정적 파일: cache-first (성능 유지, 잘 안 바뀜)
 *  - 캐시 이름을 v2로 올려 activate 때 옛 v1 캐시가 자동 삭제되게 함.
 */
const CACHE = 'office-hub-v2';
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
      // 이름이 다른 옛 캐시(office-hub-v1 등)를 모두 삭제
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// HTML/네비게이션 요청인지 판별
function isHtmlRequest(req) {
  if (req.mode === 'navigate') return true;
  const url = new URL(req.url);
  if (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) return true;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // GET 이외(POST 등)와 다른 출처(외부 앱 링크)는 그대로 네트워크로 통과.
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (isHtmlRequest(req)) {
    // network-first: 항상 최신 index.html을 먼저 받고, 오프라인일 때만 캐시로 폴백
    e.respondWith(
      fetch(req)
        .then((res) => {
          // 최신본을 캐시에도 갱신해 둔다(오프라인 폴백용)
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // 그 밖의 정적 파일(아이콘·manifest 등): cache-first (성능)
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).catch(() => hit))
  );
});
