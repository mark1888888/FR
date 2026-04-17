# FlowRich 公式與數據定義

本文件整合 FlowRich 各頁面所用到的所有金額、統計、公式與欄位來源，作為前後端計算的唯一真實來源 (single source of truth)。每次公式調整都應同步更新此文件。

版本：v1.8.4 ｜更新：2026-04-17

設計原則：資產總覽採用「個人財務三表」架構 — **資產負債表（存量）**、**收支儲蓄表（流量）**、**財務健康指標**。

---

## 1. 名詞與符號

### 1.1 資產（依流動性分類）

| 符號 | 中文 | 組成 |
|------|------|------|
| `cashAmt` | 現金 | `accounts[type='cash'].balance` 加總 |
| `bankAmt` | 銀行存款 | `accounts[type='bank'].balance` 加總 |
| `investAmt` | 投資（股票/基金） | `accounts[type='invest'].balance` 加總 |
| `rec` | 應收款 | `receivables[type='receivable' ∧ status='pending'].amount` 加總 |
| **`liquid`** | **流動資產** | `cashAmt + bankAmt + investAmt + rec` |
| `propertyAmt` | 不動產現值 | `properties[*].currentValue` 加總 |
| `vehicleAmt` | 動產現值 | `vehicles[*].currentValue` 加總 |
| **`nonLiquid`** | **非流動資產** | `propertyAmt + vehicleAmt` |
| **`totalAsset`** | **總資產** | `liquid + nonLiquid` |

### 1.2 負債

| 符號 | 中文 | 組成 |
|------|------|------|
| `debt` | 信用卡負債 | `Σ |accounts[type='credit'].balance|`（取絕對值） |
| `pay` | 應付款 | `receivables[type='payable' ∧ status='pending'].amount` 加總 |
| **`totalLiab`** | **總負債** | `debt + pay` |

### 1.3 淨資產（Net Worth）

```
netA = totalAsset − totalLiab
     = (liquid + nonLiquid) − (debt + pay)
```

### 1.4 期間收支（流量）

| 符號 | 中文 | 定義 |
|------|------|------|
| `tI` | 本期收入 | 經 `filterByMonth` 過濾後的 `incomes.amount` 加總（換匯） |
| `tE` | 本期支出 | 同上，過濾 `expenses` |
| `net` / `saving` | 淨收支 / 儲蓄 | `tI − tE` |

所有金額皆透過 `convert(amount, from, to)` 換算成使用者選擇的顯示幣別再加總。

---

## 2. 資產負債表（個人版 Balance Sheet）

### 2.1 核心恆等式

```
總資產 = 總負債 + 淨資產
 ↕
淨資產 = 總資產 − 總負債
```

### 2.2 流動性定義（參考財務會計教科書）

**流動資產**：一年內可轉為現金的資產
- 現金（`cash`）
- 銀行存款（`bank`）
- 投資（`invest`，股票/基金/ETF，T+2 即可變現）
- 應收款（`receivable`，未收）

**非流動資產**：預計持有超過一年或難以即時變現
- 不動產（`properties`，房屋/土地/商業用房/車位）
- 動產（`vehicles`，汽機車/船舶）

**備註**：v1.8.4 起將 `invest`（股票/基金/ETF）改歸**流動資產**，理由是上市證券 T+2 內可變現，嚴格會計上也屬流動。若未來要再細分「長期持有」vs「短期交易」，可新增 `invest_long` 帳戶型別歸到非流動。

### 2.3 資產總覽卡片對照（v1.8.4）

**第 1 區「資產負債表（存量）」— 4 張卡**

| # | 卡片 | 公式 | 副標 |
|---|------|------|------|
| 1 | 淨資產 | `totalAsset − totalLiab` | 總資產 − 總負債 |
| 2 | 流動資產 | `cashAmt + bankAmt + investAmt + rec` | 顯示四者拆分 |
| 3 | 非流動資產 | `propertyAmt + vehicleAmt` | 顯示兩者拆分 |
| 4 | 總負債 | `debt + pay` | 顯示兩者拆分 |

恆等式驗證：**#1 = #2 + #3 − #4**，四張卡金額互不重疊。

