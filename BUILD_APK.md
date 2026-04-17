# RichMark — APK 打包教學

RichMark 是純 Web 應用（HTML/CSS/JS + Supabase），要變成 Android APK 有 3 條路。按「從簡單到客製化」排序：

| 方式 | 難度 | APK 大小 | 可上架 Play 商店 | 需 Android SDK |
|------|------|---------|-----------------|---------------|
| 1. **PWABuilder**（雲端） | 🟢 零代碼 | ~2 MB | ✓ | ✗ |
| 2. **Bubblewrap TWA**（本機） | 🟡 中 | ~2 MB | ✓ | ✓ |
| 3. **Capacitor**（本機） | 🟠 高 | ~4 MB | ✓ | ✓ |

---

## ✅ 前置條件（三種方式共通）

RichMark 已經是合格 PWA：
- ✓ `manifest.json`（app 名稱、圖示、顏色）
- ✓ `service-worker.js`（離線快取）
- ✓ 可透過 HTTPS 存取（目前部署在 GitHub Pages：`https://mark1888888.github.io/...`）
- ✓ 各尺寸圖示：`logo-192.png`、`logo-512.png`、`apple-touch-icon.png`

在 Chrome DevTools → Application → Manifest 檢查是否全綠勾，沒問題才能打包。

---

## 🟢 方式 1：PWABuilder（推薦 — 零安裝、零代碼）

Microsoft 官方提供的線上 PWA 轉 APK 服務。

### 步驟

1. 打開 https://www.pwabuilder.com
2. 貼上你的 URL：`https://mark1888888.github.io/<你的repo名>/`
3. 點「**Start**」，等它自動分析 manifest / service worker（應該全綠）
4. 點右上「**Package for stores**」→ 選「**Android**」
5. 選項設定：
   - **Package ID**: `com.richmark.app`
   - **App name**: RichMark
   - **Version**: 1.9.9
   - **Signing key**: 選 "**Create new**"（讓它產生新的 keystore）或上傳既有的
6. 下載 zip → 內含：
   - `app-release-signed.apk` — 直接可以安裝到手機（側載）
   - `app-release-bundle.aab` — 上傳 Play 商店用的 App Bundle
   - `assetlinks.json` — 需上傳到 `https://你的網域/.well-known/assetlinks.json` 驗證網域所有權（上 Play 商店必要）

### 安裝到手機

- 把 `.apk` 傳到手機，點擊安裝（需允許「未知來源」）
- 或用 `adb install app-release-signed.apk`

**優點**：完全零安裝、3 分鐘就能產生 APK
**缺點**：依賴 PWABuilder 伺服器、signing key 管理要自己來

---

## 🟡 方式 2：Bubblewrap TWA（Chrome 官方推薦）

TWA (Trusted Web Activity) 是 Google 推的 PWA 包 APK 標準，APK 其實只是個殼，實際跑 Chrome Custom Tab 載入網頁。

### 環境準備

```bash
# 安裝 Node.js 20+ 和 Java JDK 17+
# macOS:
brew install node openjdk@17

# Ubuntu:
sudo apt install nodejs openjdk-17-jdk

# 安裝 Bubblewrap CLI
npm install -g @bubblewrap/cli

# 首次執行會要下載 Android SDK（可選擇自動或手動）
```

### 建置

```bash
# 進 RichMark 資料夾
cd RichMark

# 初始化（會讀取 twa-manifest.json）
# 注意：如果 twa-manifest.json 裡的 host / URL 不對，要先編輯
bubblewrap init --manifest=./twa-manifest.json

# 建置 APK
bubblewrap build

# 輸出：
# - app-release-signed.apk  (可直接安裝)
# - app-release-bundle.aab  (上架 Play 商店)
# - android.keystore        (簽章檔案，妥善保存！)
```

### 首次建置會問的問題

- Package ID: `com.richmark.app`
- App name: `RichMark`
- 主機名: `mark1888888.github.io`（或你部署網域）
- Start URL: `/你的repo名/index.html`
- 顯示模式: standalone
- 主題色: `#6c63ff`
- Keystore 密碼：設一個強密碼並記好（每次 build 都要用）

### 上架注意事項（Digital Asset Links）

TWA 要讓 Play 商店相信這個 APK 和你的網站是同一家人，必須：

1. Bubblewrap 會告訴你一個 SHA256 指紋
2. 把它填進 `.well-known/assetlinks.json`：

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.richmark.app",
    "sha256_cert_fingerprints": ["<你的 SHA256 指紋>"]
  }
}]
```

3. 上傳到 `https://你的網域/.well-known/assetlinks.json`（必須 HTTPS、無重定向）

