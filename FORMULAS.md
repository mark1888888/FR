# FlowRich 公式與數據定義

本文件整合 FlowRich 各頁面所用到的所有金額、統計、公式與欄位來源，作為前後端計算的唯一真實來源 (single source of truth)。每次公式調整都應同步更新此文件。

版本：v1.7.3 ｜更新：2026-04-17

---

## 1. 名詞與符號

| 符號 | 中文 | 定義 |
|------|------|------|
| `posAsset` | 正資產 | 自己擁有且可自由處分的資產 |
| `rec` | 未收款（應收帳款） | 別人尚未付給你的錢（狀態 `pending`） |
| `pay` | 應付款（應付帳款） | 你尚未付給別人的錢（狀態 `pending`） |
| `debt` | 負債（信用卡） | 信用卡已刷未繳金額 |
| `totalLiab` | 總負債 | `pay + debt` |
| `tA` | 總資產 | `posAsset + rec` |
| `netA` | 淨資產 (Net Worth) | `posAsset + rec − pay − debt` |
| `tI` | 期間收入 | 指定月份（或年/全部）的收入加總 |
| `tE` | 期間支出 | 指定月份（或年/全部）的支出加總 |
| `net` | 淨收支 | `tI − tE` |

所有金額皆透過 `convert(amount, from, to)` 換算成使用者選擇的顯示幣別再加總。

---

## 2. 正資產 `posAsset`

```
posAsset =
    Σ accounts[type ∈ {bank, cash, invest}].balance
  + Σ properties[*].currentValue        ← 不動產現值
  + Σ vehicles[*].currentValue          ← 動產現值
```

說明：
- `accounts.balance` 直接取欄位值。`bank`、`cash`、`invest` 三類視為正資產，匯率差異透過 `convert()` 換算。
- 不動產（`properties`）與動產（`vehicles`）取「當前價值」而非「購入價格」，用以反映增值/折舊後的真實資產。
- 信用卡（`credit`）不計入正資產，獨立在負債裡。
- 未收款、應付款也不計入 `posAsset`，它們走明細記錄（`d.receivables`）。

來源：`js/app.js` `renderDashboard()`、`renderAnalysis()`、`renderAssetAnalysisSection()`。

---

## 3. 未收款 `rec` 與應付款 `pay`

這兩個值**只**由 `d.receivables` 明細陣列推算，**不**使用 `accounts` 中型別為 `receivable` / `payable` 的帳戶餘額。帳戶僅作為分類/顯示用途。

```
rec = Σ receivables[type='receivable' ∧ status='pending'].amount
pay = Σ receivables[type='payable'    ∧ status='pending'].amount
```

- `status` 為 `paid` 的記錄不再計入（代表已結清）。
- 幣別同樣透過 `convert()` 統一。

---

## 4. 負債 `debt`

```
debt = Σ |accounts[type='credit'].balance|
```

取絕對值處理，無論信用卡欄位是以正數或負數記錄，都視為待繳金額。

---

## 5. 總資產、淨資產（三頁一致）

```
總資產  tA    = posAsset + rec
總負債  tLiab = pay + debt
淨資產  netA  = posAsset + rec − pay − debt
                ≡ tA − tLiab
```

**重要（v1.7.3 修正）**：之前 `renderAnalysis()` 的淨資產少算了 `rec` 和 `pay`，造成資產總覽與資產分析兩頁的淨資產不一致。現已統一為上式。

---

## 6. 期間收支

```
incF = filterByMonth(d.incomes,  month)   // 若 range=year 則 filterByRange
expF = filterByMonth(d.expenses, month)
tI   = Σ sumConverted(incF, 'amount', cur)
tE   = Σ sumConverted(expF, 'amount', cur)
net  = tI − tE
```

其中 `filterByMonth(list, 'YYYY-MM')` 比對 `item.date.slice(0,7)`，`month='all'` 時回傳全部。`sumConverted` 會對每筆 `convert(item.amount, item.currency, cur)` 再加總。

---

## 7. 資產總覽卡片對照表（v1.7.3 重新整理）

### 上區「資產狀況」（存量，4 張）

| # | 卡片 | 公式 | 對應欄位 |
|---|------|------|----------|
| 1 | 淨資產 | `posAsset + rec − pay − debt` | 副標「正資產 + 未收款 − 總負債」 |
| 2 | 正資產 | `posAsset` | 副標「銀行+現金+投資+不動產+動產」 |
| 3 | 未收款 | `rec` | 副標「應收帳款」 |
| 4 | 總負債 | `pay + debt` | 副標顯示應付款與信用卡拆分 |