---

## 3. 收支儲蓄表（個人版 Income Statement）

### 3.1 核心公式

```
儲蓄 = 收入 − 支出
```

### 3.2 資產總覽卡片對照（v1.8.0）

**第 2 區「收支儲蓄表（本月流量）」— 3 張卡**

| # | 卡片 | 公式 |
|---|------|------|
| 5 | 收入 | `tI`（附筆數） |
| 6 | 支出 | `tE`（附筆數） |
| 7 | 儲蓄（淨收支） | `tI − tE` |

時間範圍由畫面上的月份選擇器（`dashMonth`）控制，支援單月或「全部月份」。

---

## 4. 財務健康指標（Financial Health Metrics）

三項指標，皆可用現有資料計算。卡片右上以綠（健康）/橘（注意）/紅（警訊）顏色等級顯示。

### 4.1 負債比率（Debt-to-Asset Ratio）

```
debtRatio = totalLiab / totalAsset × 100%
```

| 區間 | 等級 | 建議 |
|------|------|------|
| `< 40%` | 健康 ✓ | 負債控制得宜 |
| `40–60%` | 注意 ! | 需留意負債增長 |
| `> 60%` | 警訊 ✕ | 負債偏高，建議降低 |

`totalAsset = 0` 時顯示「--」不做評分。

### 4.2 儲蓄率（Savings Rate）

```
savingRate = saving / income × 100%
           = (tI − tE) / tI × 100%
```

| 區間 | 等級 | 建議 |
|------|------|------|
| `≥ 20%` | 健康 ✓ | 儲蓄表現優秀 |
| `10–20%` | 尚可 ! | 符合最低建議 |
| `< 10%` | 警訊 ✕ | 儲蓄偏低，需檢視支出 |

本月 `tI = 0` 時顯示「--」並標註「本月無收入」。

### 4.3 緊急預備金月數（Emergency Fund Months）

```
emMonths = liquid / tE
```

以「流動資產」做分子，代表可立刻動用的資金；分母為當期支出，換算「這筆錢可以撐幾個月」。

| 區間 | 等級 | 建議 |
|------|------|------|
| `≥ 6` | 健康 ✓ | 準備金充足 |
| `3–6` | 尚可 ! | 接近建議下限 |
| `< 3` | 警訊 ✕ | 需提高備用金 |

本月 `tE = 0` 時：流動資產 > 0 顯示 `∞`（本月無支出），否則顯示 `0 個月`。

### 4.4 快速支配資產（Quick Disposable Assets）

```
quickDisposable = bankAmt + cashAmt + investAmt
                ≡ liquid − rec
```

代表「自己馬上可動用的資金」—即**流動資產扣除應收款**（應收款還要對方付款才能取得，不算 100% 可動用）。適合用來判斷「如果現在需要一筆錢，我能立刻拿出多少」。

| 組成 | 說明 |
|------|------|
| 銀行存款 | 活存 + 定存（定存視為可解約提前領取） |
| 現金 | 現場持有 |
| 投資 | 上市股票、ETF、流通基金 |

本項無健康等級閾值，屬中性參考金額。顯示位置：資產總覽 → 財務健康指標區（第 4 張卡）。

### 4.5 尚未實作：貸款負擔比

```
貸款負擔比 = 每月貸款支出 / 月收入 × 100%    建議 < 30%
```

目前資料模型尚無「貸款/房貸/車貸」欄位。待後續加入 `loans` 陣列後可新增此指標。

---

## 5. 匯率轉換

```
convert(amount, from, to) = amount ÷ rates[from] × rates[to]
```

- `rates.TWD` 恆為 1，其他幣別來自 `exchangerate-api.com/v4/latest/TWD`。
- 匯率載入失敗時回落到本地預設值，確保離線可用。
- 防呆：`rates[from]` 為 `0` / `undefined` 時回落為 `1`，避免除以零。

---

## 6. 資產分析頁（獨立於總覽）

資產分析頁保留更細的分類視角，共 7 張統計卡：

