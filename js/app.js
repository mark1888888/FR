// ============================================================
// FlowRich 記帳理財 - app.js
// 包含所有業務邏輯、Supabase 雲端同步、圖表繪製
// ============================================================

// ============ 圖示對照表 ============
const CAT_ICONS = {
  '薪資':'💰','獎金':'🏆','投資收益':'📈','兼職':'💼','利息':'🏦','其他收入':'💵',
  '餐飲':'🍽️','交通':'🚗','購物':'🛍️','娛樂':'🎮','醫療':'🏥','教育':'📚',
  '居住':'🏠','日用品':'🧴','通訊':'📱','保險':'🛡️','其他支出':'📋',
  '水電':'💡','旅遊':'✈️','寵物':'🐾','服飾':'👔','美容':'💇','健身':'🏋️',
  '捐款':'❤️','稅務':'📝','社交':'🤝','房租':'🔑','貸款':'💳','投資':'📊',
  '股利':'💹','租金收入':'🏢','退款':'🔄','禮金':'🎁','中獎':'🎰',
};
const ICON_OPTIONS = [
  '💰','💵','💴','💶','💷','🏆','📈','💼','🏦','💹','🏢','🔄','🎁','🎰',
  '🍽️','🍔','🍕','🍜','☕','🥗','🥤','🍻','🍰','🍎',
  '🚗','🚌','🚇','🚕','🚲','✈️','🚂','⛽','🚁','🛳️',
  '🛍️','👗','👔','👟','💄','💍','⌚','📱','💻','🖥️',
  '🎮','🎬','🎵','🎤','🎲','🎯','🎪','🎭','🎨','📷',
  '🏥','💊','🏋️','💪','🧘','🏊','🏃','⚽','🎾','🏀',
  '📚','✏️','🎓','🏫','👨‍🎓','📖','🔬','🧪',
  '🏠','🏡','🔑','💡','🛁','🔧','🧹','🧴','🧻',
  '📞','📡','💬','📮','🔔',
  '🛡️','⚖️','📝','📋','📊','💳','🏧','💱',
  '🐾','🐕','🐈','🐟','🐦','🐰',
  '💇','💅','💆','❤️','🤝','🎉','🎊','💒','👶',
  '🏖️','⛰️','🏕️','🎢','🗺️','🌍',
  '📌','⭐','✅','❌','⚡','🔥','💎','🌈','☀️','🌙'
];

/** 取得類別圖示，若找不到則根據關鍵字推測 */
function getIcon(cat) {
  if (DB && DB.categoryIcons && DB.categoryIcons[cat]) return DB.categoryIcons[cat];
  return CAT_ICONS[cat] || (
    cat.includes('餐') ? '🍽️' :
    cat.includes('交通') ? '🚗' :
    cat.includes('購') ? '🛍️' :
    cat.includes('醫') ? '🏥' :
    cat.includes('薪') ? '💰' : '📌'
  );
}

// ============ 常數 ============
const DEFAULT_INC_CATS = ['薪資','獎金','投資收益','兼職','利息','其他收入'];
const DEFAULT_EXP_CATS = ['餐飲','交通','購物','娛樂','醫療','教育','居住','日用品','通訊','保險','其他支出'];
const CURRENCIES = { TWD:'新台幣', USD:'美元', JPY:'日圓', EUR:'歐元', CNY:'人民幣', KRW:'韓元', HKD:'港幣' };
const ACCOUNT_TYPES = { bank:'銀行存款', cash:'現金', credit:'信用卡' };
const PROPERTY_TYPES = { house:'房屋', land:'土地', apartment:'公寓/大廈', commercial:'商業用房', parking:'車位', other_property:'其他不動產' };
const VEHICLE_TYPES = { car:'汽車', motorcycle:'機車', bicycle:'自行車', boat:'船舶', other_vehicle:'其他動產' };
const PIE_COLORS = ['#6c63ff','#00d2ff','#22c55e','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6','#f97316','#64748b','#a855f7','#06b6d4'];

let rates = { TWD:1, USD:0.0313, JPY:4.69, EUR:0.0289, CNY:0.2273, KRW:44.5, HKD:0.244 };
let DB = null, currentUser = '', currentUserId = '';

// ============ SUPABASE 初始化 ============
// 使用 var 避免與全域 supabase 衝突（Bug 4 修正）
const SUPABASE_URL = 'https://zdghqxxydlibgqvooesn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uyC2tpnAclYTKq2OQDBOkA_uBIq1X6N';
var _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============ 同步狀態顯示 ============
/** 確保 syncStatus 元素存在（若 HTML 中遺漏則自動建立） */
function ensureSyncStatusEl() {
  var el = document.getElementById('syncStatus');
  if (!el) {
    el = document.createElement('div');
    el.id = 'syncStatus';
    el.className = 'sync-status';
    document.body.appendChild(el);
  }
  return el;
}

/** 顯示同步狀態訊息；錯誤時點擊元素可立即重試。 */
function showSync(msg, type) {
  var el = ensureSyncStatusEl();
  el.textContent = msg + (type === 'err' ? '｜點此重試' : '');
  el.className = 'sync-status sync-' + type;
  el.style.cursor = (type === 'err') ? 'pointer' : '';
  el.onclick = (type === 'err') ? function() {
    el.textContent = '重新同步中...';
    cloudSave();
  } : null;
  if (type === 'ok') {
    setTimeout(function() { el.classList.add('sync-hide'); }, 2000);
  }
}

// ============ 預設使用者資料 ============
function defaultUserData() {
  return {
    incomeCategories: [...DEFAULT_INC_CATS],
    expenseCategories: [...DEFAULT_EXP_CATS],
    accounts: [],
    incomes: [],
    expenses: [],
    transfers: [],
    watchStocks: ['2330','2317','2454'],
    categoryIcons: {},
    subCategories: {},   // { '教育': ['學費','午餐費','多元課程費'], '餐飲': ['外食','飲料'] }
    receivables: [],     // 應收款記錄
    portfolio: [],       // 投資組合 { id, type:'stock'|'fund'|'other', code, name, costPerUnit, units, currency, note }
    properties: [],      // 不動產 { id, subType, name, address, purchaseDate, purchasePrice, currentValue, currency, note }
    vehicles: [],        // 動產   { id, subType, name, brand, model, purchaseDate, purchasePrice, currentValue, currency, note }
    // v1.8.6 財務規劃模組
    projects: [],        // 專案標籤 { id, name, emoji, color, status:'active'|'closed', startDate, endDate, budget, currency, note }
    recurring: [],       // 定期收/支 { id, type:'income'|'expense', name, amount, currency, category, accountId, dayOfMonth, note, active, lastGenerated:'YYYY-MM' }
    savingsGoals: [],    // 儲蓄目標 { id, name, emoji, targetAmount, currency, deadline, startDate, monthlyTarget, note, status:'active'|'done' }
    taxProfile: null,    // 稅務設定 { annualIncome, deductions, dividendIncome, filingStatus }
    // v1.9.0 財務成長模組（遊戲化）
    achievements: {},    // { achievementId: { unlockedAt, data } }
    personality: null,   // { type, score, updatedAt }
    updated_at: new Date().toISOString()
  };
}

// ============ 本地快取 ============
function saveLocal() {
  if (!DB || !currentUserId) return;
  localStorage.setItem('flowrich_user_' + currentUserId, JSON.stringify(DB));
}
function loadLocal() {
  var d = localStorage.getItem('flowrich_user_' + currentUserId);
  if (d) {
    DB = JSON.parse(d);
    return true;
  }
  return false;
}

// ============ 雲端同步（即時上傳，不再 debounce） ============

/** 儲存（先存本地，再立即存雲端） */
function save() {
  if (DB) {
    DB.updated_at = new Date().toISOString();
  }
  saveLocal();
  cloudSave(); // 每次修改立即上傳
}

/** 雲端儲存（v1.8.2 加入錯誤診斷與重試） */
var _cloudSaveInFlight = false;

/** 將 Supabase error 物件格式化為人可讀的簡短訊息。 */
function _formatCloudError(e) {
  if (!e) return '未知錯誤';
  // Supabase 常見錯誤
  var code = e.code || e.statusCode || '';
  var msg = e.message || e.msg || String(e);
  if (/JWT|token|401/i.test(msg) || code === '401') return '登入逾期，請重新登入';
  if (/permission|denied|403|RLS/i.test(msg)) return '權限不足（RLS 政策）';
  if (/fetch|network|Failed to fetch|NetworkError/i.test(msg)) return '網路連線異常';
  if (/too large|payload|size|413/i.test(msg) || code === '413') return '資料超過雲端單次上傳上限';
  if (/duplicate|conflict|23505/i.test(msg)) return '資料衝突';
  if (/timeout|timed out/i.test(msg)) return '雲端回應逾時';
  // 兜底：取前 80 字
  return msg.slice(0, 80);
}

async function cloudSave(attempt) {
  if (!currentUserId || !DB) return;
  if (_cloudSaveInFlight) return; // 避免同時多次上傳
  _cloudSaveInFlight = true;
  attempt = attempt || 1;
  showSync('儲存中...', 'saving');
  try {
    DB.updated_at = new Date().toISOString();
    saveLocal();

    var result = await _sb.from('user_data').upsert(
      { user_id: currentUserId, data: DB },
      { onConflict: 'user_id' }
    );
    if (result.error) throw result.error;
    showSync('已同步至雲端 ✓', 'ok');
    _cloudSaveInFlight = false;
  } catch (e) {
    _cloudSaveInFlight = false;
    console.error('Cloud save error (attempt ' + attempt + '):', e);
    var reason = _formatCloudError(e);

    // 網路或逾時類錯誤：最多重試 2 次（指數退避 1s → 3s）
    var retriable = /網路連線異常|雲端回應逾時/.test(reason);
    if (retriable && attempt < 3) {
      showSync('同步失敗（' + reason + '），' + Math.pow(2, attempt) + ' 秒後重試 (' + attempt + '/2)...', 'err');
      setTimeout(function() { cloudSave(attempt + 1); }, attempt * 2000);
      return;
    }
    showSync('雲端同步失敗（已存本地）：' + reason, 'err');
  }
}

/** 雲端載入（Bug 1 修正：比較 updated_at，使用較新的資料） */
async function cloudLoad() {
  if (!currentUserId) return false;
  try {
    var result = await _sb.from('user_data').select('data').eq('user_id', currentUserId).maybeSingle();
    if (result.error) throw result.error;
    if (result.data && result.data.data) {
      var cloudData = result.data.data;
      var cloudTime = cloudData.updated_at || '1970-01-01T00:00:00.000Z';
      var localTime = (DB && DB.updated_at) ? DB.updated_at : '1970-01-01T00:00:00.000Z';

      // 比較雲端與本地的時間戳，使用較新的
      if (!DB || cloudTime >= localTime) {
        DB = cloudData;
        saveLocal();
        return true;
      } else {
        // 本地較新，保留本地資料但仍回傳 true 表示已載入
        return true;
      }
    }
  } catch (e) {
    console.error('Cloud load error:', e);
  }
  return false;
}

// ============ 單一裝置登入機制 ============
var _localSessionId = '';
var _syncInterval = null;
var _sessionCheckInterval = null;

/** 產生隨機 session ID */
function generateSessionId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** 將 session ID 寫入雲端 */
async function registerSession() {
  _localSessionId = generateSessionId();
  if (DB) {
    DB._activeSessionId = _localSessionId;
    DB.updated_at = new Date().toISOString();
    saveLocal();
    await cloudSave();
  }
}

/** 定期檢查 session 是否仍有效（每 10 秒） */
function startSessionCheck() {
  if (_sessionCheckInterval) clearInterval(_sessionCheckInterval);
  _sessionCheckInterval = setInterval(async function() {
    if (!currentUserId || !_localSessionId) return;
    try {
      var result = await _sb.from('user_data').select('data').eq('user_id', currentUserId).maybeSingle();
      if (result.error || !result.data) return;
      if (result.data.data) {
        var cloudSessionId = result.data.data._activeSessionId || '';
        if (cloudSessionId && cloudSessionId !== _localSessionId) {
          // 另一台裝置已登入，強制登出
          clearInterval(_sessionCheckInterval);
          if (_syncInterval) clearInterval(_syncInterval);
          alert('您的帳號已在其他裝置登入，此裝置將自動登出。');
          forceLogout();
        }
      }
    } catch (e) {
      // 靜默失敗
    }
  }, 10000);
}

/** 強制登出（不清雲端 session） */
async function forceLogout() {
  if (_syncInterval) clearInterval(_syncInterval);
  if (_sessionCheckInterval) clearInterval(_sessionCheckInterval);
  _localSessionId = '';
  await _sb.auth.signOut();
  currentUser = '';
  currentUserId = '';
  DB = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginOverlay').style.display = 'flex';
  showLogin();
}

/** 定期同步檢查（每 30 秒）+ 重新渲染頁面 */
function startPeriodicSync() {
  if (_syncInterval) clearInterval(_syncInterval);
  _syncInterval = setInterval(async function() {
    if (!currentUserId || !DB) return;
    try {
      var result = await _sb.from('user_data').select('data').eq('user_id', currentUserId).maybeSingle();
      if (result.error || !result.data) return;
      if (result.data.data) {
        var cloudData = result.data.data;
        var cloudTime = cloudData.updated_at || '1970-01-01T00:00:00.000Z';
        var localTime = DB.updated_at || '1970-01-01T00:00:00.000Z';
        if (cloudTime > localTime) {
          // 保留本地 session ID
          var mySession = _localSessionId;
          DB = cloudData;
          DB._activeSessionId = mySession;
          saveLocal();
          showSync('已從雲端同步最新資料 ✓', 'ok');
          rerenderActivePage();
        }
      }
    } catch (e) {
      // 靜默失敗
    }
  }, 30000);
}

/** 重新渲染當前頁面 */
function rerenderActivePage() {
  var ap = document.querySelector('.page.active');
  if (ap) {
    var pageId = ap.id.replace('page-', '');
    var renders = {
      dashboard: renderDashboard,
      income: renderIncome,
      expense: renderExpense,
      assets: renderAssets,
      analysis: renderAnalysis,
      invest: renderInvest,
      planning: renderPlanning,
      growth: renderGrowth
    };
    if (renders[pageId]) renders[pageId]();
  }
}

/** 頁面可見性變更時同步 */
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && currentUserId && DB) {
    cloudLoad().then(function(loaded) {
      if (loaded) rerenderActivePage();
    });
  }
});

var _legacyMigrated = false;

/** v1.8.2 一次性資料移轉：將舊版「應收款帳戶」/「應付款帳戶」(type=receivable/payable) 轉成應收/應付款明細。
 *  新架構以 d.receivables 明細為主，不再使用帳戶型別 receivable/payable。 */
function _migrateLegacyReceivablePayableAccounts() {
  if (!DB || !DB.accounts) return false;
  var legacy = DB.accounts.filter(function(a) {
    return a.type === 'receivable' || a.type === 'payable';
  });
  if (legacy.length === 0) return false;

  if (!DB.receivables) DB.receivables = [];
  var today = new Date().toISOString().slice(0, 10);

  legacy.forEach(function(a) {
    var amount = Math.abs(Number(a.balance) || 0);
    if (amount <= 0) return;   // 空餘額帳戶不建立明細
    DB.receivables.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '_mig',
      type: a.type,
      date: today,
      dueDate: '',
      target: a.name || (a.type === 'receivable' ? '（舊應收款）' : '（舊應付款）'),
      amount: amount,
      currency: a.currency || 'TWD',
      note: (a.note ? a.note + '｜' : '') + '自舊帳戶移轉',
      status: 'pending'
    });
  });

  DB.accounts = DB.accounts.filter(function(a) {
    return a.type !== 'receivable' && a.type !== 'payable';
  });
  console.log('[FlowRich] 已自動移轉 ' + legacy.length + ' 筆舊 receivable/payable 帳戶為明細');
  return true;
}

/** v1.8.5 一次性資料移轉：完全移除 type='invest' 舊帳戶，改以 d.portfolio 投資組合為唯一投資資產來源。 */
function _removeLegacyInvestAccounts() {
  if (!DB || !DB.accounts) return false;
  var legacy = DB.accounts.filter(function(a) { return a.type === 'invest'; });
  if (legacy.length === 0) return false;
  console.warn('[FlowRich v1.8.5] 完全移除', legacy.length, '筆舊 invest 帳戶：',
    legacy.map(function(a) { return a.name + '（' + a.currency + ' ' + a.balance + '）'; }).join(', '));
  DB.accounts = DB.accounts.filter(function(a) { return a.type !== 'invest'; });
  return true;
}

/** 取得資料並確保各欄位預設值存在；首次存取觸發一次性資料移轉。 */
function U() {
  if (!DB.watchStocks) DB.watchStocks = ['2330','2317','2454'];
  if (!DB.categoryIcons) DB.categoryIcons = {};
  if (!DB.transfers) DB.transfers = [];
  if (!DB.receivables) DB.receivables = [];
  if (!DB.portfolio) DB.portfolio = [];
  if (!DB.projects) DB.projects = [];
  if (!DB.recurring) DB.recurring = [];
  if (!DB.savingsGoals) DB.savingsGoals = [];
  if (!DB.achievements) DB.achievements = {};
  if (!DB.updated_at) DB.updated_at = new Date().toISOString();
  if (!_legacyMigrated) {
    _legacyMigrated = true;
    var a = _migrateLegacyReceivablePayableAccounts();
    var b = _removeLegacyInvestAccounts();
    if (a || b) save();
  }
  return DB;
}

// ============ 主題切換 ============
function toggleTheme() {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('flowrich_theme',
    document.documentElement.classList.contains('light') ? 'light' : 'dark'
  );
  var ap = document.querySelector('.page.active');
  if (ap) {
    var id = ap.id.replace('page-', '');
    var r = { dashboard: renderDashboard, analysis: renderAnalysis };
    if (r[id]) r[id]();
  }
}
function loadTheme() {
  if (localStorage.getItem('flowrich_theme') === 'light') {
    document.documentElement.classList.add('light');
  }
}
loadTheme();

// ============ 登入/註冊 ============
function showLoginError(m) {
  var e = document.getElementById('loginError');
  e.textContent = m;
  e.style.display = 'block';
}
function showRegisterError(m) {
  var e = document.getElementById('registerError');
  e.textContent = m;
  e.style.display = 'block';
}
function showRegister() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('registerView').style.display = 'block';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('registerError').style.display = 'none';
}
function showLogin() {
  document.getElementById('registerView').style.display = 'none';
  document.getElementById('loginView').style.display = 'block';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('registerError').style.display = 'none';
}

async function doLogin() {
  var email = document.getElementById('loginUser').value.trim();
  var pwd = document.getElementById('loginPwd').value;
  if (!email || !pwd) { showLoginError('請輸入 Email 和密碼'); return; }
  showLoginError('登入中...');
  document.getElementById('loginError').style.display = 'block';
  document.getElementById('loginError').style.color = 'var(--text3)';
  try {
    var result = await _sb.auth.signInWithPassword({ email: email, password: pwd });
    if (result.error) throw result.error;
    currentUserId = result.data.user.id;
    currentUser = result.data.user.email;
    // 先嘗試載入本地，再從雲端比對
    loadLocal();
    var loaded = await cloudLoad();
    if (!loaded && !DB) { initNewUser(); }
    // 註冊此裝置的 session（強制其他裝置登出）
    await registerSession();
    enterApp();
  } catch (e) {
    document.getElementById('loginError').style.color = 'var(--red)';
    showLoginError(e.message === 'Invalid login credentials' ? 'Email 或密碼錯誤' : e.message);
  }
}

async function doSetup() {
  var email = document.getElementById('newUser').value.trim();
  var p1 = document.getElementById('newPwd').value;
  var p2 = document.getElementById('confirmPwd').value;
  if (!email) { showRegisterError('請輸入 Email'); return; }
  if (!p1 || p1.length < 6) { showRegisterError('密碼至少 6 位'); return; }
  if (p1 !== p2) { showRegisterError('兩次密碼不一致'); return; }
  showRegisterError('註冊中...');
  document.getElementById('registerError').style.display = 'block';
  document.getElementById('registerError').style.color = 'var(--text3)';
  try {
    var result = await _sb.auth.signUp({ email: email, password: p1 });
    if (result.error) throw result.error;
    if (result.data.user && !result.data.session) {
      showRegisterError('請查收 Email 確認信後再登入');
      document.getElementById('registerError').style.color = 'var(--green)';
      return;
    }
    currentUserId = result.data.user.id;
    currentUser = result.data.user.email;
    initNewUser();
    await registerSession();
    enterApp();
  } catch (e) {
    document.getElementById('registerError').style.color = 'var(--red)';
    showRegisterError(e.message === 'User already registered' ? '此 Email 已註冊' : e.message);
  }
}

/** 初始化新使用者資料 */
function initNewUser() {
  DB = defaultUserData();
  DB.accounts.push({
    id: genId(), name: '主要銀行', type: 'bank', institution: '',
    currency: 'TWD', balance: 0, note: '', createdAt: new Date().toISOString()
  });
  DB.accounts.push({
    id: genId(), name: '現金', type: 'cash', institution: '',
    currency: 'TWD', balance: 0, note: '', createdAt: new Date().toISOString()
  });
  saveLocal();
}

/** 進入主應用畫面 */
function enterApp() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('sidebarUser').textContent = currentUser;
  var se = document.getElementById('settingsEmail');
  if (se) se.textContent = currentUser;
  initMonthSelectors();
  fetchRates();
  renderDashboard();
  loadCategories();
  startPeriodicSync();
  startSessionCheck(); // 啟動單一裝置檢查
}

async function doLogout() {
  if (_syncInterval) clearInterval(_syncInterval);
  if (_sessionCheckInterval) clearInterval(_sessionCheckInterval);
  _localSessionId = '';
  await _sb.auth.signOut();
  currentUser = '';
  currentUserId = '';
  DB = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginOverlay').style.display = 'flex';
  showLogin();
}

// ============ 工具函式 ============
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmt(n, cur) {
  cur = cur || 'TWD';
  var sym = { TWD:'NT$', USD:'$', JPY:'¥', EUR:'€', CNY:'¥' }[cur] || '';
  var noDecimal = cur === 'TWD' || cur === 'JPY';
  return sym + Number(n).toLocaleString('en', {
    minimumFractionDigits: noDecimal ? 0 : 2,
    maximumFractionDigits: noDecimal ? 0 : 2
  });
}

function convert(amount, from, to) {
  amount = Number(amount) || 0;
  if (from === to) return amount;
  return (amount / (rates[from] || 1)) * (rates[to] || 1);
}

function getMonth(ds) { return ds.slice(0, 7); }
function getYear(ds) { return ds.slice(0, 4); }

function initMonthSelectors() {
  var months = [], now = new Date();
  var curY = now.getFullYear(), curM = now.getMonth();
  var cur = curY + '-' + (curM + 1 < 10 ? '0' : '') + (curM + 1);
  // 最新月份排在最上面
  for (var i = 0; i <= 11; i++) {
    var y2 = new Date(curY, curM - i, 1);
    var mm = y2.getFullYear() + '-' + ((y2.getMonth() + 1) < 10 ? '0' : '') + (y2.getMonth() + 1);
    months.push(mm);
  }
  ['dashMonth','incMonth','expMonth','anaMonth','tfMonth'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="all">全部月份</option>' +
      months.map(function(m) {
        return '<option value="' + m + '"' + (m === cur ? ' selected' : '') + '>' + m + '</option>';
      }).join('');
  });
  var years = [];
  for (var j = 0; j < 5; j++) years.push((curY - j).toString());
  ['incYear','expYear','anaYear','tfYear'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = years.map(function(y) {
      return '<option value="' + y + '"' + (y === curY.toString() ? ' selected' : '') + '>' + y + ' 年</option>';
    }).join('');
  });
}

function updateIncSel() {
  var r = document.getElementById('incRange').value;
  document.getElementById('incMonth').style.display = r === 'month' ? '' : 'none';
  document.getElementById('incYear').style.display = r === 'year' ? '' : 'none';
}
function updateExpSel() {
  var r = document.getElementById('expRange').value;
  document.getElementById('expMonth').style.display = r === 'month' ? '' : 'none';
  document.getElementById('expYear').style.display = r === 'year' ? '' : 'none';
}
function updateAnaSel() {
  var r = document.getElementById('anaRange').value;
  document.getElementById('anaMonth').style.display = r === 'month' ? '' : 'none';
  document.getElementById('anaYear').style.display = r === 'year' ? '' : 'none';
}

function filterByRange(list, range, month, year) {
  if (range === 'all') return [...list];
  if (range === 'year') return list.filter(function(i) { return getYear(i.date) === year; });
  if (month === 'all') return [...list];
  return list.filter(function(i) { return getMonth(i.date) === month; });
}

function filterByMonth(list, month) {
  return month === 'all' ? [...list] : list.filter(function(item) { return getMonth(item.date) === month; });
}
function sumConverted(list, field, toCur) {
  return list.reduce(function(s, item) { return s + convert(item[field], item.currency, toCur); }, 0);
}

// ============ 匯率 ============
async function fetchRates() {
  try {
    var r = await fetch('https://api.exchangerate-api.com/v4/latest/TWD');
    var d = await r.json();
    if (d.rates) {
      rates.TWD = 1;
      rates.USD = d.rates.USD;
      rates.JPY = d.rates.JPY;
      rates.EUR = d.rates.EUR;
      rates.CNY = d.rates.CNY;
      if (d.rates.KRW) rates.KRW = d.rates.KRW;
      if (d.rates.HKD) rates.HKD = d.rates.HKD;
    }
  } catch (e) { /* 靜默處理 */ }
  renderRateTable();
  doConvert();
}

function renderRateTable() {
  var tb = document.getElementById('rateTable');
  if (!tb) return;
  tb.innerHTML = Object.entries(CURRENCIES).map(function(entry) {
    return '<tr><td><strong>' + entry[0] + '</strong></td><td>' +
      rates[entry[0]].toFixed(6) + '</td><td>' + entry[1] + '</td></tr>';
  }).join('');
  var info = document.getElementById('rateInfo');
  if (info) info.textContent = '匯率來源: exchangerate-api.com｜' + new Date().toLocaleString('zh-TW');
}

// ============ 頁面切換（含底部導航同步） ============
function switchPage(page) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('page-' + page).classList.add('active');
  // 同步側邊欄
  document.querySelectorAll('.nav-item').forEach(function(n) {
    n.classList.toggle('active', n.dataset.page === page);
  });
  // 同步底部導航
  document.querySelectorAll('.bottom-nav-item').forEach(function(n) {
    n.classList.toggle('active', n.dataset.page === page);
  });
  var renders = {
    dashboard: renderDashboard,
    income: renderIncome,
    expense: renderExpense,
    assets: renderAssets,
    transfer: renderTransfer,
    analysis: renderAnalysis,
    invest: renderInvest,
    planning: renderPlanning,
    growth: renderGrowth
  };
  if (renders[page]) renders[page]();
}

// ============ 總覽 (Dashboard) ============

/** 依閾值表回傳顏色等級與評語。
 *  higherIsBetter=false: 值越低越好（如負債比率）。true: 值越高越好（如儲蓄率）。
 *  thresholds: [good, warn] — 依 higherIsBetter 方向分區。
 */
function _healthLevel(val, thresholds, higherIsBetter) {
  if (!isFinite(val)) return { cls: 'c-green', tip: '充足', icon: '✓' };
  var good = thresholds[0], warn = thresholds[1];
  if (higherIsBetter) {
    if (val >= good) return { cls: 'c-green', tip: '健康', icon: '✓' };
    if (val >= warn) return { cls: 'c-orange', tip: '尚可', icon: '!' };
    return { cls: 'c-red', tip: '警訊', icon: '✕' };
  } else {
    if (val <= good) return { cls: 'c-green', tip: '健康', icon: '✓' };
    if (val <= warn) return { cls: 'c-orange', tip: '注意', icon: '!' };
    return { cls: 'c-red', tip: '警訊', icon: '✕' };
  }
}

/** 產生財務健康指標卡片 HTML。依現有資料可算 3 項：負債比率、儲蓄率、緊急預備金月數。 */
function renderHealthCards(v) {
  // 負債比率 = 總負債 / 總資產（越低越好，建議 < 40%）
  var debtRatio = v.totalAsset > 0 ? (v.totalLiab / v.totalAsset) * 100 : 0;
  var dLv = _healthLevel(debtRatio, [40, 60], false);
  var debtRatioStr = v.totalAsset > 0 ? debtRatio.toFixed(1) + '%' : '--';

  // 儲蓄率 = 儲蓄 / 收入（越高越好，建議 ≥ 20%，至少 10%）
  var savingRate = v.income > 0 ? (v.saving / v.income) * 100 : null;
  var sLv = savingRate === null
    ? { cls: 'c-muted', tip: '本月無收入', icon: '—' }
    : _healthLevel(savingRate, [20, 10], true);
  var savingRateStr = savingRate === null ? '--' : savingRate.toFixed(1) + '%';

  // 緊急預備金月數 = 流動資產 / 本月支出（建議 3-6 個月）
  var emMonths = v.monthExp > 0 ? v.liquid / v.monthExp : (v.liquid > 0 ? Infinity : 0);
  var eLv = _healthLevel(emMonths, [6, 3], true);
  var emStr = v.monthExp > 0 ? emMonths.toFixed(1) + ' 個月' : (v.liquid > 0 ? '∞ 本月無支出' : '0 個月');

  // 快速支配資產卡（金額，非比率，無等級評分）
  var qdCard = '';
  if (typeof v.quickDisposable === 'number') {
    qdCard =
      '<div class="stat-card"><div class="label">快速支配資產</div>' +
        '<div class="value c-blue">' + fmt(v.quickDisposable, v.cur) + '</div>' +
        '<div class="sub">銀行 ' + fmt(v.bankAmt, v.cur) + ' + 現金 ' + fmt(v.cashAmt, v.cur) + ' + 投資 ' + fmt(v.investAmt, v.cur) + '</div></div>';
  }

  // 生存天數卡：不增加收入的情況下還能撐幾天
  var survivalCard = '';
  if (v.cur) {
    var sv = computeSurvivalDays(v.cur);
    var daysStr = isFinite(sv.days) ? Math.floor(sv.days) + ' 天' : '∞ 無近 3 月支出';
    var svLv = isFinite(sv.days) ? _healthLevel(sv.days, [180, 90], true) : { cls: 'c-green', tip: '健康', icon: '✓' };
    survivalCard =
      '<div class="stat-card"><div class="label">生存天數</div>' +
        '<div class="value ' + svLv.cls + '">' + daysStr + ' <span style="font-size:14px">' + svLv.icon + '</span></div>' +
        '<div class="sub">快速支配 ÷ 近 3 月平均月支出｜標準 ≥ 180 天｜' + svLv.tip + '</div></div>';
  }

  return (
    '<div class="stat-card"><div class="label">負債比率</div>' +
      '<div class="value ' + dLv.cls + '">' + debtRatioStr + ' <span style="font-size:14px">' + dLv.icon + '</span></div>' +
      '<div class="sub">總負債 ÷ 總資產｜標準 &lt; 40%｜' + dLv.tip + '</div></div>' +
    '<div class="stat-card"><div class="label">儲蓄率</div>' +
      '<div class="value ' + sLv.cls + '">' + savingRateStr + ' <span style="font-size:14px">' + sLv.icon + '</span></div>' +
      '<div class="sub">本月儲蓄 ÷ 本月收入｜標準 ≥ 20%｜' + sLv.tip + '</div></div>' +
    '<div class="stat-card"><div class="label">緊急預備金</div>' +
      '<div class="value ' + eLv.cls + '">' + emStr + ' <span style="font-size:14px">' + eLv.icon + '</span></div>' +
      '<div class="sub">流動資產 ÷ 本月支出｜標準 3–6 個月｜' + eLv.tip + '</div></div>' +
    qdCard +
    survivalCard
  );
}

