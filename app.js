// ============ ICONS ============
const CAT_ICONS = {
  '薪資':'💰','獎金':'🏆','投資收益':'📈','兼職':'💼','利息':'🏦','其他收入':'💵',
  '餐飲':'🍽️','交通':'🚗','購物':'🛍️','娛樂':'🎮','醫療':'🏥','教育':'📚',
  '居住':'🏠','日用品':'🧴','通訊':'📱','保險':'🛡️','其他支出':'📋',
  '水電':'💡','旅遊':'✈️','寵物':'🐾','服飾':'👔','美容':'💇','健身':'🏋️',
  '捐款':'❤️','稅務':'📝','社交':'🤝','房租':'🔑','貸款':'💳','投資':'📊',
  '股利':'💹','租金收入':'🏢','退款':'🔄','禮金':'🎁','中獎':'🎰',
};
function getIcon(cat){ return CAT_ICONS[cat] || (cat.includes('餐')?'🍽️':cat.includes('交通')?'🚗':cat.includes('購')?'🛍️':cat.includes('醫')?'🏥':cat.includes('薪')?'💰':'📌'); }

const DEFAULT_INC_CATS = ['薪資','獎金','投資收益','兼職','利息','其他收入'];
const DEFAULT_EXP_CATS = ['餐飲','交通','購物','娛樂','醫療','教育','居住','日用品','通訊','保險','其他支出'];
const CURRENCIES = {TWD:'新台幣',USD:'美元',JPY:'日圓',EUR:'歐元',CNY:'人民幣'};
const ACCOUNT_TYPES = {bank:'銀行存款',cash:'現金',credit:'信用卡',receivable:'未收款',payable:'應付款',invest:'投資/其他'};
const PIE_COLORS = ['#6c63ff','#00d2ff','#22c55e','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6','#f97316','#64748b','#a855f7','#06b6d4'];

let rates={TWD:1,USD:0.0313,JPY:4.69,EUR:0.0289,CNY:0.2273};
let DB=null, currentUser='', currentUserId='';

// ============ SUPABASE ============
const SUPABASE_URL = 'https://zdghqxxydlibgqvooesn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uyC2tpnAclYTKq2OQDBOkA_uBIq1X6N';
var _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function showSync(msg,type){const el=document.getElementById('syncStatus');el.textContent=msg;el.className='sync-status sync-'+type;if(type==='ok')setTimeout(()=>{el.classList.add('sync-hide');},2000);}

function defaultUserData(){return {incomeCategories:[...DEFAULT_INC_CATS],expenseCategories:[...DEFAULT_EXP_CATS],accounts:[],incomes:[],expenses:[],watchStocks:['2330','2317','2454']};}

// Local cache
function saveLocal(){localStorage.setItem('flowrich_user_'+currentUserId,JSON.stringify(DB));}
function loadLocal(){const d=localStorage.getItem('flowrich_user_'+currentUserId);if(d){DB=JSON.parse(d);return true;}return false;}

// Cloud save with debounce
let _saveTimer=null;
function save(){
  saveLocal();
  if(_saveTimer)clearTimeout(_saveTimer);
  _saveTimer=setTimeout(()=>cloudSave(),800);
}
async function cloudSave(){
  if(!currentUserId)return;
  showSync('儲存中...','saving');
  try{
    const {error}=await _sb.from('user_data').upsert({user_id:currentUserId,data:DB},{onConflict:'user_id'});
    if(error)throw error;
    showSync('已同步至雲端 ✓','ok');
  }catch(e){
    console.error('Cloud save error:',e);
    showSync('雲端同步失敗（已存本地）','err');
  }
}
async function cloudLoad(){
  if(!currentUserId)return false;
  try{
    const {data,error}=await _sb.from('user_data').select('data').eq('user_id',currentUserId).single();
    if(error&&error.code==='PGRST116'){return false;} // no row
    if(error)throw error;
    if(data&&data.data){DB=data.data;saveLocal();return true;}
  }catch(e){console.error('Cloud load error:',e);}
  return false;
}

function U(){if(!DB.watchStocks)DB.watchStocks=['2330','2317','2454'];return DB;}

// ============ THEME ============
function toggleTheme(){document.documentElement.classList.toggle('light');localStorage.setItem('flowrich_theme',document.documentElement.classList.contains('light')?'light':'dark');const ap=document.querySelector('.page.active');if(ap){const id=ap.id.replace('page-','');const r={dashboard:renderDashboard,analysis:renderAnalysis,assetAnalysis:renderAssetAnalysis};if(r[id])r[id]();}}
function loadTheme(){if(localStorage.getItem('flowrich_theme')==='light')document.documentElement.classList.add('light');}
loadTheme();

// ============ LOGIN ============
function showLoginError(m){const e=document.getElementById('loginError');e.textContent=m;e.style.display='block';}
function showRegisterError(m){const e=document.getElementById('registerError');e.textContent=m;e.style.display='block';}
function showRegister(){document.getElementById('loginView').style.display='none';document.getElementById('registerView').style.display='block';document.getElementById('loginError').style.display='none';document.getElementById('registerError').style.display='none';}
function showLogin(){document.getElementById('registerView').style.display='none';document.getElementById('loginView').style.display='block';document.getElementById('loginError').style.display='none';document.getElementById('registerError').style.display='none';}

async function doLogin(){
  const email=document.getElementById('loginUser').value.trim(),pwd=document.getElementById('loginPwd').value;
  if(!email||!pwd){showLoginError('請輸入 Email 和密碼');return;}
  showLoginError('登入中...');document.getElementById('loginError').style.display='block';document.getElementById('loginError').style.color='var(--text3)';
  try{
    const {data,error}=await _sb.auth.signInWithPassword({email,password:pwd});
    if(error)throw error;
    currentUserId=data.user.id;currentUser=data.user.email;
    const loaded=await cloudLoad();
    if(!loaded){loadLocal()||initNewUser();}
    enterApp();
  }catch(e){
    document.getElementById('loginError').style.color='var(--red)';
    showLoginError(e.message==='Invalid login credentials'?'Email 或密碼錯誤':e.message);
  }
}

