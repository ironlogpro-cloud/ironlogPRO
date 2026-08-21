// IronLog Service Worker
// نکته: این فایل معمولاً نیازی به تغییر دستی نداره حتی اگه هر روز
// چندین‌بار index.html رو آپدیت کنی — چون استراتژی network-first
// همیشه اول از شبکه نسخه‌ی تازه رو می‌گیره.

const CACHE = 'ironlog-static';

const SCOPE_URL = new URL(self.registration.scope);
const BASE = SCOPE_URL.pathname;

const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await Promise.all(
        ASSETS.map((url) =>
          c.add(url).catch((err) => {
            console.warn('[SW] cache failed for', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isHTML = e.request.mode === 'navigate' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === BASE;

  if (isHTML) {
    // Network-first: همیشه اول تلاش کن نسخه‌ی تازه رو از شبکه بگیری.
    // چون این صفحه‌ای‌ست که هر روز چندبار عوض می‌شه، نمی‌خوایم
    // کاربر آنلاین گیر بیفته روی نسخه‌ی کهنه‌ی کش‌شده.
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request)) // فقط وقتی آفلاینه، برو سراغ کش
    );
    return;
  }

  // برای بقیه‌ی فایل‌ها (فونت، آیکون، manifest و ...) که کمتر عوض می‌شن:
  // Cache-first با آپدیت پس‌زمینه (سریع‌تر و کم‌مصرف‌تر برای گوشی ضعیف)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkFetch = fetch(e.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