function renderDashboard() {
  var d = U();
  var month = document.getElementById('dashMonth').value;
  var cur = document.getElementById('dashCurrency').value;
  var inc = filterByMonth(d.incomes, month);
  var exp = filterByMonth(d.expenses, month);
  var tI = sumConverted(inc, 'amount', cur);
  var tE = sumConverted(exp, 'amount', cur);
  var net = tI - tE;

  // ======== 資產負債表：按流動性分類 ========
  // 流動資產 = 現金 + 銀行存款 + 投資 + 應收款
  //   （投資：股票/基金/ETF T+2 內可變現，視為流動資產）
  var cashAmt = d.accounts.filter(function(a) { return a.type === 'cash'; })
    .reduce(function(s, a) { return s + convert(a.balance, a.currency, cur); }, 0);
  var bankAmt = d.accounts.filter(function(a) { return a.type === 'bank'; })
    .reduce(function(s, a) { return s + convert(a.balance, a.currency, cur); }, 0);
  // 投資金額來自投資組合總市值（d.portfolio），不再使用 type='invest' 帳戶
  var investAmt = portfolioMarketValue(cur);
  var rec = (d.receivables || []).filter(function(r) { return r.type === 'receivable' && r.status === 'pending'; })
    .reduce(function(s, r) { return s + convert(r.amount, r.currency, cur); }, 0);
  var liquid = cashAmt + bankAmt + investAmt + rec;

  // 非流動資產 = 不動產現值 + 動產現值
  var propertyAmt = (d.properties || []).reduce(function(s, p) { return s + convert(p.currentValue || 0, p.currency || 'TWD', cur); }, 0);
  var vehicleAmt = (d.vehicles || []).reduce(function(s, v) { return s + convert(v.currentValue || 0, v.currency || 'TWD', cur); }, 0);
  var nonLiquid = propertyAmt + vehicleAmt;

  // 負債 = 信用卡 + 應付款
  var debt = d.accounts.filter(function(a) { return a.type === 'credit'; })
    .reduce(function(s, a) { return s + convert(Math.abs(a.balance), a.currency, cur); }, 0);
  var pay = (d.receivables || []).filter(function(r) { return r.type === 'payable' && r.status === 'pending'; })
    .reduce(function(s, r) { return s + convert(r.amount, r.currency, cur); }, 0);
  var totalLiab = debt + pay;

  var totalAsset = liquid + nonLiquid;
  var netA = totalAsset - totalLiab;  // 淨資產 = 總資產 − 總負債

  // ======== 第 1 區：資產負債表（存量）— 4 張卡 ========
  document.getElementById('dashStatsAssets').innerHTML =
    '<div class="stat-card"><div class="label">淨資產</div><div class="value c-primary">' + fmt(netA, cur) + '</div><div class="sub">總資產 − 總負債</div></div>' +
    '<div class="stat-card"><div class="label">流動資產</div><div class="value c-blue">' + fmt(liquid, cur) + '</div><div class="sub">現金 ' + fmt(cashAmt, cur) + ' + 銀行 ' + fmt(bankAmt, cur) + ' + 投資 ' + fmt(investAmt, cur) + ' + 應收 ' + fmt(rec, cur) + '</div></div>' +
    '<div class="stat-card"><div class="label">非流動資產</div><div class="value c-blue">' + fmt(nonLiquid, cur) + '</div><div class="sub">不動產 ' + fmt(propertyAmt, cur) + ' + 動產 ' + fmt(vehicleAmt, cur) + '</div></div>' +
    '<div class="stat-card"><div class="label">總負債</div><div class="value c-red">' + fmt(totalLiab, cur) + '</div><div class="sub">信用卡 ' + fmt(debt, cur) + ' + 應付款 ' + fmt(pay, cur) + '</div></div>';

  // ======== 第 2 區：收支儲蓄表（流量）— 3 張卡 ========
  document.getElementById('dashStatsFlow').innerHTML =
    '<div class="stat-card"><div class="label">收入</div><div class="value c-green">' + fmt(tI, cur) + '</div><div class="sub">' + inc.length + ' 筆</div></div>' +
    '<div class="stat-card"><div class="label">支出</div><div class="value c-red">' + fmt(tE, cur) + '</div><div class="sub">' + exp.length + ' 筆</div></div>' +
    '<div class="stat-card"><div class="label">儲蓄（淨收支）</div><div class="value ' + (net >= 0 ? 'c-green' : 'c-red') + '">' + (net >= 0 ? '+' : '') + fmt(net, cur) + '</div><div class="sub">收入 − 支出</div></div>';

  // ======== 第 3 區：財務健康指標 ========
  // 快速支配資產 = 銀行 + 現金 + 投資（一般情況下 T+2 內可變現的資產）
  var quickDisposable = bankAmt + cashAmt + investAmt;
  document.getElementById('dashStatsHealth').innerHTML = renderHealthCards({
    totalAsset: totalAsset, totalLiab: totalLiab,
    income: tI, saving: net, liquid: liquid, monthExp: tE,
    quickDisposable: quickDisposable, bankAmt: bankAmt, cashAmt: cashAmt, investAmt: investAmt, cur: cur
  });

  // 最近交易
  var all = [
    ...inc.map(function(i) { return Object.assign({}, i, { _t: 'inc' }); }),
    ...exp.map(function(e) { return Object.assign({}, e, { _t: 'exp' }); })
  ].sort(function(a, b) { return b.date.localeCompare(a.date); }).slice(0, 10);

  document.getElementById('dashRecent').innerHTML = all.length ? all.map(function(t) {
    var ac = d.accounts.find(function(a) { return a.id === t.accountId; });
    var objStr = (t.payTo || t.usedBy) ? ((t.payTo || '') + (t.payTo && t.usedBy ? '/' : '') + (t.usedBy || '')) : '-';
    return '<tr><td>' + t.date + '</td><td><span class="tag ' +
      (t._t === 'inc' ? 'tag-green' : 'tag-red') + '">' +
      (t._t === 'inc' ? '收入' : '支出') + '</span></td><td><span class="cat-icon">' +
      getIcon(t.category) + '</span>' + t.category + '</td><td>' +
      (t.note || '-') + '</td><td>' + objStr + '</td><td style="font-weight:600" class="' +
      (t._t === 'inc' ? 'c-green' : 'c-red') + '">' +
      (t._t === 'inc' ? '+' : '\u2212') + fmt(t.amount, t.currency) +
      '</td><td>' + (ac ? ac.name : '-') + '</td></tr>';
  }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">尚無交易記錄</td></tr>';

  drawDashChart(month, cur);
  renderAssetAnalysisSection();
}

function drawDashChart(month, cur) {
  var canvas = document.getElementById('dashChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth - 40;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var d = U();
  var tm = month === 'all' ? new Date().toISOString().slice(0, 7) : month;
  var dim = new Date(parseInt(tm.slice(0, 4)), parseInt(tm.slice(5, 7)), 0).getDate();
  var iD = new Array(dim).fill(0);
  var eD = new Array(dim).fill(0);
  d.incomes.filter(function(i) { return getMonth(i.date) === tm; }).forEach(function(i) {
    iD[parseInt(i.date.slice(8, 10)) - 1] += convert(i.amount, i.currency, cur);
  });
  d.expenses.filter(function(e) { return getMonth(e.date) === tm; }).forEach(function(e) {
    eD[parseInt(e.date.slice(8, 10)) - 1] += convert(e.amount, e.currency, cur);
  });
  var mx = Math.max(...iD, ...eD, 1);
  var w = canvas.width, h = canvas.height, p = 40, gw = w - p * 2, gh = h - p * 2;
  var gc = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim();
  var tc = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim();
  ctx.strokeStyle = gc; ctx.lineWidth = 1;
  for (var i = 0; i <= 4; i++) {
    var y = p + gh * (1 - i / 4);
    ctx.beginPath(); ctx.moveTo(p, y); ctx.lineTo(w - p, y); ctx.stroke();
    ctx.fillStyle = tc; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(mx * i / 4).toLocaleString(), p - 8, y + 4);
  }
  function dl(data, col) {
    ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 2;
    data.forEach(function(v, idx) {
      var x = p + (idx / (dim - 1)) * gw;
      var y2 = p + gh * (1 - v / mx);
      idx === 0 ? ctx.moveTo(x, y2) : ctx.lineTo(x, y2);
    });
    ctx.stroke();
  }
  dl(iD, '#22c55e');
  dl(eD, '#ef4444');
}

// ============ 表格排序狀態 ============
var _sortState = {
  income: { col: 'date', dir: 'desc' },
  expense: { col: 'date', dir: 'desc' }
};

function toggleSort(table, col) {
  var st = _sortState[table];
  if (st.col === col) {
    st.dir = st.dir === 'asc' ? 'desc' : 'asc';
  } else {
    st.col = col;
    st.dir = col === 'date' ? 'desc' : 'asc';
  }
  if (table === 'income') renderIncome();
  else renderExpense();
}

function _sortIndicator(table, col) {
  var st = _sortState[table];
  if (st.col !== col) return ' <span class="sort-icon">⇅</span>';
  return st.dir === 'asc' ? ' <span class="sort-icon active">▲</span>' : ' <span class="sort-icon active">▼</span>';
}

function _applySorting(list, table) {
  var st = _sortState[table];
  var col = st.col;
  var dir = st.dir === 'asc' ? 1 : -1;
  return list.slice().sort(function(a, b) {
    var va, vb;
    switch (col) {
      case 'date': va = a.date || ''; vb = b.date || ''; return va < vb ? -dir : va > vb ? dir : 0;
      case 'category': va = a.category || ''; vb = b.category || ''; return va.localeCompare(vb) * dir;
      case 'note': va = a.note || ''; vb = b.note || ''; return va.localeCompare(vb) * dir;
      case 'payTo': va = a.payTo || ''; vb = b.payTo || ''; return va.localeCompare(vb) * dir;
      case 'usedBy': va = a.usedBy || ''; vb = b.usedBy || ''; return va.localeCompare(vb) * dir;
      case 'amount': return (a.amount - b.amount) * dir;
      case 'currency': va = a.currency || ''; vb = b.currency || ''; return va.localeCompare(vb) * dir;
      case 'payMethod': va = a.payMethod || ''; vb = b.payMethod || ''; return va.localeCompare(vb) * dir;
      default: return 0;
    }
  });
}

// ============ 收入 ============
function renderIncome() {
  var d = U();
  var range = document.getElementById('incRange').value;
  var month = document.getElementById('incMonth').value;
  var year = document.getElementById('incYear').value;
  var list = _applySorting(filterByRange(d.incomes, range, month, year), 'income');
  var total = list.reduce(function(s, i) { return s + convert(i.amount, i.currency, 'TWD'); }, 0);

  document.getElementById('incStats').innerHTML =
    '<div class="stat-card"><div class="label">總收入 (TWD)</div><div class="value c-green">' +
    fmt(total, 'TWD') + '</div><div class="sub">' + list.length + ' 筆</div></div>';

  document.getElementById('incThead').innerHTML =
    '<tr>' +
    '<th class="sortable" onclick="toggleSort(\'income\',\'date\')">日期' + _sortIndicator('income','date') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'income\',\'category\')">類別' + _sortIndicator('income','category') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'income\',\'note\')">說明' + _sortIndicator('income','note') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'income\',\'payTo\')">支付對象' + _sortIndicator('income','payTo') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'income\',\'usedBy\')">使用對象' + _sortIndicator('income','usedBy') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'income\',\'amount\')">金額' + _sortIndicator('income','amount') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'income\',\'currency\')">幣別' + _sortIndicator('income','currency') + '</th>' +
    '<th>帳戶</th><th>操作</th></tr>';

  document.getElementById('incTable').innerHTML = list.length ? list.map(function(i) {
    var ac = d.accounts.find(function(a) { return a.id === i.accountId; });
    var mainCat = (i.category || '').split(' > ')[0];
    return '<tr><td>' + i.date + '</td><td><span class="tag tag-green"><span class="cat-icon">' +
      getIcon(mainCat) + '</span>' + _getCatDisplay(i.category) + '</span></td><td>' + (i.note || '-') +
      '</td><td>' + (i.payTo || '-') + '</td><td>' + (i.usedBy || '-') +
      '</td><td class="c-green" style="font-weight:600">+' + fmt(i.amount, i.currency) +
      '</td><td>' + i.currency + '</td><td>' + (ac ? ac.name : '-') +
      '</td><td><span class="edit-btn" onclick="editRecord(\'income\',\'' + i.id + '\')">✏️</span>' +
      '<span class="del-btn" onclick="deleteRecord(\'incomes\',\'' + i.id + '\')">✕</span></td></tr>';
  }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:40px">尚無收入記錄</td></tr>';
}

// ============ 支出 ============
function renderExpense() {
  var d = U();
  var range = document.getElementById('expRange').value;
  var month = document.getElementById('expMonth').value;
  var year = document.getElementById('expYear').value;
  var pt = document.getElementById('expPayType').value;
  var list = filterByRange(d.expenses, range, month, year);
  if (pt !== 'all') list = list.filter(function(e) { return e.payMethod === pt; });
  list = _applySorting(list, 'expense');

  var total = list.reduce(function(s, e) { return s + convert(e.amount, e.currency, 'TWD'); }, 0);
  var cc = list.filter(function(e) { return e.payMethod === '信用卡'; })
    .reduce(function(s, e) { return s + convert(e.amount, e.currency, 'TWD'); }, 0);
  var cash = list.filter(function(e) { return e.payMethod === '現金'; })
    .reduce(function(s, e) { return s + convert(e.amount, e.currency, 'TWD'); }, 0);

  document.getElementById('expStats').innerHTML =
    '<div class="stat-card"><div class="label">總支出 (TWD)</div><div class="value c-red">' + fmt(total, 'TWD') + '</div><div class="sub">' + list.length + ' 筆</div></div>' +
    '<div class="stat-card"><div class="label">信用卡</div><div class="value c-orange">' + fmt(cc, 'TWD') + '</div></div>' +
    '<div class="stat-card"><div class="label">現金</div><div class="value c-pink">' + fmt(cash, 'TWD') + '</div></div>';

  document.getElementById('expThead').innerHTML =
    '<tr>' +
    '<th class="sortable" onclick="toggleSort(\'expense\',\'date\')">日期' + _sortIndicator('expense','date') + '</th>' +
    '<th class="sortable" style="min-width:80px" onclick="toggleSort(\'expense\',\'category\')">類別' + _sortIndicator('expense','category') + '</th>' +
    '<th class="sortable" style="min-width:160px" onclick="toggleSort(\'expense\',\'note\')">說明' + _sortIndicator('expense','note') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'expense\',\'payTo\')">支付對象' + _sortIndicator('expense','payTo') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'expense\',\'usedBy\')">使用對象' + _sortIndicator('expense','usedBy') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'expense\',\'amount\')">金額' + _sortIndicator('expense','amount') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'expense\',\'currency\')">幣別' + _sortIndicator('expense','currency') + '</th>' +
    '<th class="sortable" onclick="toggleSort(\'expense\',\'payMethod\')">支付方式' + _sortIndicator('expense','payMethod') + '</th>' +
    '<th>帳戶</th><th>操作</th></tr>';

  document.getElementById('expTable').innerHTML = list.length ? list.map(function(e) {
    var ac = d.accounts.find(function(a) { return a.id === e.accountId; });
    var tc2 = e.payMethod === '信用卡' ? 'tag-orange' : e.payMethod === '現金' ? 'tag-purple' : 'tag-blue';
    var transferInfo = e.payMethod === '銀行轉帳' && e.transferAccount ? '<br><small style="color:var(--text3)">轉入：' + e.transferAccount + '</small>' : '';
    var mainCat2 = (e.category || '').split(' > ')[0];
    return '<tr><td>' + e.date + '</td><td><span class="tag tag-red"><span class="cat-icon">' +
      getIcon(mainCat2) + '</span>' + _getCatDisplay(e.category) + '</span></td><td>' + (e.note || '-') +
      '</td><td>' + (e.payTo || '-') + '</td><td>' + (e.usedBy || '-') +
      '</td><td class="c-red" style="font-weight:600">\u2212' + fmt(e.amount, e.currency) +
      '</td><td>' + e.currency + '</td><td><span class="tag ' + tc2 + '">' + e.payMethod +
      '</span>' + transferInfo + '</td><td>' + (ac ? ac.name : '-') +
      '</td><td><span class="edit-btn" onclick="editRecord(\'expense\',\'' + e.id + '\')">✏️</span>' +
      '<span class="del-btn" onclick="deleteRecord(\'expenses\',\'' + e.id + '\')">✕</span></td></tr>';
  }).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:40px">尚無支出記錄</td></tr>';
}

// ============ 資產管理 ============
var currentAssetTab = 'bank';

function switchAssetTab(tab, btn) {
  currentAssetTab = tab;
  document.querySelectorAll('#assetTabBar .tab-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  // 更新新增按鈕文字和行為
  var addBtn = document.getElementById('assetAddBtn');
  if (addBtn) {
    if (tab === 'property') { addBtn.textContent = '+ 新增不動產'; }
    else if (tab === 'vehicle') { addBtn.textContent = '+ 新增動產'; }
    else { addBtn.textContent = '+ 新增帳戶'; }
  }
  renderAssets();
}

function openAssetModal() {
  if (currentAssetTab === 'property') openModal('property');
  else if (currentAssetTab === 'vehicle') openModal('vehicle');
  else openModal('account');
}

function renderAssets() {
  var d = U();
  var titles = {
    bank: '銀行存款帳戶', cash: '現金帳戶', credit: '信用卡帳戶',
    receivable: '應收款追蹤', payable: '應付款追蹤', invest: '投資/其他資產',
    property: '不動產資產', vehicle: '動產資產'
  };
  document.getElementById('assetTableTitle').textContent = titles[currentAssetTab] || currentAssetTab;

  // 不動產和動產用獨立渲染
  if (currentAssetTab === 'property') {
    _renderPropertyTab(d); return;
  }
  if (currentAssetTab === 'vehicle') {
    _renderVehicleTab(d); return;
  }

  // ===== 應收款/應付款分頁：直接顯示「追蹤」介面，不顯示帳戶表格 =====
  var isRecvPay = (currentAssetTab === 'receivable' || currentAssetTab === 'payable');
  var accountWrap = document.getElementById('assetAccountWrap');
  var assetAddBtn = document.getElementById('assetAddBtn');
  var recvSection = document.getElementById('receivableSection');

  if (isRecvPay) {
    // 隱藏帳戶表格、隱藏「+ 新增帳戶」按鈕
    if (accountWrap) accountWrap.style.display = 'none';
    if (assetAddBtn) assetAddBtn.parentElement.style.display = 'none';

    // 統計卡：以明細為準（應收/應付款追蹤）
    var isRecv = currentAssetTab === 'receivable';
    var pendingDetails = (d.receivables || []).filter(function(r) {
      return r.type === (isRecv ? 'receivable' : 'payable') && r.status === 'pending';
    });
    var tTWD = pendingDetails.reduce(function(s, r) {
      return s + convert(r.amount, r.currency, 'TWD');
    }, 0);
    document.getElementById('assetStats').innerHTML =
      '<div class="stat-card"><div class="label">' + (isRecv ? '應收款總計' : '應付款總計') + ' (TWD)</div>' +
      '<div class="value ' + (isRecv ? 'c-orange' : 'c-red') + '">' + fmt(tTWD, 'TWD') + '</div>' +
      '<div class="sub">' + pendingDetails.length + ' 筆待' + (isRecv ? '收' : '付') + '</div></div>';

    // 明細區塊：更新標題與按鈕
    if (recvSection) {
      recvSection.style.display = 'block';
      document.getElementById('recvTableTitle').textContent = isRecv ? '應收款追蹤' : '應付款追蹤';
      var addBtnEl = recvSection.querySelector('button');
      addBtnEl.textContent = isRecv ? '+ 新增應收款' : '+ 新增應付款';
      addBtnEl.onclick = function() { openModal('receivable'); };
      renderReceivables(isRecv);
    }
    return;
  }

  // ===== 一般帳戶分頁 =====
  if (accountWrap) accountWrap.style.display = '';
  if (assetAddBtn) assetAddBtn.parentElement.style.display = '';
  if (recvSection) recvSection.style.display = 'none';

  var list = d.accounts.filter(function(a) { return a.type === currentAssetTab; });
  var tTWDAcct = list.reduce(function(s, a) {
    return s + convert(a.balance, a.currency, 'TWD');
  }, 0);

  document.getElementById('assetThead').innerHTML =
    '<tr><th style="width:40px"></th><th>帳戶名稱</th><th>機構</th><th>幣別</th><th>餘額</th><th>說明</th><th></th></tr>';

  document.getElementById('assetStats').innerHTML =
    '<div class="stat-card"><div class="label">' + titles[currentAssetTab] + '合計 (TWD)</div>' +
    '<div class="value ' + (currentAssetTab === 'credit' ? 'c-red' : 'c-blue') + '">' +
    fmt(tTWDAcct, 'TWD') + '</div><div class="sub">' + list.length + ' 個帳戶</div></div>';

  var tb = document.getElementById('assetTable');
  tb.innerHTML = list.length ? list.map(function(a) {
    var colorClass = a.balance >= 0 ? 'c-green' : 'c-red';
    return '<tr draggable="true" data-id="' + a.id + '">' +
      '<td><span class="drag-handle">⠿</span></td>' +
      '<td style="font-weight:600">' + a.name + '</td>' +
      '<td>' + (a.institution || '-') + '</td>' +
      '<td>' + a.currency + '</td>' +
      '<td style="font-weight:600" class="' + colorClass + '">' + fmt(a.balance, a.currency) + '</td>' +
      '<td style="color:var(--text3)">' + (a.note || '-') + '</td>' +
      '<td><span class="edit-btn" onclick="editAccount(\'' + a.id + '\')">✏️</span>' +
      '<span class="del-btn" onclick="deleteAccount(\'' + a.id + '\')">✕</span></td></tr>';
  }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">尚無帳戶</td></tr>';

  initAssetDrag();
}

// ======= 不動產渲染 =======
function _renderPropertyTab(d) {
  if (!d.properties) d.properties = [];
  var list = d.properties;
  var tTWD = list.reduce(function(s, p) { return s + convert(p.currentValue || 0, p.currency || 'TWD', 'TWD'); }, 0);
  var tCost = list.reduce(function(s, p) { return s + convert(p.purchasePrice || 0, p.currency || 'TWD', 'TWD'); }, 0);

  document.getElementById('assetStats').innerHTML =
    '<div class="stat-card"><div class="label">不動產現值合計 (TWD)</div><div class="value c-blue">' + fmt(tTWD, 'TWD') + '</div><div class="sub">' + list.length + ' 筆</div></div>' +
    '<div class="stat-card"><div class="label">購入成本合計 (TWD)</div><div class="value c-primary">' + fmt(tCost, 'TWD') + '</div></div>' +
    '<div class="stat-card"><div class="label">增減值</div><div class="value ' + (tTWD - tCost >= 0 ? 'c-green' : 'c-red') + '">' + (tTWD - tCost >= 0 ? '+' : '') + fmt(tTWD - tCost, 'TWD') + '</div></div>';

  document.getElementById('assetThead').innerHTML =
    '<tr><th>類型</th><th>名稱</th><th>地址/位置</th><th>購入日期</th><th>購入價格</th><th>當前價值</th><th>幣別</th><th>備註</th><th></th></tr>';

  var tb = document.getElementById('assetTable');
  tb.innerHTML = list.length ? list.map(function(p) {
    var pnl = (p.currentValue || 0) - (p.purchasePrice || 0);
    return '<tr><td><span class="tag">' + (PROPERTY_TYPES[p.subType] || p.subType || '-') + '</span></td>' +
      '<td style="font-weight:600">' + (p.name || '-') + '</td>' +
      '<td style="color:var(--text3);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (p.address || '-') + '</td>' +
      '<td>' + (p.purchaseDate || '-') + '</td>' +
      '<td>' + fmt(p.purchasePrice || 0, p.currency || 'TWD') + '</td>' +
      '<td style="font-weight:600" class="c-blue">' + fmt(p.currentValue || 0, p.currency || 'TWD') +
      '<div style="font-size:11px" class="' + (pnl >= 0 ? 'c-green' : 'c-red') + '">' + (pnl >= 0 ? '+' : '') + fmt(pnl, p.currency || 'TWD') + '</div></td>' +
      '<td>' + (p.currency || 'TWD') + '</td>' +
      '<td style="color:var(--text3)">' + (p.note || '-') + '</td>' +
      '<td><span class="edit-btn" onclick="editProperty(\'' + p.id + '\')">✏️</span>' +
      '<span class="del-btn" onclick="deleteProperty(\'' + p.id + '\')">✕</span></td></tr>';
  }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:40px">尚無不動產資料</td></tr>';

  // 隱藏應收款區塊
  var recvSection = document.getElementById('receivableSection');
  if (recvSection) recvSection.style.display = 'none';
}

// ======= 動產渲染 =======
function _renderVehicleTab(d) {
  if (!d.vehicles) d.vehicles = [];
  var list = d.vehicles;
  var tTWD = list.reduce(function(s, v) { return s + convert(v.currentValue || 0, v.currency || 'TWD', 'TWD'); }, 0);
  var tCost = list.reduce(function(s, v) { return s + convert(v.purchasePrice || 0, v.currency || 'TWD', 'TWD'); }, 0);

  document.getElementById('assetStats').innerHTML =
    '<div class="stat-card"><div class="label">動產現值合計 (TWD)</div><div class="value c-blue">' + fmt(tTWD, 'TWD') + '</div><div class="sub">' + list.length + ' 筆</div></div>' +
    '<div class="stat-card"><div class="label">購入成本合計 (TWD)</div><div class="value c-primary">' + fmt(tCost, 'TWD') + '</div></div>' +
    '<div class="stat-card"><div class="label">折舊</div><div class="value ' + (tTWD - tCost >= 0 ? 'c-green' : 'c-red') + '">' + (tTWD - tCost >= 0 ? '+' : '') + fmt(tTWD - tCost, 'TWD') + '</div></div>';

  document.getElementById('assetThead').innerHTML =
    '<tr><th>類型</th><th>名稱</th><th>品牌/型號</th><th>購入日期</th><th>購入價格</th><th>當前價值</th><th>幣別</th><th>備註</th><th></th></tr>';

  var tb = document.getElementById('assetTable');
  tb.innerHTML = list.length ? list.map(function(v) {
    var pnl = (v.currentValue || 0) - (v.purchasePrice || 0);
    var brandModel = ((v.brand || '') + ' ' + (v.model || '')).trim() || '-';
    return '<tr><td><span class="tag">' + (VEHICLE_TYPES[v.subType] || v.subType || '-') + '</span></td>' +
      '<td style="font-weight:600">' + (v.name || '-') + '</td>' +
      '<td>' + brandModel + '</td>' +
      '<td>' + (v.purchaseDate || '-') + '</td>' +
      '<td>' + fmt(v.purchasePrice || 0, v.currency || 'TWD') + '</td>' +
      '<td style="font-weight:600" class="c-blue">' + fmt(v.currentValue || 0, v.currency || 'TWD') +
      '<div style="font-size:11px" class="' + (pnl >= 0 ? 'c-green' : 'c-red') + '">' + (pnl >= 0 ? '+' : '') + fmt(pnl, v.currency || 'TWD') + '</div></td>' +
      '<td>' + (v.currency || 'TWD') + '</td>' +
      '<td style="color:var(--text3)">' + (v.note || '-') + '</td>' +
      '<td><span class="edit-btn" onclick="editVehicle(\'' + v.id + '\')">✏️</span>' +
      '<span class="del-btn" onclick="deleteVehicle(\'' + v.id + '\')">✕</span></td></tr>';
  }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:40px">尚無動產資料</td></tr>';

  var recvSection = document.getElementById('receivableSection');
  if (recvSection) recvSection.style.display = 'none';
}

// ============ 不動產 CRUD ============
function saveProperty() {
  var d = U();
  if (!d.properties) d.properties = [];
  var editId = document.getElementById('f_editId').value;
  var obj = {
    id: editId || genId(),
    subType: document.getElementById('f_propType').value,
    name: document.getElementById('f_propName').value.trim(),
    address: document.getElementById('f_propAddr').value.trim(),
    purchaseDate: document.getElementById('f_propDate').value,
    purchasePrice: parseFloat(document.getElementById('f_propPrice').value) || 0,
    currentValue: parseFloat(document.getElementById('f_propValue').value) || 0,
    currency: document.getElementById('f_propCur').value,
    note: document.getElementById('f_propNote').value.trim()
  };
  if (editId) {
    var ex = d.properties.find(function(p) { return p.id === editId; });
    if (ex) Object.assign(ex, obj);
  } else {
    d.properties.push(obj);
  }
  save(); closeModal(); renderAssets();
  showToast('✅ 不動產資料已儲存', 'success');
}
function editProperty(id) { openModal('property', id); }
function deleteProperty(id) {
  showConfirmModal('確定刪除此不動產資料？', function() {
    var d = U();
    d.properties = (d.properties || []).filter(function(p) { return p.id !== id; });
    save(); renderAssets();
  });
}

// ============ 動產 CRUD ============
function saveVehicle() {
  var d = U();
  if (!d.vehicles) d.vehicles = [];
  var editId = document.getElementById('f_editId').value;
  var obj = {
    id: editId || genId(),
    subType: document.getElementById('f_vehType').value,
    name: document.getElementById('f_vehName').value.trim(),
    brand: document.getElementById('f_vehBrand').value.trim(),
    model: document.getElementById('f_vehModel').value.trim(),
    purchaseDate: document.getElementById('f_vehDate').value,
    purchasePrice: parseFloat(document.getElementById('f_vehPrice').value) || 0,
    currentValue: parseFloat(document.getElementById('f_vehValue').value) || 0,
    currency: document.getElementById('f_vehCur').value,
    note: document.getElementById('f_vehNote').value.trim()
  };
  if (editId) {
    var ex = d.vehicles.find(function(v) { return v.id === editId; });
    if (ex) Object.assign(ex, obj);
  } else {
    d.vehicles.push(obj);
  }
  save(); closeModal(); renderAssets();
  showToast('✅ 動產資料已儲存', 'success');
}
function editVehicle(id) { openModal('vehicle', id); }
function deleteVehicle(id) {
  showConfirmModal('確定刪除此動產資料？', function() {
    var d = U();
    d.vehicles = (d.vehicles || []).filter(function(v) { return v.id !== id; });
    save(); renderAssets();
  });
}

// ============ 應收款/應付款明細 ============
function renderReceivables(isRecv) {
  var d = U();
  if (!d.receivables) d.receivables = [];
  var typeFilter = isRecv ? 'receivable' : 'payable';
  var list = d.receivables.filter(function(r) { return r.type === typeFilter; });
  list.sort(function(a, b) { return (a.dueDate || '').localeCompare(b.dueDate || ''); });

  var today = new Date().toISOString().slice(0, 10);
  var tb = document.getElementById('recvTable');
  tb.innerHTML = list.length ? list.map(function(r) {
    var overdueDays = 0;
    var statusHtml = '';
    if (r.status === 'paid') {
      statusHtml = '<span class="tag tag-green">' + (isRecv ? '已收款' : '已付款') + '</span>';
    } else if (r.dueDate && r.dueDate < today) {
      var d1 = new Date(today), d2 = new Date(r.dueDate);
      overdueDays = Math.floor((d1 - d2) / 86400000);
      statusHtml = '<span class="tag tag-red">逾期 ' + overdueDays + ' 天</span>';
    } else if (r.dueDate && r.dueDate === today) {
      statusHtml = '<span class="tag tag-orange">今日到期</span>';
    } else {
      statusHtml = '<span class="tag tag-blue">未到期</span>';
    }
    var acct = r.accountId ? d.accounts.find(function(a) { return a.id === r.accountId; }) : null;
    var acctLabel = acct
      ? '<span style="color:var(--text)">' + acct.name + '</span>'
      : '<span style="color:var(--text3);font-size:12px">未指定</span>';
    return '<tr' + (overdueDays > 0 ? ' style="background:rgba(239,68,68,.05)"' : '') + '>' +
      '<td>' + (r.date || '-') + '</td>' +
      '<td>' + (r.dueDate || '-') + '</td>' +
      '<td>' + statusHtml + '</td>' +
      '<td style="font-weight:600">' + (r.target || '-') + '</td>' +
      '<td>' + (r.note || '-') + '</td>' +
      '<td style="font-weight:600" class="' + (isRecv ? 'c-orange' : 'c-red') + '">' + fmt(r.amount, r.currency) + '</td>' +
      '<td>' + (r.currency || 'TWD') + '</td>' +
      '<td>' + acctLabel + '</td>' +
      '<td>' +
        (r.status !== 'paid' ? '<span class="edit-btn" onclick="markReceivablePaid(\'' + r.id + '\')" title="' + (isRecv ? '標記已收款' : '標記已付款') + '">✅</span>' : '') +
        '<span class="edit-btn" onclick="editReceivable(\'' + r.id + '\')">✏️</span>' +
        '<span class="del-btn" onclick="deleteReceivable(\'' + r.id + '\')">✕</span>' +
      '</td></tr>';
  }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:40px">尚無' + (isRecv ? '應收款' : '應付款') + '記錄</td></tr>';
}

/** 確保分類清單存在指定項目；若無則自動新增到使用者的類別清單。 */
function _ensureCategory(list, name) {
  if (!Array.isArray(list)) return;
  if (list.indexOf(name) === -1) list.push(name);
}

/** 標記應收/應付款為已收/已付。若已指定對應帳戶，會：
 *  1. 在收入/支出建立一筆紀錄（類別：應收款入帳 / 應付款支付）
 *  2. 調整該帳戶的餘額
 *  3. 在明細上記錄 paidIncomeId / paidExpenseId 以便未來追溯
 *  若未指定帳戶，僅變更 status，不動帳戶也不建金流紀錄。
 */
function markReceivablePaid(id) {
  var d = U();
  var r = (d.receivables || []).find(function(rv) { return rv.id === id; });
  if (!r) return;
  var isRecv = r.type === 'receivable';
  var today = new Date().toISOString().slice(0, 10);

  // 無指定帳戶 → 僅更新狀態
  if (!r.accountId) {
    showConfirmModal(
      '此筆未指定' + (isRecv ? '收款' : '付款') + '帳戶，僅會更新狀態為「已' + (isRecv ? '收' : '付') + '」，不會產生收支紀錄或調整帳戶餘額。確定繼續？',
      function() {
        r.status = 'paid';
        r.paidDate = today;
        save();
        renderAssets();
        showToast(isRecv ? '已標記已收款（未連動帳戶）' : '已標記已付款（未連動帳戶）');
      }
    );
    return;
  }

  var acct = d.accounts.find(function(a) { return a.id === r.accountId; });
  if (!acct) {
    showToast('找不到對應帳戶，請先編輯此筆補上帳戶', 'warn');
    return;
  }

  var msg = isRecv
    ? '確定標記為已收款？系統會在「收入」新增 ' + fmt(r.amount, r.currency) + '（類別：應收款入帳），並存入「' + acct.name + '」。'
    : '確定標記為已付款？系統會在「支出」新增 ' + fmt(r.amount, r.currency) + '（類別：應付款支付），並從「' + acct.name + '」扣除。';

  showConfirmModal(msg, function() {
    var amountInAcctCur = convert(r.amount, r.currency, acct.currency);

    if (isRecv) {
      _ensureCategory(d.incomeCategories, '應收款入帳');
      var incId = genId();
      d.incomes.push({
        id: incId,
        date: today,
        category: '應收款入帳',
        accountId: r.accountId,
        amount: r.amount,
        currency: r.currency,
        note: '[應收款] ' + (r.target || '') + (r.note ? '｜' + r.note : ''),
        payTo: r.target || '',
        usedBy: ''
      });
      acct.balance += amountInAcctCur;
      r.paidIncomeId = incId;
    } else {
      _ensureCategory(d.expenseCategories, '應付款支付');
      var expId = genId();
      d.expenses.push({
        id: expId,
        date: today,
        category: '應付款支付',
        payMethod: '銀行轉帳',
        accountId: r.accountId,
        amount: r.amount,
        currency: r.currency,
        note: '[應付款] ' + (r.target || '') + (r.note ? '｜' + r.note : ''),
        payTo: r.target || '',
        usedBy: '',
        transferAccount: ''
      });
      acct.balance -= amountInAcctCur;
      r.paidExpenseId = expId;
    }

    r.status = 'paid';
    r.paidDate = today;
    save();
    renderAssets();
    showToast(isRecv ? '已收款，已在收入新增紀錄並存入帳戶' : '已付款，已在支出新增紀錄並從帳戶扣除');
  });
}

function editReceivable(id) { openModal('receivable', id); }

function deleteReceivable(id) {
  var d = U();
  var r = (d.receivables || []).find(function(rv) { return rv.id === id; });
  if (!r) return;
  var hasLinkedTx = !!(r.paidIncomeId || r.paidExpenseId);
  var msg = hasLinkedTx
    ? '此筆已標記' + (r.type === 'receivable' ? '已收款' : '已付款') + '，會連動刪除對應的' + (r.type === 'receivable' ? '收入' : '支出') + '紀錄並還原帳戶餘額。確定刪除？'
    : '確定刪除此筆記錄？';

  showConfirmModal(msg, function() {
    // 連動還原：刪除關聯 income/expense 並回補帳戶
    if (r.paidIncomeId) {
      var incIdx = (d.incomes || []).findIndex(function(i) { return i.id === r.paidIncomeId; });
      if (incIdx >= 0) {
        var inc = d.incomes[incIdx];
        var acct = d.accounts.find(function(a) { return a.id === inc.accountId; });
        if (acct) acct.balance -= convert(inc.amount, inc.currency, acct.currency);
        d.incomes.splice(incIdx, 1);
      }
    }
    if (r.paidExpenseId) {
      var expIdx = (d.expenses || []).findIndex(function(e) { return e.id === r.paidExpenseId; });
      if (expIdx >= 0) {
        var exp = d.expenses[expIdx];
        var acct2 = d.accounts.find(function(a) { return a.id === exp.accountId; });
        if (acct2) acct2.balance += convert(exp.amount, exp.currency, acct2.currency);
        d.expenses.splice(expIdx, 1);
      }
    }
    d.receivables = d.receivables.filter(function(rv) { return rv.id !== id; });
    save();
    renderAssets();
    showToast(hasLinkedTx ? '已刪除並還原帳戶' : '已刪除');
  });
}

function saveReceivable() {
  var d = U();
  if (!d.receivables) d.receivables = [];
  var editId = document.getElementById('f_editId').value;
  var obj = {
    id: editId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: currentAssetTab === 'payable' ? 'payable' : 'receivable',
    date: document.getElementById('f_date').value,
    dueDate: document.getElementById('f_dueDate').value,
    target: document.getElementById('f_target').value.trim(),
    amount: parseFloat(document.getElementById('f_amt').value) || 0,
    currency: document.getElementById('f_cur').value,
    accountId: document.getElementById('f_acct').value || '',
    note: document.getElementById('f_note').value.trim(),
    status: 'pending'
  };
  if (!obj.amount) { alert('請輸入金額'); return; }
  if (!obj.target) { alert('請輸入對象/機構'); return; }

  if (editId) {
    var idx = d.receivables.findIndex(function(r) { return r.id === editId; });
    if (idx >= 0) { var old = d.receivables[idx]; obj.status = old.status; d.receivables[idx] = obj; }
  } else {
    d.receivables.push(obj);
  }
  save();
  closeModal();
  renderAssets();
  showToast((currentAssetTab === 'payable' ? '應付款' : '應收款') + '已儲存');
}

// ============ 資產拖拽排序（v1.8.2 重寫：getBoundingClientRect + 上/下判斷 + 正確 index 位移） ============
var _dragSrcRow = null;
var _dropTargetRow = null;
var _dropAfter = false;  // true: 插入到目標之後, false: 之前

function _clearDragOver() {
  document.querySelectorAll('#assetTable tr').forEach(function(r) {
    r.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

function initAssetDrag() {
  var tbody = document.getElementById('assetTable');
  if (!tbody) return;
  var rows = tbody.querySelectorAll('tr[draggable]');

  rows.forEach(function(row) {
    row.addEventListener('dragstart', function(e) {
      _dragSrcRow = this;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', this.dataset.id || ''); } catch (err) { /* IE/Edge 舊版保險 */ }
    });

    row.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      _clearDragOver();
      _dragSrcRow = null;
      _dropTargetRow = null;
    });

    row.addEventListener('dragover', function(e) {
      if (!_dragSrcRow || this === _dragSrcRow || !this.dataset.id) return;
      e.preventDefault();                       // 讓 drop 事件能觸發
      e.dataTransfer.dropEffect = 'move';
      var rect = this.getBoundingClientRect();
      var after = (e.clientY - rect.top) > rect.height / 2;
      this.classList.toggle('drag-over-top', !after);
      this.classList.toggle('drag-over-bottom', after);
      _dropTargetRow = this;
      _dropAfter = after;
    });

    row.addEventListener('dragleave', function() {
      this.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    row.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      _clearDragOver();
      if (!_dragSrcRow || !_dropTargetRow || _dropTargetRow === _dragSrcRow) return;

      var fromId = _dragSrcRow.dataset.id;
      var toId = _dropTargetRow.dataset.id;
      if (!fromId || !toId) return;

      var d = U(), accts = d.accounts;
      var fromIdx = accts.findIndex(function(a) { return a.id === fromId; });
      var toIdx = accts.findIndex(function(a) { return a.id === toId; });
      if (fromIdx < 0 || toIdx < 0) return;

      var item = accts.splice(fromIdx, 1)[0];
      // fromIdx < toIdx 時 splice 後目標索引往前位移 1
      if (fromIdx < toIdx) toIdx--;
      // drop 在目標下半部表示插入到「目標之後」，否則「目標之前」
      if (_dropAfter) toIdx++;
      accts.splice(toIdx, 0, item);
      save();
      renderAssets();
    });
  });
}

// ============ 收支分析 ============
function renderAnalysis() {
  var d = U();
  var range = document.getElementById('anaRange').value;
  var month = document.getElementById('anaMonth').value;
  var year = document.getElementById('anaYear').value;
  var cur = document.getElementById('anaCurrency').value;
  var inc = filterByRange(d.incomes, range, month, year);
  var exp = filterByRange(d.expenses, range, month, year);
  var tI = sumConverted(inc, 'amount', cur);
  var tE = sumConverted(exp, 'amount', cur);
  var sr = tI > 0 ? ((tI - tE) / tI * 100) : 0;

  document.getElementById('anaStats').innerHTML =
    '<div class="stat-card"><div class="label">收入</div><div class="value c-green">' + fmt(tI, cur) + '</div></div>' +
    '<div class="stat-card"><div class="label">支出</div><div class="value c-red">' + fmt(tE, cur) + '</div></div>' +
    '<div class="stat-card"><div class="label">淨收支</div><div class="value ' + (tI - tE >= 0 ? 'c-green' : 'c-red') + '">' + fmt(tI - tE, cur) + '</div></div>' +
    '<div class="stat-card"><div class="label">儲蓄率</div><div class="value c-primary">' + sr.toFixed(1) + '%</div></div>';

  drawPie('expPieChart', 'expPieLegend', groupByCategory(exp, cur), cur, false, true);
  drawPie('incPieChart', 'incPieLegend', groupByCategory(inc, cur), cur, false, true);

  // 支付對象 & 使用對象分析（合併收入+支出）
  var allItems = inc.concat(exp);
  drawPie('payToPieChart', 'payToPieLegend', groupByField(allItems, 'payTo', cur), cur, true);
  drawPie('usedByPieChart', 'usedByPieLegend', groupByField(allItems, 'usedBy', cur), cur, true);

  drawBarChart('expBarChart', groupByCategory(exp, cur), cur);
  drawMonthlyChart(cur);
}

// ============ 資產分析（合併至總覽） ============
function renderAssetAnalysisSection() {
  var d = U();
  var cur = document.getElementById('aasCurrency').value;
  var range = document.getElementById('aasRange').value;
  var now = new Date();
  var thisMonth = now.toISOString().slice(0, 7);
  var thisYear = now.getFullYear().toString();

  // 依時間範圍篩選收支
  var incF = d.incomes, expF = d.expenses;
  if (range === 'year') {
    incF = incF.filter(function(i) { return getYear(i.date) === thisYear; });
    expF = expF.filter(function(e) { return getYear(e.date) === thisYear; });
  } else if (range === 'month') {
    incF = incF.filter(function(i) { return getMonth(i.date) === thisMonth; });
    expF = expF.filter(function(e) { return getMonth(e.date) === thisMonth; });
  }
  var periodInc = sumConverted(incF, 'amount', cur);
  var periodExp = sumConverted(expF, 'amount', cur);
  var rangeLabel = range === 'year' ? '本年度' : range === 'month' ? '本月' : '全部';

  // 分類計算
  // 正資產：bank + cash 帳戶 + 投資組合市值 + 不動產現值 + 動產現值
  var positiveAccts = d.accounts.filter(function(a) {
    return a.type === 'bank' || a.type === 'cash';
  });
  var tPositive = positiveAccts.reduce(function(s, a) { return s + convert(a.balance, a.currency, cur); }, 0);
  tPositive += portfolioMarketValue(cur);  // 投資資產 = d.portfolio 市值
  tPositive += (d.properties || []).reduce(function(s, p) { return s + convert(p.currentValue || 0, p.currency || 'TWD', cur); }, 0);
  tPositive += (d.vehicles || []).reduce(function(s, v) { return s + convert(v.currentValue || 0, v.currency || 'TWD', cur); }, 0);

  // 應付款：從明細記錄加總（未付的 payable）
  var payableAccts = d.accounts.filter(function(a) { return a.type === 'payable'; });
  var pendingPayables = (d.receivables || []).filter(function(r) { return r.type === 'payable' && r.status === 'pending'; });
  var tPay = pendingPayables.reduce(function(s, r) { return s + convert(r.amount, r.currency, cur); }, 0);

  // 應收款：從明細記錄加總（未收的 receivable）
  var receivableAccts = d.accounts.filter(function(a) { return a.type === 'receivable'; });
  var pendingReceivables = (d.receivables || []).filter(function(r) { return r.type === 'receivable' && r.status === 'pending'; });
  var tRec = pendingReceivables.reduce(function(s, r) { return s + convert(r.amount, r.currency, cur); }, 0);

  // 負債：credit
  var creditAccts = d.accounts.filter(function(a) { return a.type === 'credit'; });
  var tDebt = creditAccts.reduce(function(s, a) { return s + convert(Math.abs(a.balance), a.currency, cur); }, 0);

  // 總資產 = 正資產 + 應收款（所有擁有的資源）
  var tA = tPositive + tRec;
  // 淨資產 = 正資產 + 應收款 − 應付款 − 負債（標準 Net Worth 定義，與資產總覽一致）
  var netAsset = tPositive + tRec - tPay - tDebt;

  // 統計卡片
  try {
    document.getElementById('aasStats').innerHTML =
      '<div class="stat-card"><div class="label">正資產</div><div class="value c-blue">' + fmt(tPositive, cur) + '</div><div class="sub">銀行+現金+投資+不動產+動產</div></div>' +
      '<div class="stat-card"><div class="label">淨資產</div><div class="value c-primary">' + fmt(netAsset, cur) + '</div><div class="sub">正資產 + 應收款 − 應付款 − 負債</div></div>' +
      '<div class="stat-card"><div class="label">' + rangeLabel + '收入</div><div class="value c-green">' + fmt(periodInc, cur) + '</div></div>' +
      '<div class="stat-card"><div class="label">' + rangeLabel + '支出</div><div class="value c-red">' + fmt(periodExp, cur) + '</div></div>' +
      '<div class="stat-card"><div class="label">負債（信用卡）</div><div class="value c-red">' + fmt(tDebt, cur) + '</div><div class="sub">' + creditAccts.length + ' 張</div></div>' +
      '<div class="stat-card"><div class="label">應收款</div><div class="value c-orange">' + fmt(tRec, cur) + '</div><div class="sub">' + pendingReceivables.length + ' 筆未收</div></div>' +
      '<div class="stat-card"><div class="label">應付款</div><div class="value c-red">' + fmt(tPay, cur) + '</div><div class="sub">' + pendingPayables.length + ' 筆未付</div></div>';
  } catch (e) { console.error('統計卡片錯誤:', e); }

  // --- 圓餅圖（各區塊獨立 try-catch，避免單一錯誤中斷所有圖表） ---
  try {
    // 正資產圓餅圖
    var posMap = {};
    positiveAccts.forEach(function(a) {
      var label = a.name + ' (' + a.currency + ')';
      posMap[label] = (posMap[label] || 0) + convert(a.balance, a.currency, cur);
    });
    drawPie('aasTypePie', 'aasTypeLegend',
      Object.entries(posMap).sort(function(a, b) { return b[1] - a[1]; }), cur
    );
  } catch (e) { console.error('正資產圓餅圖錯誤:', e); }

  try {
    // 幣別分佈圓餅圖
    var curMap = {};
    d.accounts.forEach(function(a) {
      var label = a.currency + ' ' + (CURRENCIES[a.currency] || a.currency);
      curMap[label] = (curMap[label] || 0) + convert(Math.abs(Number(a.balance) || 0), a.currency, cur);
    });
    drawPie('aasCurPie', 'aasCurLegend',
      Object.entries(curMap).sort(function(a, b) { return b[1] - a[1]; }), cur
    );
  } catch (e) { console.error('幣別圓餅圖錯誤:', e); }

  try {
    // 負債圓餅圖
    var debtMap = {};
    creditAccts.forEach(function(a) {
      var label = a.name + ' (' + a.currency + ')';
      debtMap[label] = (debtMap[label] || 0) + convert(Math.abs(Number(a.balance) || 0), a.currency, cur);
    });
    drawPie('aasDebtPie', 'aasDebtLegend',
      Object.entries(debtMap).sort(function(a, b) { return b[1] - a[1]; }), cur
    );
  } catch (e) { console.error('負債圓餅圖錯誤:', e); }

  try {
    // 應付款圓餅圖
    var payMap = {};
    payableAccts.forEach(function(a) {
      var label = a.name + ' (' + a.currency + ')';
      payMap[label] = (payMap[label] || 0) + convert(Math.abs(Number(a.balance) || 0), a.currency, cur);
    });
    drawPie('aasPayPie', 'aasPayLegend',
      Object.entries(payMap).sort(function(a, b) { return b[1] - a[1]; }), cur
    );
  } catch (e) { console.error('應付款圓餅圖錯誤:', e); }

  // --- 橫條排行圖（各區塊獨立 try-catch） ---
  try {
    // 銀行存款排行
    var bankData = d.accounts.filter(function(a) { return a.type === 'bank'; })
      .map(function(a) {
        return [a.name + ' (' + a.currency + ')', convert(a.balance, a.currency, cur)];
      }).sort(function(a, b) { return b[1] - a[1]; });
    drawBarChart('aasBankBar', bankData, cur);
  } catch (e) { console.error('銀行存款排行錯誤:', e); }

  try {
    // 現金排行
    var cashData = d.accounts.filter(function(a) { return a.type === 'cash'; })
      .map(function(a) {
        return [a.name + ' (' + a.currency + ')', convert(a.balance, a.currency, cur)];
      }).sort(function(a, b) { return b[1] - a[1]; });
    drawBarChart('aasCashBar', cashData, cur);
  } catch (e) { console.error('現金排行錯誤:', e); }

  try {
    // 信用卡負債排行（橫條圖）
    drawBarChart('aasDebtBar',
      creditAccts.map(function(a) {
        return [a.name + ' (' + a.currency + ')', convert(Math.abs(Number(a.balance) || 0), a.currency, cur)];
      }).sort(function(a, b) { return b[1] - a[1]; }),
      cur
    );
  } catch (e) { console.error('信用卡負債排行錯誤:', e); }

  try {
    // 應付款排行（橫條圖）
    drawBarChart('aasPayBar',
      payableAccts.map(function(a) {
        return [a.name + ' (' + a.currency + ')', convert(Math.abs(Number(a.balance) || 0), a.currency, cur)];
      }).sort(function(a, b) { return b[1] - a[1]; }),
      cur
    );
  } catch (e) { console.error('應付款排行錯誤:', e); }

  // --- 追蹤表 ---
  try {
    // 應收款追蹤表（從明細記錄）
    document.getElementById('aasReceivableStats').innerHTML =
      '<div class="stat-card"><div class="label">應收款總計 (' + cur + ')</div>' +
      '<div class="value c-orange">' + fmt(tRec, cur) + '</div>' +
      '<div class="sub">' + pendingReceivables.length + ' 筆未收</div></div>';

    document.getElementById('aasReceivableTable').innerHTML = pendingReceivables.length ?
      pendingReceivables.map(function(r) {
        return '<tr><td>' + (r.dueDate || r.date || '-') + '</td><td style="font-weight:600">' +
          (r.target || '-') + '</td><td>' + r.currency + '</td>' +
          '<td class="c-orange" style="font-weight:600">' + fmt(r.amount, r.currency) +
          '</td><td style="color:var(--text3)">' + (r.note || '-') + '</td></tr>';
      }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:30px">無應收款記錄</td></tr>';
  } catch (e) { console.error('應收款追蹤表錯誤:', e); }

  try {
    // 應付款追蹤表（從明細記錄）
    document.getElementById('aasPayableStats').innerHTML =
      '<div class="stat-card"><div class="label">應付款總計 (' + cur + ')</div>' +
      '<div class="value c-red">' + fmt(tPay, cur) + '</div>' +
      '<div class="sub">' + pendingPayables.length + ' 筆未付</div></div>';

    document.getElementById('aasPayableTable').innerHTML = pendingPayables.length ?
      pendingPayables.map(function(r) {
        return '<tr><td>' + (r.dueDate || r.date || '-') + '</td><td style="font-weight:600">' +
          (r.target || '-') + '</td><td>' + r.currency + '</td>' +
          '<td class="c-red" style="font-weight:600">' + fmt(r.amount, r.currency) +
          '</td><td style="color:var(--text3)">' + (r.note || '-') + '</td></tr>';
      }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:30px">無應付款記錄</td></tr>';
  } catch (e) { console.error('應付款追蹤表錯誤:', e); }
}

// ============ 投資情報 ============
function renderInvest() { loadNews(); renderPortfolio(); loadStocks(); loadPreciousMetals(); loadCryptoNews(); }

// ------ 股票自動刷新機制 ------
var _lastStockRefresh = null;  // timestamp (ms) of last successful refresh
var _stockRefreshTimer = null; // setInterval handle

/** 台股開盤判斷：週一～五 09:00–13:30（本地時間），不考慮國定假日。 */
function isTwStockMarketOpen() {
  var now = new Date();
  var day = now.getDay();          // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  var mins = now.getHours() * 60 + now.getMinutes();
  return mins >= 9 * 60 && mins <= 13 * 60 + 30;
}

/** 更新畫面上的「最後刷新時間」提示。 */
function updateStockRefreshInfo() {
  var el = document.getElementById('stockRefreshInfo');
  if (!el) return;
  var openStatus = isTwStockMarketOpen() ? '開盤中 · 每 10 分鐘自動刷新' : '休市中 · 自動刷新已暫停';
  if (!_lastStockRefresh) {
    el.textContent = '尚未刷新｜' + openStatus;
    return;
  }
  var t = new Date(_lastStockRefresh);
  var hh = String(t.getHours()).padStart(2, '0');
  var mm = String(t.getMinutes()).padStart(2, '0');
  var ss = String(t.getSeconds()).padStart(2, '0');
  el.textContent = '最後刷新：' + hh + ':' + mm + ':' + ss + '｜' + openStatus;
}

/** 每分鐘 tick：開盤中 + 已在投資頁 + 距上次刷新 ≥ 10 分鐘 → 觸發刷新。 */
function stockRefreshTick() {
  updateStockRefreshInfo();  // 每分鐘至少更新一次「開盤/休市」狀態
  if (!isTwStockMarketOpen()) return;
  var invPage = document.getElementById('page-invest');
  if (!invPage || !invPage.classList.contains('active')) return;
  var now = Date.now();
  if (_lastStockRefresh && now - _lastStockRefresh < 10 * 60 * 1000) return;
  loadStocks();
  renderPortfolio();
}

/** 啟動自動刷新定時器（每分鐘 tick 一次，由 stockRefreshTick 控節奏）。 */
function startStockAutoRefresh() {
  if (_stockRefreshTimer) return;
  _stockRefreshTimer = setInterval(stockRefreshTick, 60 * 1000);
  // 頁面載入時先跑一次以更新顯示
  updateStockRefreshInfo();
}

async function loadNews() {
  var el = document.getElementById('newsContainer');
  el.innerHTML = '<p style="color:var(--text3)">載入中...</p>';
  var today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:12px;color:var(--text3)">每日 8:00 更新</span><span style="font-size:12px;color:var(--text3)">' + today + '</span></div>';
  try {
    var r = await fetch('https://newsdata.io/api/1/latest?apikey=pub_64aboreal&category=business&language=zh&country=tw');
    var d = await r.json();
    if (d.results && d.results.length) {
      el.innerHTML = header + d.results.slice(0, 10).map(function(n) {
        var link = n.link || '#';
        return '<a href="' + link + '" target="_blank" rel="noopener" class="news-card" style="display:block;text-decoration:none;color:inherit;cursor:pointer">' +
          '<div class="news-title">' + (n.title || '無標題') +
          ' <span style="font-size:11px;color:var(--primary-light)">↗</span></div>' +
          '<div class="news-meta">' + (n.description || '').slice(0, 120) +
          ((n.description || '').length > 120 ? '...' : '') +
          '</div><div class="news-src">' + (n.source_id || '') + ' · ' +
          (n.pubDate ? n.pubDate.slice(0, 10) : '') + '</div></a>';
      }).join('');
      return;
    }
  } catch (e) { /* 靜默處理 */ }
  // 備用
  el.innerHTML = header +
    '<div class="news-card"><div class="news-title">全球經濟動態</div><div class="news-meta">請關注美聯儲利率決策、歐洲央行政策動向、中國經濟數據及地緣政治風險。建議查看 Bloomberg、Reuters 等專業財經網站獲取最新資訊。</div></div>' +
    '<div class="news-card"><div class="news-title">台灣市場焦點</div><div class="news-meta">台股動態受半導體產業、AI 趨勢及外資動向影響。建議關注台積電法說會、外資買賣超、央行政策及台幣匯率走勢。</div></div>' +
    '<div class="news-card"><div class="news-title">投資提醒</div><div class="news-meta">以上為一般性資訊，不構成投資建議。投資有風險，請依個人狀況審慎評估。</div></div>';
}

/** 透過 CORS Proxy 查詢 TWSE 即時股價（mis.twse.com.tw 直連會被瀏覽器 CORS 擋下）。
 *  ex_chQuery 範例：'tse_2330.tw|otc_6488.tw'
 *  依序嘗試多個公開 proxy，任一成功即回傳；全失敗回傳 null。
 *  回傳格式與 TWSE 原始 JSON 相同（含 msgArray）。
 */
async function fetchTWSE(ex_chQuery) {
  var twseUrl = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=' + ex_chQuery + '&json=1&delay=0&_=' + Date.now();
  var proxies = [
    function(u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
    function(u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
    function(u) { return 'https://api.codetabs.com/v1/proxy?quest=' + u; }
  ];
  for (var i = 0; i < proxies.length; i++) {
    try {
      var r = await fetch(proxies[i](twseUrl));
      if (!r.ok) continue;
      var text = await r.text();
      if (!text) continue;
      var data = JSON.parse(text);
      if (data && data.msgArray) return data;
    } catch (e) { /* 嘗試下一個 proxy */ }
  }
  return null;
}

async function loadStocks() {
  var d = U(), el = document.getElementById('stockContainer');
  if (!d.watchStocks || !d.watchStocks.length) {
    el.innerHTML = '<p style="color:var(--text3)">尚未追蹤任何股票，請輸入股票代號添加</p>';
    return;
  }
  el.innerHTML = '<p style="color:var(--text3)">載入股價中...</p>';

  // 輔助：將 TWSE msgArray 轉換為統一格式
  function parseTWSE(msgArray) {
    return msgArray.map(function(s) {
      var price = parseFloat(s.z) || parseFloat(s.y) || 0;
      var yesterday = parseFloat(s.y) || 0;
      var change = price - yesterday;
      var pct = yesterday ? ((change / yesterday) * 100) : 0;
      return { code: s.c, name: s.n || s.c, price: price, change: change, pct: pct };
    });
  }

  // 輔助：渲染股票卡片
  function renderCards(results, failedCodes) {
    var html = results.map(function(s) {
      var up = s.change >= 0;
      return '<div class="stock-card"><div><div class="stock-name">' + s.name +
        '</div><div class="stock-code">' + s.code + '.TW</div></div>' +
        '<div style="text-align:right"><div class="stock-price">' + (s.price ? s.price.toFixed(2) : '--') +
        '</div><div class="stock-change ' + (up ? 'c-green' : 'c-red') + '">' +
        (up ? '+' : '') + s.change.toFixed(2) + ' (' + (up ? '+' : '') + s.pct.toFixed(2) + '%)</div></div>' +
        '<span class="del-btn" onclick="removeStock(\'' + s.code + '\')" style="margin-left:12px" title="移除追蹤">✕</span></div>';
    }).join('');
    // 對未取得資料的股票顯示提示
    if (failedCodes && failedCodes.length) {
      html += failedCodes.map(function(c) {
        return '<div class="stock-card"><div><div class="stock-name">' + c +
          '</div><div class="stock-code">' + c + '.TW</div></div>' +
          '<div style="text-align:right"><div class="stock-price" style="color:var(--text3)">--</div>' +
          '<div style="font-size:11px;color:var(--text3)">無法載入</div></div>' +
          '<span class="del-btn" onclick="removeStock(\'' + c + '\')" style="margin-left:12px">✕</span></div>';
      }).join('');
    }
    return html;
  }

  var allResults = [];
  var loadedCodes = [];

  // 方法 1：TWSE 上市（主要）— 同時查詢 tse 與 otc（經 CORS Proxy）
  try {
    var tseQuery = d.watchStocks.map(function(c) { return 'tse_' + c + '.tw'; }).join('|');
    var otcQuery = d.watchStocks.map(function(c) { return 'otc_' + c + '.tw'; }).join('|');
    var fullQuery = tseQuery + '|' + otcQuery;
    var data = await fetchTWSE(fullQuery);
    if (data && data.msgArray && data.msgArray.length) {
      var parsed = parseTWSE(data.msgArray);
      // 去重：同一股票代號若 tse 與 otc 都有回傳，保留有價格的那筆
      var seen = {};
      parsed.forEach(function(s) {
        if (!seen[s.code] || (s.price > 0 && !seen[s.code].price)) {
          seen[s.code] = s;
        }
      });
      allResults = Object.values(seen).filter(function(s) { return s.price > 0; });
      loadedCodes = allResults.map(function(s) { return s.code; });
    }
  } catch (e) { /* 靜默處理 */ }

  // 方法 2：針對未成功的股票，分別嘗試 tse 再 otc（個別查詢 fallback）
  if (loadedCodes.length < d.watchStocks.length) {
    var remaining = d.watchStocks.filter(function(c) { return loadedCodes.indexOf(c) === -1; });
    for (var i = 0; i < remaining.length; i++) {
      var code = remaining[i];
      try {
        var d1 = await fetchTWSE('tse_' + code + '.tw');
        if (d1 && d1.msgArray && d1.msgArray.length) {
          var p = parseTWSE(d1.msgArray);
          if (p[0] && p[0].price > 0) { allResults.push(p[0]); loadedCodes.push(code); continue; }
        }
      } catch (e) { /* 靜默處理 */ }
      try {
        var d2 = await fetchTWSE('otc_' + code + '.tw');
        if (d2 && d2.msgArray && d2.msgArray.length) {
          var p2 = parseTWSE(d2.msgArray);
          if (p2[0] && p2[0].price > 0) { allResults.push(p2[0]); loadedCodes.push(code); continue; }
        }
      } catch (e) { /* 靜默處理 */ }
    }
  }

  // 有成功取得至少一筆 → 渲染並記錄刷新時間
  if (allResults.length > 0) {
    var failedCodes = d.watchStocks.filter(function(c) { return loadedCodes.indexOf(c) === -1; });
    // 按照原始追蹤順序排列
    allResults.sort(function(a, b) {
      return d.watchStocks.indexOf(a.code) - d.watchStocks.indexOf(b.code);
    });
    el.innerHTML = renderCards(allResults, failedCodes);
    _lastStockRefresh = Date.now();
    updateStockRefreshInfo();
    return;
  }

  // 全部失敗：顯示提示
  el.innerHTML = '<div style="background:rgba(245,158,11,.1);border:1px solid var(--orange);border-radius:12px;padding:16px;margin-bottom:16px;font-size:13px;color:var(--orange)">' +
    '<strong>提示：</strong>股價 API 暫時無法連線（資料來源：臺灣證交所 TWSE），請稍後再試。</div>' +
    d.watchStocks.map(function(c) {
      return '<div class="stock-card"><div><div class="stock-name">' + c +
        '</div><div class="stock-code">' + c + '.TW</div></div>' +
        '<div style="text-align:right"><div class="stock-price" style="color:var(--text3)">無法載入</div>' +
        '<div style="font-size:11px;color:var(--text3)">連線失敗</div></div>' +
        '<span class="del-btn" onclick="removeStock(\'' + c + '\')" style="margin-left:12px">✕</span></div>';
    }).join('');
}

async function loadPreciousMetals() {
  var el = document.getElementById('metalsContainer');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--text3)">載入中...</p>';
  var items = [];
  // 貴金屬 & 加密貨幣：使用 CoinGecko 免費 API
  try {
    var r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd,twd&include_24hr_change=true');
    var cd = await r.json();
    if (cd.bitcoin) items.push({ name: '比特幣 Bitcoin', code: 'BTC', price: cd.bitcoin.usd, priceTwd: cd.bitcoin.twd, change: cd.bitcoin.usd_24h_change || 0 });
    if (cd.ethereum) items.push({ name: '以太幣 Ethereum', code: 'ETH', price: cd.ethereum.usd, priceTwd: cd.ethereum.twd, change: cd.ethereum.usd_24h_change || 0 });
  } catch (e) { /* 靜默處理 */ }
  // 貴金屬使用 metals.dev 或 fallback
  try {
    var mr = await fetch('https://api.metals.dev/v1/latest?api_key=demo&currency=USD&unit=toz');
    var md = await mr.json();
    if (md.metals) {
      if (md.metals.gold) items.unshift({ name: '黃金 Gold', code: 'XAU', price: md.metals.gold, priceTwd: md.metals.gold * (rates.USD ? 1/rates.USD : 31.5), change: 0, isOz: true });
      if (md.metals.silver) items.unshift({ name: '白銀 Silver', code: 'XAG', price: md.metals.silver, priceTwd: md.metals.silver * (rates.USD ? 1/rates.USD : 31.5), change: 0, isOz: true });
    }
  } catch (e) {
    // Fallback: 顯示靜態參考
    if (!items.find(function(i) { return i.code === 'XAU'; })) {
      items.unshift({ name: '黃金 Gold', code: 'XAU', price: null, priceTwd: null, change: 0, isOz: true });
      items.unshift({ name: '白銀 Silver', code: 'XAG', price: null, priceTwd: null, change: 0, isOz: true });
    }
  }
  if (!items.length) {
    el.innerHTML = '<p style="color:var(--text3)">暫時無法取得價格資料，請稍後再試</p>';
    return;
  }
  el.innerHTML = items.map(function(s) {
    var up = s.change >= 0;
    var priceStr = s.price ? ('$' + s.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '--';
    var twdStr = s.priceTwd ? ('NT$' + Math.round(s.priceTwd).toLocaleString()) : '';
    var unit = s.isOz ? '/oz' : '';
    return '<div class="stock-card"><div><div class="stock-name">' + s.name +
      '</div><div class="stock-code">' + s.code + '</div></div>' +
      '<div style="text-align:right"><div class="stock-price">' + priceStr + unit +
      '</div>' + (twdStr ? '<div style="font-size:11px;color:var(--text3)">' + twdStr + unit + '</div>' : '') +
      (s.change ? '<div class="stock-change ' + (up ? 'c-green' : 'c-red') + '">' +
      (up ? '+' : '') + s.change.toFixed(2) + '%</div>' : '') +
      '</div></div>';
  }).join('');
}

async function loadCryptoNews() {
  var el = document.getElementById('cryptoNewsContainer');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--text3)">載入中...</p>';
  try {
    var r = await fetch('https://newsdata.io/api/1/latest?apikey=pub_64aboreal&q=crypto%20OR%20bitcoin%20OR%20ethereum&language=en&category=business');
    var d = await r.json();
    if (d.results && d.results.length) {
      el.innerHTML = d.results.slice(0, 10).map(function(n) {
        var link = n.link || '#';
        return '<a href="' + link + '" target="_blank" rel="noopener" class="news-card" style="display:block;text-decoration:none;color:inherit;cursor:pointer">' +
          '<div class="news-title">' + (n.title || '無標題') + '</div>' +
          '<div class="news-meta">' + (n.description || '').slice(0, 120) +
          ((n.description || '').length > 120 ? '...' : '') + '</div>' +
          '<div class="news-src">' + (n.source_id || '') + ' · ' +
          (n.pubDate ? n.pubDate.slice(0, 10) : '') + '</div></a>';
      }).join('');
      return;
    }
  } catch (e) { /* 靜默處理 */ }
  el.innerHTML = '<p style="color:var(--text3)">暫無幣圈新聞，請稍後再試</p>';
}

function addWatchStock() {
  var input = document.getElementById('addStockInput');
  var code = input.value.trim();
  if (!code) { alert('請輸入股票代號'); return; }
  var d = U();
  if (d.watchStocks.includes(code)) { alert('已追蹤此股票'); return; }
  d.watchStocks.push(code);
  save();
  input.value = '';
  loadStocks();
}

function removeStock(code) {
  var d = U();
  d.watchStocks = d.watchStocks.filter(function(c) { return c !== code; });
  save();
  loadStocks();
}

// ============ 投資組合管理 ============
var _portfolioPrices = {}; // 暫存即時股價 { code: price }

/** 抓取投資組合內所有 stock 類型的即時股價，更新到 _portfolioPrices。 */
async function fetchPortfolioPrices() {
  var d = DB;
  if (!d || !d.portfolio || d.portfolio.length === 0) return;
  var stockCodes = d.portfolio.filter(function(p) { return p.type === 'stock' && p.code; }).map(function(p) { return p.code; });
  if (stockCodes.length === 0) return;
  try {
    var tseQ = stockCodes.map(function(c) { return 'tse_' + c + '.tw'; }).join('|');
    var otcQ = stockCodes.map(function(c) { return 'otc_' + c + '.tw'; }).join('|');
    var data = await fetchTWSE(tseQ + '|' + otcQ);
    if (data && data.msgArray) {
      data.msgArray.forEach(function(s) {
        var price = parseFloat(s.z) || parseFloat(s.y) || 0;
        if (price > 0) _portfolioPrices[s.c] = price;
      });
    }
  } catch (e) { /* 靜默 */ }
}

/** 計算投資組合總市值（換算到指定幣別）。若無即時股價則以成本為 fallback。 */
function portfolioMarketValue(targetCurrency) {
  if (!DB || !DB.portfolio) return 0;
  return DB.portfolio.reduce(function(s, p) {
    var cost = (p.costPerUnit || 0) * (p.units || 0);
    var price = _portfolioPrices[p.code] || 0;
    var mv = price > 0 ? price * (p.units || 0) : cost;
    return s + convert(mv, p.currency || 'TWD', targetCurrency);
  }, 0);
}

async function renderPortfolio() {
  var d = U();
  if (!d.portfolio) d.portfolio = [];
  var tb = document.getElementById('portfolioTable');
  var stats = document.getElementById('portfolioStats');
  if (!tb) return;

  // 查詢 TWSE 即時價格（經 CORS Proxy）
  await fetchPortfolioPrices();

  var totalCost = 0, totalValue = 0;
  var typeLabels = { stock: '股票', fund: '基金', other: '其他' };

  tb.innerHTML = d.portfolio.length ? d.portfolio.map(function(p) {
    var cost = (p.costPerUnit || 0) * (p.units || 0);
    var currentPrice = _portfolioPrices[p.code] || 0;
    var marketVal = currentPrice > 0 ? currentPrice * (p.units || 0) : cost;
    var pnl = marketVal - cost;
    var pnlPct = cost > 0 ? ((pnl / cost) * 100) : 0;
    totalCost += cost;
    totalValue += marketVal;
    var pnlColor = pnl >= 0 ? 'c-green' : 'c-red';
    var priceStr = currentPrice > 0 ? fmt(currentPrice, p.currency || 'TWD') : '<span style="color:var(--text3)">--</span>';
    return '<tr>' +
      '<td><span class="tag">' + (typeLabels[p.type] || p.type) + '</span></td>' +
      '<td style="font-weight:600">' + (p.code || '-') + '</td>' +
      '<td>' + (p.name || '-') + '</td>' +
      '<td>' + (p.units || 0) + '</td>' +
      '<td>' + fmt(p.costPerUnit || 0, p.currency || 'TWD') + '</td>' +
      '<td>' + fmt(cost, p.currency || 'TWD') + '</td>' +
      '<td>' + priceStr + '</td>' +
      '<td style="font-weight:600">' + fmt(marketVal, p.currency || 'TWD') + '</td>' +
      '<td class="' + pnlColor + '" style="font-weight:600">' + (pnl >= 0 ? '+' : '') + fmt(pnl, p.currency || 'TWD') +
      '<div style="font-size:11px">(' + (pnl >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%)</div></td>' +
      '<td><span class="edit-btn" onclick="editPortfolio(\'' + p.id + '\')">✏️</span>' +
      '<span class="del-btn" onclick="deletePortfolio(\'' + p.id + '\')">✕</span></td></tr>';
  }).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:40px">尚無投資持倉記錄</td></tr>';

  var totalPnl = totalValue - totalCost;
  if (stats) {
    stats.innerHTML =
      '<div class="stat-card"><div class="label">總成本</div><div class="value c-blue">' + fmt(totalCost, 'TWD') + '</div></div>' +
      '<div class="stat-card"><div class="label">總市值</div><div class="value c-primary">' + fmt(totalValue, 'TWD') + '</div></div>' +
      '<div class="stat-card"><div class="label">總損益</div><div class="value ' + (totalPnl >= 0 ? 'c-green' : 'c-red') + '">' + (totalPnl >= 0 ? '+' : '') + fmt(totalPnl, 'TWD') + '</div></div>';
  }
}

function savePortfolio() {
  var d = U();
  if (!d.portfolio) d.portfolio = [];
  var editId = document.getElementById('f_editId').value;
  var obj = {
    id: editId || genId(),
    type: document.getElementById('f_pType').value,
    code: document.getElementById('f_pCode').value.trim(),
    name: document.getElementById('f_pName').value.trim(),
    costPerUnit: parseFloat(document.getElementById('f_pCost').value) || 0,
    units: parseFloat(document.getElementById('f_pUnits').value) || 0,
    currency: document.getElementById('f_pCur').value,
    note: document.getElementById('f_pNote').value.trim()
  };
  if (editId) {
    var existing = d.portfolio.find(function(p) { return p.id === editId; });
    if (existing) Object.assign(existing, obj);
  } else {
    d.portfolio.push(obj);
  }
  save(); closeModal(); renderPortfolio();
  showToast('✅ 持倉記錄已儲存', 'success');
}

function editPortfolio(id) { openModal('portfolio', id); }

function deletePortfolio(id) {
  showConfirmModal('確定刪除此持倉記錄？', function() {
    var d = U();
    d.portfolio = (d.portfolio || []).filter(function(p) { return p.id !== id; });
    save(); renderPortfolio();
  });
}

// ============ 圖表繪製輔助函式 ============
function groupByCategory(list, cur) {
  var map = {};
  list.forEach(function(item) {
    // 以大分類統計（「教育 > 學費」歸入「教育」）
    var cat = (item.category || '其他').split(' > ')[0];
    map[cat] = (map[cat] || 0) + convert(item.amount, item.currency, cur);
  });
  return Object.entries(map).sort(function(a, b) { return b[1] - a[1]; });
}

function groupByField(list, field, cur) {
  var map = {};
  list.forEach(function(item) {
    var key = (item[field] && item[field].trim()) ? item[field].trim() : '其他';
    map[key] = (map[key] || 0) + convert(item.amount, item.currency, cur);
  });
  return Object.entries(map).sort(function(a, b) { return b[1] - a[1]; });
}

function drawPie(cid, lid, data, cur, noIcon, onClickCat) {
  var cv = document.getElementById(cid);
  var lg = document.getElementById(lid);
  if (!cv || !lg) return;
  var ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 180, 180);
  var total = data.reduce(function(s, d) { return s + d[1]; }, 0);
  if (!total) {
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(90, 90, 70, 0, Math.PI * 2); ctx.fill();
    lg.innerHTML = '<div style="color:var(--text3)">無資料</div>';
    return;
  }
  var angle = -Math.PI / 2;
  data.forEach(function(d, i) {
    var sl = (d[1] / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(90, 90);
    ctx.arc(90, 90, 70, angle, angle + sl);
    ctx.closePath();
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length];
    ctx.fill();
    angle += sl;
  });
  var hc = getComputedStyle(document.documentElement).getPropertyValue('--donut-hole').trim();
  ctx.beginPath(); ctx.arc(90, 90, 40, 0, Math.PI * 2);
  ctx.fillStyle = hc; ctx.fill();
  // onClickCat: 傳入類別名稱時，圖例項目可點擊展開子類別彈窗
  var clickable = onClickCat === true;
  lg.innerHTML = data.slice(0, 8).map(function(d, i) {
    var amtStr = cur ? fmt(d[1], cur) : '';
    var iconHtml = noIcon ? '' : '<span class="cat-icon">' + getIcon(d[0]) + '</span>';
    var clickAttr = clickable ? ' onclick="showSubCatPopup(\'' + d[0].replace(/'/g, "\\'") + '\',\'' + (cur || 'TWD') + '\')" style="cursor:pointer"' : '';
    return '<div class="pie-legend-item"' + clickAttr + '><div class="pie-legend-dot" style="background:' +
      PIE_COLORS[i % PIE_COLORS.length] + '"></div><span>' + iconHtml + d[0] +
      '</span><span style="color:var(--text3);margin-left:auto">' +
      (amtStr ? amtStr + ' ' : '') + (d[1] / total * 100).toFixed(1) + '%</span>' +
      (clickable ? '<span style="color:var(--text3);font-size:11px;margin-left:4px">▶</span>' : '') + '</div>';
  }).join('');
}

function drawBarChart(eid, data, cur) {
  var el = document.getElementById(eid);
  if (!el) return;
  var mx = data.length ? Math.max.apply(null, data.map(function(d) { return Math.abs(d[1]); })) : 0;
  el.innerHTML = data.length ? data.map(function(d, i) {
    return '<div class="chart-bar-group"><div class="chart-bar-label"><span><span class="cat-icon">' +
      getIcon(d[0]) + '</span>' + d[0] + '</span><span>' + fmt(d[1], cur) +
      '</span></div><div class="chart-bar"><div class="chart-bar-fill" style="width:' +
      (mx ? Math.abs(d[1]) / mx * 100 : 0) + '%;background:' +
      PIE_COLORS[i % PIE_COLORS.length] + '"></div></div></div>';
  }).join('') : '<div style="text-align:center;color:var(--text3);padding:20px">尚無帳戶資料，請先在資產管理中新增對應帳戶</div>';
}

// ============ 子類別分析彈窗 ============
function showSubCatPopup(mainCat, cur) {
  var d = U();
  var range = document.getElementById('anaRange').value;
  var month = document.getElementById('anaMonth').value;
  var year = document.getElementById('anaYear').value;
  // 合併收入+支出中屬於此大分類的項目
  var allItems = filterByRange(d.incomes, range, month, year).concat(filterByRange(d.expenses, range, month, year));
  var items = allItems.filter(function(item) {
    return (item.category || '').split(' > ')[0] === mainCat;
  });
  if (items.length === 0) { showToast('此類別無明細資料', 'warn'); return; }

  // 按子類別分組
  var map = {};
  items.forEach(function(item) {
    var parts = (item.category || '').split(' > ');
    var subName = parts.length > 1 ? parts[1] : '（無子類別）';
    map[subName] = (map[subName] || 0) + convert(item.amount, item.currency, cur);
  });
  var subData = Object.entries(map).sort(function(a, b) { return b[1] - a[1]; });
  var total = subData.reduce(function(s, d) { return s + d[1]; }, 0);

  document.getElementById('subCatPopupTitle').innerHTML =
    '<span class="cat-icon">' + getIcon(mainCat) + '</span> ' + mainCat + ' 子類別分佈';

  // 畫子類別圓餅圖
  drawPie('subCatPieChart', 'subCatPieLegend', subData, cur, true);

  // 明細列表
  document.getElementById('subCatPopupList').innerHTML =
    '<div style="margin-top:8px">' + subData.map(function(s, i) {
      var pct = total ? (s[1] / total * 100).toFixed(1) : '0.0';
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--border)">' +
        '<div style="width:10px;height:10px;border-radius:50%;background:' + PIE_COLORS[i % PIE_COLORS.length] + ';flex-shrink:0"></div>' +
        '<span style="flex:1">' + s[0] + '</span>' +
        '<span style="color:var(--text3)">' + fmt(s[1], cur) + '</span>' +
        '<span style="color:var(--text3);font-size:12px;min-width:45px;text-align:right">' + pct + '%</span>' +
        '</div>';
    }).join('') + '</div>';

  document.getElementById('subCatPopupOverlay').classList.add('show');
}

function closeSubCatPopup() {
  document.getElementById('subCatPopupOverlay').classList.remove('show');
}

function drawMonthlyChart(cur) {
  var cv = document.getElementById('monthlyChart');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  cv.width = cv.parentElement.clientWidth - 40;
  var w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  var d = U(), months = [], now = new Date();
  for (var i = 5; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7));
  }
  var iD = months.map(function(m) { return sumConverted(filterByMonth(d.incomes, m), 'amount', cur); });
  var eD = months.map(function(m) { return sumConverted(filterByMonth(d.expenses, m), 'amount', cur); });
  var mx = Math.max(...iD, ...eD, 1);
  var p = 50, gw = w - p * 2, gh = h - p - 20, bw = gw / months.length / 3;
  var gc = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim();
  var tc2 = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim();
  ctx.strokeStyle = gc; ctx.lineWidth = 1;
  for (var j = 0; j <= 4; j++) {
    var y = 20 + gh * (1 - j / 4);
    ctx.beginPath(); ctx.moveTo(p, y); ctx.lineTo(w - 20, y); ctx.stroke();
    ctx.fillStyle = tc2; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(mx * j / 4).toLocaleString(), p - 8, y + 4);
  }
  months.forEach(function(m, idx) {
    var cx = p + (idx + 0.5) * (gw / months.length);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(cx - bw - 2, 20 + gh - (iD[idx] / mx) * gh, bw, (iD[idx] / mx) * gh);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx + 2, 20 + gh - (eD[idx] / mx) * gh, bw, (eD[idx] / mx) * gh);
    ctx.fillStyle = tc2; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(m.slice(5), cx, h - 4);
  });
}

// ============ 財務規劃 (v1.8.6) ============
var _currentPlanTab = 'projects';

function renderPlanning() {
  _renderPlanTab(_currentPlanTab);
}

function switchPlanTab(tab, btn) {
  _currentPlanTab = tab;
  document.querySelectorAll('#page-planning .tab-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  _renderPlanTab(tab);
}

function _renderPlanTab(tab) {
  if (tab === 'projects') renderPlanProjects();
  else if (tab === 'recurring') renderPlanRecurring();
  else if (tab === 'goals') renderPlanGoals();
  else if (tab === 'tax') renderPlanTax();
}

// ============ B. 專案標籤 ============
function renderPlanProjects() {
  var d = U();
  var projects = d.projects || [];
  // 計算每個專案的總收支
  function aggregate(pid) {
    var income = (d.incomes || []).filter(function(i) { return i.projectId === pid; })
      .reduce(function(s, i) { return s + convert(i.amount, i.currency, 'TWD'); }, 0);
    var expense = (d.expenses || []).filter(function(e) { return e.projectId === pid; })
      .reduce(function(s, e) { return s + convert(e.amount, e.currency, 'TWD'); }, 0);
    var count = (d.incomes || []).filter(function(i) { return i.projectId === pid; }).length +
                (d.expenses || []).filter(function(e) { return e.projectId === pid; }).length;
    return { income: income, expense: expense, net: income - expense, count: count };
  }

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
    '<div style="color:var(--text2);font-size:13px">專案標籤可將跨月、跨類別的收支（例如裝修、旅遊、備孕計畫）匯聚起來計算總損益。</div>' +
    '<button class="btn btn-p btn-sm" onclick="openModal(\'planProject\')">+ 新增專案</button></div>';

  if (projects.length === 0) {
    html += '<div style="text-align:center;color:var(--text3);padding:60px">尚無專案，點擊右上「新增專案」建立第一個。</div>';
  } else {
    html += '<div class="stat-grid">' + projects.map(function(p) {
      var agg = aggregate(p.id);
      var pct = p.budget > 0 ? Math.min(100, (agg.expense / convert(p.budget, p.currency || 'TWD', 'TWD')) * 100) : 0;
      var color = agg.net >= 0 ? 'c-green' : 'c-red';
      var statusTag = p.status === 'closed' ? '<span class="tag tag-blue" style="margin-left:6px">已結案</span>' : '';
      return '<div class="stat-card" style="cursor:pointer" onclick="editPlanProject(\'' + p.id + '\')">' +
        '<div class="label">' + (p.emoji || '📁') + ' ' + p.name + statusTag + '</div>' +
        '<div class="value ' + color + '">' + (agg.net >= 0 ? '+' : '') + fmt(agg.net, 'TWD') + '</div>' +
        '<div class="sub">收 ' + fmt(agg.income, 'TWD') + '｜支 ' + fmt(agg.expense, 'TWD') + '｜' + agg.count + ' 筆</div>' +
        (p.budget > 0 ? '<div style="margin-top:8px;background:var(--border);border-radius:4px;height:6px;overflow:hidden"><div style="height:100%;background:' + (pct > 100 ? '#ef4444' : 'var(--primary)') + ';width:' + pct + '%"></div></div><div style="font-size:11px;color:var(--text3);margin-top:4px">預算 ' + fmt(p.budget, p.currency || 'TWD') + '｜已用 ' + pct.toFixed(0) + '%</div>' : '') +
        '</div>';
    }).join('') + '</div>';
  }
  document.getElementById('planContent').innerHTML = html;
}

function editPlanProject(id) { openModal('planProject', id); }

function savePlanProject() {
  var d = U();
  var editId = document.getElementById('f_editId').value;
  var obj = {
    id: editId || genId(),
    name: document.getElementById('f_pjName').value.trim(),
    emoji: document.getElementById('f_pjEmoji').value.trim() || '📁',
    status: document.getElementById('f_pjStatus').value,
    startDate: document.getElementById('f_pjStart').value,
    endDate: document.getElementById('f_pjEnd').value,
    budget: parseFloat(document.getElementById('f_pjBudget').value) || 0,
    currency: document.getElementById('f_pjCur').value,
    note: document.getElementById('f_pjNote').value
  };
  if (!obj.name) { alert('請輸入專案名稱'); return; }
  if (editId) {
    var idx = d.projects.findIndex(function(p) { return p.id === editId; });
    if (idx >= 0) d.projects[idx] = obj;
  } else {
    d.projects.push(obj);
  }
  save(); closeModal(); renderPlanProjects();
}

function deletePlanProject(id) {
  showConfirmModal('確定刪除此專案？不會刪除相關收支紀錄，只是把它們的專案標籤清掉。', function() {
    var d = U();
    d.projects = d.projects.filter(function(p) { return p.id !== id; });
    (d.incomes || []).forEach(function(i) { if (i.projectId === id) delete i.projectId; });
    (d.expenses || []).forEach(function(e) { if (e.projectId === id) delete e.projectId; });
    save(); closeModal(); renderPlanProjects();
  });
}

// ============ C. 定期收支 + 生存天數 ============
function renderPlanRecurring() {
  var d = U();
  var list = d.recurring || [];
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
    '<div style="color:var(--text2);font-size:13px">設定每月固定收入/支出（如薪資、保費、房貸、訂閱），系統會在每月 1 號自動建立「預計」記錄。</div>' +
    '<button class="btn btn-p btn-sm" onclick="openModal(\'planRecurring\')">+ 新增定期項目</button></div>';

  // 本月自動產生狀態
  var thisMonth = new Date().toISOString().slice(0, 7);
  var pendingCount = list.filter(function(r) { return r.active && r.lastGenerated !== thisMonth; }).length;
  if (pendingCount > 0) {
    html += '<div style="background:rgba(108,99,255,.1);border:1px solid var(--primary);border-radius:12px;padding:12px;margin-bottom:16px;font-size:13px">' +
      '本月還有 ' + pendingCount + ' 筆定期項目尚未建立記錄。<button class="btn btn-p btn-sm" style="margin-left:12px" onclick="runRecurringThisMonth()">立即產生本月</button></div>';
  }

  if (list.length === 0) {
    html += '<div style="text-align:center;color:var(--text3);padding:60px">尚無定期項目。</div>';
  } else {
    html += '<div class="table-wrap"><div class="table-scroll-wrap"><table>' +
      '<thead><tr><th>類型</th><th>名稱</th><th>分類</th><th>金額</th><th>扣款日</th><th>帳戶</th><th>本月狀態</th><th>操作</th></tr></thead>' +
      '<tbody>' +
      list.map(function(r) {
        var acct = d.accounts.find(function(a) { return a.id === r.accountId; });
        var isDone = r.lastGenerated === thisMonth;
        var typeLabel = r.type === 'income' ? '<span class="tag tag-green">收入</span>' : '<span class="tag tag-red">支出</span>';
        return '<tr style="' + (r.active ? '' : 'opacity:.5') + '">' +
          '<td>' + typeLabel + '</td>' +
          '<td style="font-weight:600">' + r.name + '</td>' +
          '<td>' + (r.category || '-') + '</td>' +
          '<td>' + fmt(r.amount, r.currency) + '</td>' +
          '<td>每月 ' + r.dayOfMonth + ' 日</td>' +
          '<td>' + (acct ? acct.name : '-') + '</td>' +
          '<td>' + (isDone ? '<span class="tag tag-green">已建</span>' : (r.active ? '<span class="tag tag-orange">待建</span>' : '<span class="tag">停用</span>')) + '</td>' +
          '<td><span class="edit-btn" onclick="editPlanRecurring(\'' + r.id + '\')">✏️</span>' +
            '<span class="del-btn" onclick="deletePlanRecurring(\'' + r.id + '\')">✕</span></td></tr>';
      }).join('') +
      '</tbody></table></div></div>';
  }

  document.getElementById('planContent').innerHTML = html;
}

function runRecurringThisMonth() {
  var d = U();
  var thisMonth = new Date().toISOString().slice(0, 7);
  var today = new Date().toISOString().slice(0, 10);
  var created = 0;
  (d.recurring || []).forEach(function(r) {
    if (!r.active || r.lastGenerated === thisMonth) return;
    var dateStr = thisMonth + '-' + String(r.dayOfMonth || 1).padStart(2, '0');
    var record = {
      id: genId(),
      date: dateStr,
      category: r.category || (r.type === 'income' ? '其他收入' : '其他支出'),
      accountId: r.accountId || '',
      amount: r.amount,
      currency: r.currency,
      note: '[定期] ' + r.name + (r.note ? '｜' + r.note : ''),
      payTo: '', usedBy: '',
      _fromRecurringId: r.id
    };
    if (r.type === 'income') {
      d.incomes.push(record);
      var ac = d.accounts.find(function(a) { return a.id === r.accountId; });
      if (ac) ac.balance += convert(r.amount, r.currency, ac.currency);
    } else {
      record.payMethod = '銀行轉帳';
      record.transferAccount = '';
      d.expenses.push(record);
      var ac2 = d.accounts.find(function(a) { return a.id === r.accountId; });
      if (ac2) ac2.balance -= convert(r.amount, r.currency, ac2.currency);
    }
    r.lastGenerated = thisMonth;
    created++;
  });
  save();
  renderPlanRecurring();
  showToast('已建立 ' + created + ' 筆本月定期記錄');
}

function editPlanRecurring(id) { openModal('planRecurring', id); }

function savePlanRecurring() {
  var d = U();
  var editId = document.getElementById('f_editId').value;
  var obj = {
    id: editId || genId(),
    type: document.getElementById('f_rType').value,
    name: document.getElementById('f_rName').value.trim(),
    amount: parseFloat(document.getElementById('f_rAmt').value) || 0,
    currency: document.getElementById('f_rCur').value,
    category: document.getElementById('f_rCat').value,
    accountId: document.getElementById('f_rAcct').value,
    dayOfMonth: parseInt(document.getElementById('f_rDay').value, 10) || 1,
    note: document.getElementById('f_rNote').value,
    active: document.getElementById('f_rActive').checked,
    lastGenerated: ''
  };
  if (!obj.name) { alert('請輸入名稱'); return; }
  if (!obj.amount) { alert('請輸入金額'); return; }
  if (editId) {
    var idx = d.recurring.findIndex(function(r) { return r.id === editId; });
    if (idx >= 0) {
      obj.lastGenerated = d.recurring[idx].lastGenerated || '';
      d.recurring[idx] = obj;
    }
  } else {
    d.recurring.push(obj);
  }
  save(); closeModal(); renderPlanRecurring();
}

function deletePlanRecurring(id) {
  showConfirmModal('確定刪除此定期項目？已建立的收支記錄不會受影響。', function() {
    var d = U();
    d.recurring = d.recurring.filter(function(r) { return r.id !== id; });
    save(); closeModal(); renderPlanRecurring();
  });
}

/** 計算生存天數 = 快速支配資產 / 近 3 月平均月支出 × 30 */
function computeSurvivalDays(cur) {
  var d = U();
  // 快速支配資產
  var bankAmt = d.accounts.filter(function(a) { return a.type === 'bank'; })
    .reduce(function(s, a) { return s + convert(a.balance, a.currency, cur); }, 0);
  var cashAmt = d.accounts.filter(function(a) { return a.type === 'cash'; })
    .reduce(function(s, a) { return s + convert(a.balance, a.currency, cur); }, 0);
  var investAmt = portfolioMarketValue(cur);
  var quickDisposable = bankAmt + cashAmt + investAmt;

  // 近 3 個月平均支出（不含當月）
  var now = new Date();
  var months = [];
  for (var i = 1; i <= 3; i++) {
    var dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'));
  }
  var monthlyExp = (d.expenses || []).filter(function(e) {
    return months.indexOf((e.date || '').slice(0, 7)) >= 0;
  }).reduce(function(s, e) { return s + convert(e.amount, e.currency, cur); }, 0);
  var avgMonthly = monthlyExp / 3;
  var days = avgMonthly > 0 ? (quickDisposable / avgMonthly) * 30 : Infinity;
  return { quickDisposable: quickDisposable, avgMonthly: avgMonthly, days: days };
}

// ============ D. 儲蓄目標 ============
function renderPlanGoals() {
  var d = U();
  var goals = d.savingsGoals || [];
  // 可用於分配的月結餘（用本月 saving 估計）
  var now = new Date(), thisMonth = now.toISOString().slice(0, 7);
  var tI = (d.incomes || []).filter(function(i) { return (i.date || '').slice(0, 7) === thisMonth; })
    .reduce(function(s, i) { return s + convert(i.amount, i.currency, 'TWD'); }, 0);
  var tE = (d.expenses || []).filter(function(e) { return (e.date || '').slice(0, 7) === thisMonth; })
    .reduce(function(s, e) { return s + convert(e.amount, e.currency, 'TWD'); }, 0);
  var monthSaving = tI - tE;

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
    '<div style="color:var(--text2);font-size:13px">設定買車、旅遊等大筆目標，系統根據每月結餘（本月 ' + fmt(monthSaving, 'TWD') + '）預估達成時間。</div>' +
    '<button class="btn btn-p btn-sm" onclick="openModal(\'planGoal\')">+ 新增目標</button></div>';

  if (goals.length === 0) {
    html += '<div style="text-align:center;color:var(--text3);padding:60px">尚無目標。</div>';
  } else {
    html += '<div class="stat-grid">' + goals.map(function(g) {
      // 進度用「專案累積」或「淨儲蓄」來算，這裡簡化為 monthSaving 基準
      var target = convert(g.targetAmount, g.currency || 'TWD', 'TWD');
      var saved = 0;
      // 若綁專案，取該專案累計淨收入為已儲蓄；否則顯示「需每月 ?」
      if (g.projectId) {
        var inc = (d.incomes || []).filter(function(i) { return i.projectId === g.projectId; })
          .reduce(function(s, i) { return s + convert(i.amount, i.currency, 'TWD'); }, 0);
        var exp = (d.expenses || []).filter(function(e) { return e.projectId === g.projectId; })
          .reduce(function(s, e) { return s + convert(e.amount, e.currency, 'TWD'); }, 0);
        saved = inc - exp;
      }
      var pct = target > 0 ? Math.min(100, Math.max(0, (saved / target) * 100)) : 0;
      var remaining = Math.max(0, target - saved);
      var monthsNeeded = monthSaving > 0 ? Math.ceil(remaining / monthSaving) : null;
      var deadline = g.deadline ? new Date(g.deadline) : null;
      var monthsUntilDeadline = deadline ? Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24 * 30))) : null;
      var warn = (monthsUntilDeadline !== null && monthsNeeded !== null && monthsNeeded > monthsUntilDeadline);

      return '<div class="stat-card" style="cursor:pointer" onclick="editPlanGoal(\'' + g.id + '\')">' +
        '<div class="label">' + (g.emoji || '🎯') + ' ' + g.name + '</div>' +
        '<div class="value c-primary">' + fmt(saved, 'TWD') + ' / ' + fmt(target, 'TWD') + '</div>' +
        '<div style="margin-top:8px;background:var(--border);border-radius:4px;height:8px;overflow:hidden"><div style="height:100%;background:' + (warn ? '#ef4444' : 'var(--primary)') + ';width:' + pct + '%"></div></div>' +
        '<div class="sub" style="margin-top:6px">' +
          pct.toFixed(1) + '% 已達成' +
          (g.deadline ? '｜' + g.deadline : '') +
          (monthsNeeded !== null ? '｜按本月結餘需 ' + monthsNeeded + ' 個月' : '') +
          (warn ? '<br><span class="c-red">⚠ 預估達不到期限</span>' : '') +
        '</div></div>';
    }).join('') + '</div>';
  }
  document.getElementById('planContent').innerHTML = html;
}

function editPlanGoal(id) { openModal('planGoal', id); }

function savePlanGoal() {
  var d = U();
  var editId = document.getElementById('f_editId').value;
  var obj = {
    id: editId || genId(),
    name: document.getElementById('f_gName').value.trim(),
    emoji: document.getElementById('f_gEmoji').value.trim() || '🎯',
    targetAmount: parseFloat(document.getElementById('f_gTarget').value) || 0,
    currency: document.getElementById('f_gCur').value,
    deadline: document.getElementById('f_gDeadline').value,
    projectId: document.getElementById('f_gProject').value,
    note: document.getElementById('f_gNote').value,
    status: 'active'
  };
  if (!obj.name) { alert('請輸入目標名稱'); return; }
  if (!obj.targetAmount) { alert('請輸入目標金額'); return; }
  if (editId) {
    var idx = d.savingsGoals.findIndex(function(g) { return g.id === editId; });
    if (idx >= 0) d.savingsGoals[idx] = obj;
  } else {
    d.savingsGoals.push(obj);
  }
  save(); closeModal(); renderPlanGoals();
}

function deletePlanGoal(id) {
  showConfirmModal('確定刪除此目標？', function() {
    var d = U();
    d.savingsGoals = d.savingsGoals.filter(function(g) { return g.id !== id; });
    save(); closeModal(); renderPlanGoals();
  });
}

// ============ E. 稅務預估（台灣綜合所得稅 2025 稅率，簡化版） ============
// 稅率級距（2025 年度，單位 TWD）
var TW_TAX_BRACKETS = [
  { limit: 590000,    rate: 0.05, deduct: 0 },
  { limit: 1330000,   rate: 0.12, deduct: 41300 },
  { limit: 2660000,   rate: 0.20, deduct: 147700 },
  { limit: 4980000,   rate: 0.30, deduct: 413700 },
  { limit: Infinity,  rate: 0.40, deduct: 911700 }
];
var TW_TAX_BASE_DEDUCTION = 97000;    // 免稅額（單身）
var TW_TAX_STANDARD_DEDUCTION = 131000; // 標準扣除額
var TW_TAX_SALARY_DEDUCTION = 218000;   // 薪資所得特別扣除額

function estimateTaiwanTax(grossIncome, salaryIncome, extraDeductions) {
  extraDeductions = extraDeductions || 0;
  var taxable = grossIncome - TW_TAX_BASE_DEDUCTION - TW_TAX_STANDARD_DEDUCTION - Math.min(salaryIncome, TW_TAX_SALARY_DEDUCTION) - extraDeductions;
  if (taxable <= 0) return { taxable: 0, tax: 0, bracket: null, effectiveRate: 0 };
  var bracket = TW_TAX_BRACKETS.find(function(b) { return taxable <= b.limit; });
  var tax = Math.max(0, taxable * bracket.rate - bracket.deduct);
  return { taxable: taxable, tax: tax, bracket: bracket, effectiveRate: tax / grossIncome };
}

function renderPlanTax() {
  var d = U();
  var year = new Date().getFullYear().toString();
  var yearInc = (d.incomes || []).filter(function(i) { return (i.date || '').slice(0, 4) === year; });
  // 以「薪資」類別為主要薪資所得
  var salaryInc = yearInc.filter(function(i) { return i.category === '薪資'; })
    .reduce(function(s, i) { return s + convert(i.amount, i.currency, 'TWD'); }, 0);
  var otherInc = yearInc.filter(function(i) { return i.category !== '薪資'; })
    .reduce(function(s, i) { return s + convert(i.amount, i.currency, 'TWD'); }, 0);
  var grossInc = salaryInc + otherInc;
  // 投資股息（簡化：投資收益類別）
  var dividend = yearInc.filter(function(i) { return i.category === '投資收益'; })
    .reduce(function(s, i) { return s + convert(i.amount, i.currency, 'TWD'); }, 0);

  var est = estimateTaiwanTax(grossInc, salaryInc, 0);
  var monthlyReserve = est.tax / 12;

  var html = '<div style="background:rgba(108,99,255,.05);border-left:3px solid var(--primary);padding:12px;margin-bottom:16px;font-size:13px;color:var(--text2)">' +
    '台灣綜合所得稅簡易試算（' + year + ' 年度）。採用標準扣除額 + 薪資所得特別扣除額，僅供估算；實際申報請以財政部公布稅率為準。</div>';

  html += '<div class="stat-grid">' +
    '<div class="stat-card"><div class="label">今年累計收入</div><div class="value c-green">' + fmt(grossInc, 'TWD') + '</div><div class="sub">薪資 ' + fmt(salaryInc, 'TWD') + '｜其他 ' + fmt(otherInc, 'TWD') + '</div></div>' +
    '<div class="stat-card"><div class="label">課稅所得淨額</div><div class="value c-blue">' + fmt(est.taxable, 'TWD') + '</div><div class="sub">扣除免稅 + 標扣 + 薪扣</div></div>' +
    '<div class="stat-card"><div class="label">預估年稅額</div><div class="value c-red">' + fmt(est.tax, 'TWD') + '</div><div class="sub">稅率 ' + (est.bracket ? (est.bracket.rate * 100).toFixed(0) + '%' : '0%') + '｜有效 ' + (est.effectiveRate * 100).toFixed(2) + '%</div></div>' +
    '<div class="stat-card"><div class="label">每月建議預備金</div><div class="value c-orange">' + fmt(monthlyReserve, 'TWD') + '</div><div class="sub">年稅額 ÷ 12</div></div>' +
    '</div>';

  // 稅率級距表
  html += '<h3 style="margin-top:24px">2025 年度稅率級距</h3>' +
    '<div class="table-wrap"><div class="table-scroll-wrap"><table>' +
    '<thead><tr><th>課稅所得淨額</th><th>稅率</th><th>累進差額</th></tr></thead><tbody>' +
    '<tr><td>0 – 590,000</td><td>5%</td><td>0</td></tr>' +
    '<tr><td>590,001 – 1,330,000</td><td>12%</td><td>41,300</td></tr>' +
    '<tr><td>1,330,001 – 2,660,000</td><td>20%</td><td>147,700</td></tr>' +
    '<tr><td>2,660,001 – 4,980,000</td><td>30%</td><td>413,700</td></tr>' +
    '<tr><td>4,980,001 以上</td><td>40%</td><td>911,700</td></tr>' +
    '</tbody></table></div></div>';

  html += '<div style="margin-top:16px;font-size:13px;color:var(--text3)">' +
    '📌 提示：目前以收入頁的「薪資」類別視為薪資所得，「投資收益」視為股息（' + fmt(dividend, 'TWD') + '）。實際申報還需考量扶養親屬、保險費、醫療費等列舉扣除。</div>';

  document.getElementById('planContent').innerHTML = html;
}

// ============ 財務成長 / 遊戲化 (v1.9.0) ============
var _currentGrowthTab = 'ratrace';

function renderGrowth() {
  _renderGrowthTab(_currentGrowthTab);
  // 每次進入此頁都檢查成就
  checkAchievements();
}

function switchGrowthTab(tab, btn) {
  _currentGrowthTab = tab;
  document.querySelectorAll('#page-growth .tab-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  _renderGrowthTab(tab);
}

function _renderGrowthTab(tab) {
  if (tab === 'ratrace') renderRatRace();
  else if (tab === 'achievements') renderAchievements();
  else if (tab === 'personality') renderPersonality();
  else if (tab === 'simulator') renderSimulator();
}

// ======== 1a. 老鼠賽跑進度條 ========
/** 近 N 天內符合條件的收支加總（以 TWD 計） */
function _sumRangeTWD(list, days, filterFn) {
  var now = new Date();
  var cutoff = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  return list.filter(function(x) { return x.date >= cutoff && (!filterFn || filterFn(x)); })
    .reduce(function(s, x) { return s + convert(x.amount, x.currency, 'TWD'); }, 0);
}

/** 計算被動收入 vs 支出比率（老鼠賽跑核心指標） */
function computeRatRace() {
  var d = U();
  var passiveCats = ['投資收益', '利息', '股利', '租金收入'];
  var passiveIncome = _sumRangeTWD(d.incomes || [], 30, function(i) {
    return passiveCats.indexOf(i.category) >= 0;
  });
  var totalExp = _sumRangeTWD(d.expenses || [], 30);
  var ratio = totalExp > 0 ? (passiveIncome / totalExp) : (passiveIncome > 0 ? Infinity : 0);
  var escaped = ratio >= 1;
  return { passiveIncome: passiveIncome, totalExp: totalExp, ratio: ratio, escaped: escaped };
}

function renderRatRace() {
  var r = computeRatRace();
  var pct = isFinite(r.ratio) ? Math.min(100, r.ratio * 100) : 100;
  var gap = Math.max(0, r.totalExp - r.passiveIncome);
  var color = r.escaped ? '#22c55e' : (pct > 50 ? '#f59e0b' : '#8b5cf6');

  var medalHtml = r.escaped
    ? '<div style="background:linear-gradient(135deg,#fbbf24,#f59e0b);border-radius:20px;padding:24px;margin-bottom:20px;text-align:center;color:#1a1a1a">' +
        '<div style="font-size:56px;line-height:1">🏅</div>' +
        '<div style="font-size:20px;font-weight:700;margin-top:8px">跳脫老鼠賽跑</div>' +
        '<div style="font-size:13px;margin-top:4px;opacity:.85">你的被動收入已覆蓋所有支出，恭喜達成財務自由起點</div>' +
      '</div>'
    : '';

  var html = medalHtml +
    '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">' +
        '<h3 style="margin:0">🏃 老鼠賽跑進度</h3>' +
        '<span style="font-size:28px;font-weight:700;color:' + color + '">' + (isFinite(r.ratio) ? (r.ratio * 100).toFixed(1) : '∞') + '%</span>' +
      '</div>' +
      '<div style="background:var(--border);border-radius:8px;height:18px;overflow:hidden;position:relative">' +
        '<div style="height:100%;background:linear-gradient(90deg,' + color + ',' + color + 'dd);width:' + pct + '%;transition:width .6s"></div>' +
        (r.escaped ? '<div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:#fff">🔓 已跳脫</div>' : '') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:20px">' +
        '<div><div style="font-size:11px;color:var(--text3)">近 30 天被動收入</div><div style="font-size:18px;font-weight:700" class="c-green">+' + fmt(r.passiveIncome, 'TWD') + '</div></div>' +
        '<div><div style="font-size:11px;color:var(--text3)">近 30 天總支出</div><div style="font-size:18px;font-weight:700" class="c-red">' + fmt(r.totalExp, 'TWD') + '</div></div>' +
        '<div><div style="font-size:11px;color:var(--text3)">' + (r.escaped ? '超額覆蓋' : '還差') + '</div><div style="font-size:18px;font-weight:700">' + fmt(Math.abs(gap), 'TWD') + '</div></div>' +
      '</div>' +
    '</div>' +
    '<div style="background:rgba(108,99,255,.08);border-left:3px solid var(--primary);padding:12px;font-size:13px;color:var(--text2);border-radius:0 8px 8px 0">' +
      '<strong style="color:var(--text)">💡 老鼠賽跑是什麼？</strong><br>' +
      '《富爸爸窮爸爸》的核心概念：一般人被薪水綁住，花錢的速度追著賺錢的速度。當你的<strong style="color:var(--text)">被動收入（投資收益、利息、股利、租金）</strong>能完全覆蓋生活支出，就不必再為錢工作——這就是「跳脫老鼠賽跑」。' +
    '</div>' +
    '<div style="margin-top:12px;font-size:12px;color:var(--text3)">' +
      '被動收入計算範圍：近 30 天「投資收益」「利息」「股利」「租金收入」四類別的收入。若你的被動收入不屬於這些類別，請在收入頁手動切換。' +
    '</div>';
  document.getElementById('growthContent').innerHTML = html;
}

// ======== 1c. 成就解鎖 ========
var ACHIEVEMENTS = [
  { id: 'ach_first_entry', emoji: '📝', name: '邁出第一步', desc: '建立任一筆收入或支出記錄',
    check: function(d) { return (d.incomes || []).length + (d.expenses || []).length > 0; } },
  { id: 'ach_streak_30', emoji: '🔥', name: '連續 30 天', desc: '近 30 天每天都有記錄',
    check: function(d) {
      var today = new Date();
      var days = {};
      [].concat(d.incomes || [], d.expenses || []).forEach(function(x) {
        if (x.date) days[x.date] = true;
      });
      for (var i = 0; i < 30; i++) {
        var dt = new Date(today - i * 86400000).toISOString().slice(0, 10);
        if (!days[dt]) return false;
      }
      return true;
    } },
  { id: 'ach_first_dividend', emoji: '👁', name: '財富之眼', desc: '首筆股利/投資收益入帳',
    check: function(d) { return (d.incomes || []).some(function(i) { return ['投資收益','利息','股利','租金收入'].indexOf(i.category) >= 0; }); } },
  { id: 'ach_emergency_fund', emoji: '🛡', name: '護盾值滿點', desc: '緊急預備金 ≥ 6 個月',
    check: function(d) {
      var cashAmt = (d.accounts || []).filter(function(a) { return a.type === 'cash'; }).reduce(function(s, a) { return s + convert(a.balance, a.currency, 'TWD'); }, 0);
      var bankAmt = (d.accounts || []).filter(function(a) { return a.type === 'bank'; }).reduce(function(s, a) { return s + convert(a.balance, a.currency, 'TWD'); }, 0);
      var rec = (d.receivables || []).filter(function(r) { return r.type === 'receivable' && r.status === 'pending'; }).reduce(function(s, r) { return s + convert(r.amount, r.currency, 'TWD'); }, 0);
      var liquid = cashAmt + bankAmt + portfolioMarketValue('TWD') + rec;
      var tE = _sumRangeTWD(d.expenses || [], 30);
      return tE > 0 && (liquid / tE) >= 6;
    } },
  { id: 'ach_saving_rate', emoji: '💪', name: '意志力 +10', desc: '近 3 月儲蓄率連續 ≥ 20%',
    check: function(d) {
      var now = new Date();
      for (var i = 0; i < 3; i++) {
        var dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
        var m = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
        var inc = (d.incomes || []).filter(function(x) { return (x.date || '').slice(0, 7) === m; }).reduce(function(s, x) { return s + convert(x.amount, x.currency, 'TWD'); }, 0);
        var exp = (d.expenses || []).filter(function(x) { return (x.date || '').slice(0, 7) === m; }).reduce(function(s, x) { return s + convert(x.amount, x.currency, 'TWD'); }, 0);
        if (inc <= 0) return false;
        if ((inc - exp) / inc < 0.2) return false;
      }
      return true;
    } },
  { id: 'ach_low_debt', emoji: '⚖', name: '負債控制', desc: '負債比率 < 40%',
    check: function(d) {
      var cashAmt = (d.accounts || []).filter(function(a) { return a.type === 'cash'; }).reduce(function(s, a) { return s + convert(a.balance, a.currency, 'TWD'); }, 0);
      var bankAmt = (d.accounts || []).filter(function(a) { return a.type === 'bank'; }).reduce(function(s, a) { return s + convert(a.balance, a.currency, 'TWD'); }, 0);
      var invAmt = portfolioMarketValue('TWD');
      var propAmt = (d.properties || []).reduce(function(s, p) { return s + convert(p.currentValue || 0, p.currency || 'TWD', 'TWD'); }, 0);
      var vehAmt = (d.vehicles || []).reduce(function(s, v) { return s + convert(v.currentValue || 0, v.currency || 'TWD', 'TWD'); }, 0);
      var rec = (d.receivables || []).filter(function(r) { return r.type === 'receivable' && r.status === 'pending'; }).reduce(function(s, r) { return s + convert(r.amount, r.currency, 'TWD'); }, 0);
      var pay = (d.receivables || []).filter(function(r) { return r.type === 'payable' && r.status === 'pending'; }).reduce(function(s, r) { return s + convert(r.amount, r.currency, 'TWD'); }, 0);
      var debt = (d.accounts || []).filter(function(a) { return a.type === 'credit'; }).reduce(function(s, a) { return s + convert(Math.abs(a.balance), a.currency, 'TWD'); }, 0);
      var asset = cashAmt + bankAmt + invAmt + rec + propAmt + vehAmt;
      var liab = debt + pay;
      return asset > 0 && (liab / asset) < 0.4;
    } },
  { id: 'ach_millionaire', emoji: '💰', name: '百萬身價', desc: '淨資產突破 NT$1,000,000',
    check: function(d) {
      var cashAmt = (d.accounts || []).filter(function(a) { return a.type === 'cash'; }).reduce(function(s, a) { return s + convert(a.balance, a.currency, 'TWD'); }, 0);
      var bankAmt = (d.accounts || []).filter(function(a) { return a.type === 'bank'; }).reduce(function(s, a) { return s + convert(a.balance, a.currency, 'TWD'); }, 0);
      var invAmt = portfolioMarketValue('TWD');
      var propAmt = (d.properties || []).reduce(function(s, p) { return s + convert(p.currentValue || 0, p.currency || 'TWD', 'TWD'); }, 0);
      var vehAmt = (d.vehicles || []).reduce(function(s, v) { return s + convert(v.currentValue || 0, v.currency || 'TWD', 'TWD'); }, 0);
      var rec = (d.receivables || []).filter(function(r) { return r.type === 'receivable' && r.status === 'pending'; }).reduce(function(s, r) { return s + convert(r.amount, r.currency, 'TWD'); }, 0);
      var pay = (d.receivables || []).filter(function(r) { return r.type === 'payable' && r.status === 'pending'; }).reduce(function(s, r) { return s + convert(r.amount, r.currency, 'TWD'); }, 0);
      var debt = (d.accounts || []).filter(function(a) { return a.type === 'credit'; }).reduce(function(s, a) { return s + convert(Math.abs(a.balance), a.currency, 'TWD'); }, 0);
      return (cashAmt + bankAmt + invAmt + rec + propAmt + vehAmt - debt - pay) >= 1000000;
    } },
  { id: 'ach_first_position', emoji: '📊', name: '首檔持倉', desc: '在投資組合建立第一筆持倉',
    check: function(d) { return (d.portfolio || []).length > 0; } },
  { id: 'ach_escape_ratrace', emoji: '🏅', name: '跳脫老鼠賽跑', desc: '被動收入 ≥ 總支出',
    check: function(d) { return computeRatRace().escaped; } },
  { id: 'ach_project_done', emoji: '🎯', name: '專案達標', desc: '任一專案達成預算目標（未超支）',
    check: function(d) {
      return (d.projects || []).some(function(p) {
        if (!p.budget || p.status !== 'closed') return false;
        var exp = (d.expenses || []).filter(function(e) { return e.projectId === p.id; }).reduce(function(s, e) { return s + convert(e.amount, e.currency, 'TWD'); }, 0);
        return exp <= convert(p.budget, p.currency || 'TWD', 'TWD');
      });
    } }
];

/** 檢查所有成就；若有新解鎖則記錄並 toast 提示 */
function checkAchievements() {
  var d = U();
  if (!d.achievements) d.achievements = {};
  var newly = [];
  ACHIEVEMENTS.forEach(function(a) {
    if (d.achievements[a.id] && d.achievements[a.id].unlockedAt) return;
    try {
      if (a.check(d)) {
        d.achievements[a.id] = { unlockedAt: new Date().toISOString() };
        newly.push(a);
      }
    } catch (e) { /* 靜默 */ }
  });
  if (newly.length > 0) {
    save();
    newly.forEach(function(a, i) {
      setTimeout(function() {
        showToast('🎉 解鎖成就：' + a.emoji + ' ' + a.name + '｜' + a.desc);
      }, i * 1500);
    });
  }
}

function renderAchievements() {
  var d = U();
  if (!d.achievements) d.achievements = {};
  var unlocked = ACHIEVEMENTS.filter(function(a) { return d.achievements[a.id]; }).length;
  var total = ACHIEVEMENTS.length;
  var pct = (unlocked / total) * 100;

  var html = '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<h3 style="margin:0">🏆 成就進度 ' + unlocked + ' / ' + total + '</h3>' +
      '<span style="font-size:22px;font-weight:700;color:var(--primary-light)">' + pct.toFixed(0) + '%</span>' +
    '</div>' +
    '<div style="background:var(--border);border-radius:6px;height:10px;overflow:hidden">' +
      '<div style="height:100%;background:linear-gradient(90deg,#8b5cf6,#22d3ee);width:' + pct + '%"></div>' +
    '</div></div>';

  html += '<div class="stat-grid">' + ACHIEVEMENTS.map(function(a) {
    var got = d.achievements[a.id];
    var date = got ? new Date(got.unlockedAt).toISOString().slice(0, 10) : '';
    return '<div class="stat-card" style="text-align:center;' + (got ? '' : 'opacity:.45;filter:grayscale(.7)') + '">' +
      '<div style="font-size:48px;line-height:1;margin-bottom:8px">' + a.emoji + '</div>' +
      '<div style="font-weight:700;margin-bottom:4px">' + a.name + '</div>' +
      '<div style="font-size:12px;color:var(--text3);line-height:1.4">' + a.desc + '</div>' +
      (got ? '<div style="margin-top:8px;font-size:11px;color:var(--green)">✓ 已解鎖 ' + date + '</div>' : '<div style="margin-top:8px;font-size:11px;color:var(--text3)">🔒 尚未達成</div>') +
      '</div>';
  }).join('') + '</div>';

  document.getElementById('growthContent').innerHTML = html;
}

// ======== 1b. 財務性格診斷 ========
/** 依多指標推算使用者財務性格 */
function computePersonality() {
  var d = U();
  // 近 3 月收入、支出
  var now = new Date();
  var months = [];
  for (var i = 0; i < 3; i++) {
    var dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'));
  }
  var inc3 = (d.incomes || []).filter(function(x) { return months.indexOf((x.date || '').slice(0, 7)) >= 0; })
    .reduce(function(s, x) { return s + convert(x.amount, x.currency, 'TWD'); }, 0);
  var exp3 = (d.expenses || []).filter(function(x) { return months.indexOf((x.date || '').slice(0, 7)) >= 0; })
    .reduce(function(s, x) { return s + convert(x.amount, x.currency, 'TWD'); }, 0);
  var savingRate = inc3 > 0 ? (inc3 - exp3) / inc3 : 0;

  // 投資占流動資產比
  var cashAmt = (d.accounts || []).filter(function(a) { return a.type === 'cash'; }).reduce(function(s, a) { return s + convert(a.balance, a.currency, 'TWD'); }, 0);
  var bankAmt = (d.accounts || []).filter(function(a) { return a.type === 'bank'; }).reduce(function(s, a) { return s + convert(a.balance, a.currency, 'TWD'); }, 0);
  var invAmt = portfolioMarketValue('TWD');
  var liquid = cashAmt + bankAmt + invAmt;
  var investRatio = liquid > 0 ? invAmt / liquid : 0;

  // 支出變異度（3 月各月支出的標準差 / 平均）
  var monthExps = months.map(function(m) {
    return (d.expenses || []).filter(function(x) { return (x.date || '').slice(0, 7) === m; })
      .reduce(function(s, x) { return s + convert(x.amount, x.currency, 'TWD'); }, 0);
  });
  var avgExp = monthExps.reduce(function(s, v) { return s + v; }, 0) / 3;
  var variance = avgExp > 0 ? Math.sqrt(monthExps.reduce(function(s, v) { return s + Math.pow(v - avgExp, 2); }, 0) / 3) / avgExp : 0;

  // 應付款占總負債比
  var debt = (d.accounts || []).filter(function(a) { return a.type === 'credit'; }).reduce(function(s, a) { return s + convert(Math.abs(a.balance), a.currency, 'TWD'); }, 0);
  var pay = (d.receivables || []).filter(function(r) { return r.type === 'payable' && r.status === 'pending'; }).reduce(function(s, r) { return s + convert(r.amount, r.currency, 'TWD'); }, 0);

  // 分型邏輯
  var type, emoji, slogan, advice;
  if (inc3 === 0 && exp3 === 0) {
    type = '新手村村民'; emoji = '🐣'; slogan = '剛踏入記帳世界，快記下第一筆吧！';
    advice = '建議先記錄 7 天的收支，讓系統有足夠資料來診斷你的性格。';
  } else if (savingRate < 0.05 && investRatio < 0.1) {
    type = '月光族'; emoji = '🌙'; slogan = '賺多少花多少，錢包永遠是空的';
    advice = '試著從每月存下 10% 開始。設定「定期支出」功能，看清楚必要支出後就能知道還能花多少。';
  } else if (savingRate > 0.3 && investRatio < 0.1) {
    type = '守財奴'; emoji = '🐉'; slogan = '寧可屯著不花也不敢投資';
    advice = '儲蓄習慣很棒，但通膨會慢慢蠶食購買力。建議拿閒錢的 20-30% 開始定期定額 ETF，讓錢幫你工作。';
  } else if (investRatio > 0.5 && variance > 0.3) {
    type = '冒險家'; emoji = '🏴‍☠'; slogan = '進可攻、退可...還是進攻';
    advice = '投資積極但支出不穩定，建議建立 6 個月緊急預備金在高流動帳戶裡，抵抗下檔風險。';
  } else if (investRatio > 0.25 && savingRate > 0.15) {
    type = '投資兒'; emoji = '📈'; slogan = '穩紮穩打，讓資產複利滾動';
    advice = '配置很健康。下一階段：檢視資產配置比例（股/債/現金）是否符合你的風險偏好與年齡。';
  } else if (pay > debt && pay > 10000) {
    type = '欠債俠'; emoji = '📮'; slogan = '應付款堆積，現金流吃緊';
    advice = '先處理應付款，避免滾雪球。應付款是隱形的短期負債，儘快結清再規劃投資。';
  } else {
    type = '平衡立'; emoji = '⚖'; slogan = '收支穩定、進退有度';
    advice = '各項指標都在健康區間。下一步：挑戰儲蓄率 20%+ 或增加被動收入來源，往「跳脫老鼠賽跑」邁進。';
  }

  var result = {
    type: type, emoji: emoji, slogan: slogan, advice: advice,
    score: { savingRate: savingRate, investRatio: investRatio, variance: variance, inc3: inc3, exp3: exp3 },
    updatedAt: new Date().toISOString()
  };
  d.personality = result;
  return result;
}

function renderPersonality() {
  var p = computePersonality();
  var sr = p.score;
  save();

  var html = '<div style="background:linear-gradient(135deg,rgba(139,92,246,.15),rgba(34,211,238,.15));border:1px solid var(--primary);border-radius:20px;padding:32px;margin-bottom:20px;text-align:center">' +
    '<div style="font-size:96px;line-height:1;margin-bottom:8px">' + p.emoji + '</div>' +
    '<div style="font-size:28px;font-weight:700;margin-bottom:4px">' + p.type + '</div>' +
    '<div style="font-size:14px;color:var(--text2);margin-bottom:16px">「' + p.slogan + '」</div>' +
    '<div style="max-width:500px;margin:0 auto;background:var(--card);border-radius:12px;padding:16px;font-size:13px;text-align:left;line-height:1.6">' +
      '<strong>💬 建議：</strong>' + p.advice +
    '</div>' +
  '</div>';

  html += '<h3 style="margin:0 0 12px">📊 診斷指標</h3>' +
    '<div class="stat-grid">' +
      '<div class="stat-card"><div class="label">近 3 月儲蓄率</div>' +
        '<div class="value ' + (sr.savingRate >= 0.2 ? 'c-green' : sr.savingRate >= 0.1 ? 'c-orange' : 'c-red') + '">' + (sr.savingRate * 100).toFixed(1) + '%</div>' +
        '<div class="sub">收入 ' + fmt(sr.inc3, 'TWD') + '｜支出 ' + fmt(sr.exp3, 'TWD') + '</div></div>' +
      '<div class="stat-card"><div class="label">投資占流動資產</div>' +
        '<div class="value c-blue">' + (sr.investRatio * 100).toFixed(1) + '%</div>' +
        '<div class="sub">>25% 積極｜10-25% 平衡｜<10% 保守</div></div>' +
      '<div class="stat-card"><div class="label">支出穩定度</div>' +
        '<div class="value ' + (sr.variance < 0.2 ? 'c-green' : sr.variance < 0.4 ? 'c-orange' : 'c-red') + '">' + (sr.variance < 0.2 ? '穩定' : sr.variance < 0.4 ? '波動' : '大起大落') + '</div>' +
        '<div class="sub">變異係數 ' + (sr.variance * 100).toFixed(1) + '%</div></div>' +
    '</div>' +
    '<div style="margin-top:16px;font-size:12px;color:var(--text3)">性格分類僅供參考，每次打開此頁會依最新資料重新診斷。</div>';

  document.getElementById('growthContent').innerHTML = html;
}

// ======== 2b. 人生大事模擬器 ========
var LIFE_SCENARIOS = [
  {
    id: 'marriage', emoji: '💍', name: '結婚',
    desc: '婚禮 + 蜜月 + 戒指等一次性支出',
    fields: [{ key: 'oneTime', label: '一次性支出', defaultVal: 300000, unit: 'TWD' }],
    impact: function(p) { return { oneTime: p.oneTime, monthly: 0 }; }
  },
  {
    id: 'house', emoji: '🏠', name: '買房',
    desc: '自備款 + 房貸月付 (20 年 2% 利率)',
    fields: [
      { key: 'price', label: '房屋總價', defaultVal: 15000000, unit: 'TWD' },
      { key: 'downRatio', label: '自備款比例 (%)', defaultVal: 30, unit: '%' }
    ],
    impact: function(p) {
      var down = p.price * p.downRatio / 100;
      var loan = p.price - down;
      // 房貸月付 = loan × r × (1+r)^n / ((1+r)^n - 1), r=2%/12, n=240
      var r = 0.02 / 12, n = 240;
      var monthly = loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      return { oneTime: down, monthly: monthly };
    }
  },
  {
    id: 'car', emoji: '🚗', name: '買車',
    desc: '一次性車價 + 每月油料/保險/保養',
    fields: [
      { key: 'price', label: '車價', defaultVal: 800000, unit: 'TWD' },
      { key: 'monthly', label: '每月相關開銷', defaultVal: 5000, unit: 'TWD' }
    ],
    impact: function(p) { return { oneTime: p.price, monthly: p.monthly }; }
  },
  {
    id: 'cat', emoji: '🐱', name: '養貓',
    desc: '一次性醫療儲備 + 每月飼料/砂/保養',
    fields: [
      { key: 'oneTime', label: '一次性支出（醫療儲備）', defaultVal: 30000, unit: 'TWD' },
      { key: 'monthly', label: '每月開銷', defaultVal: 5000, unit: 'TWD' }
    ],
    impact: function(p) { return { oneTime: p.oneTime, monthly: p.monthly }; }
  },
  {
    id: 'startup', emoji: '🚀', name: '離職創業',
    desc: '設備投入 + 收入歸零（支出照舊）',
    fields: [
      { key: 'equipment', label: '設備/開辦費', defaultVal: 200000, unit: 'TWD' },
      { key: 'incomeLoss', label: '每月收入歸零（現月薪）', defaultVal: 50000, unit: 'TWD' }
    ],
    impact: function(p) { return { oneTime: p.equipment, monthly: p.incomeLoss }; }
  },
  {
    id: 'baby', emoji: '👶', name: '生小孩',
    desc: '生產一次性 + 每月奶粉/尿布/保母',
    fields: [
      { key: 'oneTime', label: '一次性支出（生產/月子）', defaultVal: 80000, unit: 'TWD' },
      { key: 'monthly', label: '每月育兒開銷', defaultVal: 20000, unit: 'TWD' }
    ],
    impact: function(p) { return { oneTime: p.oneTime, monthly: p.monthly }; }
  }
];

function renderSimulator() {
  var html = '<div style="color:var(--text2);font-size:13px;margin-bottom:16px">選擇人生場景，系統會根據目前資產 + 近 3 月平均收支，模擬 <strong>5 年後</strong>的財務變化。</div>';

  html += '<div class="stat-grid">' + LIFE_SCENARIOS.map(function(s) {
    return '<div class="stat-card" style="cursor:pointer;text-align:center" onclick="openLifeSimulator(\'' + s.id + '\')">' +
      '<div style="font-size:48px;line-height:1;margin-bottom:8px">' + s.emoji + '</div>' +
      '<div style="font-weight:700">' + s.name + '</div>' +
      '<div style="font-size:12px;color:var(--text3);margin-top:4px">' + s.desc + '</div>' +
      '</div>';
  }).join('') + '</div>';

  html += '<div id="simResult" style="margin-top:20px"></div>';
  document.getElementById('growthContent').innerHTML = html;
}

function openLifeSimulator(scenarioId) {
  var s = LIFE_SCENARIOS.find(function(x) { return x.id === scenarioId; });
  if (!s) return;
  var m = document.getElementById('modalContent');
  m.innerHTML = '<h3>' + s.emoji + ' ' + s.name + '模擬</h3>' +
    '<p style="color:var(--text2);font-size:13px;margin-top:0">' + s.desc + '</p>' +
    s.fields.map(function(f) {
      return '<div class="form-group"><label>' + f.label + ' (' + f.unit + ')</label><input type="number" id="simF_' + f.key + '" value="' + f.defaultVal + '"></div>';
    }).join('') +
    '<input type="hidden" id="simF_scenarioId" value="' + scenarioId + '">' +
    '<div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="runLifeSimulation()">開始模擬</button></div>';
  document.getElementById('modalOverlay').classList.add('show');
}

function runLifeSimulation() {
  var d = U();
  var sId = document.getElementById('simF_scenarioId').value;
  var s = LIFE_SCENARIOS.find(function(x) { return x.id === sId; });
  var params = {};
  s.fields.forEach(function(f) { params[f.key] = parseFloat(document.getElementById('simF_' + f.key).value) || 0; });
  var imp = s.impact(params);

  // 現況
  var cashAmt = (d.accounts || []).filter(function(a) { return a.type === 'cash'; }).reduce(function(s2, a) { return s2 + convert(a.balance, a.currency, 'TWD'); }, 0);
  var bankAmt = (d.accounts || []).filter(function(a) { return a.type === 'bank'; }).reduce(function(s2, a) { return s2 + convert(a.balance, a.currency, 'TWD'); }, 0);
  var invAmt = portfolioMarketValue('TWD');
  var rec = (d.receivables || []).filter(function(r) { return r.type === 'receivable' && r.status === 'pending'; }).reduce(function(s2, r) { return s2 + convert(r.amount, r.currency, 'TWD'); }, 0);
  var propAmt = (d.properties || []).reduce(function(s2, p) { return s2 + convert(p.currentValue || 0, p.currency || 'TWD', 'TWD'); }, 0);
  var vehAmt = (d.vehicles || []).reduce(function(s2, v) { return s2 + convert(v.currentValue || 0, v.currency || 'TWD', 'TWD'); }, 0);
  var debt = (d.accounts || []).filter(function(a) { return a.type === 'credit'; }).reduce(function(s2, a) { return s2 + convert(Math.abs(a.balance), a.currency, 'TWD'); }, 0);
  var pay = (d.receivables || []).filter(function(r) { return r.type === 'payable' && r.status === 'pending'; }).reduce(function(s2, r) { return s2 + convert(r.amount, r.currency, 'TWD'); }, 0);
  var netAssetNow = cashAmt + bankAmt + invAmt + rec + propAmt + vehAmt - debt - pay;

  // 近 3 月平均月收支
  var now = new Date();
  var months = [];
  for (var i = 1; i <= 3; i++) {
    var dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'));
  }
  var inc3 = (d.incomes || []).filter(function(x) { return months.indexOf((x.date || '').slice(0, 7)) >= 0; }).reduce(function(s2, x) { return s2 + convert(x.amount, x.currency, 'TWD'); }, 0);
  var exp3 = (d.expenses || []).filter(function(x) { return months.indexOf((x.date || '').slice(0, 7)) >= 0; }).reduce(function(s2, x) { return s2 + convert(x.amount, x.currency, 'TWD'); }, 0);
  var avgIncome = inc3 / 3, avgExpense = exp3 / 3;

  // 模擬 5 年 = 60 個月
  // 情境影響：一次性從淨資產扣除；每月新增 "額外支出" 或 "收入損失"
  // 注意「離職創業」的 monthly 其實是收入損失 → 影響現金流
  var simNetAsset = netAssetNow - imp.oneTime;
  var cashFlow = avgIncome - avgExpense;
  if (sId === 'startup') cashFlow -= imp.monthly;  // 收入歸零
  else cashFlow -= imp.monthly;                    // 其他場景都是新增支出
  // 每月淨現金流 × 60 月加到淨資產
  var simNetAsset5y = simNetAsset + cashFlow * 60;

  // 產生 60 個月趨勢點
  var points = [];
  for (var m2 = 0; m2 <= 60; m2++) {
    points.push(simNetAsset + cashFlow * m2);
  }

  // 計算「破產月」— 當 net asset 首次 < 0
  var bankruptMonth = -1;
  for (var i2 = 0; i2 < points.length; i2++) {
    if (points[i2] < 0) { bankruptMonth = i2; break; }
  }

  var baseline5y = netAssetNow + (avgIncome - avgExpense) * 60;
  var delta = simNetAsset5y - baseline5y;

  closeModal();
  var resultEl = document.getElementById('simResult');
  if (!resultEl) return;

  var html = '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px">' +
    '<h3 style="margin-top:0">' + s.emoji + ' ' + s.name + '｜5 年模擬結果</h3>' +
    '<div class="stat-grid">' +
      '<div class="stat-card"><div class="label">現在淨資產</div><div class="value c-blue">' + fmt(netAssetNow, 'TWD') + '</div></div>' +
      '<div class="stat-card"><div class="label">5 年後（決定此情境）</div><div class="value ' + (simNetAsset5y >= 0 ? 'c-primary' : 'c-red') + '">' + fmt(simNetAsset5y, 'TWD') + '</div></div>' +
      '<div class="stat-card"><div class="label">5 年後（不做此事）</div><div class="value">' + fmt(baseline5y, 'TWD') + '</div></div>' +
      '<div class="stat-card"><div class="label">影響差額</div><div class="value ' + (delta >= 0 ? 'c-green' : 'c-red') + '">' + (delta >= 0 ? '+' : '') + fmt(delta, 'TWD') + '</div></div>' +
    '</div>' +
    (bankruptMonth >= 0
      ? '<div style="background:rgba(239,68,68,.1);border:1px solid var(--red);border-radius:12px;padding:12px;margin-top:16px;font-size:13px"><strong class="c-red">⚠ 風險警示：</strong>按此情境，約第 ' + bankruptMonth + ' 個月（' + (bankruptMonth / 12).toFixed(1) + ' 年）淨資產會跌破 0。建議調整參數或提前增加收入。</div>'
      : '<div style="background:rgba(34,197,94,.1);border:1px solid var(--green);border-radius:12px;padding:12px;margin-top:16px;font-size:13px"><strong class="c-green">✓ 可承受：</strong>5 年內淨資產保持正值，此決定在財務面可以承擔。</div>') +
    '<canvas id="simChart" height="180" style="margin-top:16px"></canvas>' +
  '</div>';
  resultEl.innerHTML = html;

  // 繪製 60 月曲線
  setTimeout(function() {
    var cv = document.getElementById('simChart');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var w = cv.width = cv.offsetWidth, h = cv.height = cv.offsetHeight;
    var max = Math.max.apply(null, points.concat([baseline5y, 0])), min = Math.min.apply(null, points.concat([0]));
    var pad = 20;
    ctx.clearRect(0, 0, w, h);
    function y(v) { return pad + (h - 2 * pad) * (1 - (v - min) / (max - min || 1)); }
    // 0 線
    var y0 = y(0);
    ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad, y0); ctx.lineTo(w - pad, y0); ctx.stroke();
    ctx.setLineDash([]);
    // 基準（不做此事）
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (var k = 0; k <= 60; k++) {
      var xp = pad + (w - 2 * pad) * k / 60;
      var yp = y(netAssetNow + (avgIncome - avgExpense) * k);
      if (k === 0) ctx.moveTo(xp, yp); else ctx.lineTo(xp, yp);
    }
    ctx.stroke();
    // 情境線
    ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (var k2 = 0; k2 < points.length; k2++) {
      var xp2 = pad + (w - 2 * pad) * k2 / 60;
      var yp2 = y(points[k2]);
      if (k2 === 0) ctx.moveTo(xp2, yp2); else ctx.lineTo(xp2, yp2);
    }
    ctx.stroke();
    // 標籤
    ctx.fillStyle = '#9ca3af'; ctx.font = '11px sans-serif';
    ctx.fillText('0', 4, y0 + 3);
    ctx.fillText('今', pad - 4, h - 4);
    ctx.fillText('5 年後', w - pad - 30, h - 4);
    ctx.fillStyle = '#8b5cf6'; ctx.fillText('● 此情境', w - 100, pad + 10);
    ctx.fillStyle = '#6b7280'; ctx.fillText('● 不做此事', w - 100, pad + 26);
  }, 50);
}

// ============ 匯率換算 ============
function doConvert() {
  var amt = parseFloat(document.getElementById('convFrom').value) || 0;
  var from = document.getElementById('convFromCur').value;
  var to = document.getElementById('convToCur').value;
  var result = convert(amt, from, to);
  document.getElementById('convTo').value = result.toFixed(to === 'JPY' ? 0 : 2);
  document.getElementById('convResult').textContent = fmt(amt, from) + ' = ' + fmt(result, to);
}

/** 建構專案下拉選項 HTML（含「不歸屬」選項） */
function _buildProjectOptions(selectedId) {
  var d = U();
  var opts = '<option value="">（不歸屬專案）</option>';
  opts += (d.projects || []).filter(function(p) { return p.status !== 'closed'; }).map(function(p) {
    return '<option value="' + p.id + '"' + (selectedId === p.id ? ' selected' : '') + '>' + (p.emoji || '📁') + ' ' + p.name + '</option>';
  }).join('');
  return opts;
}

// ============ 模態對話框 ============
function openModal(type, editId) {
  var m = document.getElementById('modalContent');
  var d = U();

  if (type === 'income') {
    var editing = editId ? d.incomes.find(function(i) { return i.id === editId; }) : null;
    var cats = _buildCatOptions(d.incomeCategories, editing ? editing.category : '');
    var acctOpts = d.accounts.map(function(a) {
      return '<option value="' + a.id + '"' + (editing && editing.accountId === a.id ? ' selected' : '') + '>' + a.name + '</option>';
    }).join('');
    var curOpts = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editing && editing.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    m.innerHTML = '<h3>' + (editing ? '編輯' : '新增') + '收入</h3>' +
      '<div class="form-group"><label>日期</label><input type="date" id="f_date" value="' + (editing ? editing.date : new Date().toISOString().slice(0, 10)) + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>類別</label><select id="f_cat">' + cats + '</select></div>' +
      '<div class="form-group"><label>帳戶</label><select id="f_acct">' + acctOpts + '</select></div></div>' +
      '<div class="form-row"><div class="form-group"><label>金額</label><input type="number" id="f_amt" step="0.01" value="' + (editing ? editing.amount : '') + '"></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_cur">' + curOpts + '</select></div></div>' +
      '<div class="form-group"><label>專案標籤</label><select id="f_project">' + _buildProjectOptions(editing ? editing.projectId : '') + '</select></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_note" value="' + (editing ? editing.note || '' : '') + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>支付對象</label><input type="text" id="f_payTo" placeholder="例：新民小學" value="' + (editing ? editing.payTo || '' : '') + '"></div>' +
      '<div class="form-group"><label>使用對象</label><input type="text" id="f_usedBy" placeholder="例：女兒" value="' + (editing ? editing.usedBy || '' : '') + '"></div></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveIncome()">儲存</button></div>';
  } else if (type === 'expense') {
    var editing2 = editId ? d.expenses.find(function(e) { return e.id === editId; }) : null;
    var cats2 = _buildCatOptions(d.expenseCategories, editing2 ? editing2.category : '');
    var payMethods = ['信用卡','現金','銀行轉帳','電子支付'].map(function(pm) {
      return '<option value="' + pm + '"' + (editing2 && editing2.payMethod === pm ? ' selected' : '') + '>' + pm + '</option>';
    }).join('');
    var acctOpts2 = d.accounts.map(function(a) {
      return '<option value="' + a.id + '"' + (editing2 && editing2.accountId === a.id ? ' selected' : '') + '>' + a.name + '</option>';
    }).join('');
    var curOpts2 = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editing2 && editing2.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    var showTransferAcct = editing2 && editing2.payMethod === '銀行轉帳';
    m.innerHTML = '<h3>' + (editing2 ? '編輯' : '新增') + '支出</h3>' +
      '<div class="form-group"><label>日期</label><input type="date" id="f_date" value="' + (editing2 ? editing2.date : new Date().toISOString().slice(0, 10)) + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>類別</label><select id="f_cat">' + cats2 + '</select></div>' +
      '<div class="form-group"><label>支付方式</label><select id="f_pay" onchange="toggleTransferAcct()">' + payMethods + '</select></div></div>' +
      '<div class="form-row"><div class="form-group"><label>金額</label><input type="number" id="f_amt" step="0.01" value="' + (editing2 ? editing2.amount : '') + '"></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_cur">' + curOpts2 + '</select></div></div>' +
      '<div class="form-group"><label>帳戶</label><select id="f_acct">' + acctOpts2 + '</select></div>' +
      '<div class="form-group" id="transferAcctGroup" style="display:' + (showTransferAcct ? 'block' : 'none') + '"><label>轉入帳號</label><input type="text" id="f_transferAcct" placeholder="例：012-345678901234" value="' + (editing2 ? editing2.transferAccount || '' : '') + '"></div>' +
      '<div class="form-group"><label>專案標籤</label><select id="f_project">' + _buildProjectOptions(editing2 ? editing2.projectId : '') + '</select></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_note" value="' + (editing2 ? editing2.note || '' : '') + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>支付對象</label><input type="text" id="f_payTo" placeholder="例：新民小學" value="' + (editing2 ? editing2.payTo || '' : '') + '"></div>' +
      '<div class="form-group"><label>使用對象</label><input type="text" id="f_usedBy" placeholder="例：女兒" value="' + (editing2 ? editing2.usedBy || '' : '') + '"></div></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveExpense()">儲存</button></div>';
  } else if (type === 'account') {
    var editing3 = editId ? d.accounts.find(function(a) { return a.id === editId; }) : null;
    var typeOpts = Object.entries(ACCOUNT_TYPES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editing3 && editing3.type === entry[0] ? ' selected' : '') + '>' + entry[1] + '</option>';
    }).join('');
    var curOpts3 = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editing3 && editing3.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    // Bug 2: 編輯 payable 帳戶時顯示正數餘額
    var displayBal = editing3 ? (editing3.type === 'payable' ? Math.abs(editing3.balance) : editing3.balance) : 0;
    m.innerHTML = '<h3>' + (editing3 ? '編輯' : '新增') + '帳戶</h3>' +
      '<div class="form-group"><label>帳戶名稱</label><input type="text" id="f_name" value="' + (editing3 ? editing3.name : '') + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>類型</label><select id="f_type">' + typeOpts + '</select></div>' +
      '<div class="form-group"><label>機構</label><input type="text" id="f_inst" value="' + (editing3 ? editing3.institution || '' : '') + '"></div></div>' +
      '<div class="form-row"><div class="form-group"><label>幣別</label><select id="f_cur">' + curOpts3 + '</select></div>' +
      '<div class="form-group"><label>餘額</label><input type="number" id="f_bal" step="0.01" value="' + displayBal + '"></div></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_note" value="' + (editing3 ? editing3.note || '' : '') + '"></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveAccount()">儲存</button></div>';
    if (!editing3) document.getElementById('f_type').value = currentAssetTab;
  } else if (type === 'transfer') {
    var editing4 = editId ? (d.transfers || []).find(function(t) { return t.id === editId; }) : null;
    var allAccts = d.accounts;
    var fromOpts = allAccts.map(function(a) {
      return '<option value="' + a.id + '"' + (editing4 && editing4.fromAccountId === a.id ? ' selected' : '') + '>' + a.name + ' (' + (ACCOUNT_TYPES[a.type] || a.type) + ')</option>';
    }).join('');
    var toOpts = allAccts.map(function(a) {
      return '<option value="' + a.id + '"' + (editing4 && editing4.toAccountId === a.id ? ' selected' : '') + '>' + a.name + ' (' + (ACCOUNT_TYPES[a.type] || a.type) + ')</option>';
    }).join('');
    var curOpts4 = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editing4 && editing4.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    m.innerHTML = '<h3>' + (editing4 ? '編輯' : '新增') + '帳戶轉帳</h3>' +
      '<div class="form-group"><label>日期</label><input type="date" id="f_date" value="' + (editing4 ? editing4.date : new Date().toISOString().slice(0, 10)) + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>轉出帳戶</label><select id="f_fromAcct">' + fromOpts + '</select></div>' +
      '<div class="form-group"><label>轉入帳戶</label><select id="f_toAcct">' + toOpts + '</select></div></div>' +
      '<div class="form-row"><div class="form-group"><label>金額</label><input type="number" id="f_amt" step="0.01" value="' + (editing4 ? editing4.amount : '') + '"></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_cur">' + curOpts4 + '</select></div></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_note" placeholder="例：繳信用卡帳單" value="' + (editing4 ? editing4.note || '' : '') + '"></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveTransfer()">儲存</button></div>';
  } else if (type === 'receivable') {
    var isRecv = currentAssetTab !== 'payable';
    var label = isRecv ? '應收款' : '應付款';
    var editing5 = editId ? (d.receivables || []).find(function(r) { return r.id === editId; }) : null;
    var curOpts5 = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editing5 && editing5.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    // 只列可實際收/付款的帳戶（銀行、現金）
    var acctCandidates = d.accounts.filter(function(a) {
      return a.type === 'bank' || a.type === 'cash';
    });
    var acctOpts5 = '<option value="">（不指定，只記錄不動帳）</option>' +
      acctCandidates.map(function(a) {
        return '<option value="' + a.id + '"' + (editing5 && editing5.accountId === a.id ? ' selected' : '') + '>' +
          a.name + '（' + a.currency + '）</option>';
      }).join('');
    m.innerHTML = '<h3>' + (editing5 ? '編輯' : '新增') + label + '</h3>' +
      '<div class="form-row"><div class="form-group"><label>建立日期</label><input type="date" id="f_date" value="' + (editing5 ? editing5.date : new Date().toISOString().slice(0, 10)) + '"></div>' +
      '<div class="form-group"><label>應付日期（到期日）</label><input type="date" id="f_dueDate" value="' + (editing5 ? editing5.dueDate || '' : '') + '"></div></div>' +
      '<div class="form-group"><label>' + (isRecv ? '付款對象/機構' : '應付對象/機構') + '</label><input type="text" id="f_target" placeholder="例：張先生 / 台電公司" value="' + (editing5 ? editing5.target || '' : '') + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>金額</label><input type="number" id="f_amt" step="0.01" value="' + (editing5 ? editing5.amount : '') + '"></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_cur">' + curOpts5 + '</select></div></div>' +
      '<div class="form-group"><label>' + (isRecv ? '收款帳戶' : '付款帳戶') + '<span style="font-size:11px;color:var(--text3);margin-left:8px">點擊「標記已收/已付」時此帳戶會自動增減並寫入收支記錄</span></label><select id="f_acct">' + acctOpts5 + '</select></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_note" value="' + (editing5 ? editing5.note || '' : '') + '"></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveReceivable()">儲存</button></div>';
  } else if (type === 'portfolio') {
    var editing6 = editId ? (d.portfolio || []).find(function(p) { return p.id === editId; }) : null;
    var curOpts6 = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editing6 && editing6.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    m.innerHTML = '<h3>' + (editing6 ? '編輯' : '新增') + '投資持倉</h3>' +
      '<div class="form-row"><div class="form-group"><label>類型</label><select id="f_pType">' +
        '<option value="stock"' + (editing6 && editing6.type === 'stock' ? ' selected' : '') + '>股票</option>' +
        '<option value="fund"' + (editing6 && editing6.type === 'fund' ? ' selected' : '') + '>基金</option>' +
        '<option value="other"' + (editing6 && editing6.type === 'other' ? ' selected' : '') + '>其他</option>' +
      '</select></div>' +
      '<div class="form-group"><label>代號</label><input type="text" id="f_pCode" placeholder="如 2330、0050" value="' + (editing6 ? editing6.code || '' : '') + '"></div></div>' +
      '<div class="form-group"><label>名稱</label><input type="text" id="f_pName" placeholder="如 台積電" value="' + (editing6 ? editing6.name || '' : '') + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>購入成本（每股/每份）</label><input type="number" id="f_pCost" step="0.01" value="' + (editing6 ? editing6.costPerUnit || '' : '') + '"></div>' +
      '<div class="form-group"><label>持有股數/份額</label><input type="number" id="f_pUnits" step="0.001" value="' + (editing6 ? editing6.units || '' : '') + '"></div></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_pCur">' + curOpts6 + '</select></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_pNote" value="' + (editing6 ? editing6.note || '' : '') + '"></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="savePortfolio()">儲存</button></div>';
  } else if (type === 'property') {
    var editingP = editId ? (d.properties || []).find(function(p) { return p.id === editId; }) : null;
    var propTypeOpts = Object.entries(PROPERTY_TYPES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editingP && editingP.subType === entry[0] ? ' selected' : '') + '>' + entry[1] + '</option>';
    }).join('');
    var curOptsP = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editingP && editingP.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    m.innerHTML = '<h3>' + (editingP ? '編輯' : '新增') + '不動產</h3>' +
      '<div class="form-row"><div class="form-group"><label>類型</label><select id="f_propType">' + propTypeOpts + '</select></div>' +
      '<div class="form-group"><label>名稱</label><input type="text" id="f_propName" placeholder="如：信義路自宅" value="' + (editingP ? editingP.name || '' : '') + '"></div></div>' +
      '<div class="form-group"><label>地址/位置</label><input type="text" id="f_propAddr" placeholder="如：台北市信義區..." value="' + (editingP ? editingP.address || '' : '') + '"></div>' +
      '<div class="form-group"><label>購入日期</label><input type="date" id="f_propDate" value="' + (editingP ? editingP.purchaseDate || '' : '') + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>購入價格</label><input type="number" id="f_propPrice" step="1" value="' + (editingP ? editingP.purchasePrice || '' : '') + '"></div>' +
      '<div class="form-group"><label>當前價值</label><input type="number" id="f_propValue" step="1" value="' + (editingP ? editingP.currentValue || '' : '') + '"></div></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_propCur">' + curOptsP + '</select></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_propNote" value="' + (editingP ? editingP.note || '' : '') + '"></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveProperty()">儲存</button></div>';
  } else if (type === 'vehicle') {
    var editingV = editId ? (d.vehicles || []).find(function(v) { return v.id === editId; }) : null;
    var vehTypeOpts = Object.entries(VEHICLE_TYPES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editingV && editingV.subType === entry[0] ? ' selected' : '') + '>' + entry[1] + '</option>';
    }).join('');
    var curOptsV = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editingV && editingV.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    m.innerHTML = '<h3>' + (editingV ? '編輯' : '新增') + '動產</h3>' +
      '<div class="form-row"><div class="form-group"><label>類型</label><select id="f_vehType">' + vehTypeOpts + '</select></div>' +
      '<div class="form-group"><label>名稱</label><input type="text" id="f_vehName" placeholder="如：Toyota Camry" value="' + (editingV ? editingV.name || '' : '') + '"></div></div>' +
      '<div class="form-row"><div class="form-group"><label>品牌</label><input type="text" id="f_vehBrand" placeholder="如：Toyota" value="' + (editingV ? editingV.brand || '' : '') + '"></div>' +
      '<div class="form-group"><label>型號</label><input type="text" id="f_vehModel" placeholder="如：Camry 2.0" value="' + (editingV ? editingV.model || '' : '') + '"></div></div>' +
      '<div class="form-group"><label>購入日期</label><input type="date" id="f_vehDate" value="' + (editingV ? editingV.purchaseDate || '' : '') + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>購入價格</label><input type="number" id="f_vehPrice" step="1" value="' + (editingV ? editingV.purchasePrice || '' : '') + '"></div>' +
      '<div class="form-group"><label>當前價值</label><input type="number" id="f_vehValue" step="1" value="' + (editingV ? editingV.currentValue || '' : '') + '"></div></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_vehCur">' + curOptsV + '</select></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_vehNote" value="' + (editingV ? editingV.note || '' : '') + '"></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveVehicle()">儲存</button></div>';
  } else if (type === 'planProject') {
    var editingPj = editId ? (d.projects || []).find(function(p) { return p.id === editId; }) : null;
    var curOptsPj = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editingPj && editingPj.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    m.innerHTML = '<h3>' + (editingPj ? '編輯' : '新增') + '專案標籤</h3>' +
      '<div class="form-row"><div class="form-group"><label>Emoji</label><input type="text" id="f_pjEmoji" maxlength="2" placeholder="📁" value="' + (editingPj ? editingPj.emoji || '📁' : '📁') + '"></div>' +
      '<div class="form-group" style="flex:3"><label>名稱</label><input type="text" id="f_pjName" placeholder="如：裝修新房、京都旅行" value="' + (editingPj ? editingPj.name || '' : '') + '"></div></div>' +
      '<div class="form-row"><div class="form-group"><label>開始日期</label><input type="date" id="f_pjStart" value="' + (editingPj ? editingPj.startDate || '' : new Date().toISOString().slice(0, 10)) + '"></div>' +
      '<div class="form-group"><label>結束日期</label><input type="date" id="f_pjEnd" value="' + (editingPj ? editingPj.endDate || '' : '') + '"></div></div>' +
      '<div class="form-row"><div class="form-group"><label>預算金額</label><input type="number" id="f_pjBudget" step="1" value="' + (editingPj ? editingPj.budget || '' : '') + '"></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_pjCur">' + curOptsPj + '</select></div></div>' +
      '<div class="form-group"><label>狀態</label><select id="f_pjStatus">' +
        '<option value="active"' + (editingPj && editingPj.status === 'active' ? ' selected' : '') + '>進行中</option>' +
        '<option value="closed"' + (editingPj && editingPj.status === 'closed' ? ' selected' : '') + '>已結案</option>' +
      '</select></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_pjNote" value="' + (editingPj ? editingPj.note || '' : '') + '"></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions">' +
        (editingPj ? '<button class="btn btn-s" style="color:var(--red)" onclick="deletePlanProject(\'' + editingPj.id + '\')">刪除</button>' : '') +
        '<button class="btn btn-s" onclick="closeModal()">取消</button>' +
        '<button class="btn btn-p" onclick="savePlanProject()">儲存</button></div>';
  } else if (type === 'planRecurring') {
    var editingR = editId ? (d.recurring || []).find(function(r) { return r.id === editId; }) : null;
    var curOptsR = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editingR && editingR.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    var acctOptsR = d.accounts.filter(function(a) { return a.type === 'bank' || a.type === 'cash' || a.type === 'credit'; })
      .map(function(a) {
        return '<option value="' + a.id + '"' + (editingR && editingR.accountId === a.id ? ' selected' : '') + '>' + a.name + '</option>';
      }).join('');
    var catOptsRInc = (d.incomeCategories || []).map(function(c) {
      return '<option value="' + c + '"' + (editingR && editingR.category === c ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
    var catOptsRExp = (d.expenseCategories || []).map(function(c) {
      return '<option value="' + c + '"' + (editingR && editingR.category === c ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
    var isInc = editingR ? editingR.type === 'income' : false;
    m.innerHTML = '<h3>' + (editingR ? '編輯' : '新增') + '定期收支項目</h3>' +
      '<div class="form-row"><div class="form-group"><label>類型</label><select id="f_rType" onchange="_planRecurringTypeChange()">' +
        '<option value="expense"' + (!isInc ? ' selected' : '') + '>支出</option>' +
        '<option value="income"' + (isInc ? ' selected' : '') + '>收入</option>' +
      '</select></div>' +
      '<div class="form-group" style="flex:3"><label>名稱</label><input type="text" id="f_rName" placeholder="如：房貸、Netflix 訂閱" value="' + (editingR ? editingR.name || '' : '') + '"></div></div>' +
      '<div class="form-row"><div class="form-group"><label>金額</label><input type="number" id="f_rAmt" step="0.01" value="' + (editingR ? editingR.amount : '') + '"></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_rCur">' + curOptsR + '</select></div></div>' +
      '<div class="form-row"><div class="form-group"><label>分類</label><select id="f_rCat">' + (isInc ? catOptsRInc : catOptsRExp) + '</select></div>' +
      '<div class="form-group"><label>扣款/入帳日</label><input type="number" id="f_rDay" min="1" max="28" value="' + (editingR ? editingR.dayOfMonth || 1 : 1) + '"></div></div>' +
      '<div class="form-group"><label>對應帳戶</label><select id="f_rAcct">' + acctOptsR + '</select></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_rNote" value="' + (editingR ? editingR.note || '' : '') + '"></div>' +
      '<div class="form-group"><label><input type="checkbox" id="f_rActive"' + (!editingR || editingR.active !== false ? ' checked' : '') + '> 啟用（每月自動產生記錄）</label></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions">' +
        (editingR ? '<button class="btn btn-s" style="color:var(--red)" onclick="deletePlanRecurring(\'' + editingR.id + '\')">刪除</button>' : '') +
        '<button class="btn btn-s" onclick="closeModal()">取消</button>' +
        '<button class="btn btn-p" onclick="savePlanRecurring()">儲存</button></div>';
  } else if (type === 'planGoal') {
    var editingG = editId ? (d.savingsGoals || []).find(function(g) { return g.id === editId; }) : null;
    var curOptsG = Object.entries(CURRENCIES).map(function(entry) {
      return '<option value="' + entry[0] + '"' + (editingG && editingG.currency === entry[0] ? ' selected' : '') + '>' + entry[0] + ' ' + entry[1] + '</option>';
    }).join('');
    var projOptsG = '<option value="">（不綁定專案）</option>' +
      (d.projects || []).map(function(p) {
        return '<option value="' + p.id + '"' + (editingG && editingG.projectId === p.id ? ' selected' : '') + '>' + (p.emoji || '📁') + ' ' + p.name + '</option>';
      }).join('');
    m.innerHTML = '<h3>' + (editingG ? '編輯' : '新增') + '儲蓄目標</h3>' +
      '<div class="form-row"><div class="form-group"><label>Emoji</label><input type="text" id="f_gEmoji" maxlength="2" placeholder="🎯" value="' + (editingG ? editingG.emoji || '🎯' : '🎯') + '"></div>' +
      '<div class="form-group" style="flex:3"><label>名稱</label><input type="text" id="f_gName" placeholder="如：買車、京都自由行" value="' + (editingG ? editingG.name || '' : '') + '"></div></div>' +
      '<div class="form-row"><div class="form-group"><label>目標金額</label><input type="number" id="f_gTarget" step="1" value="' + (editingG ? editingG.targetAmount || '' : '') + '"></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_gCur">' + curOptsG + '</select></div></div>' +
      '<div class="form-group"><label>目標截止日</label><input type="date" id="f_gDeadline" value="' + (editingG ? editingG.deadline || '' : '') + '"></div>' +
      '<div class="form-group"><label>綁定專案（可選）<span style="font-size:11px;color:var(--text3);margin-left:8px">已累計金額會從該專案的淨收支算</span></label><select id="f_gProject">' + projOptsG + '</select></div>' +
      '<div class="form-group"><label>備註</label><input type="text" id="f_gNote" value="' + (editingG ? editingG.note || '' : '') + '"></div>' +
      '<input type="hidden" id="f_editId" value="' + (editId || '') + '">' +
      '<div class="modal-actions">' +
        (editingG ? '<button class="btn btn-s" style="color:var(--red)" onclick="deletePlanGoal(\'' + editingG.id + '\')">刪除</button>' : '') +
        '<button class="btn btn-s" onclick="closeModal()">取消</button>' +
        '<button class="btn btn-p" onclick="savePlanGoal()">儲存</button></div>';
  }
  document.getElementById('modalOverlay').classList.add('show');
}

/** 定期項目 Modal 中切換 type 時重建分類下拉 */
function _planRecurringTypeChange() {
  var type = document.getElementById('f_rType').value;
  var d = U();
  var cats = type === 'income' ? (d.incomeCategories || []) : (d.expenseCategories || []);
  var sel = document.getElementById('f_rCat');
  sel.innerHTML = cats.map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function editRecord(type, id) { openModal(type, id); }

// ============ 儲存收入 ============
function saveIncome() {
  var amt = parseFloat(document.getElementById('f_amt').value);
  if (!amt || amt <= 0) { alert('請輸入有效金額'); return; }
  var d = U(), editId = document.getElementById('f_editId').value;
  var newData = {
    date: document.getElementById('f_date').value,
    category: document.getElementById('f_cat').value,
    accountId: document.getElementById('f_acct').value,
    amount: amt,
    currency: document.getElementById('f_cur').value,
    note: document.getElementById('f_note').value,
    payTo: document.getElementById('f_payTo').value,
    usedBy: document.getElementById('f_usedBy').value,
    projectId: (document.getElementById('f_project') || {}).value || ''
  };
  if (editId) {
    var old = d.incomes.find(function(i) { return i.id === editId; });
    if (old) {
      var oa = d.accounts.find(function(a) { return a.id === old.accountId; });
      if (oa) oa.balance -= convert(old.amount, old.currency, oa.currency);
      Object.assign(old, newData);
      var na = d.accounts.find(function(a) { return a.id === newData.accountId; });
      if (na) na.balance += convert(amt, newData.currency, na.currency);
    }
  } else {
    d.incomes.push(Object.assign({ id: genId() }, newData));
    var ac = d.accounts.find(function(a) { return a.id === newData.accountId; });
    if (ac) ac.balance += convert(amt, newData.currency, ac.currency);
  }
  save(); closeModal(); renderIncome();
}

// ============ 儲存支出 ============
/** 支付方式切換時顯示/隱藏轉入帳號欄位 */
function toggleTransferAcct() {
  var pay = document.getElementById('f_pay').value;
  var grp = document.getElementById('transferAcctGroup');
  if (grp) grp.style.display = pay === '銀行轉帳' ? 'block' : 'none';
}

function saveExpense() {
  var amt = parseFloat(document.getElementById('f_amt').value);
  if (!amt || amt <= 0) { alert('請輸入有效金額'); return; }
  var d = U(), editId = document.getElementById('f_editId').value;
  var payMethod = document.getElementById('f_pay').value;
  var transferAcctEl = document.getElementById('f_transferAcct');
  var newData = {
    date: document.getElementById('f_date').value,
    category: document.getElementById('f_cat').value,
    payMethod: payMethod,
    accountId: document.getElementById('f_acct').value,
    amount: amt,
    currency: document.getElementById('f_cur').value,
    note: document.getElementById('f_note').value,
    payTo: document.getElementById('f_payTo').value,
    usedBy: document.getElementById('f_usedBy').value,
    transferAccount: payMethod === '銀行轉帳' && transferAcctEl ? transferAcctEl.value : '',
    projectId: (document.getElementById('f_project') || {}).value || ''
  };
  if (editId) {
    var old = d.expenses.find(function(e) { return e.id === editId; });
    if (old) {
      var oa = d.accounts.find(function(a) { return a.id === old.accountId; });
      if (oa) oa.balance += convert(old.amount, old.currency, oa.currency);
      Object.assign(old, newData);
      var na = d.accounts.find(function(a) { return a.id === newData.accountId; });
      if (na) na.balance -= convert(amt, newData.currency, na.currency);
    }
  } else {
    d.expenses.push(Object.assign({ id: genId() }, newData));
    var ac = d.accounts.find(function(a) { return a.id === newData.accountId; });
    if (ac) ac.balance -= convert(amt, newData.currency, ac.currency);
  }
  save(); closeModal(); renderExpense();
}

// ============ 儲存帳戶（Bug 2 修正：payable 自動轉負數） ============
function saveAccount() {
  var d = U(), editId = document.getElementById('f_editId').value;
  var data = {
    name: document.getElementById('f_name').value,
    type: document.getElementById('f_type').value,
    institution: document.getElementById('f_inst').value,
    currency: document.getElementById('f_cur').value,
    balance: parseFloat(document.getElementById('f_bal').value) || 0,
    note: document.getElementById('f_note').value
  };
  if (!data.name) { alert('請輸入帳戶名稱'); return; }

  // Bug 2 修正：如果是應付款且餘額為正，自動轉為負數
  if (data.type === 'payable' && data.balance > 0) {
    data.balance = -data.balance;
  }

  if (editId) {
    var ac = d.accounts.find(function(a) { return a.id === editId; });
    if (ac) Object.assign(ac, data);
  } else {
    d.accounts.push(Object.assign({ id: genId(), createdAt: new Date().toISOString() }, data));
  }
  save(); closeModal(); renderAssets();
}

function editAccount(id) { openModal('account', id); }

function deleteAccount(id) {
  showConfirmModal('確定刪除此帳戶？', function() {
    var d = U();
    d.accounts = d.accounts.filter(function(a) { return a.id !== id; });
    save(); renderAssets();
  });
}

function deleteRecord(col, id) {
  showConfirmModal('確定刪除此筆記錄？', function() {
    var d = U();
    d[col] = d[col].filter(function(r) { return r.id !== id; });
    save();
    if (col === 'incomes') renderIncome();
    else renderExpense();
  });
}

// ============ 帳戶轉帳 ============
function saveTransfer() {
  var amt = parseFloat(document.getElementById('f_amt').value);
  if (!amt || amt <= 0) { showToast('請輸入有效金額', 'warn'); return; }
  var fromId = document.getElementById('f_fromAcct').value;
  var toId = document.getElementById('f_toAcct').value;
  if (fromId === toId) { showToast('轉出與轉入帳戶不能相同', 'warn'); return; }
  var d = U();
  if (!d.transfers) d.transfers = [];
  var editId = document.getElementById('f_editId').value;
  var newData = {
    date: document.getElementById('f_date').value,
    fromAccountId: fromId,
    toAccountId: toId,
    amount: amt,
    currency: document.getElementById('f_cur').value,
    note: document.getElementById('f_note').value
  };
  if (editId) {
    // 編輯：先復原舊轉帳的帳戶餘額
    var old = d.transfers.find(function(t) { return t.id === editId; });
    if (old) {
      var oldFrom = d.accounts.find(function(a) { return a.id === old.fromAccountId; });
      var oldTo = d.accounts.find(function(a) { return a.id === old.toAccountId; });
      if (oldFrom) oldFrom.balance += convert(old.amount, old.currency, oldFrom.currency);
      if (oldTo) oldTo.balance -= convert(old.amount, old.currency, oldTo.currency);
      Object.assign(old, newData);
    }
  } else {
    d.transfers.push(Object.assign({ id: genId() }, newData));
  }
  // 更新帳戶餘額
  var fromAcct = d.accounts.find(function(a) { return a.id === newData.fromAccountId; });
  var toAcct = d.accounts.find(function(a) { return a.id === newData.toAccountId; });
  if (fromAcct) fromAcct.balance -= convert(amt, newData.currency, fromAcct.currency);
  if (toAcct) toAcct.balance += convert(amt, newData.currency, toAcct.currency);
  save(); closeModal(); renderTransfer();
  showToast('✅ 轉帳記錄已儲存', 'success');
}

function deleteTransfer(id) {
  showConfirmModal('確定刪除此轉帳記錄？', function() {
    var d = U();
    if (!d.transfers) return;
    var tf = d.transfers.find(function(t) { return t.id === id; });
    if (tf) {
      // 復原帳戶餘額
      var fromAcct = d.accounts.find(function(a) { return a.id === tf.fromAccountId; });
      var toAcct = d.accounts.find(function(a) { return a.id === tf.toAccountId; });
      if (fromAcct) fromAcct.balance += convert(tf.amount, tf.currency, fromAcct.currency);
      if (toAcct) toAcct.balance -= convert(tf.amount, tf.currency, toAcct.currency);
    }
    d.transfers = d.transfers.filter(function(t) { return t.id !== id; });
    save(); renderTransfer();
  });
}

function renderTransfer() {
  var d = U();
  if (!d.transfers) d.transfers = [];
  var range = document.getElementById('tfRange').value;
  var month = document.getElementById('tfMonth').value;
  var year = document.getElementById('tfYear').value;
  var list = filterByRange(d.transfers, range, month, year);
  list.sort(function(a, b) { return b.date.localeCompare(a.date); });

  var cur = 'TWD';
  var total = 0;
  list.forEach(function(t) { total += convert(t.amount, t.currency, cur); });

  document.getElementById('tfStats').innerHTML =
    '<div class="stat-card"><div class="label">轉帳筆數</div><div class="value">' + list.length + '</div></div>' +
    '<div class="stat-card"><div class="label">轉帳總額</div><div class="value c-blue">' + fmt(total, cur) + '</div></div>';

  var tbody = document.getElementById('tfTable');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:32px">尚無轉帳記錄</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(function(t) {
    var fromAcct = d.accounts.find(function(a) { return a.id === t.fromAccountId; });
    var toAcct = d.accounts.find(function(a) { return a.id === t.toAccountId; });
    return '<tr>' +
      '<td>' + t.date + '</td>' +
      '<td>' + (fromAcct ? fromAcct.name : '(已刪除)') + '</td>' +
      '<td>' + (toAcct ? toAcct.name : '(已刪除)') + '</td>' +
      '<td class="amt">' + fmt(t.amount, t.currency) + '</td>' +
      '<td>' + t.currency + '</td>' +
      '<td>' + (t.note || '-') + '</td>' +
      '<td>' +
        '<span class="edit-btn" onclick="openModal(\'transfer\',\'' + t.id + '\')">✏️</span>' +
        '<span class="del-btn" onclick="deleteTransfer(\'' + t.id + '\')">✕</span>' +
      '</td></tr>';
  }).join('');
}

function updateTfSel() {
  var range = document.getElementById('tfRange').value;
  document.getElementById('tfMonth').style.display = range === 'month' ? '' : 'none';
  document.getElementById('tfYear').style.display = range === 'year' ? '' : 'none';
}

// ============ 設定 ============
function loadCategories() {
  var d = U();
  renderCategoryList('incCatList', d.incomeCategories, 'income');
  renderCategoryList('expCatList', d.expenseCategories, 'expense');
}

function renderCategoryList(containerId, cats, type) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var d = U();
  if (!d.subCategories) d.subCategories = {};
  el.innerHTML = cats.map(function(cat, idx) {
    var esc = cat.replace(/'/g, "\\'");
    var subs = d.subCategories[cat] || [];
    var subHtml = subs.map(function(sub, si) {
      return '<div class="sub-cat-row">' +
        '<span class="sub-cat-dot">·</span>' +
        '<span class="cat-name">' + sub + '</span>' +
        '<span class="del-btn" onclick="removeSubCategory(\'' + esc + '\',' + si + ')">✕</span>' +
        '</div>';
    }).join('');
    return '<div class="cat-group">' +
      '<div class="cat-row">' +
        '<span class="cat-icon-btn" onclick="openIconPicker(\'' + esc + '\')" title="更改圖示">' + getIcon(cat) + '</span>' +
        '<span class="cat-name">' + cat + '</span>' +
        '<span class="sub-cat-toggle" onclick="toggleSubCatInput(\'' + esc + '\')" title="新增子類別">＋</span>' +
        '<span class="del-btn" onclick="removeCategory(\'' + type + '\',' + idx + ')">✕</span>' +
      '</div>' +
      subHtml +
      '<div class="sub-cat-add" id="subCatAdd_' + cat + '" style="display:none">' +
        '<input type="text" id="subCatInput_' + cat + '" placeholder="子類別名稱" class="sub-cat-input" onkeydown="if(event.key===\'Enter\')addSubCategory(\'' + esc + '\')">' +
        '<button class="btn btn-p btn-sm" onclick="addSubCategory(\'' + esc + '\')">加入</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

function addCategory(type) {
  var d = U();
  var inputId = type === 'income' ? 'newIncCat' : 'newExpCat';
  var name = document.getElementById(inputId).value.trim();
  if (!name) { alert('請輸入類別名稱'); return; }
  if (type === 'income') {
    if (d.incomeCategories.includes(name)) { alert('類別已存在'); return; }
    d.incomeCategories.push(name);
  } else {
    if (d.expenseCategories.includes(name)) { alert('類別已存在'); return; }
    d.expenseCategories.push(name);
  }
  document.getElementById(inputId).value = '';
  save();
  loadCategories();
}

function removeCategory(type, idx) {
  showConfirmModal('確定刪除此類別？（含所有子類別）', function() {
    var d = U();
    var catName;
    if (type === 'income') { catName = d.incomeCategories[idx]; d.incomeCategories.splice(idx, 1); }
    else { catName = d.expenseCategories[idx]; d.expenseCategories.splice(idx, 1); }
    // 同時移除子類別
    if (d.subCategories && catName) delete d.subCategories[catName];
    save();
    loadCategories();
  });
}

function toggleSubCatInput(cat) {
  var el = document.getElementById('subCatAdd_' + cat);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
  if (el.style.display !== 'none') {
    var inp = document.getElementById('subCatInput_' + cat);
    if (inp) inp.focus();
  }
}

function addSubCategory(cat) {
  var inp = document.getElementById('subCatInput_' + cat);
  if (!inp) return;
  var name = inp.value.trim();
  if (!name) { alert('請輸入子類別名稱'); return; }
  var d = U();
  if (!d.subCategories) d.subCategories = {};
  if (!d.subCategories[cat]) d.subCategories[cat] = [];
  if (d.subCategories[cat].includes(name)) { alert('子類別已存在'); return; }
  d.subCategories[cat].push(name);
  inp.value = '';
  save();
  loadCategories();
}

function removeSubCategory(cat, idx) {
  showConfirmModal('確定刪除此子類別？', function() {
    var d = U();
    if (d.subCategories && d.subCategories[cat]) {
      d.subCategories[cat].splice(idx, 1);
      if (d.subCategories[cat].length === 0) delete d.subCategories[cat];
    }
    save();
    loadCategories();
  });
}

/** 取得類別的完整顯示名稱（含子類別）*/
function _getCatDisplay(category) {
  if (!category) return '-';
  var parts = category.split(' > ');
  if (parts.length > 1) return parts[0] + ' <span class="sub-cat-label">' + parts[1] + '</span>';
  return category;
}

/** 產生含子類別的下拉選單 options HTML */
function _buildCatOptions(cats, selectedVal) {
  var d = U();
  if (!d.subCategories) d.subCategories = {};
  var html = '';
  cats.forEach(function(c) {
    var sel = selectedVal === c ? ' selected' : '';
    html += '<option value="' + c + '"' + sel + '>' + getIcon(c) + ' ' + c + '</option>';
    var subs = d.subCategories[c] || [];
    subs.forEach(function(sub) {
      var val = c + ' > ' + sub;
      var sel2 = selectedVal === val ? ' selected' : '';
      html += '<option value="' + val + '"' + sel2 + '>\u00A0\u00A0\u00A0\u00A0' + getIcon(c) + ' ' + sub + '</option>';
    });
  });
  return html;
}

// ============ Icon Picker ============
var _iconPickerCallback = null;

function openIconPicker(category) {
  _iconPickerCallback = category;
  var overlay = document.getElementById('iconPickerOverlay');
  var grid = document.getElementById('iconPickerGrid');
  grid.innerHTML = ICON_OPTIONS.map(function(icon) {
    return '<span class="icon-option" onclick="selectIcon(\'' + icon + '\')">' + icon + '</span>';
  }).join('');
  overlay.classList.add('show');
}

function selectIcon(icon) {
  if (!_iconPickerCallback) return;
  var d = U();
  if (!d.categoryIcons) d.categoryIcons = {};
  d.categoryIcons[_iconPickerCallback] = icon;
  save();
  closeIconPicker();
  loadCategories();
}

function closeIconPicker() {
  document.getElementById('iconPickerOverlay').classList.remove('show');
  _iconPickerCallback = null;
}

async function changePwd() {
  var np = document.getElementById('newPwd2').value;
  if (!np || np.length < 6) { alert('新密碼至少 6 位'); return; }
  try {
    var result = await _sb.auth.updateUser({ password: np });
    if (result.error) throw result.error;
    alert('密碼已更新');
    document.getElementById('newPwd2').value = '';
  } catch (e) {
    alert('更新失敗: ' + e.message);
  }
}

function exportData() {
  var b = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'FlowRich_' + currentUser + '_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}

function importData(e) {
  var f = e.target.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      if (data.incomeCategories && data.accounts) {
        DB = data;
      } else if (data.users && data.users[Object.keys(data.users)[0]]) {
        var firstUser = Object.keys(data.users)[0];
        DB = data.users[firstUser].data;
      } else {
        alert('檔案格式不正確');
        return;
      }
      save();
      alert('匯入成功！');
      location.reload();
    } catch (err) {
      alert('解析失敗: ' + err.message);
    }
  };
  reader.readAsText(f);
  e.target.value = '';
}

function resetAll() {
  showConfirmModal('確定要清除所有資料嗎？此操作無法復原！', async function() {
    DB = defaultUserData();
    save();
    await cloudSave();
    location.reload();
  });
}

// ============ 信用卡帳單 OCR 掃描 ============
var _billParsedItems = [];
var _billSelectedCardId = '';  // v1.8.6: 掃描前先選好歸屬信用卡

/** 填入信用卡下拉 + 判斷是否有卡 */
function _populateBillCardPicker() {
  var d = U();
  var creditCards = (d.accounts || []).filter(function(a) { return a.type === 'credit'; });
  var sel = document.getElementById('billCardSelect');
  var empty = document.getElementById('billCardEmpty');
  var upload = document.getElementById('billUploadArea');

  if (creditCards.length === 0) {
    sel.innerHTML = '';
    sel.style.display = 'none';
    empty.style.display = 'block';
    if (upload) upload.style.opacity = '0.4', upload.style.pointerEvents = 'none';
    _billSelectedCardId = '';
    return;
  }
  sel.style.display = '';
  empty.style.display = 'none';
  if (upload) upload.style.opacity = '', upload.style.pointerEvents = '';

  // 優先保留上一次選擇；若該卡已被刪除則用第一張
  var keepId = creditCards.find(function(a) { return a.id === _billSelectedCardId; }) ? _billSelectedCardId : creditCards[0].id;
  _billSelectedCardId = keepId;
  sel.innerHTML = creditCards.map(function(a) {
    return '<option value="' + a.id + '"' + (a.id === keepId ? ' selected' : '') + '>' +
      a.name + (a.institution ? '（' + a.institution + '）' : '') + '｜' + a.currency + '</option>';
  }).join('');
}

function onBillCardChange() {
  var sel = document.getElementById('billCardSelect');
  _billSelectedCardId = sel.value;
  // 若已經有解析結果，把所有項目的 accountId 改為新選的卡
  if (_billParsedItems.length > 0) {
    _billParsedItems.forEach(function(it) { it.accountId = _billSelectedCardId; });
    renderBillResults();
  }
}

function openBillScanner() {
  var overlay = document.getElementById('billScannerOverlay');
  resetBillScanner();
  _populateBillCardPicker();
  overlay.classList.add('show');
}

function closeBillScanner() {
  document.getElementById('billScannerOverlay').classList.remove('show');
  _billParsedItems = [];
}

function resetBillScanner() {
  _billParsedItems = [];
  document.getElementById('billUploadArea').style.display = '';
  document.getElementById('billPreviewArea').style.display = 'none';
  document.getElementById('billOcrProgress').style.display = 'none';
  document.getElementById('billResultArea').style.display = 'none';
  document.getElementById('billInitActions').style.display = '';
  document.getElementById('billFileInput').value = '';
}

// 點擊上傳區域
document.addEventListener('DOMContentLoaded', function() {
  // 啟動股票開盤自動刷新（每分鐘 tick，實際刷新節奏 10 分鐘 + 需在投資頁 + 開盤中）
  startStockAutoRefresh();
  // 啟動時背景載入投資組合股價，讓資產總覽的「流動資產」數字開即正確
  setTimeout(function() {
    if (!DB || !DB.portfolio || DB.portfolio.length === 0) return;
    fetchPortfolioPrices().then(function() { rerenderActivePage(); });
  }, 500);

  var uploadArea = document.getElementById('billUploadArea');
  if (uploadArea) {
    uploadArea.addEventListener('click', function() {
      document.getElementById('billFileInput').click();
    });
    // 拖曳支援
    uploadArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      uploadArea.classList.add('bill-drag-over');
    });
    uploadArea.addEventListener('dragleave', function() {
      uploadArea.classList.remove('bill-drag-over');
    });
    uploadArea.addEventListener('drop', function(e) {
      e.preventDefault();
      uploadArea.classList.remove('bill-drag-over');
      if (e.dataTransfer.files.length > 0) {
        processBillImage(e.dataTransfer.files[0]);
      }
    });
  }
});

function handleBillUpload(event) {
  var file = event.target.files[0];
  if (file) processBillImage(file);
}

function processBillImage(file) {
  if (!file.type.startsWith('image/')) {
    showToast('請上傳圖片檔案（JPG 或 PNG）', 'warn');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    // 顯示預覽
    document.getElementById('billUploadArea').style.display = 'none';
    document.getElementById('billPreviewArea').style.display = 'block';
    document.getElementById('billPreviewImg').src = e.target.result;
    document.getElementById('billInitActions').style.display = 'none';

    // 開始 OCR
    startBillOCR(e.target.result);
  };
  reader.readAsDataURL(file);
}

/** 影像前處理：灰階化 + 對比增強 + 自適應二值化，提升 OCR 辨識率 */
function _preprocessImage(imageData) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var cv = document.createElement('canvas');
      var ctx = cv.getContext('2d');
      // 如果圖片太大，縮放到合理尺寸以加速處理
      var scale = 1;
      if (img.width > 3000) scale = 3000 / img.width;
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);

      var imgData = ctx.getImageData(0, 0, cv.width, cv.height);
      var data = imgData.data;
      var w = cv.width, h = cv.height;

      // 第一遍：灰階化 + 計算 Otsu 最佳閾值
      var grayArr = new Uint8Array(w * h);
      var histogram = new Array(256).fill(0);
      for (var i = 0; i < data.length; i += 4) {
        var g = Math.round(data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
        grayArr[i / 4] = g;
        histogram[g]++;
      }

      // Otsu 自適應閾值計算
      var total = w * h;
      var sum = 0;
      for (var t = 0; t < 256; t++) sum += t * histogram[t];
      var sumB = 0, wB = 0, maxVar = 0, threshold = 128;
      for (var t2 = 0; t2 < 256; t2++) {
        wB += histogram[t2];
        if (wB === 0) continue;
        var wF = total - wB;
        if (wF === 0) break;
        sumB += t2 * histogram[t2];
        var mB = sumB / wB;
        var mF = (sum - sumB) / wF;
        var between = wB * wF * (mB - mF) * (mB - mF);
        if (between > maxVar) { maxVar = between; threshold = t2; }
      }

      // 第二遍：對比增強 + 二值化（使用 Otsu 閾值）
      for (var j = 0; j < grayArr.length; j++) {
        var gray2 = ((grayArr[j] - 128) * 1.5) + 128;
        gray2 = Math.max(0, Math.min(255, gray2));
        var bw = gray2 > threshold ? 255 : 0;
        data[j * 4] = data[j * 4 + 1] = data[j * 4 + 2] = bw;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(cv.toDataURL('image/png'));
    };
    img.src = imageData;
  });
}

async function startBillOCR(imageData) {
  var progressEl = document.getElementById('billOcrProgress');
  var fillEl = document.getElementById('billProgressFill');
  var statusEl = document.getElementById('billOcrStatus');
  progressEl.style.display = 'block';

  try {
    statusEl.textContent = '正在前處理影像...';
    fillEl.style.width = '5%';

    // 影像前處理提升辨識品質
    var processedImage = await _preprocessImage(imageData);

    statusEl.textContent = '正在載入 OCR 引擎...';
    fillEl.style.width = '10%';

    var result = await Tesseract.recognize(processedImage, 'chi_tra+eng', {
      tessedit_pageseg_mode: Tesseract.PSM ? Tesseract.PSM.SINGLE_BLOCK : '6',
      tessedit_char_whitelist: '',
      preserve_interword_spaces: '0',
      logger: function(info) {
        if (info.status === 'recognizing text') {
          var pct = Math.round(info.progress * 100);
          fillEl.style.width = (10 + pct * 0.8) + '%';
          statusEl.textContent = '辨識中... ' + pct + '%';
        }
      }
    });

    fillEl.style.width = '95%';
    statusEl.textContent = '正在解析帳單內容...';

    var text = result.data.text;
    console.log('OCR raw text:', text);

    // 解析帳單
    _billParsedItems = parseBillText(text);

    fillEl.style.width = '100%';
    statusEl.textContent = '辨識完成！';

    setTimeout(function() {
      progressEl.style.display = 'none';
      renderBillResults();
    }, 500);

  } catch (err) {
    console.error('OCR error:', err);
    statusEl.textContent = '辨識失敗：' + err.message;
    fillEl.style.width = '100%';
    fillEl.style.background = 'var(--red)';
  }
}

/**
 * OCR 文字清理：移除中文字間空格、修正常見數字誤判、正規化全半形
 * 在 parseBillText 解析前先呼叫，大幅提升後續日期／金額擷取的準確度
 */
function _cleanOcrText(text) {
  // 1. 全形符號 → 半形
  text = text.replace(/\u3000/g, ' ').replace(/\t/g, ' ');
  text = text.replace(/，/g, ',').replace(/。/g, '.').replace(/：/g, ':');
  text = text.replace(/（/g, '(').replace(/）/g, ')');
  text = text.replace(/＄/g, '$').replace(/／/g, '/').replace(/－/g, '-');
  text = text.replace(/０/g,'0').replace(/１/g,'1').replace(/２/g,'2').replace(/３/g,'3')
             .replace(/４/g,'4').replace(/５/g,'5').replace(/６/g,'6').replace(/７/g,'7')
             .replace(/８/g,'8').replace(/９/g,'9');

  // 2. 逐行處理
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // 2a. 移除 CJK 字元之間的空格（臺 北 市 → 臺北市）
    //     反覆執行直到不再變化，處理連續多字間隔
    var prev;
    do {
      prev = line;
      // CJK 與 CJK 之間的空格
      line = line.replace(/([\u4e00-\u9fff\u3400-\u4dbf])\s+([\u4e00-\u9fff\u3400-\u4dbf])/g, '$1$2');
    } while (line !== prev);

    // 2b. 修正數字中插入的空白（6 2 1 0 → 6210, 1 1 5 → 115）
    //     策略：如果一段文字是由空白隔開的單一數字字元組成，就合併
    line = line.replace(/(?<!\d)(\d)\s+(?=\d(?:\s+\d)*(?!\d))/g, function(match, p1) {
      return p1;
    });
    // 更強力的處理：連續「單數字+空白」序列合併
    line = line.replace(/\b(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\b/g, '$1$2$3$4$5$6');
    line = line.replace(/\b(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\b/g, '$1$2$3$4$5');
    line = line.replace(/\b(\d)\s+(\d)\s+(\d)\s+(\d)\b/g, '$1$2$3$4');
    line = line.replace(/\b(\d)\s+(\d)\s+(\d)\b/g, '$1$2$3');
    line = line.replace(/\b(\d)\s+(\d)\b/g, '$1$2');

    // 2c. 修正日期格式中被空白切開的斜線（115 / 04 / 13 → 115/04/13）
    line = line.replace(/(\d)\s*\/\s*(\d)/g, '$1/$2');
    line = line.replace(/(\d)\s*\-\s*(\d)/g, '$1-$2');
    line = line.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');

    // 2d. 常見 OCR 數字誤判修正（僅在「看起來像數字」的上下文中修正）
    //     日期區段：YYY/MM/DD 或 YYYY/MM/DD 模式中的字母修正
    line = line.replace(/([0-9])[Oo]([\/\-.])/g, '$10$2');   // 11O/04 → 110/04
    line = line.replace(/([\/\-.])([Oo])([0-9])/g, '$10$3');  // /O4 → /04
    line = line.replace(/([0-9])[lI|]([\/\-.])/g, '$11$2');   // 1l5/04 → 115/04
    line = line.replace(/([\/\-.])([lI|])([0-9])/g, '$11$3');  // /l3 → /13
    //     金額區段：逗號或小數點附近的字母修正
    line = line.replace(/([0-9])[Oo]([0-9])/g, '$10$2');      // 62l0 → 6210
    line = line.replace(/([0-9])[lI|]([0-9])/g, '$11$2');     // 621O → 6210
    line = line.replace(/[Oo]([,.]?\d{3})/g, '0$1');          // O,210 → 0,210
    line = line.replace(/(\d{1,3},[0-9])[Oo]([0-9])/g, '$10$2'); // 1,O00 → 1,000

    // 2e. 移除 CJK 與英數之間不必要的空格（停 管 費 AWY → 停管費AWY）
    //     CJK 接英文字母或數字之間的單一空格
    line = line.replace(/([\u4e00-\u9fff])\s+([A-Za-z0-9])/g, '$1$2');
    line = line.replace(/([A-Za-z0-9])\s+([\u4e00-\u9fff])/g, '$1$2');

    // 2f. 壓縮多餘空白
    line = line.replace(/\s+/g, ' ').trim();

    lines[i] = line;
  }
  return lines.join('\n');
}

/** 解析日期字串，回傳 YYYY-MM-DD 或 null */
function _parseDateStr(s) {
  var currentYear = new Date().getFullYear();
  var currentMonth = new Date().getMonth() + 1;
  var m;
  // 民國年格式：YYY/MM/DD（年份 < 200 視為民國年，+1911 轉西元）
  m = s.match(/^(\d{2,3})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    var rocY = parseInt(m[1]);
    if (rocY > 0 && rocY < 200) {
      var adY = rocY + 1911;
      var mm0 = parseInt(m[2]), dd0 = parseInt(m[3]);
      if (mm0 >= 1 && mm0 <= 12 && dd0 >= 1 && dd0 <= 31) {
        return adY + '-' + m[2].padStart(2,'0') + '-' + m[3].padStart(2,'0');
      }
    }
  }
  // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  m = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) return m[1] + '-' + m[2].padStart(2,'0') + '-' + m[3].padStart(2,'0');
  // MM/DD/YYYY
  m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) return m[3] + '-' + m[1].padStart(2,'0') + '-' + m[2].padStart(2,'0');
  // MM/DD or M/D (no year)
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    var mm = parseInt(m[1]), dd = parseInt(m[2]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      var yr = (mm > currentMonth) ? currentYear - 1 : currentYear;
      return yr + '-' + m[1].padStart(2,'0') + '-' + m[2].padStart(2,'0');
    }
  }
  // MM月DD日
  m = s.match(/(\d{1,2})月(\d{1,2})日/);
  if (m) {
    var mm2 = parseInt(m[1]);
    var yr2 = (mm2 > currentMonth) ? currentYear - 1 : currentYear;
    return yr2 + '-' + m[1].padStart(2,'0') + '-' + m[2].padStart(2,'0');
  }
  return null;
}