| 卡片 | 公式 |
|------|------|
| 正資產 | `cashAmt + bankAmt + investAmt + propertyAmt + vehicleAmt`（即 `liquid + nonLiquid − rec`） |
| 淨資產 | `liquid + nonLiquid − debt − pay`（與總覽一致） |
| (期間) 收入 | `tI` |
| (期間) 支出 | `tE` |
| 負債（信用卡） | `debt`（附張數） |
| 未收款 | `rec`（附未收筆數） |
| 應付款 | `pay`（附未付筆數） |

資產分析頁**沒有**儲蓄率、負債比率等指標卡，因為這些屬於「總覽」級別的健康檢視。

---

## 7. 股票自動刷新（TWSE）

### 7.1 開盤時段判斷

`isTwStockMarketOpen()` 條件：
- 星期一至星期五（`Date.getDay() ∈ {1..5}`）
- 本地時間 09:00–13:30

不考慮國定假日 / 補班日 / 颱風假（現階段簡化處理）。

### 7.2 刷新節奏

- `setInterval` 每 **60 秒** tick 一次（由 `stockRefreshTick()` 執行）
- 每次 tick 更新「開盤中 / 休市中」狀態文字
- 實際觸發重新 `loadStocks()` + `renderPortfolio()` 的條件**同時滿足**：
  1. 目前為開盤時段
  2. 使用者停留在「投資情報」頁（`#page-invest.active`）
  3. 距離上次成功刷新 ≥ 10 分鐘
- 使用者也可按「↻ 手動刷新」按鈕隨時強制刷新

### 7.3 顯示元素

- `#stockRefreshInfo` 顯示「最後刷新：HH:MM:SS｜開盤中 · 每 10 分鐘自動刷新」
- 休市時顯示「休市中 · 自動刷新已暫停」

## 8. 投資組合損益

```
marketVal = currentPrice × units    // currentPrice > 0 時；否則退回 cost
cost      = costPerUnit × units
pnl       = marketVal − cost
pnlPct    = pnl / cost × 100        // cost = 0 時為 0
```

即時股價來源：TWSE `mis.twse.com.tw` 經 CORS Proxy（`fetchTWSE()`）代理，任一 proxy 失敗自動切換下一個。

---

## 9. 資料結構（存放於 `DB`）

| 欄位 | 型態 | 說明 |
|------|------|------|
| `accounts` | 陣列 | 帳戶容器，`type ∈ {bank, cash, credit, receivable, payable, invest}` |
| `properties` | 陣列 | 不動產（獨立於帳戶） |
| `vehicles` | 陣列 | 動產（獨立於帳戶） |
| `receivables` | 陣列 | 應收/應付款**明細**（`type`, `date`, `dueDate`, `target`, `amount`, `currency`, `status`, `note`） |
| `incomes` | 陣列 | 收入明細 |
| `expenses` | 陣列 | 支出明細 |
| `portfolio` | 陣列 | 投資組合項目 |
| `watchStocks` | 陣列 | 追蹤股票代號 |

> **v1.8.2 資料模型一致化**：舊版 `accounts[type='receivable']` / `accounts[type='payable']` 帳戶在首次載入時自動移轉到 `receivables` 明細陣列，然後從帳戶清單移除。資產管理的「應收款」/「應付款」分頁也改為純粹的「追蹤」介面（統計卡+明細表，不再顯示帳戶表）。
>
> **v1.8.3 應收/應付款連動自動記帳**：`receivables[*]` 新增三個選填欄位：
> - `accountId`：選填。標記已收/已付時，這筆錢會實際存入/扣除的銀行或現金帳戶。
> - `paidIncomeId` / `paidExpenseId`：已結清時連結到 `d.incomes` / `d.expenses` 的紀錄 id。
> - `paidDate`：實際結清日期。
>
> 結清流程：
> 1. `markReceivablePaid(id)` 若 `accountId` 有值 → 建立 income/expense（類別「應收款入帳」/「應付款支付」）、更新帳戶餘額、寫回連結 id
> 2. `accountId` 為空 → 僅更新 status，不動帳戶也不產生金流紀錄
> 3. `deleteReceivable` 若有連結 id → 同步刪除關聯收/支並回補帳戶

