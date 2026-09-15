/* 数学奇境 Service Worker —— 每次发版必须 bump CACHE 版本号
 *
 * ⚠️ 2026-09-15 统一改造（三科四站同一套写法）：
 *   ① 预缓存改成逐个 add 并各自兜底 —— 原来用 addAll，**任何一个文件 404，
 *      整个预缓存就全废、SW 直接装不上**，而且不会报错，只是离线突然不好使。
 *   ② 离线回退加 ignoreSearch —— 否则带 ?v= 的请求换一次版本号就全部落空。
 *   ③ 网络优先但带超时兜底（原来是裸 fetch，弱网会一直转圈）。
 */
const CACHE = "mathquest-v21";
const CORE = ["./", "./index.html", "./data.js", "./ladder.js", "./games.js", "./app.js", "./manifest.json", "./assets/baibai-base.png"];
const TIMEOUT = 1500;

self.addEventListener("install", e => e.waitUntil(
  caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())
));

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(netFirstButDontHang(e.request));
});
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

/* 网络优先，但不干等：先走网络保证新鲜；超过 TIMEOUT 还没回来，就先拿缓存顶上（秒开），
   网络回来照样写缓存。离线时回退缓存，并且 ignoreSearch —— 否则换了 ?v= 版本号就全部落空。 */
function netFirstButDontHang(req) {
  return new Promise(resolve => {
    let settled = false;
    const give = res => { if (!settled && res) { settled = true; resolve(res); } };

    const timer = setTimeout(() => {
      if (settled) return;
      caches.match(req, { ignoreSearch: true }).then(give);   // 没缓存就继续等网络
    }, TIMEOUT);

    fetch(req).then(res => {
      clearTimeout(timer);
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      give(res);
    }).catch(async () => {
      clearTimeout(timer);
      const hit = await caches.match(req, { ignoreSearch: true })
        || (req.mode === "navigate" ? await caches.match("./index.html") : null);
      give(hit || new Response("", { status: 504, statusText: "offline" }));
    });
  });
}