/** 從一行中提取所有日期 token（支援空白或斜線分隔的多種格式） */
function _extractDates(line) {
  var results = [];
  var patterns = [
    /\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/g,
    /\d{2,3}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/g,  // 民國年 YYY/MM/DD
    /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/g,
    /\d{1,2}[\/\-\.]\d{1,2}/g,
    /\d{1,2}月\d{1,2}日/g
  ];
  for (var p = 0; p < patterns.length; p++) {
    var m;
    while ((m = patterns[p].exec(line)) !== null) {
      var parsed = _parseDateStr(m[0]);
      if (parsed) results.push({ raw: m[0], date: parsed, index: m.index });
    }
  }
  // 依位置排序、去重
  results.sort(function(a,b) { return a.index - b.index; });
  var seen = {};
  return results.filter(function(r) {
    if (seen[r.index]) return false;
    seen[r.index] = true;
    return true;
  });
}

/** 從一行中提取所有金額（回傳數值陣列） */
function _extractAmounts(line) {
  var amounts = [];
  // 先清理金額中常見的 OCR 雜訊
  var cleaned = line
    .replace(/[oO](?=\d{2,})/g, '0')     // o123 → 0123
    .replace(/(?<=\d)[oO]/g, '0')         // 12o → 120
    .replace(/(?<=\d)[lI|]/g, '1')        // 62l → 621
    .replace(/[lI|](?=\d{2,})/g, '1')     // l23 → 123
    .replace(/\s*,\s*/g, ',');            // 1 , 234 → 1,234

  // 匹配 NT$1,234 / $1234 / 1,234.00 / 1234 / 元 / 圓 等
  var pat = /(?:NT\$?|＄|\$|TWD|NTD)?\s*([\d,]+(?:\.\d{1,2})?)(?:\s*(?:元|圓))?/g;
  var m;
  while ((m = pat.exec(cleaned)) !== null) {
    var raw = m[1].replace(/,/g, '');
    // 過濾掉像日期數字的短字串（日期已在 _extractDates 中處理）
    if (raw.length <= 2 && !m[0].match(/\$|NT|TWD|NTD|元|圓/)) continue;
    var val = parseFloat(raw);
    if (val > 0 && val < 10000000) amounts.push(val);
  }
  return amounts;
}

