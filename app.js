'use strict';

let tasks = [];
let entries = [];
let taskFilter = '全部';
let acctType = 'expense';

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
  document.getElementById('acctDate').value = `${y}-${m}-${d}`;

  updateAcctCats();

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

// ─── API helper ───────────────────────────────────────────────────────────────

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function switchTab(name, btn) {
  document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panelTasks').classList.toggle('active', name === 'tasks');
  document.getElementById('panelAccounting').classList.toggle('active', name === 'accounting');
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

function filterTasks(btn) {
  document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  taskFilter = btn.dataset.cat;
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('taskList');
  const filtered = taskFilter === '全部' ? tasks : tasks.filter(t => t.category === taskFilter);
  const sorted = [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return 0;
  });

  if (!sorted.length) {
    list.innerHTML = '<div class="empty-hint">沒有待辦事項</div>';
    return;
  }

  list.innerHTML = sorted.map(t => `
    <div class="task-card${t.completed ? ' done' : ''}">
      <button class="check-btn${t.completed ? ' checked' : ''}" onclick="toggleTask('${t.id}')">
        ${t.completed ? '✓' : ''}
      </button>
      <span class="task-txt">${esc(t.text)}</span>
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
  try {
    tasks = await api('/api/tasks', 'POST', {
      text,
      category: document.getElementById('taskCat').value,
    });
    inp.value = '';
    renderTasks();
  } catch (e) { alert('新增失敗: ' + e.message); }
}

async function toggleTask(id) {
  try {
    tasks = await api(`/api/tasks?id=${id}`, 'PATCH');
    renderTasks();
  } catch (e) { alert('操作失敗: ' + e.message); }
}

async function deleteTask(id) {
  try {
    tasks = await api(`/api/tasks?id=${id}`, 'DELETE');
    renderTasks();
  } catch (e) { alert('刪除失敗: ' + e.message); }
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
  try {
    entries = await api('/api/accounting', 'POST', {
      type: acctType,
      amount,
      category: document.getElementById('acctCat').value,
      note:     document.getElementById('acctNote').value.trim(),
      date,
    });
    document.getElementById('acctAmt').value  = '';
    document.getElementById('acctNote').value = '';
    renderAccounting();
  } catch (e) { alert('新增失敗: ' + e.message); }
}

async function deleteEntry(id) {
  try {
    entries = await api(`/api/accounting?id=${id}`, 'DELETE');
    renderAccounting();
  } catch (e) { alert('刪除失敗: ' + e.message); }
}

function renderAccounting() {
  const now = new Date();
  const ms = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const me  = entries.filter(e => e.date && e.date.startsWith(ms));

  const totalInc = me.filter(e => e.type === 'income').reduce((s, e)  => s + e.amount, 0);
  const totalExp = me.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const balance  = totalInc - totalExp;
  const fmt = n => Math.round(Math.abs(n)).toLocaleString('zh-TW');

  document.getElementById('sumIncome').textContent  = fmt(totalInc);
  document.getElementById('sumExpense').textContent = fmt(totalExp);
  const balEl = document.getElementById('sumBalance');
  balEl.textContent = (balance >= 0 ? '+' : '-') + fmt(balance);
  balEl.className = 'sum-val ' + (balance >= 0 ? 'pos' : 'neg');

  const list = document.getElementById('acctList');
  if (!entries.length) {
    list.innerHTML = '<div class="empty-hint">尚無記帳記錄</div>';
    return;
  }

  const today = now.toISOString().slice(0, 10);
  const yday  = new Date(+now - 86400000).toISOString().slice(0, 10);

  const groups = {};
  for (const e of entries) {
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

// ─── Util ─────────────────────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}
