'use strict';

// ─── iOS Standalone Safe-Area Fix ─────────────────────────────────────────────
// When viewport-fit=cover doesn't work, env(safe-area-inset-bottom) returns 0.
// Try extending body 34px below viewport so the home indicator area is covered.
(function () {
  if (!window.navigator.standalone) return;
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);width:1px;pointer-events:none;opacity:0;';
  document.documentElement.appendChild(probe);
  requestAnimationFrame(function () {
    var sab = probe.getBoundingClientRect().height;
    document.documentElement.removeChild(probe);
    if (sab >= 5) return; // env() working, CSS already handles it
    if (screen.height <= 700) return; // old iPhone with home button, no gap
    document.body.style.bottom = '-34px';
  });
})();

// ─── State ────────────────────────────────────────────────────────────────────

let tasks      = [];
let entries    = [];
let fitEntries = [];
let taskFilter = '全部';
let taskStatus = '未完成';
let acctType   = 'expense';
let fitLoaded    = false;
let notesLoaded  = false;
let notesPage    = 1;
let notesTotal   = 1;
let notesData    = { 1: '' };
let notesTimer   = null;
const NOTES_LIMIT = 500;

let acctViewMode = 'month';
let acctViewDate = new Date();
let fitViewMode  = 'month';
let fitViewDate  = new Date();

const EXPENSE_CATS = ['餐飲', '交通', '娛樂', '購物', '日常', '醫療', '其他'];
const INCOME_CATS  = ['薪資', '獎金', '其他'];

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  document.getElementById('headerDate').textContent =
    `${now.getMonth() + 1}/${now.getDate()} 週${days[now.getDay()]}`;

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const today = `${y}-${m}-${d}`;
  document.getElementById('acctDate').value = today;
  document.getElementById('fitDate').value  = today;

  updateAcctCats();
  updateAcctNav();
  updateFitNav();
  updateCalNav();

  document.getElementById('taskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });
  document.getElementById('acctNote').addEventListener('keydown', e => {
    if (e.key === 'Enter') addEntry();
  });

  loadAll();
});

async function loadAll() {
  await Promise.all([loadTasks(), loadAccounting()]);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function localToday() { return localDateStr(new Date()); }
function localYesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1); return localDateStr(d);
}

// ─── Nav helpers ──────────────────────────────────────────────────────────────

function getDateRange(date, mode) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const pad = n => String(n).padStart(2, '0');
  if (mode === 'day') {
    const s = `${y}-${pad(m + 1)}-${pad(d)}`;
    return [s, s];
  }
  if (mode === 'month') {
    const s = `${y}-${pad(m + 1)}-01`;
    const e = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
    return [s, e];
  }
  return [`${y}-01-01`, `${y}-12-31`];
}

function navLabel(date, mode) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (mode === 'day')   return `${y}/${m}/${d}`;
  if (mode === 'month') return `${y}/${m}`;
  return `${y}`;
}

