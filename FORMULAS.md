# FlowRich 公式與數據定義

本文件整合 FlowRich 各頁面所用到的所有金額、統計、公式與欄位來源，作為前後端計算的唯一真實來源 (single source of truth)。每次公式調整都應同步更新此文件。

版本：v1.8.0 ｜更新：2026-04-17

設計原則：資產總覽採用「個人財務三表」架構 — **資產負債表（存量）**、**收支儲蓄表（流量）**、**財務健康指標**。

---

## 1. 名詞與符號

### 1.1 資產（依流動性分類）

| 符號 | 中文 | 組成 |
|------|------|------|
| `cashAmt` | 現金 | `accounts[type='cash'].balance` 加總 |
| `bankAmt` | 銀行存款 | `accounts[type='bank'].balance` 加總 |
| `rec` | 應收款 | `receivables[type='receivable' ∧ status='pending'].amount` 加總 |
| **`liquid`** | **流動資產** | `cashAmt + bankAmt + rec` |
| `investAmt` | 投資（股票/基金） | `accounts[type='invest'].balance` 加總 |
| `propertyAmt` | 不動產現值 | `properties[*].currentValue` 加總 |
| `vehicleAmt` | 動產現值 | `vehicles[*].currentValue` 加總 |
| **`nonLiquid`** | **非流動資產** | `investAmt + propertyAmt + vehicleAmt` |
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

### 2.2 流動性定義（參考財務會計教科書 + 國立清華大學出版社）

**流動資產**：一年內可轉為現金的資產
- 現金（`cash`）
- 銀行存款（`bank`）  
- 應收款（`receivable`，未收）

**非流動資產**：預計持有超過一年或難以即時變現
- 投資（`invest`，股票、基金、ETF）
- 不動產（`properties`，房屋/土地/商業用房/車位）
- 動產（`vehicles`，汽機車/船舶）

**備註**：嚴格會計上「上市股票/ETF」其實屬於流動（T+2 即可變現），但一般個人理財視作「非流動」以避免臨時變賣。FlowRich 採後者。若未來要細分，可將 `invest` 進一步拆為「短期投資」與「長期持有」。

### 2.3 資產總覽卡片對照（v1.8.0）

**第 1 區「資產負債表（存量）」— 4 張卡**

| # | 卡片 | 公式 | 副標 |
|---|------|------|------|
| 1 | 淨資產 | `totalAsset − totalLiab` | 總資產 − 總負債 |
| 2 | 流動資產 | `cashAmt + bankAmt + rec` | 顯示三者拆分 |
| 3 | 非流動資產 | `investAmt + propertyAmt + vehicleAmt` | 顯示三者拆分 |
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

### 4.4 尚未實作：貸款負擔比

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

## 7. 投資組合損益

```
marketVal = currentPrice × units    // currentPrice > 0 時；否則退回 cost
cost      = costPerUnit × units
pnl       = marketVal − cost
pnlPct    = pnl / cost × 100        // cost = 0 時為 0
```

即時股價來源：TWSE `mis.twse.com.tw` 經 CORS Proxy（`fetchTWSE()`）代理，任一 proxy 失敗自動切換下一個。

---

## 8. 資料結構（存放於 `DB`）

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

> **v1.8.0 移除**：`receivables[*].accountId`。應收/應付款不再綁定帳戶，標記已收/已付時**不再自動調整帳戶餘額**。如需同時記錄金流，請至「收入」/「支出」頁另行新增一筆對應的收/支紀錄。

---

## 9. 驗證範例

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

**存量**：
```
liquid     = 50,000 + 1,200,000 + 325,000            = 1,575,000
nonLiquid  = 500,000 + 0 + 19,834                    = 519,834
totalAsset = 1,575,000 + 519,834                     = 2,094,834  ✓
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
emMonths   = 1,575,000 / 25,340           ≈ 62.2 個月  → 健康 ✓
```

---

## 變更記錄

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
