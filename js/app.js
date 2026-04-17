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
const ACCOUNT_TYPES = { bank:'銀行存款', cash:'現金', credit:'信用卡', receivable:'未收款', payable:'應付款', invest:'投資/其他' };
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

/** 顯示同步狀態訊息 */
function showSync(msg, type) {
  var el = ensureSyncStatusEl();
  el.textContent = msg;
  el.className = 'sync-status sync-' + type;
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

/** 雲端儲存 */
async function cloudSave() {
  if (!currentUserId || !DB) return;
  showSync('儲存中...', 'saving');
  try {
    // 確保存入雲端時帶有最新時間戳
    DB.updated_at = new Date().toISOString();
    saveLocal(); // 同步更新本地

    var result = await _sb.from('user_data').upsert(
      { user_id: currentUserId, data: DB },
      { onConflict: 'user_id' }
    );
    if (result.error) throw result.error;
    showSync('已同步至雲端 ✓', 'ok');
  } catch (e) {
    console.error('Cloud save error:', e);
    showSync('雲端同步失敗（已存本地）', 'err');
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
      invest: renderInvest
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

/** 取得資料並確保 watchStocks 欄位存在 */
function U() {
  if (!DB.watchStocks) DB.watchStocks = ['2330','2317','2454'];
  if (!DB.categoryIcons) DB.categoryIcons = {};
  if (!DB.transfers) DB.transfers = [];
  if (!DB.updated_at) DB.updated_at = new Date().toISOString();
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
    invest: renderInvest
  };
  if (renders[page]) renders[page]();
}

// ============ 總覽 (Dashboard) ============
function renderDashboard() {
  var d = U();
  var month = document.getElementById('dashMonth').value;
  var cur = document.getElementById('dashCurrency').value;
  var inc = filterByMonth(d.incomes, month);
  var exp = filterByMonth(d.expenses, month);
  var tI = sumConverted(inc, 'amount', cur);
  var tE = sumConverted(exp, 'amount', cur);
  var net = tI - tE;

  // 資產計算：正資產（bank+cash+invest + 不動產現值 + 動產現值）
  var posAsset = d.accounts.filter(function(a) { return a.type === 'bank' || a.type === 'cash' || a.type === 'invest'; })
    .reduce(function(s, a) { return s + convert(a.balance, a.currency, cur); }, 0);
  // 加上不動產和動產現值
  posAsset += (d.properties || []).reduce(function(s, p) { return s + convert(p.currentValue || 0, p.currency || 'TWD', cur); }, 0);
  posAsset += (d.vehicles || []).reduce(function(s, v) { return s + convert(v.currentValue || 0, v.currency || 'TWD', cur); }, 0);
  // 未收款/應付款：從明細記錄加總
  var rec = (d.receivables || []).filter(function(r) { return r.type === 'receivable' && r.status === 'pending'; })
    .reduce(function(s, r) { return s + convert(r.amount, r.currency, cur); }, 0);
  var pay = (d.receivables || []).filter(function(r) { return r.type === 'payable' && r.status === 'pending'; })
    .reduce(function(s, r) { return s + convert(r.amount, r.currency, cur); }, 0);
  var debt = d.accounts.filter(function(a) { return a.type === 'credit'; })
    .reduce(function(s, a) { return s + convert(Math.abs(a.balance), a.currency, cur); }, 0);
  // 總負債 = 應付款 + 信用卡負債
  var totalLiab = pay + debt;
  // 淨資產 = 正資產 + 未收款 − 總負債（標準 Net Worth 定義）
  var netA = posAsset + rec - totalLiab;

  // 上區：資產狀況（存量）— 4 張卡，金額不重疊
  document.getElementById('dashStatsAssets').innerHTML =
    '<div class="stat-card"><div class="label">淨資產</div><div class="value c-primary">' + fmt(netA, cur) + '</div><div class="sub">正資產 + 未收款 − 總負債</div></div>' +
    '<div class="stat-card"><div class="label">正資產</div><div class="value c-blue">' + fmt(posAsset, cur) + '</div><div class="sub">銀行+現金+投資+不動產+動產</div></div>' +
    '<div class="stat-card"><div class="label">未收款</div><div class="value c-orange">' + fmt(rec, cur) + '</div><div class="sub">應收帳款</div></div>' +
    '<div class="stat-card"><div class="label">總負債</div><div class="value c-red">' + fmt(totalLiab, cur) + '</div><div class="sub">應付款 ' + fmt(pay, cur) + ' + 信用卡 ' + fmt(debt, cur) + '</div></div>';

  // 下區：本月收支（流量）— 3 張卡
  document.getElementById('dashStatsFlow').innerHTML =
    '<div class="stat-card"><div class="label">收入</div><div class="value c-green">' + fmt(tI, cur) + '</div><div class="sub">' + inc.length + ' 筆</div></div>' +
    '<div class="stat-card"><div class="label">支出</div><div class="value c-red">' + fmt(tE, cur) + '</div><div class="sub">' + exp.length + ' 筆</div></div>' +
    '<div class="stat-card"><div class="label">淨收支</div><div class="value ' + (net >= 0 ? 'c-green' : 'c-red') + '">' + (net >= 0 ? '+' : '') + fmt(net, cur) + '</div><div class="sub">收入 − 支出</div></div>';

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
    receivable: '未收款帳戶', payable: '應付款帳戶', invest: '投資/其他資產',
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

  var list = d.accounts.filter(function(a) { return a.type === currentAssetTab; });

  var tTWD = list.reduce(function(s, a) {
    if (currentAssetTab === 'payable') return s + convert(Math.abs(a.balance), a.currency, 'TWD');
    return s + convert(a.balance, a.currency, 'TWD');
  }, 0);

  // 依帳戶類型調整表頭
  if (currentAssetTab === 'receivable') {
    document.getElementById('assetThead').innerHTML =
      '<tr><th style="width:40px"></th><th>名稱</th><th>付款對象</th><th>幣別</th><th>應收金額</th><th>備註</th><th></th></tr>';
  } else if (currentAssetTab === 'payable') {
    document.getElementById('assetThead').innerHTML =
      '<tr><th style="width:40px"></th><th>名稱</th><th>收款對象</th><th>幣別</th><th>應付金額</th><th>備註</th><th></th></tr>';
  } else {
    document.getElementById('assetThead').innerHTML =
      '<tr><th style="width:40px"></th><th>帳戶名稱</th><th>機構</th><th>幣別</th><th>餘額</th><th>說明</th><th></th></tr>';
  }

  document.getElementById('assetStats').innerHTML =
    '<div class="stat-card"><div class="label">' + titles[currentAssetTab] + '合計 (TWD)</div>' +
    '<div class="value ' + (currentAssetTab === 'credit' || currentAssetTab === 'payable' ? 'c-red' : currentAssetTab === 'receivable' ? 'c-orange' : 'c-blue') + '">' +
    fmt(tTWD, 'TWD') + '</div><div class="sub">' + list.length + ' 個帳戶</div></div>';

  var tb = document.getElementById('assetTable');
  tb.innerHTML = list.length ? list.map(function(a) {
    var displayBalance = (currentAssetTab === 'payable') ? Math.abs(a.balance) : a.balance;
    var colorClass = (currentAssetTab === 'payable') ? 'c-red' : (a.balance >= 0 ? 'c-green' : 'c-red');
    return '<tr draggable="true" data-id="' + a.id + '">' +
      '<td><span class="drag-handle">⠿</span></td>' +
      '<td style="font-weight:600">' + a.name + '</td>' +
      '<td>' + (a.institution || '-') + '</td>' +
      '<td>' + a.currency + '</td>' +
      '<td style="font-weight:600" class="' + colorClass + '">' + fmt(displayBalance, a.currency) + '</td>' +
      '<td style="color:var(--text3)">' + (a.note || '-') + '</td>' +
      '<td><span class="edit-btn" onclick="editAccount(\'' + a.id + '\')">✏️</span>' +
      '<span class="del-btn" onclick="deleteAccount(\'' + a.id + '\')">✕</span></td></tr>';
  }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">尚無帳戶</td></tr>';

  // 應收款/應付款明細區塊
  var recvSection = document.getElementById('receivableSection');
  if (recvSection) {
    if (currentAssetTab === 'receivable' || currentAssetTab === 'payable') {
      recvSection.style.display = 'block';
      var isRecv = currentAssetTab === 'receivable';
      document.getElementById('recvTableTitle').textContent = isRecv ? '應收款明細' : '應付款明細';
      recvSection.querySelector('button').onclick = function() { openModal('receivable'); };
      renderReceivables(isRecv);
    } else {
      recvSection.style.display = 'none';
    }
  }

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
    var ac = d.accounts.find(function(a) { return a.id === r.accountId; });
    return '<tr' + (overdueDays > 0 ? ' style="background:rgba(239,68,68,.05)"' : '') + '>' +
      '<td>' + (r.date || '-') + '</td>' +
      '<td>' + (r.dueDate || '-') + '</td>' +
      '<td>' + statusHtml + '</td>' +
      '<td style="font-weight:600">' + (r.target || '-') + '</td>' +
      '<td>' + (r.note || '-') + '</td>' +
      '<td style="font-weight:600" class="' + (isRecv ? 'c-orange' : 'c-red') + '">' + fmt(r.amount, r.currency) + '</td>' +
      '<td>' + (r.currency || 'TWD') + '</td>' +
      '<td>' + (ac ? ac.name : '-') + '</td>' +
      '<td>' +
        (r.status !== 'paid' ? '<span class="edit-btn" onclick="markReceivablePaid(\'' + r.id + '\')" title="' + (isRecv ? '標記已收款' : '標記已付款') + '">✅</span>' : '') +
        '<span class="edit-btn" onclick="editReceivable(\'' + r.id + '\')">✏️</span>' +
        '<span class="del-btn" onclick="deleteReceivable(\'' + r.id + '\')">✕</span>' +
      '</td></tr>';
  }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:40px">尚無' + (isRecv ? '應收款' : '應付款') + '記錄</td></tr>';
}

function markReceivablePaid(id) {
  var d = U();
  var r = (d.receivables || []).find(function(rv) { return rv.id === id; });
  if (!r) return;
  var isRecv = r.type === 'receivable';
  showConfirmModal(isRecv ? '確定標記為已收款？金額將存入對應帳戶。' : '確定標記為已付款？金額將從對應帳戶扣除。', function() {
    r.status = 'paid';
    // 更新對應帳戶餘額
    if (r.accountId) {
      var acct = d.accounts.find(function(a) { return a.id === r.accountId; });
      if (acct) {
        var amt = convert(r.amount, r.currency, acct.currency);
        if (isRecv) acct.balance += amt;
        else acct.balance -= amt;
      }
    }
    save(); renderAssets();
    showToast(isRecv ? '已收款，金額已存入帳戶' : '已付款，金額已從帳戶扣除');
  });
}

function editReceivable(id) { openModal('receivable', id); }

function deleteReceivable(id) {
  showConfirmModal('確定刪除此筆記錄？', function() {
    var d = U();
    d.receivables = (d.receivables || []).filter(function(r) { return r.id !== id; });
    save();
    renderAssets();
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
    accountId: document.getElementById('f_acct').value,
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

// ============ 資產拖拽排序 ============
var dragSrcRow = null;
function initAssetDrag() {
  var rows = document.querySelectorAll('#assetTable tr[draggable]');
  rows.forEach(function(row) {
    row.addEventListener('dragstart', function(e) {
      dragSrcRow = this;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.dataset.id);
    });
    row.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      document.querySelectorAll('#assetTable tr').forEach(function(r) { r.classList.remove('drag-over'); });
    });
    row.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (this !== dragSrcRow && this.dataset.id) this.classList.add('drag-over');
    });
    row.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
    row.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      if (dragSrcRow === this) return;
      var fromId = dragSrcRow.dataset.id, toId = this.dataset.id;
      if (!fromId || !toId) return;
      var d2 = U(), accts = d2.accounts;
      var fromIdx = accts.findIndex(function(a) { return a.id === fromId; });
      var toIdx = accts.findIndex(function(a) { return a.id === toId; });
      if (fromIdx < 0 || toIdx < 0) return;
      var item = accts.splice(fromIdx, 1)[0];
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
  // 正資產：bank, cash, invest + 不動產現值 + 動產現值
  var positiveAccts = d.accounts.filter(function(a) {
    return a.type === 'bank' || a.type === 'cash' || a.type === 'invest';
  });
  var tPositive = positiveAccts.reduce(function(s, a) { return s + convert(a.balance, a.currency, cur); }, 0);
  tPositive += (d.properties || []).reduce(function(s, p) { return s + convert(p.currentValue || 0, p.currency || 'TWD', cur); }, 0);
  tPositive += (d.vehicles || []).reduce(function(s, v) { return s + convert(v.currentValue || 0, v.currency || 'TWD', cur); }, 0);

  // 應付款：從明細記錄加總（未付的 payable）
  var payableAccts = d.accounts.filter(function(a) { return a.type === 'payable'; });
  var pendingPayables = (d.receivables || []).filter(function(r) { return r.type === 'payable' && r.status === 'pending'; });
  var tPay = pendingPayables.reduce(function(s, r) { return s + convert(r.amount, r.currency, cur); }, 0);

  // 未收款：從明細記錄加總（未收的 receivable）
  var receivableAccts = d.accounts.filter(function(a) { return a.type === 'receivable'; });
  var pendingReceivables = (d.receivables || []).filter(function(r) { return r.type === 'receivable' && r.status === 'pending'; });
  var tRec = pendingReceivables.reduce(function(s, r) { return s + convert(r.amount, r.currency, cur); }, 0);

  // 負債：credit
  var creditAccts = d.accounts.filter(function(a) { return a.type === 'credit'; });
  var tDebt = creditAccts.reduce(function(s, a) { return s + convert(Math.abs(a.balance), a.currency, cur); }, 0);

  // 總資產 = 正資產 + 未收款（所有擁有的資源）
  var tA = tPositive + tRec;
  // 淨資產 = 正資產 + 未收款 − 應付款 − 負債（標準 Net Worth 定義，與資產總覽一致）
  var netAsset = tPositive + tRec - tPay - tDebt;

  // 統計卡片
  try {
    document.getElementById('aasStats').innerHTML =
      '<div class="stat-card"><div class="label">正資產</div><div class="value c-blue">' + fmt(tPositive, cur) + '</div><div class="sub">銀行+現金+投資+不動產+動產</div></div>' +
      '<div class="stat-card"><div class="label">淨資產</div><div class="value c-primary">' + fmt(netAsset, cur) + '</div><div class="sub">正資產 + 未收款 − 應付款 − 負債</div></div>' +
      '<div class="stat-card"><div class="label">' + rangeLabel + '收入</div><div class="value c-green">' + fmt(periodInc, cur) + '</div></div>' +
      '<div class="stat-card"><div class="label">' + rangeLabel + '支出</div><div class="value c-red">' + fmt(periodExp, cur) + '</div></div>' +
      '<div class="stat-card"><div class="label">負債（信用卡）</div><div class="value c-red">' + fmt(tDebt, cur) + '</div><div class="sub">' + creditAccts.length + ' 張</div></div>' +
      '<div class="stat-card"><div class="label">未收款</div><div class="value c-orange">' + fmt(tRec, cur) + '</div><div class="sub">' + pendingReceivables.length + ' 筆未收</div></div>' +
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
    // 未收款追蹤表（從明細記錄）
    document.getElementById('aasReceivableStats').innerHTML =
      '<div class="stat-card"><div class="label">未收款總計 (' + cur + ')</div>' +
      '<div class="value c-orange">' + fmt(tRec, cur) + '</div>' +
      '<div class="sub">' + pendingReceivables.length + ' 筆未收</div></div>';

    document.getElementById('aasReceivableTable').innerHTML = pendingReceivables.length ?
      pendingReceivables.map(function(r) {
        var acct = d.accounts.find(function(a) { return a.id === r.accountId; });
        return '<tr><td style="font-weight:600">' + (acct ? acct.name : '-') + '</td><td>' +
          (r.target || '-') + '</td><td>' + r.currency + '</td>' +
          '<td class="c-orange" style="font-weight:600">' + fmt(r.amount, r.currency) +
          '</td><td style="color:var(--text3)">' + (r.note || '-') + '</td></tr>';
      }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:30px">無未收款記錄</td></tr>';
  } catch (e) { console.error('未收款追蹤表錯誤:', e); }

  try {
    // 應付款追蹤表（從明細記錄）
    document.getElementById('aasPayableStats').innerHTML =
      '<div class="stat-card"><div class="label">應付款總計 (' + cur + ')</div>' +
      '<div class="value c-red">' + fmt(tPay, cur) + '</div>' +
      '<div class="sub">' + pendingPayables.length + ' 筆未付</div></div>';

    document.getElementById('aasPayableTable').innerHTML = pendingPayables.length ?
      pendingPayables.map(function(r) {
        var acct = d.accounts.find(function(a) { return a.id === r.accountId; });
        return '<tr><td style="font-weight:600">' + (acct ? acct.name : '-') + '</td><td>' +
          (r.target || '-') + '</td><td>' + r.currency + '</td>' +
          '<td class="c-red" style="font-weight:600">' + fmt(r.amount, r.currency) +
          '</td><td style="color:var(--text3)">' + (r.note || '-') + '</td></tr>';
      }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:30px">無應付款記錄</td></tr>';
  } catch (e) { console.error('應付款追蹤表錯誤:', e); }
}

// ============ 投資情報 ============
function renderInvest() { loadNews(); renderPortfolio(); loadStocks(); loadPreciousMetals(); loadCryptoNews(); }

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

  // 有成功取得至少一筆 → 渲染
  if (allResults.length > 0) {
    var failedCodes = d.watchStocks.filter(function(c) { return loadedCodes.indexOf(c) === -1; });
    // 按照原始追蹤順序排列
    allResults.sort(function(a, b) {
      return d.watchStocks.indexOf(a.code) - d.watchStocks.indexOf(b.code);
    });
    el.innerHTML = renderCards(allResults, failedCodes);
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

async function renderPortfolio() {
  var d = U();
  if (!d.portfolio) d.portfolio = [];
  var tb = document.getElementById('portfolioTable');
  var stats = document.getElementById('portfolioStats');
  if (!tb) return;

  // 收集需要查詢即時股價的代號
  var stockCodes = d.portfolio.filter(function(p) { return p.type === 'stock' && p.code; }).map(function(p) { return p.code; });

  // 查詢 TWSE 即時價格（經 CORS Proxy）
  if (stockCodes.length > 0) {
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

// ============ 匯率換算 ============
function doConvert() {
  var amt = parseFloat(document.getElementById('convFrom').value) || 0;
  var from = document.getElementById('convFromCur').value;
  var to = document.getElementById('convToCur').value;
  var result = convert(amt, from, to);
  document.getElementById('convTo').value = result.toFixed(to === 'JPY' ? 0 : 2);
  document.getElementById('convResult').textContent = fmt(amt, from) + ' = ' + fmt(result, to);
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
      return '<option value="' + a.id + '"' + (editing4 && editing4.fromAccountId === a.id ? ' selected' : '') + '>' + a.name + ' (' + ACCOUNT_TYPES[a.type] + ')</option>';
    }).join('');
    var toOpts = allAccts.map(function(a) {
      return '<option value="' + a.id + '"' + (editing4 && editing4.toAccountId === a.id ? ' selected' : '') + '>' + a.name + ' (' + ACCOUNT_TYPES[a.type] + ')</option>';
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
    var acctOpts5 = d.accounts.map(function(a) {
      return '<option value="' + a.id + '"' + (editing5 && editing5.accountId === a.id ? ' selected' : '') + '>' + a.name + '</option>';
    }).join('');
    m.innerHTML = '<h3>' + (editing5 ? '編輯' : '新增') + label + '</h3>' +
      '<div class="form-row"><div class="form-group"><label>建立日期</label><input type="date" id="f_date" value="' + (editing5 ? editing5.date : new Date().toISOString().slice(0, 10)) + '"></div>' +
      '<div class="form-group"><label>應付日期（到期日）</label><input type="date" id="f_dueDate" value="' + (editing5 ? editing5.dueDate || '' : '') + '"></div></div>' +
      '<div class="form-group"><label>' + (isRecv ? '付款對象/機構' : '應付對象/機構') + '</label><input type="text" id="f_target" placeholder="例：張先生 / 台電公司" value="' + (editing5 ? editing5.target || '' : '') + '"></div>' +
      '<div class="form-row"><div class="form-group"><label>金額</label><input type="number" id="f_amt" step="0.01" value="' + (editing5 ? editing5.amount : '') + '"></div>' +
      '<div class="form-group"><label>幣別</label><select id="f_cur">' + curOpts5 + '</select></div></div>' +
      '<div class="form-group"><label>' + (isRecv ? '收款帳戶' : '付款帳戶') + '</label><select id="f_acct">' + acctOpts5 + '</select></div>' +
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
  }
  document.getElementById('modalOverlay').classList.add('show');
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
    usedBy: document.getElementById('f_usedBy').value
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
    transferAccount: payMethod === '銀行轉帳' && transferAcctEl ? transferAcctEl.value : ''
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

function openBillScanner() {
  var overlay = document.getElementById('billScannerOverlay');
  resetBillScanner();
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
  var defaultCreditAcct = d.accounts.find(function(a) { return a.type === 'credit'; });
  var defaultAcctId = defaultCreditAcct ? defaultCreditAcct.id : (d.accounts[0] ? d.accounts[0].id : '');

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
              return '<option value="' + a.id + '"' + (a.id === defaultAcctId ? ' selected' : '') + '>' + a.name + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // 設定預設帳戶 ID
  _billParsedItems.forEach(function(item) {
    if (!item.accountId) item.accountId = defaultAcctId;
  });

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