三張組成卡的關係：**#1 = #2 + #3 − #4**，金額互不重疊，視覺上不會出現「同一筆錢被顯示兩次」。

### 下區「本月收支」（流量，3 張）

| # | 卡片 | 公式 |
|---|------|------|
| 5 | 收入 | `tI`（附筆數） |
| 6 | 支出 | `tE`（附筆數） |
| 7 | 淨收支 | `net = tI − tE` |

---

## 8. 資產分析頁卡片

資產分析頁保留細分視角，共 7 張卡：

| 卡片 | 公式 |
|------|------|
| 正資產 | `posAsset` |
| 淨資產 | `posAsset + rec − pay − debt`（修正後） |
| (期間) 收入 | `tI` |
| (期間) 支出 | `tE` |
| 負債（信用卡） | `debt`（附張數） |
| 未收款 | `rec`（附未收筆數） |
| 應付款 | `pay`（附未付筆數） |

注意：資產分析頁沒有「淨收支」「總資產」「總負債」三張卡，這是設計上的刻意區分 — 分析頁關注細項組成，總覽頁關注整體結構。

---

## 9. 匯率轉換

```
convert(amount, from, to) = amount ÷ rates[from] × rates[to]
```

- `rates.TWD` 恆為 1，其他幣別來自 `exchangerate-api.com/v4/latest/TWD`。
- 匯率載入失敗時回落到本地預設值（見 `rates` 物件初始化），因此即便離線也能運算。
- 防呆：`rates[from]` 為 `0` / `undefined` 時會回落為 `1`，避免除以零。

---

## 10. 投資組合損益

```
marketVal = currentPrice × units    // 若 currentPrice > 0，否則退回 cost
cost      = costPerUnit × units
pnl       = marketVal − cost
pnlPct    = pnl / cost × 100        // cost=0 時為 0
```

即時股價來源：TWSE `mis.twse.com.tw` 經 CORS Proxy 代理（`fetchTWSE()`），失敗時 `marketVal = cost`，損益顯示為 0 而非誤報虧損。

---

## 11. 資料結構對照（存放於 `DB`）

| 欄位 | 型態 | 說明 |
|------|------|------|
| `accounts` | 陣列 | 所有帳戶，`type ∈ {bank, cash, credit, receivable, payable, invest}` |
| `properties` | 陣列 | 不動產（獨立於帳戶） |
| `vehicles` | 陣列 | 動產（獨立於帳戶） |
| `receivables` | 陣列 | 未收款/應付款**明細**，欄位含 `type`, `amount`, `currency`, `status` |
| `incomes` | 陣列 | 收入明細 |
| `expenses` | 陣列 | 支出明細 |
| `portfolio` | 陣列 | 投資組合項目 |
| `watchStocks` | 陣列 | 追蹤股票代號 |

重要：`receivables` 是「明細記錄」陣列，而 `accounts` 中型別為 `receivable` / `payable` 的是「分類容器」。兩者概念分離，`rec` 與 `pay` 的加總**只**看前者。

---

## 12. 驗證範例

以截圖數據為例：
- `posAsset` = 1,769,834
- `rec` = 325,000
- `pay` = 0（假設）
- `debt` = 13,737
- `tI` = 700（1 筆）
- `tE` = 25,340（23 筆）

代入：
```
總資產  = 1,769,834 + 325,000 = 2,094,834  ✓
總負債  = 0 + 13,737           = 13,737
淨資產  = 1,769,834 + 325,000 − 0 − 13,737 = 2,081,097  ✓
淨收支  = 700 − 25,340 = −24,640  ✓
```

三個對照項目與截圖數字完全吻合。

---

## 變更記錄

- **2026-04-17 v1.7.3**：
  - 拆「總資產（含未收款）」為「正資產」+「未收款」兩張獨立卡片，避免視覺重複。
  - 新增「總負債」卡（應付款+信用卡）。
  - 資產總覽分成「資產狀況」與「本月收支」兩區，加入分區標題。
  - 修正 `renderAnalysis` 的淨資產公式：原本只算 `posAsset − debt`，漏了 `+ rec − pay`；現與資產總覽一致。