---

## 10. 驗證範例

以 2026-04 範例資料：
- `cashAmt` = 50,000
- `bankAmt` = 1,200,000
- `rec` = 325,000
- `investAmt` = 500,000
- `propertyAmt` = 0
- `vehicleAmt` = 19,834
- `debt` = 13,737
- `pay` = 0
- `tI` = 700（1 筆）
- `tE` = 25,340（23 筆）

**存量**（v1.8.4 起投資歸流動）：
```
liquid     = 50,000 + 1,200,000 + 500,000 + 325,000  = 2,075,000
nonLiquid  = 0 + 19,834                              = 19,834
totalAsset = 2,075,000 + 19,834                      = 2,094,834  ✓
totalLiab  = 13,737 + 0                              = 13,737
netA       = 2,094,834 − 13,737                      = 2,081,097  ✓
```

**流量**：
```
saving = 700 − 25,340 = −24,640  ✓
```

**健康指標**：
```
debtRatio  = 13,737 / 2,094,834 × 100%    ≈ 0.66%      → 健康 ✓
savingRate = −24,640 / 700 × 100%         = −3,520%    → 警訊 ✕（本月嚴重入不敷出）
emMonths   = 2,075,000 / 25,340           ≈ 81.9 個月  → 健康 ✓  (投資歸流動後，緊急預備金可撐更久)
```

---

## 變更記錄

- **2026-04-17 v1.8.4**：
  - 投資（股票/基金/ETF）由「非流動資產」改歸「流動資產」，反映上市證券 T+2 可變現的性質
  - 流動資產 = 現金 + 銀行存款 + 投資 + 應收款；非流動資產 = 不動產 + 動產
  - 連帶影響：緊急預備金月數分母從 `liquid`（舊定義）變為新 `liquid`（多了投資），通常會更樂觀
  - 「快速支配資產」卡公式不變（銀行 + 現金 + 投資），意義改為「流動資產扣除應收款」
- **2026-04-17 v1.8.3**：
  - 應收/應付款 Modal 加回「收款/付款帳戶」欄位（僅列 bank/cash/invest 類型）
  - 點擊「標記已收款/已付款」自動在收入/支出新增紀錄並更新帳戶餘額（類別：應收款入帳 / 應付款支付）
  - 刪除已結清的應收/應付款時連動刪除關聯 income/expense 並還原帳戶餘額
  - 明細表新增「連動帳戶」欄位
- **2026-04-17 v1.8.2**：
  - 應收/應付款分頁 UI 改為「追蹤」模式：隱藏帳戶表格，只顯示統計卡 + 明細表
  - 一次性自動移轉舊 receivable/payable 帳戶 → 明細
  - 重寫拖拉排序，加入 getBoundingClientRect 上下半部判斷與索引位移修正
  - 雲端同步加入錯誤翻譯、自動重試、點擊重試
- **2026-04-17 v1.8.1**：
  - 新增「快速支配資產」卡（= 銀行存款 + 現金 + 投資）於財務健康指標區
  - 股票開盤時段（週一～五 09:00–13:30）自動每 10 分鐘刷新股價與投資組合市值，並在台股追蹤區顯示最後刷新時間與開盤狀態
  - 新增「↻ 手動刷新」按鈕，可隨時強制刷新
- **2026-04-17 v1.8.0**：
  - 資產總覽改用「個人財務三表」架構：資產負債表 + 收支儲蓄表 + 財務健康指標
  - 資產分類改以流動/非流動性區分（流動 = 現金+銀行+應收；非流動 = 投資+不動產+動產）
  - 新增三項財務健康指標（負債比率、儲蓄率、緊急預備金月數）含健康等級標色
  - **移除**應收/應付款明細的「帳戶」欄位與綁定功能；`markReceivablePaid` 不再自動調整帳戶餘額
  - 修正：「+ 新增應收款」按鈕在應付款分頁沒切換文字的 bug
- **2026-04-17 v1.7.3**：
  - 拆「總資產（含未收款）」為組成項，避免視覺重複
  - 修正資產分析頁的淨資產公式 bug
  - 股價 API 改走 CORS Proxy