---

## 🟠 方式 3：Capacitor（需要 Android Studio，可擴充原生功能）

當你之後想加入「相機」「通知」「生物辨識」等 JS 做不到的原生能力時用這條路。

### 環境準備

```bash
# Node.js 20+
# Android Studio（包含 Android SDK）
# Java JDK 17+

# 進專案資料夾
cd RichMark

# 安裝依賴（package.json 已寫好）
npm install

# 初次加 Android 平台（會在同目錄產生 android/ 資料夾）
npx cap add android

# 同步 web 資源進 android 專案
npx cap sync android
```

### 建置 APK

**方法 A：命令列（快）**
```bash
cd android
./gradlew assembleDebug        # debug APK（測試用）
./gradlew assembleRelease      # release APK（正式）

# 輸出在：
# android/app/build/outputs/apk/debug/app-debug.apk
# android/app/build/outputs/apk/release/app-release-unsigned.apk
```

**方法 B：Android Studio 開圖形介面**
```bash
npx cap open android
# 然後在 Android Studio 中：Build → Build Bundle(s) / APK(s) → Build APK(s)
```

### 簽章 (Release)

```bash
# 產生 keystore（只需一次，之後保存好）
keytool -genkey -v -keystore richmark.keystore -alias richmark \
        -keyalg RSA -keysize 2048 -validity 10000

# 簽章
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
          -keystore richmark.keystore \
          android/app/build/outputs/apk/release/app-release-unsigned.apk \
          richmark

# 對齊（optional，Play 商店建議）
zipalign -v 4 app-release-unsigned.apk app-release.apk
```

---

## 📱 測試 APK

### 側載到手機
```bash
# 接 USB 打開 USB 調試模式
adb install app-release-signed.apk
```

### 上架 Google Play
1. 打開 [Play Console](https://play.google.com/console/)
2. 建立新應用
3. 上傳 `.aab`（App Bundle，不是 APK）
4. 填寫商店聽取、設定價格/地區
5. 內部測試 → 公開測試 → 正式發布

**首次上架要審核 1-7 天**。

---

## 🔧 常見問題

### Q1: APK 裝完打開一片白
- 檢查 service worker 註冊成功（Chrome DevTools 連到裝置看 Console）
- 檢查 manifest.json 的 `start_url` 正確
- 檢查 Supabase URL / anon key 正確

### Q2: 網頁更新了但 APK 顯示舊內容
- PWA service worker 快取：重啟 app 或在設定清除快取
- 每次網站更新記得把 `service-worker.js` 裡的 `CACHE_VERSION` 遞增（例如 `richmark-v1.9.10`）

### Q3: 無法在 Play 商店上架（assetlinks 驗證失敗）
- 確認 `https://你的網域/.well-known/assetlinks.json` 可直接用瀏覽器開啟並回傳 JSON
- `package_name` 大小寫要完全一致
- 指紋要用 **release keystore** 的，不是 debug 的
- GitHub Pages 如果走 `username.github.io/repo/`，assetlinks 要放到 **根網域** `username.github.io/.well-known/assetlinks.json`（不是 repo 底下）

### Q4: 檔案太大想壓縮
- `tesseract.js` 的 wasm 佔很大（圖片 OCR）。若 APK 裡不需要帳單掃描功能，可以在 service-worker 的 `NEVER_CACHE_HOSTS` 加入 `jsdelivr.net` 相關路徑避開
- 或換 Capacitor 並改用 lazy loading 只在需要時才載入

---

## 📊 三種方式比較

| 項目 | PWABuilder | Bubblewrap | Capacitor |
|------|-----------|-----------|-----------|
| 建置時間 | 3 分鐘 | 10 分鐘 | 30 分鐘 |
| 需安裝 | 瀏覽器 | Node + JDK | Node + JDK + Android Studio |
| APK 大小 | ~2 MB | ~2 MB | ~4 MB |
| 離線支援 | 依 SW | 依 SW | 依 SW |
| 原生能力 | ✗ | ✗（受限） | ✓（相機/推送/生物辨識等） |
| 更新方式 | 網站更新即用戶可看到 | 同左 | 要重新發 APK |
| 適合情境 | 快速上架 PWA | 長期維運 PWA | 需要原生功能 |

---

## 🎯 快速建議

- **想最快有 APK 試用** → 方式 1（PWABuilder，線上生成）
- **想長期經營、只需 Web 功能** → 方式 2（Bubblewrap TWA）
- **以後會加相機、推播、生物辨識** → 方式 3（Capacitor）

---

更新日期：2026-04-17 · RichMark v1.9.9