async function doSetup(){
  const email=document.getElementById('newUser').value.trim(),p1=document.getElementById('newPwd').value,p2=document.getElementById('confirmPwd').value;
  if(!email){showRegisterError('請輸入 Email');return;}
  if(!p1||p1.length<6){showRegisterError('密碼至少 6 位');return;}
  if(p1!==p2){showRegisterError('兩次密碼不一致');return;}
  showRegisterError('註冊中...');document.getElementById('registerError').style.display='block';document.getElementById('registerError').style.color='var(--text3)';
  try{
    const {data,error}=await _sb.auth.signUp({email,password:p1});
    if(error)throw error;
    if(data.user&&!data.session){showRegisterError('請查收 Email 確認信後再登入');document.getElementById('registerError').style.color='var(--green)';return;}
    currentUserId=data.user.id;currentUser=data.user.email;
    initNewUser();
    await cloudSave();
    enterApp();
  }catch(e){
    document.getElementById('registerError').style.color='var(--red)';
    showRegisterError(e.message==='User already registered'?'此 Email 已註冊':e.message);
  }
}

function initNewUser(){
  DB=defaultUserData();
  DB.accounts.push({id:genId(),name:'主要銀行',type:'bank',institution:'',currency:'TWD',balance:0,note:'',createdAt:new Date().toISOString()});
  DB.accounts.push({id:genId(),name:'現金',type:'cash',institution:'',currency:'TWD',balance:0,note:'',createdAt:new Date().toISOString()});
  saveLocal();
}

function enterApp(){document.getElementById('loginOverlay').style.display='none';document.getElementById('app').style.display='flex';document.getElementById('sidebarUser').textContent=currentUser;const se=document.getElementById('settingsEmail');if(se)se.textContent=currentUser;initMonthSelectors();fetchRates();renderDashboard();loadCategories();}

async function doLogout(){
  await _sb.auth.signOut();
  currentUser='';currentUserId='';DB=null;
  document.getElementById('app').style.display='none';
  document.getElementById('loginOverlay').style.display='flex';
  showLogin();
}

// ============ UTILS ============
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function fmt(n,cur='TWD'){const sym={TWD:'NT$',USD:'$',JPY:'¥',EUR:'€',CNY:'¥'}[cur]||'';return sym+Number(n).toLocaleString('en',{minimumFractionDigits:cur==='JPY'?0:2,maximumFractionDigits:cur==='JPY'?0:2});}
function convert(amount,from,to){if(from===to)return amount;return(amount/rates[from])*rates[to];}
function getMonth(ds){return ds.slice(0,7);}
function getYear(ds){return ds.slice(0,4);}
function initMonthSelectors(){const months=[],now=new Date();const curY=now.getFullYear(),curM=now.getMonth();const cur=curY+'-'+(curM+1<10?'0':'')+(curM+1);for(let i=11;i>=0;i--){const y2=new Date(curY,curM-i,1);const mm=y2.getFullYear()+'-'+((y2.getMonth()+1)<10?'0':'')+(y2.getMonth()+1);months.push(mm);}['dashMonth','incMonth','expMonth','anaMonth'].forEach(id=>{const sel=document.getElementById(id);if(!sel)return;sel.innerHTML='<option value="all">全部月份</option>'+months.map(m=>`<option value="${m}"${m===cur?' selected':''}>${m}</option>`).join('');});const years=[];for(let i=0;i<5;i++)years.push((curY-i).toString());['incYear','expYear','anaYear'].forEach(id=>{const sel=document.getElementById(id);if(!sel)return;sel.innerHTML=years.map(y=>`<option value="${y}"${y===curY.toString()?' selected':''}>${y} 年</option>`).join('');});}
function updateIncSel(){const r=document.getElementById('incRange').value;document.getElementById('incMonth').style.display=r==='month'?'':'none';document.getElementById('incYear').style.display=r==='year'?'':'none';}
function updateExpSel(){const r=document.getElementById('expRange').value;document.getElementById('expMonth').style.display=r==='month'?'':'none';document.getElementById('expYear').style.display=r==='year'?'':'none';}
function updateAnaSel(){const r=document.getElementById('anaRange').value;document.getElementById('anaMonth').style.display=r==='month'?'':'none';document.getElementById('anaYear').style.display=r==='year'?'':'none';}
function filterByRange(list,range,month,year){if(range==='all')return [...list];if(range==='year')return list.filter(i=>getYear(i.date)===year);if(month==='all')return [...list];return list.filter(i=>getMonth(i.date)===month);}

async function fetchRates(){try{const r=await fetch('https://api.exchangerate-api.com/v4/latest/TWD');const d=await r.json();if(d.rates){rates.TWD=1;rates.USD=d.rates.USD;rates.JPY=d.rates.JPY;rates.EUR=d.rates.EUR;rates.CNY=d.rates.CNY;}}catch(e){}renderRateTable();doConvert();}
function renderRateTable(){const tb=document.getElementById('rateTable');if(!tb)return;tb.innerHTML=Object.entries(CURRENCIES).map(([c,n])=>`<tr><td><strong>${c}</strong></td><td>${rates[c].toFixed(6)}</td><td>${n}</td></tr>`).join('');document.getElementById('rateInfo').textContent=`匯率來源: exchangerate-api.com｜${new Date().toLocaleString('zh-TW')}`;}

function switchPage(page){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById('page-'+page).classList.add('active');document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));const r={dashboard:renderDashboard,income:renderIncome,expense:renderExpense,assets:renderAssets,analysis:renderAnalysis,assetAnalysis:renderAssetAnalysis,invest:renderInvest};if(r[page])r[page]();}