/**
 * 解析 OCR 文字，提取交易明細
 * 信用卡帳單常見格式：消費日 | 入帳日 | 說明 | 台幣金額
 * 策略：
 *   1. 先嘗試表格模式（一行有兩個日期 = 消費日+入帳日，取消費日）
 *   2. 再嘗試單日期模式（一行有一個日期）
 *   3. 最後用寬鬆模式兜底
 */
function parseBillText(text) {
  var items = [];
  // OCR 文字深度清理（中文空格、數字修正、全半形正規化）
  text = _cleanOcrText(text);
  var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);

  // 跳過行的關鍵字（表頭、合計、頁碼等）
  var skipRe = /合計|小計|總計|本期|繳款|利息|循環|年利率|帳單|截止|結帳|最低應繳|信用額度|TOTAL|BALANCE|PAYMENT|STATEMENT|PAGE|消費日.*入帳日|入帳日.*消費日|交易日.*金額|日期.*說明.*金額/i;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.length < 4) continue;
    if (skipRe.test(line)) continue;

    var dates = _extractDates(line);
    var amounts = _extractAmounts(line);

    // 沒有日期或沒有金額就跳過
    if (dates.length === 0 || amounts.length === 0) continue;

    // 取消費日（第一個日期），忽略入帳日（第二個日期）
    var dateStr = dates[0].date;

    // 取台幣金額 = 最後一個數字（帳單格式通常是：消費日 入帳日 說明 金額）
    var amount = amounts[amounts.length - 1];

    // 提取說明：去掉所有日期和金額後的剩餘文字
    var desc = line;
    // 從後往前移除，避免 index 偏移
    var removeParts = [];
    dates.forEach(function(d) { removeParts.push(d.raw); });
    amounts.forEach(function(a) {
      // 移除金額及其前綴符號
      var aStr = a.toLocaleString('en-US');
      var aStrPlain = a.toString();
      removeParts.push(aStr);
      if (aStr !== aStrPlain) removeParts.push(aStrPlain);
    });
    // 按長度倒排，先移除長的避免部分匹配問題
    removeParts.sort(function(a,b) { return b.length - a.length; });
    removeParts.forEach(function(part) {
      desc = desc.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
    });
    // 清掉殘留的 NT$ 符號、多餘空白、前後標點
    desc = desc.replace(/[NT＄$]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s\-\/\.,:;]+|[\s\-\/\.,:;]+$/g, '').trim();
    if (!desc || desc.length < 2) desc = '帳單消費';

    var guessResult = guessBillCategory(desc);

    items.push({
      date: dateStr,
      desc: desc,
      amount: amount,
      category: guessResult.cat,
      payTo: guessResult.payTo || '',
      checked: true
    });
  }

  // 兜底：如果完全解析不到，嘗試寬鬆模式
  if (items.length === 0) {
    items = parseBillTextLoose(text);
  }

  return items;
}

