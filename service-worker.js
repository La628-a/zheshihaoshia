/* =================================================================
   恋学 · Service Worker (v8)
   - Stale-While-Revalidate：
     ① 命中缓存 → 立即返回（秒开，不等待网络）
     ② 同时在后台请求网络 → 更新缓存
     ③ 下次打开就是最新版
   - 网络失败且无缓存 → 页面兜底到缓存首页
   - 版本号 v8（自动清理 v7 旧缓存）
   ================================================================= */
const CACHE = 'lianxue-shell-v8';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        './',
        './index.html',
        './manifest.json',
        './icon-192.png',
        './icon-512.png'
      ]).catch(() => {})
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                    // 只处理 GET

  const sameOrigin = new URL(req.url).origin === self.location.origin;

  event.respondWith(
    caches.match(req).then((cached) => {
      // 后台静默更新：无论缓存是否命中，都去网络拉一次最新内容
      const network = fetch(req)
        .then((response) => {
          if (sameOrigin && response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          // 断网 / 请求失败：有缓存用缓存，导航请求兜底到首页
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return caches.match('./index.html').then((home) => home || Response.error());
          }
          return Response.error();
        });

      return cached || network;                          // 有缓存先给缓存（秒开），没有就等网络
    })
  );
});