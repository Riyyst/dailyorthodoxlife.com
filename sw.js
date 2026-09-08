const CACHE='orthodox-companion-v23';
const CORE=[
  './','./index.html','./calendar.html','./prayers.html','./listen.html','./study-bible.html',
  './assets/css/app.css','./assets/css/cover.css','./assets/css/reader.css',
  './assets/js/app-shell.js','./assets/js/home.js','./assets/js/prayer-data.js','./assets/js/prayers.js','./assets/js/listen.js',
  './assets/orthodox-cover-logo.png','./assets/orthodox-cover-logo.png','./assets/orthodox-cover-logo.png','./assets/study-bible-background.jpg',
  './assets/media/home/Bible.png','./assets/media/home/Prayers.jpg','./assets/media/home/candles.jpg','./assets/media/home/Icons.png','./assets/media/home/calendar-home.jpg',
  './greek/greek-assets/images/church-background.png','./russian/russian-assets/images/church-background.png',
  './greek/greek-assets/css/style.css','./greek/greek-assets/js/main.js',
  './russian/russian-assets/css/style.css','./russian/russian-assets/js/main.js'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{})));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin)return;
  if(url.pathname.includes('the-orthodox-study-bible.pdf') || url.pathname.includes('/assets/pdf-data/')) return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>cached)));
});
