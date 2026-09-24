const CACHE='orthodox-companion-v40';
const CORE=[
  './','./index.html','./404.html','./calendar.html','./prayers.html','./listen.html','./study-bible.html',
  './assets/css/app.css','./assets/css/cover.css','./assets/css/reader.css',
  './assets/js/app-shell.js','./assets/js/home.js','./assets/js/prayer-data.js','./assets/js/prayers.js','./assets/js/listen.js',
  './assets/orthodox-cover-logo.png','./assets/icons/orthodox-cross.svg','./assets/app-icon-192.png','./assets/app-icon-512.png','./assets/study-bible-background.jpg',
  './assets/media/home/Bible.png','./assets/media/home/Prayers.jpg','./assets/media/home/candles.jpg','./assets/media/home/Icons.png','./assets/media/home/calendar-home.jpg','./assets/media/empty-tomb.png',
  './greek/greek-assets/images/church-background.png','./russian/russian-assets/images/church-background.png',
  './greek/greek-assets/css/style.css','./greek/greek-assets/js/main.js',
  './russian/russian-assets/css/style.css','./russian/russian-assets/js/main.js'
];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('the-orthodox-study-bible.pdf') || url.pathname.includes('/assets/pdf-data/')) return;

  const isFreshCritical =
    e.request.mode === 'navigate' ||
    /\.(?:html|js|css)$/.test(url.pathname);

  if (isFreshCritical) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, copy)).catch(() => {});
        return response;
      });
    })
  );
});
