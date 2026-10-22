const CACHE='paperchef-windows-shared-0.1.0',SHELL=['/dish-selection.js','/scroll-position.js','/sheet-editor.js','/week-calendar.js','/app-status.js','/editor-navigation.js','/help-center.css','/help-center.js','/week-rules.js','/random-week.js','/week-types.js','/kitchen-background.svg','/kitchen-background.png','/journey.js','/clarity.js','/cuisine-visuals.js','/','/app.js','/week-info.js','/library-editor.js','/reference-ui.js','/reference-format.js','/assembly-editor.js','/menu-composition.js','/service-title.js','/app.css','/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest'];

self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting();});

self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});

// Seule lâ€™interface est conservÃ©e hors ligne ; les donnÃ©es restent dans le repository.

self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!SHELL.includes(url.pathname))return;event.respondWith(fetch(event.request).catch(()=>caches.match(url.pathname)));});