// ============ DASHBOARD ============
function renderDashboard(){
  const d=U(),month=document.getElementById('dashMonth').value,cur=document.getElementById('dashCurrency').value;
  const inc=filterByMonth(d.incomes,month),exp=filterByMonth(d.expenses,month);
  const tI=sumConverted(inc,'amount',cur),tE=sumConverted(exp,'amount',cur),net=tI-tE;
  const tA=d.accounts.filter(a=>a.type!=='payable').reduce((s,a)=>s+convert(a.balance,a.currency,cur),0);
  const rec=d.accounts.filter(a=>a.type==='receivable').reduce((s,a)=>s+convert(a.balance,a.currency,cur),0);
  const pay=d.accounts.filter(a=>a.type==='payable').reduce((s,a)=>s+convert(Math.abs(a.balance),a.currency,cur),0);
  const netA=tA-rec-pay;
  document.getElementById('dashStats').innerHTML=`
    <div class="stat-card"><div class="label">總資產</div><div class="value c-blue">${fmt(tA,cur)}</div></div>
    <div class="stat-card"><div class="label">淨資產</div><div class="value c-primary">${fmt(netA,cur)}</div><div class="sub">扣除未收款與應付款</div></div>
    <div class="stat-card"><div class="label">收入</div><div class="value c-green">${fmt(tI,cur)}</div><div class="sub">${inc.length} 筆</div></div>
    <div class="stat-card"><div class="label">支出</div><div class="value c-red">${fmt(tE,cur)}</div><div class="sub">${exp.length} 筆</div></div>
    <div class="stat-card"><div class="label">淨收支</div><div class="value ${net>=0?'c-green':'c-red'}">${net>=0?'+':''}${fmt(net,cur)}</div></div>
    ${rec>0?`<div class="stat-card"><div class="label">未收款</div><div class="value c-orange">${fmt(rec,cur)}</div></div>`:''}
    ${pay>0?`<div class="stat-card"><div class="label">應付款</div><div class="value c-red">${fmt(pay,cur)}</div></div>`:''}`;
  const all=[...inc.map(i=>({...i,_t:'inc'})),...exp.map(e=>({...e,_t:'exp'}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  document.getElementById('dashRecent').innerHTML=all.length?all.map(t=>{const ac=d.accounts.find(a=>a.id===t.accountId);return `<tr><td>${t.date}</td><td><span class="tag ${t._t==='inc'?'tag-green':'tag-red'}">${t._t==='inc'?'收入':'支出'}</span></td><td><span class="cat-icon">${getIcon(t.category)}</span>${t.category}</td><td>${t.note||'-'}</td><td style="font-weight:600" class="${t._t==='inc'?'c-green':'c-red'}">${t._t==='inc'?'+':'−'}${fmt(t.amount,t.currency)}</td><td>${ac?ac.name:'-'}</td></tr>`;}).join(''):'<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:40px">尚無交易記錄</td></tr>';
  drawDashChart(month,cur);
}
function drawDashChart(month,cur){const canvas=document.getElementById('dashChart');if(!canvas)return;const ctx=canvas.getContext('2d');canvas.width=canvas.parentElement.clientWidth-40;ctx.clearRect(0,0,canvas.width,canvas.height);const d=U(),tm=month==='all'?new Date().toISOString().slice(0,7):month;const dim=new Date(parseInt(tm.slice(0,4)),parseInt(tm.slice(5,7)),0).getDate();const iD=new Array(dim).fill(0),eD=new Array(dim).fill(0);d.incomes.filter(i=>getMonth(i.date)===tm).forEach(i=>{iD[parseInt(i.date.slice(8,10))-1]+=convert(i.amount,i.currency,cur);});d.expenses.filter(e=>getMonth(e.date)===tm).forEach(e=>{eD[parseInt(e.date.slice(8,10))-1]+=convert(e.amount,e.currency,cur);});const mx=Math.max(...iD,...eD,1),w=canvas.width,h=canvas.height,p=40,gw=w-p*2,gh=h-p*2;const gc=getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim(),tc=getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim();ctx.strokeStyle=gc;ctx.lineWidth=1;for(let i=0;i<=4;i++){const y=p+gh*(1-i/4);ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke();ctx.fillStyle=tc;ctx.font='11px sans-serif';ctx.textAlign='right';ctx.fillText(Math.round(mx*i/4).toLocaleString(),p-8,y+4);}function dl(data,col){ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=2;data.forEach((v,i)=>{const x=p+(i/(dim-1))*gw,y=p+gh*(1-v/mx);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();}dl(iD,'#22c55e');dl(eD,'#ef4444');}

// ============ INCOME ============
function renderIncome(){
  const d=U(),range=document.getElementById('incRange').value,month=document.getElementById('incMonth').value,year=document.getElementById('incYear').value;
  const list=filterByRange(d.incomes,range,month,year).sort((a,b)=>b.date.localeCompare(a.date));
  const total=list.reduce((s,i)=>s+convert(i.amount,i.currency,'TWD'),0);
  document.getElementById('incStats').innerHTML=`<div class="stat-card"><div class="label">總收入 (TWD)</div><div class="value c-green">${fmt(total,'TWD')}</div><div class="sub">${list.length} 筆</div></div>`;
  document.getElementById('incTable').innerHTML=list.length?list.map(i=>{const ac=d.accounts.find(a=>a.id===i.accountId);return `<tr><td>${i.date}</td><td><span class="tag tag-green"><span class="cat-icon">${getIcon(i.category)}</span>${i.category}</span></td><td>${i.note||'-'}</td><td class="c-green" style="font-weight:600">+${fmt(i.amount,i.currency)}</td><td>${i.currency}</td><td>${ac?ac.name:'-'}</td><td><span class="edit-btn" onclick="editRecord('income','${i.id}')">✏️</span><span class="del-btn" onclick="deleteRecord('incomes','${i.id}')">✕</span></td></tr>`;}).join(''):'<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">尚無收入記錄</td></tr>';
}

// ============ EXPENSE ============
function renderExpense(){
  const d=U(),range=document.getElementById('expRange').value,month=document.getElementById('expMonth').value,year=document.getElementById('expYear').value,pt=document.getElementById('expPayType').value;
  let list=filterByRange(d.expenses,range,month,year);if(pt!=='all')list=list.filter(e=>e.payMethod===pt);
  list.sort((a,b)=>b.date.localeCompare(a.date));
  const total=list.reduce((s,e)=>s+convert(e.amount,e.currency,'TWD'),0);
  const cc=list.filter(e=>e.payMethod==='信用卡').reduce((s,e)=>s+convert(e.amount,e.currency,'TWD'),0);
  const cash=list.filter(e=>e.payMethod==='現金').reduce((s,e)=>s+convert(e.amount,e.currency,'TWD'),0);
  document.getElementById('expStats').innerHTML=`<div class="stat-card"><div class="label">總支出 (TWD)</div><div class="value c-red">${fmt(total,'TWD')}</div><div class="sub">${list.length} 筆</div></div><div class="stat-card"><div class="label">信用卡</div><div class="value c-orange">${fmt(cc,'TWD')}</div></div><div class="stat-card"><div class="label">現金</div><div class="value c-pink">${fmt(cash,'TWD')}</div></div>`;
  document.getElementById('expTable').innerHTML=list.length?list.map(e=>{const ac=d.accounts.find(a=>a.id===e.accountId);const tc2=e.payMethod==='信用卡'?'tag-orange':e.payMethod==='現金'?'tag-purple':'tag-blue';return `<tr><td>${e.date}</td><td><span class="tag tag-red"><span class="cat-icon">${getIcon(e.category)}</span>${e.category}</span></td><td>${e.note||'-'}</td><td class="c-red" style="font-weight:600">−${fmt(e.amount,e.currency)}</td><td>${e.currency}</td><td><span class="tag ${tc2}">${e.payMethod}</span></td><td>${ac?ac.name:'-'}</td><td><span class="edit-btn" onclick="editRecord('expense','${e.id}')">✏️</span><span class="del-btn" onclick="deleteRecord('expenses','${e.id}')">✕</span></td></tr>`;}).join(''):'<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:40px">尚無支出記錄</td></tr>';
}

// ============ ASSETS ============
let currentAssetTab='bank';
function switchAssetTab(tab,btn){currentAssetTab=tab;document.querySelectorAll('#assetTabBar .tab-btn').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderAssets();}
function renderAssets(){const d=U(),list=d.accounts.filter(a=>a.type===currentAssetTab);const titles={bank:'銀行存款帳戶',cash:'現金帳戶',credit:'信用卡帳戶',receivable:'未收款帳戶',payable:'應付款帳戶',invest:'投資/其他資產'};document.getElementById('assetTableTitle').textContent=titles[currentAssetTab];const tTWD=list.reduce((s,a)=>s+convert(a.balance,a.currency,'TWD'),0);if(currentAssetTab==='receivable')document.getElementById('assetThead').innerHTML='<tr><th style="width:40px"></th><th>名稱</th><th>付款對象</th><th>幣別</th><th>應收金額</th><th>備註</th><th></th></tr>';else if(currentAssetTab==='payable')document.getElementById('assetThead').innerHTML='<tr><th style="width:40px"></th><th>名稱</th><th>收款對象</th><th>幣別</th><th>應付金額</th><th>備註</th><th></th></tr>';else document.getElementById('assetThead').innerHTML='<tr><th style="width:40px"></th><th>帳戶名稱</th><th>機構</th><th>幣別</th><th>餘額</th><th>說明</th><th></th></tr>';document.getElementById('assetStats').innerHTML=`<div class="stat-card"><div class="label">${titles[currentAssetTab]}合計 (TWD)</div><div class="value ${currentAssetTab==='credit'||currentAssetTab==='payable'?'c-red':currentAssetTab==='receivable'?'c-orange':'c-blue'}">${fmt(tTWD,'TWD')}</div><div class="sub">${list.length} 個帳戶</div></div>`;const tb=document.getElementById('assetTable');tb.innerHTML=list.length?list.map(a=>`<tr draggable="true" data-id="${a.id}"><td><span class="drag-handle">⠿</span></td><td style="font-weight:600">${a.name}</td><td>${a.institution||'-'}</td><td>${a.currency}</td><td style="font-weight:600" class="${a.balance>=0?'c-green':'c-red'}">${fmt(a.balance,a.currency)}</td><td style="color:var(--text3)">${a.note||'-'}</td><td><span class="edit-btn" onclick="editAccount('${a.id}')">✏️</span><span class="del-btn" onclick="deleteAccount('${a.id}')">✕</span></td></tr>`).join(''):'<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">尚無帳戶</td></tr>';initAssetDrag();}

// ============ DRAG & DROP FOR ASSETS ============
let dragSrcRow=null;
function initAssetDrag(){
  const rows=document.querySelectorAll('#assetTable tr[draggable]');
  rows.forEach(row=>{
    row.addEventListener('dragstart',function(e){dragSrcRow=this;this.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',this.dataset.id);});
    row.addEventListener('dragend',function(){this.classList.remove('dragging');document.querySelectorAll('#assetTable tr').forEach(r=>r.classList.remove('drag-over'));});
    row.addEventListener('dragover',function(e){e.preventDefault();e.dataTransfer.dropEffect='move';if(this!==dragSrcRow&&this.dataset.id){this.classList.add('drag-over');}});
    row.addEventListener('dragleave',function(){this.classList.remove('drag-over');});
    row.addEventListener('drop',function(e){e.preventDefault();this.classList.remove('drag-over');if(dragSrcRow===this)return;const fromId=dragSrcRow.dataset.id,toId=this.dataset.id;if(!fromId||!toId)return;const d=U(),accts=d.accounts;const fromIdx=accts.findIndex(a=>a.id===fromId),toIdx=accts.findIndex(a=>a.id===toId);if(fromIdx<0||toIdx<0)return;const item=accts.splice(fromIdx,1)[0];accts.splice(toIdx,0,item);save();renderAssets();});
  });
}

// ============ ANALYSIS ============
function renderAnalysis(){const d=U(),range=document.getElementById('anaRange').value,month=document.getElementById('anaMonth').value,year=document.getElementById('anaYear').value,cur=document.getElementById('anaCurrency').value;const inc=filterByRange(d.incomes,range,month,year),exp=filterByRange(d.expenses,range,month,year);const tI=sumConverted(inc,'amount',cur),tE=sumConverted(exp,'amount',cur);const sr=tI>0?((tI-tE)/tI*100):0;document.getElementById('anaStats').innerHTML=`<div class="stat-card"><div class="label">收入</div><div class="value c-green">${fmt(tI,cur)}</div></div><div class="stat-card"><div class="label">支出</div><div class="value c-red">${fmt(tE,cur)}</div></div><div class="stat-card"><div class="label">淨收支</div><div class="value ${tI-tE>=0?'c-green':'c-red'}">${fmt(tI-tE,cur)}</div></div><div class="stat-card"><div class="label">儲蓄率</div><div class="value c-primary">${sr.toFixed(1)}%</div></div>`;drawPie('expPieChart','expPieLegend',groupByCategory(exp,cur));drawPie('incPieChart','incPieLegend',groupByCategory(inc,cur));drawBarChart('expBarChart',groupByCategory(exp,cur),cur);drawMonthlyChart(cur);}

// ============ ASSET ANALYSIS ============
function renderAssetAnalysis(){
  const d=U(),cur=document.getElementById('aasCurrency').value,range=document.getElementById('aasRange').value;
  const now=new Date(),thisMonth=now.toISOString().slice(0,7),thisYear=now.getFullYear().toString();
  // Filter income/expense by range for flow analysis
  let incF=d.incomes,expF=d.expenses;
  if(range==='year'){incF=incF.filter(i=>getYear(i.date)===thisYear);expF=expF.filter(e=>getYear(e.date)===thisYear);}
  else if(range==='month'){incF=incF.filter(i=>getMonth(i.date)===thisMonth);expF=expF.filter(e=>getMonth(e.date)===thisMonth);}
  const periodInc=sumConverted(incF,'amount',cur),periodExp=sumConverted(expF,'amount',cur);
  const tA=d.accounts.filter(a=>a.type!=='payable').reduce((s,a)=>s+convert(a.balance,a.currency,cur),0);
  const netExcl=d.accounts.filter(a=>a.type!=='credit'&&a.type!=='payable').reduce((s,a)=>s+convert(a.balance,a.currency,cur),0);
  const tDebt=d.accounts.filter(a=>a.type==='credit').reduce((s,a)=>s+convert(Math.abs(a.balance),a.currency,cur),0);
  const tRec=d.accounts.filter(a=>a.type==='receivable').reduce((s,a)=>s+convert(a.balance,a.currency,cur),0);
  const tPay=d.accounts.filter(a=>a.type==='payable').reduce((s,a)=>s+convert(Math.abs(a.balance),a.currency,cur),0);
  const rangeLabel=range==='year'?'本年度':range==='month'?'本月':'全部';
  const netAsset=tA-tRec-tPay;
  document.getElementById('aasStats').innerHTML=`
    <div class="stat-card"><div class="label">總資產</div><div class="value c-blue">${fmt(tA,cur)}</div><div class="sub">${d.accounts.length} 個帳戶</div></div>
    <div class="stat-card"><div class="label">淨資產</div><div class="value c-primary">${fmt(netAsset,cur)}</div><div class="sub">扣除未收款與應付款</div></div>
    <div class="stat-card"><div class="label">${rangeLabel}收入</div><div class="value c-green">${fmt(periodInc,cur)}</div></div>
    <div class="stat-card"><div class="label">${rangeLabel}支出</div><div class="value c-red">${fmt(periodExp,cur)}</div></div>
    <div class="stat-card"><div class="label">信用卡負債</div><div class="value c-red">${fmt(tDebt,cur)}</div></div>
    <div class="stat-card"><div class="label">未收款</div><div class="value c-orange">${fmt(tRec,cur)}</div></div>
    <div class="stat-card"><div class="label">應付款</div><div class="value c-red">${fmt(tPay,cur)}</div></div>`;
  const typeMap={};d.accounts.forEach(a=>{const l=ACCOUNT_TYPES[a.type]||a.type;typeMap[l]=(typeMap[l]||0)+convert(Math.abs(a.balance),a.currency,cur);});drawPie('aasTypePie','aasTypeLegend',Object.entries(typeMap).sort((a,b)=>b[1]-a[1]));
  const curMap={};d.accounts.forEach(a=>{const l=a.currency+' '+CURRENCIES[a.currency];curMap[l]=(curMap[l]||0)+convert(Math.abs(a.balance),a.currency,cur);});drawPie('aasCurPie','aasCurLegend',Object.entries(curMap).sort((a,b)=>b[1]-a[1]));
  drawBarChart('aasAcctBar',d.accounts.map(a=>([a.name+' ('+a.currency+')',convert(a.balance,a.currency,cur)])).sort((a,b)=>b[1]-a[1]),cur);
  const recs=d.accounts.filter(a=>a.type==='receivable');const recT=recs.reduce((s,a)=>s+convert(a.balance,a.currency,cur),0);
  document.getElementById('aasReceivableStats').innerHTML=`<div class="stat-card"><div class="label">未收款總計 (${cur})</div><div class="value c-orange">${fmt(recT,cur)}</div><div class="sub">${recs.length} 筆</div></div>`;
  document.getElementById('aasReceivableTable').innerHTML=recs.length?recs.map(a=>`<tr><td style="font-weight:600">${a.name}</td><td>${a.institution||'-'}</td><td>${a.currency}</td><td class="c-orange" style="font-weight:600">${fmt(a.balance,a.currency)}</td><td style="color:var(--text3)">${a.note||'-'}</td></tr>`).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:30px">無未收款記錄</td></tr>';
}

// ============ INVEST PAGE ============
function renderInvest(){loadNews();loadStocks();loadIndices();}

async function loadNews(){
  const el=document.getElementById('newsContainer');
  try{
    const r=await fetch('https://newsdata.io/api/1/latest?apikey=pub_64aboreal&category=business&language=zh&country=tw');
    const d=await r.json();
    if(d.results&&d.results.length){
      el.innerHTML=d.results.slice(0,8).map(n=>`<div class="news-card"><div class="news-title">${n.title||'無標題'}</div><div class="news-meta">${(n.description||'').slice(0,100)}${(n.description||'').length>100?'...':''}</div><div class="news-src">${n.source_id||''} · ${n.pubDate?n.pubDate.slice(0,10):''}</div></div>`).join('');
      return;
    }
  }catch(e){}
  // Fallback: show curated info
  const today=new Date().toLocaleDateString('zh-TW',{year:'numeric',month:'long',day:'numeric'});
  el.innerHTML=`
    <div class="news-card"><div class="news-title">全球經濟動態</div><div class="news-meta">${today} — 請關注美聯儲利率決策、歐洲央行政策動向、中國經濟數據及地緣政治風險。建議查看 Bloomberg、Reuters 等專業財經網站獲取最新資訊。</div></div>
    <div class="news-card"><div class="news-title">台灣市場焦點</div><div class="news-meta">台股動態受半導體產業、AI 趨勢及外資動向影響。建議關注台積電法說會、外資買賣超、央行政策及台幣匯率走勢。</div></div>
    <div class="news-card"><div class="news-title">投資提醒</div><div class="news-meta">以上為一般性資訊，不構成投資建議。投資有風險，請依個人狀況審慎評估。</div></div>`;
}

async function loadStocks(){
  const d=U(),el=document.getElementById('stockContainer');
  if(!d.watchStocks||!d.watchStocks.length){el.innerHTML='<p style="color:var(--text3)">尚未追蹤任何股票，請輸入股票代號添加</p>';return;}
  el.innerHTML='<p style="color:var(--text3)">載入股價中...</p>';
  let loaded=false;
  // Method 1: TWSE MIS API
  try{
    const r=await fetch(`https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${d.watchStocks.map(c=>'tse_'+c+'.tw').join('|')}&json=1&_=${Date.now()}`);
    const data=await r.json();
    if(data.msgArray&&data.msgArray.length){
      el.innerHTML=data.msgArray.map(s=>{
        const price=parseFloat(s.z)||parseFloat(s.y)||0;
        const yesterday=parseFloat(s.y)||0;
        const change=price-yesterday;
        const pct=yesterday?((change/yesterday)*100):0;
        const up=change>=0;
        return `<div class="stock-card">
          <div><div class="stock-name">${s.n||s.c}</div><div class="stock-code">${s.c}.TW</div></div>
          <div style="text-align:right"><div class="stock-price">${price?price.toFixed(2):'--'}</div>
          <div class="stock-change ${up?'c-green':'c-red'}">${up?'+':''}${change.toFixed(2)} (${up?'+':''}${pct.toFixed(2)}%)</div></div>
          <span class="del-btn" onclick="removeStock('${s.c}')" style="margin-left:12px" title="移除追蹤">✕</span>
        </div>`;
      }).join('');loaded=true;return;
    }
  }catch(e){}
  // Method 2: Try OTC for stocks not found on TSE
  if(!loaded){try{
    const r=await fetch(`https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${d.watchStocks.map(c=>'otc_'+c+'.tw').join('|')}&json=1&_=${Date.now()}`);
    const data=await r.json();
    if(data.msgArray&&data.msgArray.length){
      el.innerHTML=data.msgArray.map(s=>{
        const price=parseFloat(s.z)||parseFloat(s.y)||0;
        const yesterday=parseFloat(s.y)||0;
        const change=price-yesterday;
        const pct=yesterday?((change/yesterday)*100):0;
        const up=change>=0;
        return `<div class="stock-card">
          <div><div class="stock-name">${s.n||s.c}</div><div class="stock-code">${s.c}.TW</div></div>
          <div style="text-align:right"><div class="stock-price">${price?price.toFixed(2):'--'}</div>
          <div class="stock-change ${up?'c-green':'c-red'}">${up?'+':''}${change.toFixed(2)} (${up?'+':''}${pct.toFixed(2)}%)</div></div>
          <span class="del-btn" onclick="removeStock('${s.c}')" style="margin-left:12px" title="移除追蹤">✕</span>
        </div>`;
      }).join('');loaded=true;return;
    }
  }catch(e){}}
  // Fallback: show stocks with manual refresh hint
  el.innerHTML=`<div style="background:rgba(245,158,11,.1);border:1px solid var(--orange);border-radius:12px;padding:16px;margin-bottom:16px;font-size:13px;color:var(--orange)">
    <strong>提示：</strong>台股即時報價 API (TWSE) 在某些環境下可能因 CORS 限制無法載入。<br>
    建議方式：<br>• 將此頁面部署到網站伺服器上（非直接開啟 HTML 檔案）<br>• 或使用簡易伺服器：在終端輸入 <code style="background:var(--card);padding:2px 6px;border-radius:4px">npx serve .</code> 或 <code style="background:var(--card);padding:2px 6px;border-radius:4px">python -m http.server</code><br>• 透過 http://localhost 存取即可正常取得股價
  </div>`+d.watchStocks.map(c=>`<div class="stock-card"><div><div class="stock-name">${c}</div><div class="stock-code">${c}.TW</div></div><div style="text-align:right"><div class="stock-price" style="color:var(--text3)">無法載入</div><div style="font-size:11px;color:var(--text3)">CORS 限制</div></div><span class="del-btn" onclick="removeStock('${c}')" style="margin-left:12px">✕</span></div>`).join('');
}

async function loadIndices(){
  const el=document.getElementById('indexContainer');
  const indices=[{name:'台灣加權指數',code:'TAIEX'},{name:'道瓊工業',code:'DJI'},{name:'S&P 500',code:'SPX'},{name:'那斯達克',code:'NASDAQ'},{name:'日經225',code:'N225'},{name:'上證指數',code:'SSE'}];
  el.innerHTML=indices.map(idx=>`<div class="stock-card"><div><div class="stock-name">${idx.name}</div><div class="stock-code">${idx.code}</div></div><div style="text-align:right;color:var(--text3)">請參考專業財經平台</div></div>`).join('');
}

function addWatchStock(){
  const input=document.getElementById('addStockInput');
  const code=input.value.trim();
  if(!code){alert('請輸入股票代號');return;}
  const d=U();
  if(d.watchStocks.includes(code)){alert('已追蹤此股票');return;}
  d.watchStocks.push(code);
  save();input.value='';loadStocks();
}
function removeStock(code){const d=U();d.watchStocks=d.watchStocks.filter(c=>c!==code);save();loadStocks();}

// ============ CHART HELPERS ============
function groupByCategory(list,cur){const map={};list.forEach(item=>{map[item.category]=(map[item.category]||0)+convert(item.amount,item.currency,cur);});return Object.entries(map).sort((a,b)=>b[1]-a[1]);}
function drawPie(cid,lid,data){const cv=document.getElementById(cid),lg=document.getElementById(lid);if(!cv||!lg)return;const ctx=cv.getContext('2d');ctx.clearRect(0,0,180,180);const total=data.reduce((s,d)=>s+d[1],0);if(!total){ctx.fillStyle='#555';ctx.beginPath();ctx.arc(90,90,70,0,Math.PI*2);ctx.fill();lg.innerHTML='<div style="color:var(--text3)">無資料</div>';return;}let angle=-Math.PI/2;data.forEach((d,i)=>{const sl=(d[1]/total)*Math.PI*2;ctx.beginPath();ctx.moveTo(90,90);ctx.arc(90,90,70,angle,angle+sl);ctx.closePath();ctx.fillStyle=PIE_COLORS[i%PIE_COLORS.length];ctx.fill();angle+=sl;});const hc=getComputedStyle(document.documentElement).getPropertyValue('--donut-hole').trim();ctx.beginPath();ctx.arc(90,90,40,0,Math.PI*2);ctx.fillStyle=hc;ctx.fill();lg.innerHTML=data.slice(0,8).map((d,i)=>`<div class="pie-legend-item"><div class="pie-legend-dot" style="background:${PIE_COLORS[i%PIE_COLORS.length]}"></div><span><span class="cat-icon">${getIcon(d[0])}</span>${d[0]}</span><span style="color:var(--text3);margin-left:auto">${(d[1]/total*100).toFixed(1)}%</span></div>`).join('');}
function drawBarChart(eid,data,cur){const el=document.getElementById(eid);if(!el)return;const mx=data.length?Math.max(...data.map(d=>Math.abs(d[1]))):0;el.innerHTML=data.length?data.map((d,i)=>`<div class="chart-bar-group"><div class="chart-bar-label"><span><span class="cat-icon">${getIcon(d[0])}</span>${d[0]}</span><span>${fmt(d[1],cur)}</span></div><div class="chart-bar"><div class="chart-bar-fill" style="width:${mx?Math.abs(d[1])/mx*100:0}%;background:${PIE_COLORS[i%PIE_COLORS.length]}"></div></div></div>`).join(''):'<div style="text-align:center;color:var(--text3);padding:20px">無資料</div>';}
function drawMonthlyChart(cur){const cv=document.getElementById('monthlyChart');if(!cv)return;const ctx=cv.getContext('2d');cv.width=cv.parentElement.clientWidth-40;const w=cv.width,h=cv.height;ctx.clearRect(0,0,w,h);const d=U(),months=[],now=new Date();for(let i=5;i>=0;i--){months.push(new Date(now.getFullYear(),now.getMonth()-i,1).toISOString().slice(0,7));}const iD=months.map(m=>sumConverted(filterByMonth(d.incomes,m),'amount',cur)),eD=months.map(m=>sumConverted(filterByMonth(d.expenses,m),'amount',cur));const mx=Math.max(...iD,...eD,1),p=50,gw=w-p*2,gh=h-p-20,bw=gw/months.length/3;const gc=getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim(),tc2=getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim();ctx.strokeStyle=gc;ctx.lineWidth=1;for(let i=0;i<=4;i++){const y=20+gh*(1-i/4);ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-20,y);ctx.stroke();ctx.fillStyle=tc2;ctx.font='11px sans-serif';ctx.textAlign='right';ctx.fillText(Math.round(mx*i/4).toLocaleString(),p-8,y+4);}months.forEach((m,i)=>{const cx=p+(i+.5)*(gw/months.length);ctx.fillStyle='#22c55e';ctx.fillRect(cx-bw-2,20+gh-(iD[i]/mx)*gh,bw,(iD[i]/mx)*gh);ctx.fillStyle='#ef4444';ctx.fillRect(cx+2,20+gh-(eD[i]/mx)*gh,bw,(eD[i]/mx)*gh);ctx.fillStyle=tc2;ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(m.slice(5),cx,h-4);});}

// ============ CURRENCY ============
function doConvert(){const amt=parseFloat(document.getElementById('convFrom').value)||0,from=document.getElementById('convFromCur').value,to=document.getElementById('convToCur').value,result=convert(amt,from,to);document.getElementById('convTo').value=result.toFixed(to==='JPY'?0:2);document.getElementById('convResult').textContent=`${fmt(amt,from)} = ${fmt(result,to)}`;}

// ============ MODALS ============
function openModal(type,editId){
  const m=document.getElementById('modalContent'),d=U();
  const acctOpts=d.accounts.map(a=>`<option value="${a.id}">${a.name} (${a.currency})</option>`).join('');
  const curOpts=Object.entries(CURRENCIES).map(([c,n])=>`<option value="${c}">${c} ${n}</option>`).join('');
  if(type==='income'){
    const editing=editId?d.incomes.find(i=>i.id===editId):null;
    const cats=d.incomeCategories.map(c=>`<option value="${c}"${editing&&editing.category===c?' selected':''}>${getIcon(c)} ${c}</option>`).join('');
    m.innerHTML=`<h3>${editing?'編輯':'新增'}收入</h3>
    <div class="form-group"><label>日期</label><input type="date" id="f_date" value="${editing?editing.date:new Date().toISOString().slice(0,10)}"></div>
    <div class="form-row"><div class="form-group"><label>類別</label><select id="f_cat">${cats}</select></div><div class="form-group"><label>帳戶</label><select id="f_acct">${d.accounts.map(a=>`<option value="${a.id}"${editing&&editing.accountId===a.id?' selected':''}>${a.name}</option>`).join('')}</select></div></div>
    <div class="form-row"><div class="form-group"><label>金額</label><input type="number" id="f_amt" step="0.01" value="${editing?editing.amount:''}"></div><div class="form-group"><label>幣別</label><select id="f_cur">${Object.entries(CURRENCIES).map(([c,n])=>`<option value="${c}"${editing&&editing.currency===c?' selected':''}>${c} ${n}</option>`).join('')}</select></div></div>
    <div class="form-group"><label>備註</label><input type="text" id="f_note" value="${editing?editing.note||'':''}"></div>
    <input type="hidden" id="f_editId" value="${editId||''}">
    <div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveIncome()">儲存</button></div>`;
  } else if(type==='expense'){
    const editing=editId?d.expenses.find(e=>e.id===editId):null;
    const cats=d.expenseCategories.map(c=>`<option value="${c}"${editing&&editing.category===c?' selected':''}>${getIcon(c)} ${c}</option>`).join('');
    m.innerHTML=`<h3>${editing?'編輯':'新增'}支出</h3>
    <div class="form-group"><label>日期</label><input type="date" id="f_date" value="${editing?editing.date:new Date().toISOString().slice(0,10)}"></div>
    <div class="form-row"><div class="form-group"><label>類別</label><select id="f_cat">${cats}</select></div><div class="form-group"><label>支付方式</label><select id="f_pay"><option value="信用卡"${editing&&editing.payMethod==='信用卡'?' selected':''}>信用卡</option><option value="現金"${editing&&editing.payMethod==='現金'?' selected':''}>現金</option><option value="銀行轉帳"${editing&&editing.payMethod==='銀行轉帳'?' selected':''}>銀行轉帳</option><option value="電子支付"${editing&&editing.payMethod==='電子支付'?' selected':''}>電子支付</option></select></div></div>
    <div class="form-row"><div class="form-group"><label>金額</label><input type="number" id="f_amt" step="0.01" value="${editing?editing.amount:''}"></div><div class="form-group"><label>幣別</label><select id="f_cur">${Object.entries(CURRENCIES).map(([c,n])=>`<option value="${c}"${editing&&editing.currency===c?' selected':''}>${c} ${n}</option>`).join('')}</select></div></div>
    <div class="form-group"><label>帳戶</label><select id="f_acct">${d.accounts.map(a=>`<option value="${a.id}"${editing&&editing.accountId===a.id?' selected':''}>${a.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>備註</label><input type="text" id="f_note" value="${editing?editing.note||'':''}"></div>
    <input type="hidden" id="f_editId" value="${editId||''}">
    <div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveExpense()">儲存</button></div>`;
  } else if(type==='account'){
    const editing=editId?d.accounts.find(a=>a.id===editId):null;
    m.innerHTML=`<h3>${editing?'編輯':'新增'}帳戶</h3>
    <div class="form-group"><label>帳戶名稱</label><input type="text" id="f_name" value="${editing?editing.name:''}"></div>
    <div class="form-row"><div class="form-group"><label>類型</label><select id="f_type">${Object.entries(ACCOUNT_TYPES).map(([k,v])=>`<option value="${k}"${editing&&editing.type===k?' selected':''}>${v}</option>`).join('')}</select></div><div class="form-group"><label>機構</label><input type="text" id="f_inst" value="${editing?editing.institution||'':''}"></div></div>
    <div class="form-row"><div class="form-group"><label>幣別</label><select id="f_cur">${Object.entries(CURRENCIES).map(([c,n])=>`<option value="${c}"${editing&&editing.currency===c?' selected':''}>${c} ${n}</option>`).join('')}</select></div><div class="form-group"><label>餘額</label><input type="number" id="f_bal" step="0.01" value="${editing?editing.balance:0}"></div></div>
    <div class="form-group"><label>備註</label><input type="text" id="f_note" value="${editing?editing.note||'':''}"></div>
    <input type="hidden" id="f_editId" value="${editId||''}">
    <div class="modal-actions"><button class="btn btn-s" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="saveAccount()">儲存</button></div>`;
    if(!editing)document.getElementById('f_type').value=currentAssetTab;
  }
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal(){document.getElementById('modalOverlay').classList.remove('show');}

function editRecord(type,id){openModal(type,id);}

function saveIncome(){
  const amt=parseFloat(document.getElementById('f_amt').value);if(!amt||amt<=0){alert('請輸入有效金額');return;}
  const d=U(),editId=document.getElementById('f_editId').value;
  const newData={date:document.getElementById('f_date').value,category:document.getElementById('f_cat').value,accountId:document.getElementById('f_acct').value,amount:amt,currency:document.getElementById('f_cur').value,note:document.getElementById('f_note').value};
  if(editId){
    const old=d.incomes.find(i=>i.id===editId);
    if(old){const oa=d.accounts.find(a=>a.id===old.accountId);if(oa)oa.balance-=convert(old.amount,old.currency,oa.currency);Object.assign(old,newData);const na=d.accounts.find(a=>a.id===newData.accountId);if(na)na.balance+=convert(amt,newData.currency,na.currency);}
  } else {
    d.incomes.push({id:genId(),...newData});const ac=d.accounts.find(a=>a.id===newData.accountId);if(ac)ac.balance+=convert(amt,newData.currency,ac.currency);
  }
  save();closeModal();renderIncome();
}
function saveExpense(){
  const amt=parseFloat(document.getElementById('f_amt').value);if(!amt||amt<=0){alert('請輸入有效金額');return;}
  const d=U(),editId=document.getElementById('f_editId').value;
  const newData={date:document.getElementById('f_date').value,category:document.getElementById('f_cat').value,payMethod:document.getElementById('f_pay').value,accountId:document.getElementById('f_acct').value,amount:amt,currency:document.getElementById('f_cur').value,note:document.getElementById('f_note').value};
  if(editId){
    const old=d.expenses.find(e=>e.id===editId);
    if(old){const oa=d.accounts.find(a=>a.id===old.accountId);if(oa)oa.balance+=convert(old.amount,old.currency,oa.currency);Object.assign(old,newData);const na=d.accounts.find(a=>a.id===newData.accountId);if(na)na.balance-=convert(amt,newData.currency,na.currency);}
  } else {
    d.expenses.push({id:genId(),...newData});const ac=d.accounts.find(a=>a.id===newData.accountId);if(ac)ac.balance-=convert(amt,newData.currency,ac.currency);
  }
  save();closeModal();renderExpense();
}
function saveAccount(){const d=U(),editId=document.getElementById('f_editId').value;const data={name:document.getElementById('f_name').value,type:document.getElementById('f_type').value,institution:document.getElementById('f_inst').value,currency:document.getElementById('f_cur').value,balance:parseFloat(document.getElementById('f_bal').value)||0,note:document.getElementById('f_note').value};if(!data.name){alert('請輸入帳戶名稱');return;}if(editId){const ac=d.accounts.find(a=>a.id===editId);if(ac)Object.assign(ac,data);}else{d.accounts.push({id:genId(),...data,createdAt:new Date().toISOString()});}save();closeModal();renderAssets();}
function editAccount(id){openModal('account',id);}
function deleteAccount(id){if(!confirm('確定刪除？'))return;const d=U();d.accounts=d.accounts.filter(a=>a.id!==id);save();renderAssets();}
function deleteRecord(col,id){if(!confirm('確定刪除？'))return;const d=U();d[col]=d[col].filter(r=>r.id!==id);save();if(col==='incomes')renderIncome();else renderExpense();}

// ============ SETTINGS ============
function loadCategories(){const d=U();document.getElementById('incCats').value=d.incomeCategories.join('\n');document.getElementById('expCats').value=d.expenseCategories.join('\n');}
function saveCategories(){const d=U();d.incomeCategories=document.getElementById('incCats').value.split('\n').map(s=>s.trim()).filter(Boolean);d.expenseCategories=document.getElementById('expCats').value.split('\n').map(s=>s.trim()).filter(Boolean);save();alert('類別已更新');}
async function changePwd(){
  const np=document.getElementById('newPwd2').value;
  if(!np||np.length<6){alert('新密碼至少 6 位');return;}
  try{
    const {error}=await _sb.auth.updateUser({password:np});
    if(error)throw error;
    alert('密碼已更新');document.getElementById('newPwd2').value='';
  }catch(e){alert('更新失敗: '+e.message);}
}
function exportData(){const b=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`FlowRich_${currentUser}_${new Date().toISOString().slice(0,10)}.json`;a.click();}
function importData(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=function(ev){try{const data=JSON.parse(ev.target.result);if(data.incomeCategories&&data.accounts){DB=data;}else if(data.users&&data.users[Object.keys(data.users)[0]]){const firstUser=Object.keys(data.users)[0];DB=data.users[firstUser].data;}else{alert('檔案格式不正確');return;}save();alert('匯入成功！');location.reload();}catch(err){alert('解析失敗: '+err.message);}};r.readAsText(f);e.target.value='';}
async function resetAll(){if(!confirm('確定要清除所有資料嗎？此操作無法復原！'))return;DB=defaultUserData();save();await cloudSave();location.reload();}

function filterByMonth(list,month){return month==='all'?[...list]:list.filter(item=>getMonth(item.date)===month);}
function sumConverted(list,field,toCur){return list.reduce((s,item)=>s+convert(item[field],item.currency,toCur),0);}

document.getElementById('loginPwd').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
document.getElementById('loginUser').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginPwd').focus()});
document.getElementById('confirmPwd').addEventListener('keydown',e=>{if(e.key==='Enter')doSetup()});

// Auto-restore session on page load
(async function(){
  const {data:{session}}=await _sb.auth.getSession();
  if(session&&session.user){
    currentUserId=session.user.id;currentUser=session.user.email;
    const loaded=await cloudLoad();
    if(!loaded){loadLocal()||initNewUser();}
    enterApp();
  }
})();