function shiftDate(date, mode, dir) {
  const d = new Date(date);
  if (mode === 'day')   d.setDate(d.getDate() + dir);
  if (mode === 'month') d.setMonth(d.getMonth() + dir);
  if (mode === 'year')  d.setFullYear(d.getFullYear() + dir);
  return d;
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function switchTab(name, btn) {
  document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panelTasks').classList.toggle('active', name === 'tasks');
  document.getElementById('panelAccounting').classList.toggle('active', name === 'accounting');
  document.getElementById('panelFitness').classList.toggle('active', name === 'fitness');
  document.getElementById('panelNotes').classList.toggle('active', name === 'notes');
  if (name === 'fitness' && !fitLoaded) loadFitness();
  if (name === 'notes'   && !notesLoaded) loadNotes();
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

async function loadTasks() {
  try {
    tasks = await api('/api/tasks');
    renderTasks();
  } catch (e) {
    document.getElementById('taskList').innerHTML =
      `<div class="empty-hint err">載入失敗: ${e.message}</div>`;
  }
}

function filterStatus(status, btn) {
  document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  taskStatus = status;
  renderTasks();
}

function filterTasks(btn) {
  document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  taskFilter = btn.dataset.cat;
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('taskList');
  let filtered = taskFilter === '全部' ? tasks : tasks.filter(t => t.category === taskFilter);
  if (taskStatus === '未完成') filtered = filtered.filter(t => !t.completed);
  if (taskStatus === '已完成') filtered = filtered.filter(t => t.completed);
  const sorted = [...filtered];

  if (!sorted.length) {
    list.innerHTML = '<div class="empty-hint">沒有待辦事項</div>';
    return;
  }

  list.innerHTML = sorted.map(t => `
    <div class="task-card${t.completed ? ' done' : ''}">
      <button class="check-btn${t.completed ? ' checked' : ''}" onclick="toggleTask('${t.id}')">
        ${t.completed ? '✓' : ''}
      </button>
      <span class="task-txt" onclick="this.closest('.task-card').classList.toggle('expanded')">${esc(t.text)}</span>
      <span class="cat-badge ${catCls(t.category)}">${esc(t.category)}</span>
      <button class="del-btn" onclick="deleteTask('${t.id}')">✕</button>
    </div>
  `).join('');
}

function catCls(cat) {
  return { '工作任務': 'work', '學習計畫': 'study', '生活作息': 'life', '個人待辦': 'personal' }[cat] || 'personal';
}

async function addTask() {
  const inp = document.getElementById('taskInput');
  const text = inp.value.trim();
  if (!text) return;
  const category = document.getElementById('taskCat').value;
  const tempId = 'tmp_' + Date.now();
  tasks = [{ id: tempId, text, category, completed: false }, ...tasks];
  inp.value = '';
  renderTasks();
  try {
    tasks = await api('/api/tasks', 'POST', { text, category });
    renderTasks();
  } catch (e) {
    tasks = tasks.filter(t => t.id !== tempId);
    inp.value = text;
    renderTasks();
    alert('新增失敗: ' + e.message);
  }
}

async function toggleTask(id) {
  const prev = tasks.map(t => ({ ...t }));
  tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  renderTasks();
  try {
    tasks = await api(`/api/tasks?id=${id}`, 'PATCH');
    renderTasks();
  } catch (e) {
    tasks = prev;
    renderTasks();
    alert('操作失敗: ' + e.message);
  }
}

async function deleteTask(id) {
  const prev = tasks;
  tasks = tasks.filter(t => t.id !== id);
  renderTasks();
  try {
    tasks = await api(`/api/tasks?id=${id}`, 'DELETE');
    renderTasks();
  } catch (e) {
    tasks = prev;
    renderTasks();
    alert('刪除失敗: ' + e.message);
  }
}

// ─── Accounting ───────────────────────────────────────────────────────────────

async function loadAccounting() {
  try {
    entries = await api('/api/accounting');
    renderAccounting();
  } catch (e) {
    document.getElementById('acctList').innerHTML =
      `<div class="empty-hint err">載入失敗: ${e.message}</div>`;
  }
}

function setType(type) {
  acctType = type;
  document.getElementById('btnExp').classList.toggle('active', type === 'expense');
  document.getElementById('btnInc').classList.toggle('active', type === 'income');
  updateAcctCats();
}

function updateAcctCats() {
  const sel = document.getElementById('acctCat');
  const cats = acctType === 'expense' ? EXPENSE_CATS : INCOME_CATS;
  sel.innerHTML = cats.map(c => `<option>${c}</option>`).join('');
}

async function addEntry() {
  const amount = parseFloat(document.getElementById('acctAmt').value);
  const date   = document.getElementById('acctDate').value;
  if (!amount || amount <= 0 || !date) return;
  const category = document.getElementById('acctCat').value;
  const note     = document.getElementById('acctNote').value.trim();
  const tempId   = 'tmp_' + Date.now();
  entries = [{ id: tempId, type: acctType, amount, category, note, date }, ...entries];
  document.getElementById('acctAmt').value  = '';
  document.getElementById('acctNote').value = '';
  renderAccounting();
  try {
    entries = await api('/api/accounting', 'POST', { type: acctType, amount, category, note, date });
    renderAccounting();
  } catch (e) {
    entries = entries.filter(en => en.id !== tempId);
    renderAccounting();
    alert('新增失敗: ' + e.message);
  }
}

async function deleteEntry(id) {
  const prev = entries;
  entries = entries.filter(e => e.id !== id);
  renderAccounting();
  try {
    entries = await api(`/api/accounting?id=${id}`, 'DELETE');
    renderAccounting();
  } catch (e) {
    entries = prev;
    renderAccounting();
    alert('刪除失敗: ' + e.message);
  }
}

function renderAccounting() {
  const [start, end] = getDateRange(acctViewDate, acctViewMode);
  const period = entries.filter(e => e.date && e.date >= start && e.date <= end);

  const totalInc = period.filter(e => e.type === 'income').reduce((s, e)  => s + e.amount, 0);
  const totalExp = period.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const balance  = totalInc - totalExp;
  const fmt = n => Math.round(Math.abs(n)).toLocaleString('zh-TW');

  document.getElementById('sumIncome').textContent  = fmt(totalInc);
  document.getElementById('sumExpense').textContent = fmt(totalExp);
  const balEl = document.getElementById('sumBalance');
  balEl.textContent = (balance >= 0 ? '+' : '-') + fmt(balance);
  balEl.className = 'sum-val ' + (balance >= 0 ? 'pos' : 'neg');

  const list = document.getElementById('acctList');
  if (!period.length) {
    list.innerHTML = `<div class="empty-hint">${entries.length ? '此期間無記帳記錄' : '尚無記帳記錄'}</div>`;
    return;
  }

  const today = localToday();
  const yday  = localYesterday();

  const groups = {};
  for (const e of period) {
    if (e.date) (groups[e.date] = groups[e.date] || []).push(e);
  }

  let html = '';
  for (const date of Object.keys(groups).sort((a, b) => b.localeCompare(a))) {
    const lbl    = date === today ? '今天' : date === yday ? '昨天' : date.replace(/-/g, '/');
    const dayExp = groups[date].filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const dayInc = groups[date].filter(e => e.type === 'income').reduce((s, e)  => s + e.amount, 0);

    html += `<div class="date-group">
      <div class="date-hd">
        <span class="date-lbl">${lbl}</span>
        <span class="day-sum">
          ${dayExp > 0 ? `<span class="exp-txt">-${fmt(dayExp)}</span>` : ''}
          ${dayInc > 0 ? `<span class="inc-txt">+${fmt(dayInc)}</span>` : ''}
        </span>
      </div>`;

    for (const e of groups[date]) {
      html += `<div class="acct-card">
        <span class="type-badge ${e.type}">${esc(e.category)}</span>
        <span class="entry-note">${esc(e.note || e.category)}</span>
        <span class="entry-amt ${e.type}">${e.type === 'expense' ? '-' : '+'}${fmt(e.amount)}</span>
        <button class="del-btn" onclick="deleteEntry('${e.id}')">✕</button>
      </div>`;
    }
    html += '</div>';
  }
  list.innerHTML = html;
}

function setAcctMode(mode, btn) {
  acctViewMode = mode;
  document.querySelectorAll('#panelAccounting .nav-mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateAcctNav();
  renderAccounting();
}
function acctNav(dir) {
  acctViewDate = shiftDate(acctViewDate, acctViewMode, dir);
  updateAcctNav();
  renderAccounting();
}
function updateAcctNav() {
  document.getElementById('acctNavLbl').textContent = navLabel(acctViewDate, acctViewMode);
}

// ─── Fitness ──────────────────────────────────────────────────────────────────

async function loadFitness() {
  try {
    fitEntries = await api('/api/fitness');
    fitLoaded = true;
    renderFitness();
  } catch (e) {
    document.getElementById('fitList').innerHTML =
      `<div class="empty-hint err">載入失敗: ${e.message}</div>`;
  }
}

async function addFitEntry() {
  const exercise = document.getElementById('fitExercise').value.trim();
  const date     = document.getElementById('fitDate').value;
  if (!exercise || !date) return;
  const sets   = document.getElementById('fitSets').value    || null;
  const reps   = document.getElementById('fitReps').value    || null;
  const weight = document.getElementById('fitWeight').value  || null;
  const note   = document.getElementById('fitNote').value.trim();
  const tempId = 'tmp_' + Date.now();
  fitEntries = [{ id: tempId, date, exercise, sets, reps, weight, note }, ...fitEntries];
  document.getElementById('fitExercise').value = '';
  document.getElementById('fitSets').value     = '';
  document.getElementById('fitReps').value     = '';
  document.getElementById('fitWeight').value   = '';
  document.getElementById('fitNote').value     = '';
  renderFitness();
  try {
    fitEntries = await api('/api/fitness', 'POST', { date, exercise, sets, reps, weight, note });
    renderFitness();
  } catch (e) {
    fitEntries = fitEntries.filter(f => f.id !== tempId);
    renderFitness();
    alert('新增失敗: ' + e.message);
  }
}

async function deleteFitEntry(id) {
  const prev = fitEntries;
  fitEntries = fitEntries.filter(f => f.id !== id);
  renderFitness();
  try {
    fitEntries = await api(`/api/fitness?id=${id}`, 'DELETE');
    renderFitness();
  } catch (e) {
    fitEntries = prev;
    renderFitness();
    alert('刪除失敗: ' + e.message);
  }
}

function renderFitness() {
  const list = document.getElementById('fitList');
  const [start, end] = getDateRange(fitViewDate, fitViewMode);
  const period = fitEntries.filter(e => e.date && e.date >= start && e.date <= end);
  if (!period.length) {
    list.innerHTML = `<div class="empty-hint">${fitEntries.length ? '此期間無訓練記錄' : '尚無訓練記錄'}</div>`;
    return;
  }
  const today = localToday();
  const yday  = localYesterday();
  const groups = {};
  for (const e of period) {
    if (e.date) (groups[e.date] = groups[e.date] || []).push(e);
  }
  let html = '';
  for (const date of Object.keys(groups).sort((a, b) => b.localeCompare(a))) {
    const lbl = date === today ? '今天' : date === yday ? '昨天' : date.replace(/-/g, '/');
    html += `<div class="date-group"><div class="date-hd"><span class="date-lbl">${lbl}</span></div>`;
    for (const e of groups[date]) {
      const parts = [];
      if (e.sets)   parts.push(`${e.sets} 組`);
      if (e.reps)   parts.push(`${e.reps} 次`);
      if (e.weight) parts.push(`${e.weight} kg`);
      const detail = parts.join(' × ');
      html += `<div class="fit-card">
        <span class="fit-name">${esc(e.exercise)}</span>
        ${detail ? `<span class="fit-detail">${detail}</span>` : ''}
        ${e.note ? `<span class="fit-note">${esc(e.note)}</span>` : ''}
        <button class="del-btn" onclick="deleteFitEntry('${e.id}')">✕</button>
      </div>`;
    }
    html += '</div>';
  }
  list.innerHTML = html;
}

function setFitMode(mode, btn) {
  fitViewMode = mode;
  document.querySelectorAll('#panelFitness .nav-mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateFitNav();
  renderFitness();
}
function fitNav(dir) {
  fitViewDate = shiftDate(fitViewDate, fitViewMode, dir);
  updateFitNav();
  renderFitness();
}
function updateFitNav() {
  document.getElementById('fitNavLbl').textContent = navLabel(fitViewDate, fitViewMode);
}

// ─── Notes ───────────────────────────────────────────────────────────────────

async function loadNotes() {
  try {
    const pages = await api('/api/notes');
    notesData  = {};
    notesTotal = 0;
    for (const p of pages) {
      notesData[p.page] = p.content || '';
      if (p.page > notesTotal) notesTotal = p.page;
    }
    if (notesTotal === 0) { notesData[1] = ''; notesTotal = 1; }
    notesLoaded = true;
    notesPage = 1;
    renderNotesPage();
  } catch (e) {
    console.error('Notes load failed:', e.message);
  }
}

function renderNotesPage() {
  const content = notesData[notesPage] || '';
  document.getElementById('notesText').value = content;
  updateNotesCount(content.length);
  document.getElementById('notesPageNum').textContent   = notesPage;
  document.getElementById('notesPageTotal').textContent = notesTotal;
  document.getElementById('notesPrev').disabled = notesPage <= 1;
  document.getElementById('notesNext').classList.toggle('notes-full', content.length >= NOTES_LIMIT);
}

function updateNotesCount(len) {
  const el = document.getElementById('notesCharCount');
  el.textContent = len;
  el.parentElement.classList.toggle('notes-count-full', len >= NOTES_LIMIT);
}

function onNotesInput() {
  const text = document.getElementById('notesText').value;
  notesData[notesPage] = text;
  updateNotesCount(text.length);
  document.getElementById('notesNext').classList.toggle('notes-full', text.length >= NOTES_LIMIT);
  clearTimeout(notesTimer);
  notesTimer = setTimeout(saveNotesPage, 1500);
}

async function saveNotesPage() {
  try {
    await api('/api/notes', 'PUT', { page: notesPage, content: notesData[notesPage] || '' });
  } catch (e) {
    console.error('Notes save failed:', e.message);
  }
}

let notesNavBusy = false;
async function notesNav(dir) {
  if (notesNavBusy) return;
  notesNavBusy = true;
  clearTimeout(notesTimer);
  await saveNotesPage();
  const newPage = notesPage + dir;
  if (newPage < 1) return;
  if (newPage > notesTotal) {
    notesTotal++;
    notesData[notesTotal] = '';
    await api('/api/notes', 'PUT', { page: notesTotal, content: '' });
  }
  notesPage = newPage;
  renderNotesPage();
  document.getElementById('notesText').focus();
  notesNavBusy = false;
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}
