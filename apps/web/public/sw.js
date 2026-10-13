/* DayFlow static-only offline shell. Never cache /api, user data or credentials. */
const CACHE_NAME = "dayflow-shell-v2";
const STATIC_PREFIX = "/assets/";
const KNOWN_STATIC = new Set(["/", "/index.html", "/manifest.webmanifest", "/dayflow-icon.svg"]);

function isAllowedStatic(url) {
  return (
    url.origin === self.location.origin &&
    (KNOWN_STATIC.has(url.pathname) || url.pathname.startsWith(STATIC_PREFIX))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const shell = await fetch("/index.html", { cache: "reload" });
      if (!shell.ok) throw new Error("DayFlow shell unavailable during service worker install");
      const html = await shell.clone().text();
      await cache.put("/index.html", shell);
      // Vite emits hashed assets and an immutable entry URL in the built HTML.
      const sources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => new URL(match[1], self.location.origin))
        .filter((url) => url.pathname.startsWith(STATIC_PREFIX) && isAllowedStatic(url))
        .map((url) => url.pathname);
      await Promise.all(
        [...new Set([...sources, "/manifest.webmanifest", "/dayflow-icon.svg"])].map(
          async (asset) => {
            const response = await fetch(asset, { cache: "reload" });
            if (!response.ok) throw new Error("Missing DayFlow static bundle " + asset);
            await cache.put(asset, response);
          },
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("dayflow-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!isAllowedStatic(url) || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const shell = await cache.match("/index.html");
        if (!shell) return Response.error();
        return shell;
      }),
    );
    return;
  }

  if (url.pathname.startsWith(STATIC_PREFIX) || KNOWN_STATIC.has(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        // Hashed same-origin bundles are immutable. Ignore a response's Vary
        // header, which can otherwise reject the precached response because a
        // module-script request has different headers than install-time fetch.
        const saved = await cache.match(request, { ignoreVary: true });
        if (saved) return saved;
        const live = await fetch(request);
        if (live.ok && live.type === "basic") await cache.put(request, live.clone());
        return live;
      })(),
    );
  }
});
