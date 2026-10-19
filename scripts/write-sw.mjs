// Writes the installed web app's service worker into the web build (app/dist/sw.js).
// It is generated at build time, stamped with the commit, so its text changes with every
// deploy: phones then fetch the new version and replace their saved copy (same approach as PM Prep).
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = process.argv[2] ?? 'app/dist';
const VERSION = (process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`).slice(0, 12);
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
// Every screen's code and every font, so a screen never opened before still works offline.
const entry = ['_expo', 'assets'].flatMap((d) => walk(join(dist, d))).map((f) => '/' + relative(dist, f).split('\\').join('/'));

const sw = `// Form & Flow offline support, version ${VERSION}.
// The app is one page: every screen is /index.html plus app code. The page comes fresh from the
// network when it answers within 1.5 s, otherwise from the copy saved on this phone. App code and
// fonts are saved once (their file names change with every deploy). Your data never passes
// through here: it lives in this browser's storage.
const PAGE = 'page-${VERSION}', STATIC = 'static-v1', WAIT_MS = 1500, MAX_STATIC = 300;
const PRECACHE = ${JSON.stringify(['/', ...entry, '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'])};

self.addEventListener('install', (e) => {
  self.skipWaiting();
  const save = (async () => {
    const page = await caches.open(PAGE), stat = await caches.open(STATIC);
    for (const p of PRECACHE) {
      try {
        const r = await fetch(p, { cache: 'no-store' });
        if (r.ok) await (p === '/' ? page : stat).put(p, r);
      } catch {}
    }
  })();
  e.waitUntil(Promise.race([save, new Promise((r) => setTimeout(r, 20000))]));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== PAGE && k !== STATIC) await caches.delete(k);
    const s = await caches.open(STATIC), keys = await s.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_STATIC))) await s.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/') || /\\.(png|ttf|otf|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.open(STATIC).then(async (s) => {
      const hit = await s.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) s.put(req, r.clone());
      return r;
    }));
    return;
  }

  if (req.mode !== 'navigate') return;
  e.respondWith((async () => {
    const page = await caches.open(PAGE);
    const network = fetch(req).then((r) => {
      if (r.ok && (r.headers.get('content-type') || '').includes('text/html')) page.put('/', r.clone());
      return r;
    });
    const saved = await page.match('/');
    if (!saved) return network;
    const timer = new Promise((res) => setTimeout(() => res(null), WAIT_MS));
    try {
      const r = await Promise.race([network, timer]);
      return r && r.ok ? r : saved;
    } catch {
      return saved;
    }
  })());
});
`;
writeFileSync(`${dist}/sw.js`, sw);
console.log(`sw.js ${VERSION}: ${entry.length} app files and fonts saved for offline use`);
