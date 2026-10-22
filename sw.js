// Service worker de FinanzApp: hace que la app se pueda instalar y que abra
// aunque no haya señal. Los datos NO pasan por acá: Supabase y la cotización
// del dólar van siempre directo a la red (la app ya tiene su propia caché
// local y su cola de cambios pendientes para cuando no hay conexión).
//
// Cambiá CACHE cuando cambie algo de esta lista para forzar una caché nueva.
const CACHE = 'finanzapp-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];
// librerías y fuentes de afuera que la página necesita para arrancar
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event)=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k !== CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (event)=>{
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // la página: primero la red, así cada cambio publicado llega al toque;
  // sin señal, la última copia guardada
  if(req.mode === 'navigate'){
    event.respondWith(
      fetch(req)
        .then(res=>{ caches.open(CACHE).then(c=>c.put('./index.html', res.clone())); return res; })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // íconos y manifest propios: de la caché, y si no está, de la red
  if(url.origin === self.location.origin){
    event.respondWith(caches.match(req).then(hit=>hit || fetch(req)));
    return;
  }

  // supabase-js, notyf y las fuentes: la copia guardada al instante, y se
  // actualiza por detrás para la próxima vez
  if(CDN_HOSTS.includes(url.hostname)){
    event.respondWith(caches.open(CACHE).then(async c=>{
      const hit = await c.match(req);
      const net = fetch(req).then(res=>{ if(res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(()=>hit);
      return hit || net;
    }));
  }
  // todo lo demás (Supabase, dolarapi) no se toca: va directo a la red
});
