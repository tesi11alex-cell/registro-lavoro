const CACHE='registro-lavoro-v2';
const APP_SHELL=[
  './',
  './index.html',
  './manifest.webmanifest',
  './firebase-config.js',
  './icon-180-v2.png',
  './icon-192-v2.png',
  './icon-512-v2.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  if(url.origin===self.location.origin){
    if(req.mode==='navigate'){
      event.respondWith(
        fetch(req).then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put('./index.html',copy));
          return res;
        }).catch(()=>caches.match('./index.html'))
      );
      return;
    }

    // Network-first for manifest and icons so updates are picked up quickly.
    if(url.pathname.endsWith('manifest.webmanifest') || /icon-\d+-v\d+\.png$/.test(url.pathname)){
      event.respondWith(
        fetch(req).then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(req,copy));
          return res;
        }).catch(()=>caches.match(req))
      );
      return;
    }

    event.respondWith(
      caches.match(req).then(cached=>cached||fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy));
        return res;
      }))
    );
  }
});
