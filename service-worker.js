/**
 * RichMark Service Worker
 * 策略：
 *   - 靜態資源 (HTML/CSS/JS/圖片)：Cache-First，失敗回落到網路
 *   - 第三方 API (Supabase、TWSE proxy、CoinGecko 等)：Network-Only（不快取，確保資料即時）
 *   - 導覽請求 (navigate)：Network-First，斷網回退 index.html
 *
 * 升版方式：改 CACHE_VERSION 即可觸發更新，舊快取自動清除。
 */
const CACHE_VERSION = 'richmark-v1.9.9';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './images/logo.png',
  './images/logo-white.png',
  './images/logo-192.png',
  './images/logo-512.png',
  './images/favicon.ico',
  './images/favicon-32x32.png',
  './images/apple-touch-icon.png'
];

// 不要快取的網域（即時性資料、第三方 SDK）
const NEVER_CACHE_HOSTS = [
  'supabase.co',
  'supabase.com',
  'cdn.jsdelivr.net',
  'corsproxy.io',
  'api.allorigins.win',
  'api.codetabs.com',
  'api.coingecko.com',
  'api.metals.dev',
  'api.exchangerate-api.com',
  'newsdata.io',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'mis.twse.com.tw'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      // addAll 遇到任一失敗會整包失敗，所以用 Promise.allSettled 容錯
      return Promise.allSettled(STATIC_ASSETS.map(function(url) {
        return cache.add(url).catch(function(e) {
          console.warn('[SW] 預先快取失敗:', url, e);
        });
      }));
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;  // 不處理 POST/PUT 等
  var url = new URL(req.url);

  // 非 http(s) 請求（如 chrome-extension://）一律略過
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 第三方 API：直連網路，不快取
  var skip = NEVER_CACHE_HOSTS.some(function(h) { return url.hostname.indexOf(h) >= 0; });
  if (skip) return;

  // 導覽請求（換頁、直接輸入 URL）：Network-First，斷網回退 index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function() {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // 其他靜態資源：Cache-First + 背景更新
  event.respondWith(
    caches.match(req).then(function(cached) {
      var fetchPromise = fetch(req).then(function(resp) {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          var respClone = resp.clone();
          caches.open(CACHE_VERSION).then(function(cache) {
            cache.put(req, respClone).catch(function() { /* quota 等錯誤忽略 */ });
          });
        }
        return resp;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});

// 接收從主執行緒的訊息（用來手動觸發更新）
self.addEventListener('message', function(event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
