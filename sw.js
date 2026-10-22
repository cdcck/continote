/**
 * ContiNote - Service Worker (PWA Offline & Install Support)
 */

const CACHE_NAME = 'continote-v13';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/state.js',
  './js/db.js',
  './js/canvas.js',
  './js/stickers.js',
  './js/zoom.js',
  './js/crop.js',
  './js/drive.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

// 서비스 워커 설치 시 핵심 파일 프리캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA Asset caching non-fatal error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 활성화 시 이전 버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 네트워크 우선 + 캐시 폴백 전략 (오프라인 지원)
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Google APIs, 확장프로그램, 비-GET 요청은 캐시 제외
  if (req.method !== 'GET' || !req.url.startsWith('http') || req.url.includes('google') || req.url.includes('gsi')) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        // 성공적인 네트워크 응답을 캐시에 복사 저장
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkRes;
      })
      .catch(async () => {
        // 네트워크 실패 시(오프라인) 캐시 반환
        const cachedRes = await caches.match(req);
        if (cachedRes) return cachedRes;

        // HTML 탐색 요청인 경우 index.html 폴백
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }

        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
