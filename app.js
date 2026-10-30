'use strict';
(() => {
  const KEY = 'little-ledger-v1';
  const categories = {expense: ['餐饮', '交通', '购物', '居住', '娱乐', '医疗', '学习', '其他支出'], income: ['工资', '奖金', '兼职', '理财', '红包', '其他收入']};
  const icons = {'餐饮':'☕','交通':'↗','购物':'▧','居住':'⌂','娱乐':'♫','医疗':'＋','学习':'✎','工资':'¥','奖金':'☆','兼职':'▤','理财':'↗','红包':'♡'};
  const $ = id => document.getElementById(id);
  const form = $('entry-form');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const validDate = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const d = new Date(`${value}T12:00:00`); return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === value; };
  const money = cents => new Intl.NumberFormat('zh-CN', {style:'currency',currency:'CNY',minimumFractionDigits:2}).format(cents / 100);
  let records = [], storageBlocked = false, pendingDelete = null;
  function message(text, error = false) { $('form-message').textContent = text; $('form-message').classList.toggle('error', error); }
  function validRecord(r) { return r && typeof r.id === 'string' && ['income','expense'].includes(r.type) && Number.isSafeInteger(r.cents) && r.cents > 0 && r.cents <= 99999999999 && categories[r.type].includes(r.category) && validDate(r.date) && typeof r.note === 'string' && r.note.length <= 100; }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw !== null) { const parsed = JSON.parse(raw); if (!Array.isArray(parsed) || !parsed.every(validRecord) || new Set(parsed.map(r=>r.id)).size !== parsed.length) throw new Error('invalid'); records = parsed; } }
    catch { storageBlocked = true; message('无法读取本地数据。为保护原有账单，已暂停写入。请检查浏览器存储设置。', true); }
  }
  function persist(next) {
    if (storageBlocked) { message('本地存储不可用，未保存。请检查浏览器设置后刷新重试。', true); return false; }
    try { localStorage.setItem(KEY, JSON.stringify(next)); records = next; return true; }
    catch { message('保存失败，数据未更改。浏览器存储可能已满或被禁用。', true); return false; }
  }
  function updateCategories() { const type = form.elements.type.value; $('category').replaceChildren(...categories[type].map(name => new Option(name, name))); }
  function render() {
    const currentMonth = today().slice(0,7);
    const monthly = records.filter(r => r.date.startsWith(currentMonth));
    const total = type => monthly.filter(r=>r.type===type).reduce((sum,r)=>sum+BigInt(r.cents),0n);
    const income = total('income'), expense = total('expense');
    const bigMoney = cents => { const negative=cents<0n; const value=negative?-cents:cents; return `${negative?'-':''}¥${(value/100n).toLocaleString('zh-CN')}.${String(value%100n).padStart(2,'0')}`; };
    $('month-title').textContent = `${Number(currentMonth.slice(0,4))} 年 ${Number(currentMonth.slice(5))} 月 · 本月概览`;
    $('income').textContent = bigMoney(income); $('expense').textContent = bigMoney(expense); $('balance').textContent = bigMoney(income-expense);
    const month = $('history-month').value;
    const visible = records.filter(r=>!month || r.date.startsWith(month)).slice().sort((a,b)=>b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    $('record-count').textContent = `${visible.length} 笔记录`;
    $('history-caption').textContent = month ? `${month.replace('-', ' 年 ')} 月的收支记录` : '全部收支记录 · 按日期从新到旧';
    const list = $('records'); list.replaceChildren();
    if (!visible.length) { const empty = document.createElement('div'); empty.className = 'empty'; const icon = document.createElement('span'); icon.textContent='▤'; const title=document.createElement('strong'); title.textContent=records.length?'这个月还没有账单':'你的第一笔，从这里开始'; empty.append(icon,title,document.createTextNode('记下每一笔，让生活更有条理。')); list.append(empty); return; }
    visible.forEach(r=> {
      const row=document.createElement('article'); row.className='record';
      const icon=document.createElement('span'); icon.className='record-icon'; icon.setAttribute('aria-hidden','true'); icon.textContent=icons[r.category] || '·';
      const body=document.createElement('div'); body.className='record-body';
      const title=document.createElement('div'); title.className='record-title'; title.textContent=r.category;
      const detail=document.createElement('div'); detail.className='record-detail'; detail.textContent=`${r.date.replaceAll('-','.')} · ${r.type==='income'?'收入':'支出'}${r.note?' · '+r.note:''}`; body.append(title,detail);
      const side=document.createElement('div'); const amount=document.createElement('div'); amount.className=`record-value ${r.type==='income'?'income':''}`; amount.textContent=`${r.type==='income'?'+':'−'}${money(r.cents)}`;
      const button=document.createElement('button'); button.type='button'; button.className='delete'; button.textContent='删除'; button.setAttribute('aria-label',`删除 ${r.date} ${r.category} ${money(r.cents)} 的记录`); button.addEventListener('click',()=>{pendingDelete=r.id; $('delete-dialog').showModal();}); side.append(amount,button); row.append(icon,body,side); list.append(row);
    });
  }
  $('date').value=today(); $('history-month').value=today().slice(0,7);
  form.querySelectorAll('[name="type"]').forEach(input=>input.addEventListener('change',updateCategories));
  form.addEventListener('submit',event=>{
    event.preventDefault(); const raw=$('amount').value.trim();
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) { message('请输入正确金额：最多 9 位整数和 2 位小数。',true); $('amount').focus(); return; }
    const [whole,fraction='']=raw.split('.'); const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
    if (cents<=0) {message('金额必须大于 0。',true); return;}
    if (!validDate($('date').value)) {message('请选择有效日期。',true); return;}
    const type=form.elements.type.value;
    const record={id:typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`,type,cents,category:$('category').value,date:$('date').value,note:$('note').value.trim()};
    if (!validRecord(record)) {message('请检查分类、日期和备注。',true); return;}
    if (persist([...records,record])) { $('amount').value=''; $('note').value=''; $('history-month').value=record.date.slice(0,7); render(); message('已保存，账单已记录在当前浏览器。'); }
  });
  $('history-month').addEventListener('change',render);
  $('all-records').addEventListener('click',()=>{$('history-month').value='';render();});
  $('cancel-delete').addEventListener('click',()=>$('delete-dialog').close());
  $('confirm-delete').addEventListener('click',()=>{ if (pendingDelete && persist(records.filter(r=>r.id!==pendingDelete))) {render();message('记录已删除。');} $('delete-dialog').close(); });
  $('delete-dialog').addEventListener('close',()=>{pendingDelete=null;});
  window.addEventListener('storage',event=>{if(event.key===KEY || event.key===null){records=[];storageBlocked=false;load();render();}});
  window.addEventListener('pageshow',render);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  updateCategories(); load(); render();
})();
