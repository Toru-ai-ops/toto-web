'use strict';

// ─── State ────────────────────────────────────────────────────────────────────

let tasks = [];
let entries = [];
let fitEntries = [];
let taskFilter = '全部';
let acctType = 'expense';
let fitLoaded = false;

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
  if (res.status === 204) return null;
  return res.json();
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function switchTab(name, btn) {
  document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panelTasks').classList.toggle('active', name === 'tasks');
  document.getElementById('panelAccounting').classList.toggle('active', name === 'accounting');
  document.getElementById('panelCalendar').classList.toggle('active', name === 'calendar');
  document.getElementById('panelFitness').classList.toggle('active', name === 'fitness');
  if (name === 'calendar' && calEvents === null) loadCalendar();
  if (name === 'fitness' && !fitLoaded) loadFitness();
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

// ─── Calendar ─────────────────────────────────────────────────────────────────

let calEvents = null;
const evMap = {};
let editingEvent = null;

async function loadCalendar() {
  document.getElementById('calList').innerHTML = '<div class="loading">載入中...</div>';
  try {
    const events = await api('/api/calendar');
    calEvents = events;
    renderCalendar();
  } catch (e) {
    if (e.message.includes('not_authorized') || e.message.includes('401')) {
      calEvents = null;
      renderCalendar();
    } else {
      document.getElementById('calList').innerHTML = `<div class="empty-hint err">載入失敗: ${e.message}</div>`;
    }
  }
}

function renderCalendar() {
  const list   = document.getElementById('calList');
  const addBar = document.getElementById('calAddBar');

  if (calEvents === null) {
    list.innerHTML = `<div class="auth-prompt">
      <div class="auth-icon-big">🗓️</div>
      <p class="auth-msg">連接 Google 日曆以同步行程</p>
      <a href="/api/auth/login" class="auth-link-btn">授權 Google 日曆</a>
    </div>`;
    addBar.classList.add('hidden');
    return;
  }

  addBar.classList.remove('hidden');

  if (!calEvents.length) {
    list.innerHTML = '<div class="empty-hint">沒有即將到來的行程</div>';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const tmr   = new Date(+new Date() + 86400000).toISOString().slice(0, 10);
  const groups = {};

  for (const ev of calEvents) {
    evMap[ev.id] = ev;
    const d = ev.start?.date || (ev.start?.dateTime || '').slice(0, 10);
    (groups[d] = groups[d] || []).push(ev);
  }

  let html = '';
  for (const date of Object.keys(groups).sort()) {
    const lbl = date === today ? '今天' : date === tmr ? '明天' : date.replace(/-/g, '/');
    html += `<div class="date-group"><div class="date-hd"><span class="date-lbl">${lbl}</span></div>`;
    for (const ev of groups[date]) {
      const isAllDay = !!ev.start?.date;
      const timeStr  = isAllDay ? '全天' : fmtTime(ev.start?.dateTime);
      html += `<div class="ev-card" onclick="openEditEvent('${ev.id}')">
        <span class="ev-time">${timeStr}</span>
        <span class="ev-title">${esc(ev.summary || '（無標題）')}</span>
        <span class="ev-chevron">›</span>
      </div>`;
    }
    html += '</div>';
  }
  list.innerHTML = html;
}

function fmtTime(dtStr) {
  if (!dtStr) return '';
  const d = new Date(dtStr);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function openCreateEvent() {
  editingEvent = null;
  document.getElementById('modalTitle').textContent = '新增行程';
  document.getElementById('evSubmitBtn').textContent = '新增';
  document.getElementById('evDelBtn').classList.add('hidden');

  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0'), d = String(now.getDate()).padStart(2,'0');
  document.getElementById('evTitle').value    = '';
  document.getElementById('evDate').value     = `${y}-${m}-${d}`;
  document.getElementById('evAllDay').checked = false;
  document.getElementById('evStart').value    = '09:00';
  document.getElementById('evEnd').value      = '10:00';
  document.getElementById('evLocation').value = '';
  document.getElementById('evDesc').value     = '';
  document.getElementById('evTimeRow').classList.remove('hidden');
  document.getElementById('eventModal').classList.remove('hidden');
}

function openEditEvent(id) {
  const ev = evMap[id];
  if (!ev) return;
  editingEvent = ev;

  document.getElementById('modalTitle').textContent = '編輯行程';
  document.getElementById('evSubmitBtn').textContent = '儲存';
  document.getElementById('evDelBtn').classList.remove('hidden');

  const isAllDay = !!ev.start?.date;
  const date     = ev.start?.date || (ev.start?.dateTime || '').slice(0, 10);

  document.getElementById('evTitle').value    = ev.summary || '';
  document.getElementById('evDate').value     = date;
  document.getElementById('evAllDay').checked = isAllDay;
  document.getElementById('evLocation').value = ev.location || '';
  document.getElementById('evDesc').value     = ev.description || '';

  if (!isAllDay) {
    document.getElementById('evStart').value = fmtTime(ev.start?.dateTime);
    document.getElementById('evEnd').value   = fmtTime(ev.end?.dateTime);
    document.getElementById('evTimeRow').classList.remove('hidden');
  } else {
    document.getElementById('evTimeRow').classList.add('hidden');
  }

  document.getElementById('eventModal').classList.remove('hidden');
}

function closeEventModal() {
  document.getElementById('eventModal').classList.add('hidden');
  editingEvent = null;
}

function handleModalBg(e) {
  if (e.target === document.getElementById('eventModal')) closeEventModal();
}

function toggleAllDay(checked) {
  document.getElementById('evTimeRow').classList.toggle('hidden', checked);
}

async function submitEventModal() {
  const summary = document.getElementById('evTitle').value.trim();
  const date    = document.getElementById('evDate').value;
  if (!summary || !date) return;

  const isAllDay = document.getElementById('evAllDay').checked;
  let eventData;

  if (isAllDay) {
    const next = new Date(date + 'T00:00:00');
    next.setDate(next.getDate() + 1);
    eventData = { summary, start: { date }, end: { date: next.toISOString().slice(0,10) } };
  } else {
    const st  = document.getElementById('evStart').value || '09:00';
    const et  = document.getElementById('evEnd').value   || '10:00';
    const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const off = -new Date().getTimezoneOffset();
    const tzStr = `${off >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(off)/60)).padStart(2,'0')}:${String(Math.abs(off)%60).padStart(2,'0')}`;
    eventData = {
      summary,
      start: { dateTime: `${date}T${st}:00${tzStr}`, timeZone: tz },
      end:   { dateTime: `${date}T${et}:00${tzStr}`, timeZone: tz },
    };
  }

  const loc  = document.getElementById('evLocation').value.trim();
  const desc = document.getElementById('evDesc').value.trim();
  if (loc)  eventData.location    = loc;
  if (desc) eventData.description = desc;

  try {
    if (editingEvent) {
      await api(`/api/calendar?id=${editingEvent.id}&calendarId=${encodeURIComponent(editingEvent.calendarId || 'primary')}`, 'PATCH', eventData);
    } else {
      await api('/api/calendar', 'POST', eventData);
    }
    closeEventModal();
    calEvents = null;
    await loadCalendar();
  } catch (e) { alert('操作失敗: ' + e.message); }
}

async function deleteCalendarEvent() {
  if (!editingEvent) return;
  if (!confirm(`確定刪除「${editingEvent.summary}」？`)) return;
  try {
    await api(`/api/calendar?id=${editingEvent.id}&calendarId=${encodeURIComponent(editingEvent.calendarId || 'primary')}`, 'DELETE');
    closeEventModal();
    calEvents = null;
    await loadCalendar();
  } catch (e) { alert('刪除失敗: ' + e.message); }
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
  try {
    fitEntries = await api('/api/fitness', 'POST', {
      date,
      exercise,
      sets:   document.getElementById('fitSets').value    || null,
      reps:   document.getElementById('fitReps').value    || null,
      weight: document.getElementById('fitWeight').value  || null,
      note:   document.getElementById('fitNote').value.trim(),
    });
    document.getElementById('fitExercise').value = '';
    document.getElementById('fitSets').value     = '';
    document.getElementById('fitReps').value     = '';
    document.getElementById('fitWeight').value   = '';
    document.getElementById('fitNote').value     = '';
    renderFitness();
  } catch (e) { alert('新增失敗: ' + e.message); }
}

async function deleteFitEntry(id) {
  try {
    fitEntries = await api(`/api/fitness?id=${id}`, 'DELETE');
    renderFitness();
  } catch (e) { alert('刪除失敗: ' + e.message); }
}

function renderFitness() {
  const list = document.getElementById('fitList');
  if (!fitEntries.length) {
    list.innerHTML = '<div class="empty-hint">尚無訓練記錄</div>';
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const yday  = new Date(+new Date() - 86400000).toISOString().slice(0, 10);
  const groups = {};
  for (const e of fitEntries) {
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

// ─── Util ─────────────────────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}