/** 寬鬆解析：只要行中有金額就嘗試擷取 */
function parseBillTextLoose(text) {
  var items = [];
  text = _cleanOcrText(text);
  var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
  var today = new Date().toISOString().slice(0, 10);
  var skipRe = /合計|小計|總計|本期|繳款|利息|循環|年利率|帳單|截止|結帳|最低應繳|信用額度|TOTAL|BALANCE|PAYMENT|STATEMENT|PAGE/i;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.length < 3) continue;
    if (skipRe.test(line)) continue;

    var amounts = _extractAmounts(line);
    if (amounts.length === 0) continue;
    var amount = amounts[amounts.length - 1];

    // 嘗試取日期
    var dates = _extractDates(line);
    var dateStr = dates.length > 0 ? dates[0].date : today;

    // 說明
    var desc = line;
    // 移除日期和金額
    dates.forEach(function(d) { desc = desc.replace(d.raw, ' '); });
    amounts.forEach(function(a) {
      desc = desc.replace(new RegExp(a.toLocaleString('en-US').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
      desc = desc.replace(new RegExp(a.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
    });
    desc = desc.replace(/[NT＄$]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s\-\/\.,:;]+|[\s\-\/\.,:;]+$/g, '').trim();
    if (!desc || desc.length < 2) desc = '帳單消費';

    var guessResult2 = guessBillCategory(desc);

    items.push({
      date: dateStr,
      desc: desc,
      amount: amount,
      category: guessResult2.cat,
      payTo: guessResult2.payTo || '',
      checked: true
    });
  }
  return items;
}

/** 根據消費描述猜測支出類別，回傳 { category, payTo } */
function guessBillCategory(desc) {
  var d = DB || {};
  var cats = d.expenseCategories || DEFAULT_EXP_CATS;
  var lower = desc.toLowerCase();

  // 特殊規則（含子類別和支付對象）
  // 停管費 → 交通（子類別：停車費）
  if (/停管費/.test(desc)) {
    return { cat: cats.includes('交通') ? '交通 > 停車費' : '交通', payTo: '' };
  }
  // 優食/優步福爾摩沙 → 餐飲，支付對象 UberEat
  if (/優食|優步福爾摩沙|uber\s*eat/i.test(desc)) {
    return { cat: cats.includes('餐飲') ? '餐飲' : '其他支出', payTo: 'UberEat' };
  }

  // 關鍵字對應表（優先順序由上到下，先匹配先返回）
  var keywords = {
    '餐飲': ['餐廳','美食','飲料','餐','食','飯','麵','咖啡','tea','coffee','food','restaurant','麥當勞','星巴克','肯德基','吃到飽','小吃','便當','pizza','burger','鍋','壽司','拉麵','早餐','午餐','晚餐','宵夜','外送','uber eats','foodpanda','摩斯','漢堡','丹丹','鼎泰豐','八方','cama','路易莎','50嵐','清心','迷客夏','茶湯會','大苑子','鮮茶道','comebuy','麻辣','燒肉','烤肉','火鍋','牛排','brunch','甜點','蛋糕','烘焙','酒','bar','pub','居酒屋','熱炒'],
    '交通': ['加油','停車','停管費','高鐵','台鐵','捷運','uber','taxi','計程','公車','中油','台塑','parking','transport','eTag','etag','悠遊','irent','格上','和運','gogoro','wemo','共享','機車','汽車','客運','台灣大車隊','yoxi','line taxi'],
    '購物': ['百貨','商城','mall','amazon','蝦皮','momo','pchome','yahoo','購物','超市','家樂福','costco','全聯','7-11','便利','超商','大潤發','好市多','全家','萊爾富','ok超商','ikea','特力屋','寶雅','屈臣氏','康是美','光南','誠品','無印','muji','apple','三創','nova','shopee','露天','博客來','金石堂'],
    '娛樂': ['電影','cinema','netflix','spotify','遊戲','game','ktv','電玩','串流','disney','youtube','premium','kkbox','apple music','steam','switch','ps5','xbox','任天堂','威秀','秀泰','國賓','華納','旅遊','飯店','hotel','airbnb','booking','agoda','klook','kkday','樂園','遊樂','門票','展覽','演唱會','music','健身','gym','瑜珈','運動'],
    '醫療': ['醫院','診所','藥局','藥','hospital','clinic','pharmacy','牙醫','眼科','health','醫','掛號','健保','長庚','台大','馬偕','國泰','亞東','振興','中醫','復健','手術','門診','急診'],
    '教育': ['學費','補習','書店','課程','udemy','coursera','教育','tuition','幼稚園','安親','才藝','家教','英語','日語','hahow','yotta'],
    '居住': ['房租','管理費','水費','電費','瓦斯','房屋','rent','utility','水電','天然氣','台電','台水','社區','修繕','裝潢','清潔費'],
    '日用品': ['日用','清潔','衛生','洗衣','detergent','生活','用品','衛生紙','洗髮','沐浴','牙膏','廚房'],
    '通訊': ['電信','手機','internet','網路','中華電信','遠傳','台灣大','台灣之星','亞太','通訊費','月租','icloud','google storage'],
    '保險': ['保險','insurance','壽險','意外險','醫療險','車險','國泰人壽','富邦人壽','南山人壽','新光人壽'],
    '服飾': ['服飾','衣','鞋','帽','uniqlo','zara','h&m','clothes','fashion','gu ','net ','lativ','nike','adidas','puma','new balance'],
    '美容': ['美容','美髮','salon','spa','理髮','美甲','按摩','massage','保養','化妝']
  };

  for (var cat in keywords) {
    if (cats.includes(cat)) {
      for (var k = 0; k < keywords[cat].length; k++) {
        if (lower.includes(keywords[cat][k])) return { cat: cat, payTo: '' };
      }
    }
  }
  return { cat: cats.includes('其他支出') ? '其他支出' : cats[0] || '其他支出', payTo: '' };
}

/** 渲染辨識結果列表 */
function renderBillResults() {
  var resultArea = document.getElementById('billResultArea');
  var listEl = document.getElementById('billResultList');
  var countEl = document.getElementById('billResultCount');

  if (_billParsedItems.length === 0) {
    resultArea.style.display = 'block';
    listEl.innerHTML = '<p style="text-align:center;color:var(--text3);padding:20px">未能辨識出消費明細。<br>請確保圖片清晰，或嘗試重新拍照。</p>';
    countEl.textContent = '';
    return;
  }

  countEl.textContent = '共 ' + _billParsedItems.length + ' 筆';
  var d = U();
  var catOpts = d.expenseCategories.map(function(c) {
    return '<option value="' + c + '">' + getIcon(c) + ' ' + c + '</option>';
  }).join('');
  var acctOpts = d.accounts.map(function(a) {
    return '<option value="' + a.id + '">' + a.name + '</option>';
  }).join('');

  // 找預設信用卡帳戶
  // v1.8.6：預設帳戶用掃描前選好的信用卡；若未設定則找第一張信用卡 fallback
  var defaultAcctId = _billSelectedCardId ||
    (d.accounts.find(function(a) { return a.type === 'credit'; }) || {}).id ||
    (d.accounts[0] ? d.accounts[0].id : '');

  // 未設定過的項目一律套用選定的卡
  _billParsedItems.forEach(function(item) {
    if (!item.accountId) item.accountId = defaultAcctId;
  });

  listEl.innerHTML = _billParsedItems.map(function(item, idx) {
    return '<div class="bill-item" id="billItem' + idx + '">' +
      '<div class="bill-item-check">' +
        '<input type="checkbox" id="billCheck' + idx + '"' + (item.checked ? ' checked' : '') + ' onchange="_billParsedItems[' + idx + '].checked=this.checked">' +
      '</div>' +
      '<div class="bill-item-fields">' +
        '<div class="bill-item-row">' +
          '<input type="date" value="' + item.date + '" onchange="_billParsedItems[' + idx + '].date=this.value" style="flex:1">' +
          '<input type="number" value="' + item.amount + '" step="0.01" onchange="_billParsedItems[' + idx + '].amount=parseFloat(this.value)||0" style="flex:1">' +
        '</div>' +
        '<div class="bill-item-row">' +
          '<input type="text" value="' + (item.desc || '').replace(/"/g, '&quot;') + '" onchange="_billParsedItems[' + idx + '].desc=this.value" placeholder="說明" style="flex:3;min-width:0">' +
          '<select onchange="_billParsedItems[' + idx + '].category=this.value" style="flex:1.5;min-width:100px">' +
            _buildCatOptions(d.expenseCategories, item.category) +
          '</select>' +
        '</div>' +
        '<div class="bill-item-row">' +
          '<select onchange="_billParsedItems[' + idx + '].accountId=this.value" style="flex:1">' +
            d.accounts.map(function(a) {
              return '<option value="' + a.id + '"' + (a.id === (item.accountId || defaultAcctId) ? ' selected' : '') + '>' + a.name + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  resultArea.style.display = 'block';
}

/** 批次建檔所有勾選的帳單項目 */
function saveBillExpenses() {
  var d = U();
  var checkedItems = _billParsedItems.filter(function(item) { return item.checked; });

  if (checkedItems.length === 0) {
    showToast('請至少勾選一筆消費記錄', 'warn');
    return;
  }

  var count = 0;
  checkedItems.forEach(function(item) {
    if (!item.amount || item.amount <= 0) return;
    var acctId = item.accountId || (d.accounts[0] ? d.accounts[0].id : '');
    var newExpense = {
      id: genId(),
      date: item.date,
      category: item.category,
      payMethod: '信用卡',
      accountId: acctId,
      amount: item.amount,
      currency: 'TWD',
      note: item.desc || '帳單掃描',
      payTo: item.payTo || '',
      usedBy: ''
    };
    d.expenses.push(newExpense);

    // 扣除帳戶餘額
    var ac = d.accounts.find(function(a) { return a.id === acctId; });
    if (ac) ac.balance -= convert(item.amount, 'TWD', ac.currency);

    count++;
  });

  if (count > 0) {
    save();
    closeBillScanner();
    renderExpense();
    showToast('✅ 成功建檔 ' + count + ' 筆支出記錄！', 'success');
  } else {
    showToast('沒有有效的消費記錄可建檔', 'warn');
  }
}

/** 顯示確認彈窗（取代 confirm） */
function showConfirmModal(msg, onConfirm) {
  var overlay = document.getElementById('confirmModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confirmModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal" style="max-width:380px;text-align:center">' +
        '<div style="font-size:40px;margin-bottom:12px">⚠️</div>' +
        '<p id="confirmModalMsg" style="font-size:15px;line-height:1.6;margin-bottom:24px;color:var(--text)"></p>' +
        '<div class="modal-actions" style="justify-content:center;gap:12px">' +
          '<button class="btn btn-s" id="confirmModalCancel">取消</button>' +
          '<button class="btn btn-danger" id="confirmModalOk">確定</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.classList.remove('show');
      }
    });
  }
  document.getElementById('confirmModalMsg').textContent = msg;
  overlay.classList.add('show');
  // 綁定按鈕事件（每次重新綁定避免閉包問題）
  var okBtn = document.getElementById('confirmModalOk');
  var cancelBtn = document.getElementById('confirmModalCancel');
  var newOk = okBtn.cloneNode(true);
  var newCancel = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
  newCancel.addEventListener('click', function() { overlay.classList.remove('show'); });
  newOk.addEventListener('click', function() {
    overlay.classList.remove('show');
    if (typeof onConfirm === 'function') onConfirm();
  });
}

/** 顯示 Toast 提示（取代 alert） */
function showToast(msg, type) {
  type = type || 'info';
  var el = document.getElementById('toastNotify');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toastNotify';
    document.body.appendChild(el);
  }
  var colors = {
    success: 'background:rgba(34,197,94,.15);color:var(--green);border:1px solid rgba(34,197,94,.3)',
    warn: 'background:rgba(245,158,11,.15);color:var(--orange);border:1px solid rgba(245,158,11,.3)',
    error: 'background:rgba(239,68,68,.15);color:var(--red);border:1px solid rgba(239,68,68,.3)',
    info: 'background:rgba(108,99,255,.15);color:var(--primary-light);border:1px solid rgba(108,99,255,.3)'
  };
  el.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:9999;padding:14px 28px;border-radius:12px;font-size:15px;font-weight:500;pointer-events:none;opacity:0;transition:opacity .3s;white-space:nowrap;' + (colors[type] || colors.info);
  el.textContent = msg;
  // 淡入
  requestAnimationFrame(function() { el.style.opacity = '1'; });
  // 自動消失
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function() {
    el.style.opacity = '0';
  }, 2500);
}

// ============ 事件綁定 ============
document.getElementById('loginPwd').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('loginUser').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('loginPwd').focus();
});
document.getElementById('confirmPwd').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doSetup();
});

// ============ 自動恢復登入 ============
(async function() {
  var result = await _sb.auth.getSession();
  var session = result.data.session;
  if (session && session.user) {
    currentUserId = session.user.id;
    currentUser = session.user.email;
    loadLocal();
    var loaded = await cloudLoad();
    if (!loaded && !DB) { initNewUser(); }
    await registerSession(); // 註冊此裝置 session
    enterApp();
  }
})();
