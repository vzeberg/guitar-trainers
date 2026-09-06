/* Оффлайн-оболочка тренажёра.
   Стратегии:
     навигация      — сеть вперёд (чтобы деплой доезжал), кэш как запасной вариант;
     свои статики   — кэш вперёд с фоновым обновлением;
     Google Fonts   — stale-while-revalidate, иначе без сети слетают шрифты.
   Версию бампать при изменении списка SHELL. */
const VERSION = 'v1';
const SHELL   = 'shell-' + VERSION;
const RUNTIME = 'runtime-' + VERSION;
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './apple-touch-icon.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(SHELL)
      .then(c => Promise.allSettled(SHELL_FILES.map(f => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k!==SHELL && k!==RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(req, cacheName){
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetching = fetch(req).then(res=>{
    if(res && (res.ok || res.type==='opaque')) cache.put(req, res.clone());
    return res;
  }).catch(()=>null);
  return hit || (await fetching) || Response.error();
}

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req)
        .then(res=>{
          const copy = res.clone();
          caches.open(SHELL).then(c=>c.put('./index.html', copy)).catch(()=>{});
          return res;
        })
        .catch(async ()=> (await caches.match('./index.html')) || (await caches.match('./')) || Response.error())
    );
    return;
  }

  if(FONT_HOSTS.includes(url.hostname)){ e.respondWith(cacheFirst(req, RUNTIME)); return; }
  if(url.origin === self.location.origin){ e.respondWith(cacheFirst(req, SHELL)); }
});
