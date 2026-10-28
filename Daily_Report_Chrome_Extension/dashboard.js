
const LV=['Мале','Норм','Високе'],MD=['Негативний','Нормальний','Позитивний'],K2='daily_report_v2',K1='daily_report_v1',$=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const p2=n=>String(n).padStart(2,'0'),pd=s=>new Date(s+'T12:00:00'),iso=d=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
const add=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return iso(d)},utc=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d))};
const fmt=(s,o)=>pd(s).toLocaleDateString('uk',o),mon=s=>add(s,-((pd(s).getDay()+6)%7));
const defCfg=()=>({ticks:21,sections:['КРІТИ','СКЛАДНІ ЛЮДИ'],brands:['THOR','VEGAS']});
const mkDay=()=>({load:'Норм',mood:'Нормальний',items:{},calls:[],adj:0,off:''});
const mkSheet=(name,start,n)=>({name,start,cfg:defCfg(),days:Array.from({length:n},mkDay)});
let S,sel=0,tm;const cur=()=>S.sheets[S.cur];
const dc=d=>d.off?0:(d.calls||[]).slice(0,cur().cfg.ticks).filter(Boolean).length+(+d.adj||0);
const COL={ok:'#16a34a',mid:'#eab308',low:'#f97316',bad:'#ef4444'},tgt=()=>cur().cfg.weekly||50,dtg=()=>tgt()/5,lv0=p=>p>=1?'ok':p>=.7?'mid':p>=.4?'low':'bad';
// Спільний розрахунок кольору для місячних та річної клітинок.
// За наявності перетинів річна карта використовує аркуш, який відкривається при кліку.
function sheetDayLevel(sh,d,dt,today=iso(new Date())){
 if(d.off)return null;
 const v=dcs(sh,d),wd=pd(dt).getDay();
 if(wd%6===0)return v>0?'ok':null;
 const p=v/dailyGoal(sh);
 if(dt>today&&!v)return null;
 if(dt===today&&p<1)return null;
 return lv0(p);
}
function lvl(i){const sh=cur();return sheetDayLevel(sh,sh.days[i],add(sh.start,i))}
/* План = тижнева ціль / 5 × кількість будніх днів без OFF. */
function isWorkday(dt){const wd=pd(dt).getDay();return wd>0&&wd<6}
function dailyGoal(sh){return (+sh.cfg.weekly||50)/5}
function sheetWeeks(sh){
 const byWeek=new Map();
 sh.days.forEach((d,i)=>{
  const date=add(sh.start,i),key=mon(date);
  let w=byWeek.get(key);
  if(!w){w={start:key,last:date,days:[],calls:0,goal:0,off:0};byWeek.set(key,w)}
  w.days.push({d,i,date});w.last=date;
  w.calls+=dcs(sh,d);
  if(isWorkday(date)){
   if(d.off)w.off++;
   else w.goal+=dailyGoal(sh);
  }
 });
 return [...byWeek.values()];
}
function wkLbl(w){
 const complete=w.goal>0&&(w.last<iso(new Date())||w.calls>=w.goal);
 const color=complete?` style="color:${COL[lv0(w.calls/w.goal)]}"`:'';
 const label=w.goal>0?`<i${color}>${w.calls}</i>/${num(w.goal)}`:`<i>${w.calls}</i> / без плану`;
 const off=w.off?` <span class="mut">(OFF: ${w.off})</span>`:'';
 return `${label}${off}`;
}
const num=n=>Number(n.toFixed(2)).toLocaleString('uk-UA',{maximumFractionDigits:2});
function planStats(){
 const sh=cur(),today=iso(new Date());let doneDays=0,checkedDays=0,doneWeeks=0,checkedWeeks=0;
 sh.days.forEach((d,i)=>{
  const date=add(sh.start,i),goal=dailyGoal(sh);
  if(d.off||!isWorkday(date))return;
  if(date<today||date===today&&dc(d)>=goal){
   checkedDays++;
   if(dc(d)>=goal)doneDays++;
  }
 });
 sheetWeeks(sh).forEach(w=>{
  if(w.goal<=0)return;
  if(w.last<today||w.calls>=w.goal){
   checkedWeeks++;
   if(w.calls>=w.goal)doneWeeks++;
  }
 });
 return {d:[doneDays,checkedDays],w:[doneWeeks,checkedWeeks]};
}
function planTxt(i){
 const sh=cur(),d=sh.days[i],date=add(sh.start,i),week=sheetWeeks(sh).find(w=>w.start===mon(date));
 const weekly=week?num(week.goal):num(+sh.cfg.weekly||50),off=week&&week.off?` · OFF: ${week.off}`:'';
 if(d.off)return `Додатковий вихідний · план дня 0 · план тижня ${weekly}${off}`;
 if(!isWorkday(date))return `Вихідний — без плану · план тижня ${weekly}${off}`;
 const goal=dailyGoal(sh),v=dc(d),l=lvl(i);
 return `Ціль дня: ${num(goal)} · <b style="color:${l?COL[l]:'inherit'}">${Math.round(100*v/goal)}%</b> · план тижня: ${weekly}${off}`;
}
/* old (v1) week model -> new */
const oldDay=()=>({load:'',mood:'',crit:Array.from({length:5},()=>({b:'',l:'',d:''})),hard:Array.from({length:5},()=>({b:'',l:'',d:''})),calls:Array(21).fill(false),adj:0,off:''});
function conv(o){const days=[];o.weeks.forEach(w=>w.days.forEach((d,i)=>{days.push({load:d.load||'Норм',mood:d.mood||'Нормальний',items:{'КРІТИ':d.crit.filter(e=>e.l||e.d),'СКЛАДНІ ЛЮДИ':d.hard.filter(e=>e.l||e.d)},calls:(d.calls||[]).slice(),adj:d.adj||0,off:d.off||''});if(i==5)days.push(mkDay())}));return{name:o.name,start:o.weeks[0].start,cfg:defCfg(),days}}
function load(){try{const t=localStorage.getItem(K2);if(t){const o=JSON.parse(t);if(o&&o.sheets&&o.sheets.length&&o.sheets[0].days){S=o}}
 if(!S){const t1=localStorage.getItem(K1);if(t1){const o=JSON.parse(t1);if(o.sheets&&o.sheets.length)S={sheets:o.sheets.map(conv),cur:o.cur||0}}}}catch(e){}
 if(!S){const n=new Date(),f=iso(new Date(n.getFullYear(),n.getMonth(),1));S={sheets:[mkSheet(n.toLocaleString('en',{month:'long'}).toUpperCase()+' STATS',f,new Date(n.getFullYear(),n.getMonth()+1,0).getDate())],cur:0}}
 if(!S.sheets[S.cur])S.cur=0; if(!Array.isArray(S.trash))S.trash=[]; if(!S.yearData||typeof S.yearData!=='object'||Array.isArray(S.yearData))S.yearData={}}
function flush(){try{const snapshot=JSON.stringify(S);localStorage.setItem(K2,snapshot);chrome.storage.local.set({[K2]:S}).catch(err=>st('Не вдалося синхронізувати: '+err.message,1));st('Збережено '+new Date().toLocaleTimeString('uk'))}catch(e){st('Не вдалося зберегти — зробіть резервну копію',1)}}
const save=()=>{clearTimeout(tm);tm=setTimeout(flush,250)};const st=(t,w)=>{const e=$('#st');e.textContent=t;e.className=w?'w':''};
addEventListener('beforeunload',flush);try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
/* ---------- render ---------- */
function pickToday(){const sh=cur(),i=Math.round((pd(iso(new Date()))-pd(sh.start))/864e5);sel=i>=0&&i<sh.days.length?i:0}
function renderAll(){const sh=cur();
 $('#tabs').innerHTML=S.sheets.map((s,i)=>`<button class="tab${i==S.cur&&view=='sheet'?' on':''}" data-tab="${i}">${esc(s.name)}</button>`).join('')+'<button data-a="new">＋ Новий</button><button data-a="manage">Аркуші…</button><button class="tab'+(view=='year'?' on':'')+'" data-a="year">📊 Рік</button>';
 $('#sn').value=sh.name;$('#ss').value=sh.start;$('#sd').value=sh.days.length;$('#stk').value=sh.cfg.ticks;$('#swk').value=sh.cfg.weekly||50;$('#ssec').value=sh.cfg.sections.join(', ');$('#sbr').value=sh.cfg.brands.join(', ');
 applyView()}
function refresh(){stats();monthWeekdays();chart();strip()}
function lastData(){const v=cur().days.map(dc);let l=-1;v.forEach((x,i)=>{if(x>0)l=i});return l}
function stats(){const sh=cur(),v=sh.days.map(dc),L=lastData(),idx=v.map((x,i)=>i).filter(i=>i<=L&&!sh.days[i].off);
 const tot=v.reduce((a,b)=>a+b,0),avg=idx.length?tot/idx.length:0;let best=idx[0],worst=idx[0];idx.forEach(i=>{if(v[i]>v[best])best=i;if(v[i]<v[worst])worst=i});
 const c=(t,b,s)=>`<div class="stat"><small>${t}</small><b>${b}</b>${s?` <span class="mut">${s}</span>`:''}</div>`;
 const ps=planStats();$('#stats').innerHTML=c('Всього дзвінків',tot)+c('Тижні в плані',ps.w[0]+'/'+ps.w[1],'план враховує OFF')+c('Дні в плані',ps.d[0]+'/'+ps.d[1],ps.d[1]?Math.round(100*ps.d[0]/ps.d[1])+'%':'')+c('Середнє за день',avg.toFixed(1))+(idx.length?c('Найкращий день',v[best],fmt(add(sh.start,best),{day:'numeric',month:'short'})):c('Найкращий день','—'))}
function chart(){const sh=cur(),n=sh.days.length,box=$('#chart'),W=box.clientWidth||900,H=230,L=30,R=6,T=10,B=44,v=sh.days.map(dc);
 const top=Math.max(10,Math.ceil(Math.max(dtg(),...v)/10)*10),bw=(W-L-R)/n,y=x=>T+(H-T-B)*(1-x/top),LD=lastData();
 const act=v.filter((x,i)=>i<=LD&&!sh.days[i].off),avg=act.length?act.reduce((a,b)=>a+b,0)/act.length:0;
 let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-size="10" fill="currentColor">`;
 for(let k=0;k<=4;k++){const val=top*k/4;s+=`<line x1="${L}" x2="${W-R}" y1="${y(val)}" y2="${y(val)}" stroke="var(--line)"/><text x="${L-4}" y="${y(val)+3}" text-anchor="end" fill="var(--mut)">${Math.round(val)}</text>`}
 s+=`<line x1="${L}" x2="${W-R}" y1="${y(dtg())}" y2="${y(dtg())}" stroke="currentColor" stroke-dasharray="4 4" opacity=".5"/>`;const step=Math.ceil(n/Math.floor((W-L)/38)),ma=[];
 v.forEach((x,i)=>{const d=sh.days[i],dt=add(sh.start,i),wd=pd(dt).getDay(),bx=L+i*bw+bw*.14,w=bw*.72,h=Math.max(0,(H-T-B)*x/top);
  const lv=lvl(i),col=d.off?'var(--line)':lv?COL[lv]:'var(--acc)';
  s+=`<rect data-i="${i}" x="${bx}" y="${H-B-h}" width="${w}" height="${h}" rx="${Math.min(4,w/3)}" fill="${col}" opacity="${wd%6==0?.55:1}" ${i==sel?'stroke="var(--fg)" stroke-width="2"':''}><title>${fmt(dt,{weekday:'short',day:'numeric',month:'short'})}: ${x}</title></rect>`;
  s+=`<rect data-i="${i}" x="${L+i*bw}" y="${T}" width="${bw}" height="${H-T-B}" fill="transparent"/>`;
  const lc=d.load=='Високе'?'var(--bad)':d.load=='Мале'?'var(--ok)':'var(--line)';s+=`<circle cx="${bx+w/2}" cy="${H-B+30}" r="3" fill="${lc}"/>`;
  if(i%step==0)s+=`<text x="${bx+w/2}" y="${H-B+14}" text-anchor="middle" fill="var(--mut)">${p2(pd(dt).getDate())}.${p2(pd(dt).getMonth()+1)}</text>`;
  const a=[];for(let j=Math.max(0,i-3);j<=Math.min(n-1,i+3);j++)if(!sh.days[j].off&&j<=LD)a.push(v[j]);if(i<=LD&&a.length)ma.push([bx+w/2,y(a.reduce((p,q)=>p+q,0)/a.length)])});
 if(ma.length>1)s+=`<polyline fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linejoin="round" points="${ma.map(p=>p.join(',')).join(' ')}"/>`;
 box.innerHTML=s+'</svg>'}
function strip(){const sh=cur(),t=iso(new Date());let h='';
 sheetWeeks(sh).forEach(w=>{
  h+=`<div class="wk"><div class="wl">${fmt(w.start,{day:'numeric',month:'short'})} · ${wkLbl(w)}</div><div class="ch">`+w.days.map(({d,i,date:dt})=>{const lv=lvl(i);return `<button class="chip${i==sel?' on':''}${dt==t?' td':''}${d.off?' off':''}${lv?' lv':''}" ${lv?`style="--c:${COL[lv]}"`:''} data-d="${i}" title="${esc(fmt(dt,{day:'numeric',month:'long'}))}: ${dc(d)} дзвінків${d.off?' (OFF)':''}"><small>${fmt(dt,{weekday:'short'})}</small><b>${pd(dt).getDate()}</b><span>${dc(d)}</span></button>`}).join('')+'</div></div>'
 });
 $('#strip').innerHTML=h;const on=document.querySelector('.chip.on');if(on)on.scrollIntoView({inline:'nearest',block:'nearest'})}
function detail(){const sh=cur(),d=sh.days[sel],dt=add(sh.start,sel),c=sh.cfg,pl=(k,o)=>`<div class="pills">${o.map(x=>`<button data-p="${k}|${x}" class="${d[k]==x?'on':''}">${x}</button>`).join('')}</div>`;
 const sec=c.sections.map(s=>{const it=d.items[s]||[];return `<div class="sec"><h3>${esc(s)}${s.trim().toUpperCase()==='КРІТИ'?'<button data-copy-crits="1" title="Кріти з усіх аркушів за тиждень вибраного дня">Копіювати тиждень (Пн–Нд)</button>':''}<button data-add="${esc(s)}" style="padding:1px 9px">＋</button></h3>`+it.map((e,i)=>{Cases.normalize(e);const bi=c.brands.indexOf(e.b);
  return `<div class="e"><button class="${bi>=0?'b'+(bi%3+1):''}" data-br="${esc(s)}|${i}" title="Бренд">${e.b?esc(e.b.slice(0,1)):'·'}</button><input data-e="${esc(s)}|${i}|l" value="${esc(e.l)}" type="url" aria-label="Посилання" placeholder="https://…"><input data-e="${esc(s)}|${i}|id" value="${esc(e.id)}" aria-label="ID" placeholder="ID"><input data-e="${esc(s)}|${i}|d" value="${esc(e.d)}" aria-label="Опис" placeholder="опис"><button class="x" data-del="${esc(s)}|${i}">✕</button></div>`}).join('')+(it.length?'':'<div class="mut">Немає записів</div>')+'</div>'}).join('');
 $('#detail').innerHTML=`<div class="dh"><button data-go="-1">←</button><h2>${fmt(dt,{weekday:'long',day:'numeric',month:'long'})}</h2>${pl('load',LV)}${pl('mood',MD)}<button data-off="1" class="${d.off?'on':''}" style="${d.off?'background:var(--soft)':''}">${d.off?'OFF ✓':'OFF'}</button><button data-go="1">→</button></div>
 <div class="two"><div><div class="mut">Дзвінків</div><div class="big" id="big">${dc(d)}</div><div id="plan" class="mut">${planTxt(sel)}</div>
  <div class="cr"><button data-t="-1">−</button><button data-t="1">+1</button><span class="mut" style="margin-left:auto">поправка ±</span><input type="number" id="adj" value="${d.adj||0}" style="width:64px"></div>
  ${d.off?'<div class="mut">День позначено як OFF — ticks не враховуються</div>':`<div class="cg">${Array.from({length:c.ticks},(_,i)=>`<input type="checkbox" data-c="${i}"${d.calls[i]?' checked':''}>`).join('')}</div>`}</div>
  <div>${sec||'<div class="mut">Додайте розділи у «⚙ Структура»</div>'}</div></div>`}
/* ---------- events ---------- */
const D=()=>cur().days[sel],upBig=()=>{const e=$('#big');if(e)e.textContent=dc(D());const p=$('#plan');if(p)p.innerHTML=planTxt(sel)};
function go(i){sel=Math.max(0,Math.min(cur().days.length-1,i));refresh();detail()}
document.addEventListener('input',e=>{const t=e.target,d=D();
 if(t.dataset.c!=null){d.calls[+t.dataset.c]=t.checked}else if(t.id=='adj'){d.adj=+t.value||0}
 else if(t.dataset.e){const[s,i,f]=t.dataset.e.split('|');d.items[s][+i][f]=t.value;save();return}else return;
 upBig();refresh();save()});
$('#chart').addEventListener('click',e=>{const i=e.target.dataset.i;if(i!=null)go(+i)});
/* Аркуші видаляються через підтвердження, потім зберігаються в кошику. */
let managerConfirm=null,managerNotice='';
function openManager(type=null,index=null){
 managerConfirm=type?{type,index}:null;
 managerNotice='';
 $('#sheet-manager').classList.remove('h');
 $('#sheet-manager').setAttribute('aria-hidden','false');
 renderManager();
 $('#sheet-manager [data-manage="close"]').focus();
}
function closeManager(){
 $('#sheet-manager').classList.add('h');
 $('#sheet-manager').setAttribute('aria-hidden','true');
 managerConfirm=null;
}
function renderManager(){
 const trash=S.trash||[];
 const title=$('#sheet-dialog-title'),box=$('#sheet-dialog-body');
 if(managerConfirm){
  const {type,index}=managerConfirm,record=type==='delete'?S.sheets[index]:trash[index]?.sheet;
  if(!record){managerConfirm=null;renderManager();return}
  const permanent=type==='permanent';
  title.textContent=permanent?'Видалити назавжди?':'Видалити аркуш?';
  box.innerHTML=`<p>Ви дійсно хочете ${permanent?'назавжди видалити':'перемістити у кошик'} аркуш <strong>${esc(record.name)}</strong>?</p>`+
   `<p class="sheet-help">${record.days.length} днів · ${fmt(record.start,{day:'numeric',month:'long',year:'numeric'})} – ${fmt(add(record.start,record.days.length-1),{day:'numeric',month:'long',year:'numeric'})}</p>`+
   (permanent?'<p class="sheet-alert">Цю дію не можна скасувати після підтвердження. Перед видаленням можна зберегти резервну копію JSON.</p>':'<p class="sheet-alert">Аркуш зникне зі статистики, але залишиться у кошику. Його можна буде відновити у будь-який момент.</p>')+
   `<div class="sheet-actions"><button type="button" data-manage="back">Скасувати</button><button type="button" class="sheet-danger" data-manage="confirm">${permanent?'Видалити назавжди':'Перемістити у кошик'}</button></div>`;
  return;
 }
 title.textContent='Керування аркушами';
 let html='<p class="sheet-help">Виберіть аркуш для видалення. Спочатку він потрапить до кошика й не враховуватиметься в жодному звіті. Відновлення повертає всі його записи.</p>';
 if(managerNotice)html+=`<p class="sheet-alert" role="status">${esc(managerNotice)}</p>`;
 html+='<h3 class="sheet-subhead">Активні аркуші ('+S.sheets.length+')</h3>';
 html+=S.sheets.map((sh,i)=>{
  const active=i===S.cur,sd=fmt(sh.start,{day:'numeric',month:'short'}),ed=fmt(add(sh.start,sh.days.length-1),{day:'numeric',month:'short'});
  return `<div class="sheet-entry${active?' active':''}"><div class="sheet-entry-text"><b>${esc(sh.name)}${active?' · поточний':''}</b><small>${sd} – ${ed} · ${sh.days.length} днів</small></div><button type="button" data-manage="delete" data-i="${i}" class="sheet-danger" ${S.sheets.length===1?'disabled title="Не можна видалити єдиний аркуш"':''}>Видалити…</button></div>`;
 }).join('');
 html+=`<h3 class="sheet-subhead">Кошик (${trash.length})</h3>`;
 if(!trash.length)html+='<p class="sheet-help">Кошик порожній.</p>';
 else html+=trash.map((r,i)=>`<div class="sheet-entry"><div class="sheet-entry-text"><b>${esc(r.sheet.name)}</b><small>Видалено ${esc(new Date(r.deletedAt).toLocaleDateString('uk-UA'))}</small></div><div class="sheet-actions" style="margin:0"><button type="button" data-manage="restore" data-i="${i}">Відновити</button><button type="button" data-manage="permanent" data-i="${i}" class="sheet-danger">Назавжди…</button></div></div>`).join('');
 box.innerHTML=html;
}
function removeActiveSheet(index){
 if(S.sheets.length<=1){managerNotice='Не можна видалити єдиний аркуш.';managerConfirm=null;renderManager();return}
 const [sheet]=S.sheets.splice(index,1);
 S.trash.unshift({sheet,index,deletedAt:new Date().toISOString()});
 if(S.cur>=index)S.cur=Math.max(0,S.cur-(S.cur>index?1:0));
 if(S.cur>=S.sheets.length)S.cur=S.sheets.length-1;
 if(yearSource!=='all'){
  const source=+yearSource;
  yearSource=source===index?'all':String(source>index?source-1:source);
 }
 pickToday();renderAll();clearTimeout(tm);flush();
 managerNotice=`Аркуш «${sheet.name}» переміщено у кошик. Його можна відновити нижче.`;
 managerConfirm=null;renderManager();
}
function restoreSheet(index){
 const record=S.trash.splice(index,1)[0];if(!record)return;
 const at=Math.min(record.index,S.sheets.length);
 S.sheets.splice(at,0,record.sheet);
 if(yearSource!=='all'&&+yearSource>=at)yearSource=String(+yearSource+1);
 S.cur=at;view='sheet';pickToday();renderAll();clearTimeout(tm);flush();
 managerNotice=`Аркуш «${record.sheet.name}» відновлено з усіма записами.`;
 renderManager();
}
$('#sheet-manager').addEventListener('click',e=>{
 if(e.target.id==='sheet-manager'){closeManager();return}
 const b=e.target.closest('button[data-manage]');if(!b)return;
 const action=b.dataset.manage,index=+b.dataset.i;
 if(action==='close'){closeManager();return}
 if(action==='back'){managerConfirm=null;renderManager();return}
 if(action==='delete'||action==='permanent'){managerConfirm={type:action,index};renderManager();return}
 if(action==='restore'){restoreSheet(index);return}
 if(action==='confirm'&&managerConfirm){
  const c=managerConfirm;
  if(c.type==='delete')removeActiveSheet(c.index);
  else if(c.type==='permanent'){
   const removed=S.trash.splice(c.index,1)[0];managerConfirm=null;
   clearTimeout(tm);flush();managerNotice=removed?`Аркуш «${removed.sheet.name}» видалено остаточно.`:'Немає аркуша для видалення.';
   renderManager();
  }
 }
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('#sheet-manager').classList.contains('h')){e.preventDefault();closeManager()}
});
document.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t)return;const D0=t.dataset,d=D();
 if(D0.tab!=null){view='sheet';S.cur=+D0.tab;pickToday();renderAll();save();return}if(D0.ys){const q=D0.ys.split('|');view='sheet';S.cur=+q[0];sel=+q[1];renderAll();return}
 if(D0.copyCrits){try{const n=await Cases.copy(S,add(cur().start,sel));st(`Скопійовано крітів: ${n}`)}catch(e){st('Не скопійовано: '+e.message,1)}return}
 if(D0.d!=null){go(+D0.d);return}if(D0.go){go(sel+ +D0.go);return}
 if(D0.p){const[k,v]=D0.p.split('|');d[k]=v;detail();refresh();save();return}
 if(D0.off){d.off=d.off?'':'OFF';detail();refresh();save();return}
 if(D0.t){const T=cur().cfg.ticks;if(D0.t>0){const i=Array.from({length:T},(_,k)=>k).find(k=>!d.calls[k]);if(i!=null)d.calls[i]=true;else d.adj=(+d.adj||0)+1}else{if(d.adj>0)d.adj--;else{for(let k=T-1;k>=0;k--)if(d.calls[k]){d.calls[k]=false;break}}}detail();refresh();save();return}
 if(D0.add!=null){(d.items[D0.add]=d.items[D0.add]||[]).push({b:'',id:'',l:'',d:''});detail();const a=document.querySelectorAll(`[data-e^="${CSS.escape(D0.add)}|"][data-e$="|l"]`);if(a.length)a[a.length-1].focus();save();return}
 if(D0.del){const[s,i]=D0.del.split('|');d.items[s].splice(+i,1);detail();save();return}
 if(D0.br){const[s,i]=D0.br.split('|'),en=d.items[s][+i],b=['',...cur().cfg.brands],k=b.indexOf(en.b);en.b=b[(k+1)%b.length];detail();save();return}
 const a=D0.a;if(!a)return;t.closest('details')&&t.closest('details').removeAttribute('open');
 if(a==='knowledge-add'){yearMetrics().knowledge.push({month:p2(new Date().getMonth()+1),score:'',max:''});refreshAnnualPanel();save();return}
 if(a==='knowledge-del'){const arr=yearMetrics().knowledge,i=+D0.index;if(i>=0&&i<arr.length&&confirm('Видалити результат тесту?')){arr.splice(i,1);refreshAnnualPanel();save()}return}
 if(a==='kpi-item-add'){const r=yearMetrics().months[D0.month];if(r){r.items.push({name:'',percent:''});refreshAnnualPanel();save();const fields=document.querySelectorAll(`[data-year-kind="kpi-part"][data-month="${D0.month}"][data-field="name"]`);fields[fields.length-1]?.focus()}return}
 if(a==='kpi-item-del'){const r=yearMetrics().months[D0.month];if(r&&r.items[+D0.index]&&confirm('Видалити цей пункт KPI?')){r.items.splice(+D0.index,1);refreshAnnualPanel();save()}return}
 if(a==='kpi-legacy-assign'){
  const y=yearMetrics(),m=$('#legacy-kpi-month')?.value,rec=y.months[m];if(!rec)return;
  if(positiveRate(y.overallKpi)!==null&&positiveRate(rec.overall)!==null&&!confirm('Для цього місяця вже вказаний загальний KPI. Замінити його попереднім результатом?'))return;
  rec.items.push(...y.kpis.map(x=>({name:x.name||'',percent:x.percent??''})));
  if(positiveRate(y.overallKpi)!==null)rec.overall=y.overallKpi;
  y.kpis=[];y.overallKpi='';refreshAnnualPanel();save();return;
 }
 if(a=='adv')$('#adv').classList.toggle('on');if(a=='year'){view='year';renderAll()}if(a=='yp'){yr--;renderAll()}if(a=='yn'){yr++;renderAll()}if(a=='ymetric'){yearMetric=D0.metric==='rate'?'rate':'calls';yearRender()}if(a=='wdmetric'){weekdayMetric=D0.metric==='rate'?'rate':'avg';if(view==='year')yearRender();else monthWeekdays();return}
 if(a=='new'){view='sheet';const n=new Date(),f=iso(new Date(n.getFullYear(),n.getMonth(),1));S.sheets.push(mkSheet('NEW STATS',f,28));S.cur=S.sheets.length-1;sel=0;renderAll();save();$('#sn').select()}
 if(a=='manage'){openManager();return}if(a=='addw'){const s=cur();for(let i=0;i<7;i++)s.days.push(mkDay());renderAll();save()}
 if(a=='dels'){openManager('delete',S.cur);return}
 if(a=='xc')exportX([cur()]);if(a=='xa')exportX(S.sheets);if(a=='xi')$('#fx').click();if(a=='jr')$('#fj').click();
 if(a=='jb'){await dl('daily-report-backup-'+iso(new Date())+'.json',JSON.stringify(S));st('Копію збережено')}});
document.addEventListener('keydown',e=>{if(view=='year'||!$('#sheet-manager').classList.contains('h')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key=='ArrowLeft')go(sel-1);if(e.key=='ArrowRight')go(sel+1)});
document.querySelector('.card').addEventListener('change',e=>{const sh=cur(),id=e.target.id,v=e.target.value;if(!id)return;
 if(id=='sn')sh.name=v||'SHEET';if(id=='ss'&&v)sh.start=v;if(id=='sd'){const n=Math.max(1,Math.min(366,+v||1));while(sh.days.length<n)sh.days.push(mkDay());sh.days.length=n}
 if(id=='stk')sh.cfg.ticks=Math.max(1,Math.min(60,+v||21));if(id=='swk')sh.cfg.weekly=Math.max(1,+v||50);
 if(id=='ssec')sh.cfg.sections=v.split(',').map(x=>x.trim()).filter(Boolean);if(id=='sbr')sh.cfg.brands=v.split(',').map(x=>x.trim()).filter(Boolean);
 sel=Math.min(sel,sh.days.length-1);renderAll();save()});
addEventListener('resize',()=>view=='year'?yearRender():chart());
$('#fx').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{
 if(typeof ExcelJS==='undefined')throw Error('Не завантажилася бібліотека Excel. Перезавантажте розширення.');
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(await f.arrayBuffer());
 const result=importWb(wb);if(result===null){st('Імпорт скасовано');return}
 const count=typeof result==='number'?result:result.count;
 pickToday();renderAll();flush();st(result?.restored?'Відновлено повний Excel-архів: '+count+' аркушів':'Імпортовано аркушів: '+count);
 }catch(x){st('Помилка імпорту: '+x.message,1)}});
$('#fj').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const o=JSON.parse(await f.text());if(!o.sheets||!o.sheets.length)throw Error('невірний файл');S=o.sheets[0].weeks?{sheets:o.sheets.map(conv),cur:0}:o;S.cur=0;if(!Array.isArray(S.trash))S.trash=[];if(!S.yearData||typeof S.yearData!=='object')S.yearData={};yearSource='all';pickToday();renderAll();flush();st('Відновлено')}catch(x){st('Помилка: '+x.message,1)}});
async function dl(name,data){try{const d=window.claude&&await window.claude.use('downloads');if(d){await d.save({filename:name,data});return}}catch(e){if(e&&e.code=='declined')return}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data]));a.download=name;a.click()}
/* ---------- xlsx export ---------- */
const CL=n=>{let s='';for(;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s},FL=a=>({type:'pattern',pattern:'solid',fgColor:{argb:a}});
function buildSheet(wb,sh,used){let nm=sh.name.replace(/[\\\/?*\[\]:]/g,'-').slice(0,31)||'SHEET';const originalName=nm;for(let attempt=2;used.has(nm);attempt++)nm=originalName.slice(0,27)+'_'+attempt;used.add(nm);
 const ws=wb.addWorksheet(nm),c=sh.cfg,tr=Math.ceil(c.ticks/3);ws.getColumn(1).width=3;
 for(let k=0;k<7;k++){const b=2+4*k;ws.getColumn(b).width=14;ws.getColumn(b+1).width=9;ws.getColumn(b+2).width=9;ws.getColumn(b+3).width=3}
 const F=(x,o={})=>{x.font={name:'Arial',size:o.sz||10,bold:!!o.b,color:{argb:o.c||'FF000000'}};if(o.f)x.fill=FL(o.f);x.alignment={vertical:'middle',horizontal:o.h||'left'}},BK={b:1,c:'FFFFFFFF',f:'FF000000',h:'center'};
 const rule=(op,n,col)=>({type:'cellIs',operator:op,formulae:[n],style:{fill:{type:'pattern',pattern:'solid',bgColor:{argb:col},fgColor:{argb:col}}}});
 const dv=(x,l)=>{x.dataValidation={type:'list',allowBlank:true,formulae:['"'+l.join(',')+'"']}};
 let t=1;
 for(let st0=0;st0<sh.days.length;st0+=7){const blk=sh.days.slice(st0,st0+7),ms=c.sections.map(s=>Math.max(3,...blk.map(d=>(d.items[s]||[]).length))),cnt=[];
  const h=4+ms.reduce((a,m)=>a+1+m,0)+1+tr+3;
  blk.forEach((d,k)=>{const b=2+4*k,dt=add(sh.start,st0+k);let r=t;
   const H=(rr,txt)=>{ws.mergeCells(rr,b,rr,b+2);const x=ws.getCell(rr,b);x.value=txt;F(x,BK)};
   H(r,utc(dt));ws.getCell(r,b).numFmt='dd.mm.yyyy';r++;H(r,utc(dt).toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'}).toUpperCase());r++;
   [['Навантаження:',d.load,LV],['Настрій:',d.mood,MD]].forEach(([lb,v,l])=>{F(Object.assign(ws.getCell(r,b),{value:lb}),{b:1});ws.mergeCells(r,b+1,r,b+2);const x=ws.getCell(r,b+1);x.value=v||null;F(x);dv(x,l);r++});
   c.sections.forEach((s,si)=>{H(r,s);r++;for(let i=0;i<ms[si];i++){const e=(d.items[s]||[])[i]||{};ws.mergeCells(r,b+1,r,b+2);
     const q=ws.getCell(r,b-1);q.value=e.b||null;F(q);dv(q,c.brands);const l=ws.getCell(r,b),x=ws.getCell(r,b+1);const fields=Cases.fields(e);l.value=[fields.id,fields.l].filter(Boolean).join(' — ')||'посилання';x.value=e.d||'опис';F(l,{c:e.l?'FF000000':'FFD9D9D9'});F(x,{c:e.d?'FF000000':'FFD9D9D9'});r++}});
   const adj=d.adj?(d.adj>0?'+':'')+d.adj:'';for(let q=0;q<3;q++)F(ws.getCell(r,b+q),BK);
   ws.getCell(r,b).value={formula:`COUNTIF(${CL(b)}${r+1}:${CL(b+2)}${r+tr},TRUE)${adj}`,result:dc(d)};cnt.push(CL(b)+r);r++;
   if(d.off){ws.mergeCells(r,b,r+tr-1,b+2);const x=ws.getCell(r,b);x.value=d.off;F(x,{b:1,h:'center',f:'FFD9D9D9'})}
   else for(let i=0;i<c.ticks;i++){const x=ws.getCell(r+Math.floor(i/3),b+i%3);x.value=!!d.calls[i];F(x,{f:'FFD9D9D9',h:'center'})}});
  const tr0=t+h-2,a=ws.getCell(tr0,2);a.value='TOTAL';F(a,BK);const x=ws.getCell(tr0,3);x.value={formula:'SUM('+cnt.join(',')+')',result:blk.reduce((p,d)=>p+dc(d),0)};F(x,{...BK,sz:14});
  const planned=blk.reduce((a,d,k)=>a+(!d.off&&isWorkday(add(sh.start,st0+k))?dailyGoal(sh):0),0);
   const planCell=ws.getCell(tr0,4);planCell.value='/ '+num(planned);F(planCell,{b:1,c:'FF666666'});
   if(planned>0)ws.addConditionalFormatting({ref:'C'+tr0,rules:[rule('lessThan',planned*.4,'FFE06666'),rule('lessThan',planned*.7,'FFF9CB9C'),rule('lessThan',planned,'FFFFE599'),rule('greaterThan',planned-.00001,'FFB6D7A8')]});t+=h}}

/* ---------- Excel: річні записи + відновлюваний архів усіх вкладок ---------- */
const ARCHIVE='__DR_ARCHIVE__',YEAR_TAB='Річні показники',ARCHIVE_ID='DAILY_REPORT_ARCHIVE_V1';
const archiveHash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)};
const deepCopy=x=>JSON.parse(JSON.stringify(x));
function exportedState(full,list){
 if(full)return deepCopy(S);
 const sh=list[0],relevant=new Set();
 for(let i=0;i<sh.days.length;i++)relevant.add(add(sh.start,i).slice(0,4));
 const yearData={};for(const y of relevant)if(S.yearData?.[y])yearData[y]=deepCopy(S.yearData[y]);
 return {sheets:[deepCopy(sh)],cur:0,trash:[],yearData};
}
function uniqueTabName(used,base){
 let label=base,k=1;
 while(used.has(label)){label=base.slice(0,26)+' '+k++}
 used.add(label);return label;
}
function yearExcelSheet(wb,years,used){
 const ws=wb.addWorksheet(uniqueTabName(used,YEAR_TAB));
 ws.getColumn(1).width=4;ws.getColumn(1).hidden=true;
 ws.getColumn(2).width=33;ws.getColumn(3).width=22;ws.getColumn(4).width=21;ws.getColumn(5).width=21;
 ws.getColumn(6).width=6;ws.getColumn(6).hidden=true;
 ws.getColumn(7).width=25;ws.getColumn(7).hidden=true;
 ws.mergeCells('B1:E1');ws.getCell('B1').value='РІЧНІ РЕЗУЛЬТАТИ · ТЕСТИ І KPI ПО МІСЯЦЯХ';
 ws.getCell('B1').font={size:14,bold:true,color:{argb:'FF4338CA'}};
 ws.getCell('B2').value='C — бал або KPI %, D — максимальний бал; назви KPI можна редагувати в B. Імпортуйте Excel назад у додаток.';
 ws.mergeCells('B2:E2');ws.getCell('B2').font={size:10,color:{argb:'FF6B7280'}};
 const h=ws.getRow(4);['Код','Місяць / показник','Бал / KPI %','Макс. бал','Результат, %'].forEach((t,i)=>{const c=h.getCell(i+1);c.value=t;c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill=FL('FF4338CA')});h.height=25;
 let r=5;
 const writePercent=(row,formula,result)=>{const cell=ws.getCell(row,5);cell.value={formula,result};cell.numFmt='0.0%'};
 const asNum=v=>{const n=amount(v);return n===null?null:n};
 for(const [year,raw] of Object.entries(years).sort((a,b)=>+a[0]-+b[0])){
  if(!/^\d{4}$/.test(year))continue;
  const data=normalizeYearRecord(raw);
  ws.getCell(r,1).value='YEAR';ws.getCell(r,2).value=+year;
  for(let c=2;c<=5;c++){const x=ws.getCell(r,c);x.fill=FL('FFEDE9FE');x.font={bold:true,color:{argb:'FF312E81'}}}r++;
  for(const item of data.knowledge){
   const m=item.month||'',a=amount(item.score),b=amount(item.max);
   ws.getCell(r,1).value='KNOWLEDGE';ws.getCell(r,2).value=m?monthName(m):'Місяць не вказано';
   ws.getCell(r,3).value=asNum(item.score);ws.getCell(r,4).value=asNum(item.max);
   ws.getCell(r,6).value=m;ws.getCell(r,7).value=item.name||'';
   writePercent(r,`IF(AND(ISNUMBER(C${r}),ISNUMBER(D${r}),C${r}>=0,D${r}>0),C${r}/D${r},"")`,a!==null&&b!==null&&a>=0&&b>0?a/b:null);r++;
  }
  for(let i=1;i<=12;i++){
   const m=p2(i),rec=data.months[m],overall=asNum(rec.overall);
   ws.getCell(r,1).value='KPI_TOTAL';ws.getCell(r,2).value=monthName(m);ws.getCell(r,3).value=overall;ws.getCell(r,6).value=m;
   ws.getCell(r,2).font={bold:true};
   writePercent(r,`IF(ISNUMBER(C${r}),C${r}/100,"")`,overall===null?null:overall/100);r++;
   for(const part of rec.items){
    const v=asNum(part.percent);ws.getCell(r,1).value='KPI_PART';ws.getCell(r,2).value=part.name||'';ws.getCell(r,3).value=v;ws.getCell(r,6).value=m;
    writePercent(r,`IF(ISNUMBER(C${r}),C${r}/100,"")`,v===null?null:v/100);r++;
   }
  }
  for(const item of data.kpis){const v=asNum(item.percent);ws.getCell(r,1).value='KPI';ws.getCell(r,2).value=item.name||'';ws.getCell(r,3).value=v;writePercent(r,`IF(ISNUMBER(C${r}),C${r}/100,"")`,v===null?null:v/100);r++}
  if(positiveRate(data.overallKpi)!==null){const v=asNum(data.overallKpi);ws.getCell(r,1).value='OVERALL_KPI';ws.getCell(r,2).value='Загальний KPI без місяця';ws.getCell(r,3).value=v;writePercent(r,`IF(ISNUMBER(C${r}),C${r}/100,"")`,v/100);r++}
  r++;
 }
 if(r===5)ws.getCell('B5').value='Для цього року ще немає збережених даних.';
 if(r>5)ws.addConditionalFormatting({ref:`E5:E${r}`,rules:[
  {type:'expression',formulae:['AND(ISNUMBER(E5),E5>=1)'],style:{fill:FL('FFD1FAE5'),font:{color:{argb:'FF166534'}}}},
  {type:'expression',formulae:['AND(ISNUMBER(E5),E5<1)'],style:{fill:FL('FFFEE2E2'),font:{color:{argb:'FFB91C1C'}}}}
 ]});
 ws.views=[{state:'frozen',ySplit:4}];return ws;
}

function archiveExcelSheet(wb,mode,state){
 const ws=wb.addWorksheet(ARCHIVE);ws.state='veryHidden';
 const json=JSON.stringify(state),size=20000;
 ws.getCell('A1').value=ARCHIVE_ID;
 ws.getCell('B1').value=mode;
 ws.getCell('C1').value=json.length;
 ws.getCell('D1').value=archiveHash(json);
 for(let i=0;i<json.length;i+=size)ws.getCell(2+i/size,1).value=json.slice(i,i+size);
}
function readArchive(wb){
 const ws=wb.getWorksheet(ARCHIVE);
 if(!ws)return null;
 if(ws.getCell('A1').value!==ARCHIVE_ID)throw Error('Невідомий формат Excel-архіву');
 const mode=String(ws.getCell('B1').value),length=+ws.getCell('C1').value,hash=String(ws.getCell('D1').value);
 let body='';for(let i=2;i<=ws.rowCount;i++)body+=String(ws.getCell(i,1).value||'');
 if(body.length!==length||archiveHash(body)!==hash)throw Error('Архів Excel пошкоджений або неповний');
 const state=JSON.parse(body);
 if(!Array.isArray(state.sheets)||!state.sheets.length||!state.sheets.every(x=>x&&x.start&&Array.isArray(x.days)&&x.cfg))throw Error('Неповні дані аркушів в Excel');
 return {mode,state};
}
function editedExcelYearData(wb,defaults){
 const ws=wb.worksheets.find(x=>x.name===YEAR_TAB||x.name.startsWith(YEAR_TAB+' '));
 if(!ws)return defaults;
 const found={};let year=null;
 const cellText=(r,c)=>{const v=ws.getCell(r,c).value;return v===null||v===undefined?'':tx(v)};
 const monthFrom=(r,type)=>{
  const named=cellText(r,2).trim().toLowerCase();
  const index=MN.findIndex(n=>n.toLowerCase()===named);
  if(index>=0&&type!=='KPI_PART')return p2(index+1); // місяць можна змінити в Excel у видимій колонці
  const raw=cellText(r,6).trim();if(/^0?[1-9]$|^1[0-2]$/.test(raw))return p2(+raw);
  return index>=0?p2(index+1):'';
 };
 for(let r=5;r<=ws.rowCount;r++){
  const type=cellText(r,1).trim(),name=cellText(r,2),val=cellText(r,3),max=cellText(r,4);
  if(type==='YEAR'){
   const y=+name;year=Number.isInteger(y)&&y>=1900&&y<=9999?String(y):null;
   if(year)found[year]=normalizeYearRecord({knowledge:[],months:{},kpis:[],overallKpi:''});
   continue;
  }
  if(!year)continue;
  const data=found[year],month=monthFrom(r,type);
  if(type==='KNOWLEDGE'){
   const priorName=cellText(r,7);
   data.knowledge.push({month,name:priorName||(!month?name:''),score:val,max});
  }
  if(type==='KPI_TOTAL'&&month)data.months[month].overall=val;
  if(type==='KPI_PART'&&month)data.months[month].items.push({name,percent:val});
  if(type==='KPI')data.kpis.push({name,percent:val}); // старі Excel-формати
  if(type==='OVERALL_KPI')data.overallKpi=val;
 }
 return {...(defaults||{}),...found};
}

async function exportX(list){try{
 if(typeof ExcelJS==='undefined')throw Error('Не завантажилася бібліотека Excel. Перезавантажте розширення.');
 flush();st('Формую Excel…');
 const wb=new ExcelJS.Workbook(),u=new Set([ARCHIVE,YEAR_TAB]),full=list===S.sheets;
 list.forEach(s=>buildSheet(wb,s,u));
 u.delete(YEAR_TAB);
 const state=exportedState(full,list);yearExcelSheet(wb,state.yearData||{},u);
 archiveExcelSheet(wb,full?'all':'single',state);
 await dl((full?'DAILY_REPORT_FULL_BACKUP':list[0].name.replace(/\s+/g,'_'))+'.xlsx',await wb.xlsx.writeBuffer());
 st('Excel збережено: вкладки, річні дані та інформація для відновлення');
 }catch(x){st('Помилка експорту: '+x.message,1)}}
/* ---------- xlsx import (original layout: weeks found by the MONDAY cell) ---------- */
const tx=v=>{if(v==null||v instanceof Date)return'';if(typeof v=='object'){if(v.richText)return v.richText.map(r=>r.text).join('');if('result' in v)return tx(v.result);if(v.text)return tx(v.text);return''}return String(v)};
const dtv=v=>{if(v&&typeof v=='object'&&!(v instanceof Date)&&'result' in v)v=v.result;if(typeof v=='number')v=new Date(Math.round((v-25569)*864e5));return v instanceof Date&&!isNaN(v)?iso(new Date(v.getUTCFullYear(),v.getUTCMonth(),v.getUTCDate(),12)):null};
const ph=(t,p)=>t.trim()==p?'':t;
function importLegacyWb(wb){let n=0;wb.eachSheet(ws=>{if(/TEMPLATE/i.test(ws.name))return;const o={name:ws.name,weeks:[]};
 for(let r=1;r<=ws.rowCount;r++){if(tx(ws.getCell(r,2).value).trim()!=='MONDAY')continue;
  let s0=r>1?dtv(ws.getCell(r-1,2).value):null;if(!s0){const m=ws.name.match(/(\d+)\.(\d+)/);s0=o.weeks.length?add(o.weeks.at(-1).start,7):m?new Date().getFullYear()+'-'+p2(m[2])+'-'+p2(m[1]):iso(new Date())}
  const w={start:s0,days:[0,1,2,3,4,5].map(oldDay)};
  w.days.forEach((d,di)=>{const b=2+4*di,g=(a,c)=>ws.getCell(r+a,c).value;d.load=tx(g(1,b+1));d.mood=tx(g(2,b+1));
   ['crit','hard'].forEach((k,ki)=>d[k].forEach((e,i)=>{const a=ki?10+i:4+i;e.b=tx(g(a,b-1)).trim().toUpperCase();if(!['THOR','VEGAS'].includes(e.b))e.b='';e.l=ph(tx(g(a,b)),'посилання');e.d=ph(tx(g(a,b+1)),'опис')}));
   if(di<5){const cv=g(16,b),f=(cv&&(cv.formula||cv.sharedFormula))||'',m=f.replace(/^COUNTIF\([^)]*\)/i,'').match(/[+-]\d+/g);d.adj=m?m.reduce((a,x)=>a+ +x,0):0;
    const t0=g(17,b);if(typeof t0=='string'&&t0.trim())d.off=t0.trim();else for(let i=0;i<21;i++)d.calls[i]=ws.getCell(r+17+Math.floor(i/3),b+i%3).value===true}});
  o.weeks.push(w)}
 if(!o.weeks.length)return;const sh=conv(o);while(S.sheets.some(x=>x.name==sh.name))sh.name+=' (імпорт)';S.sheets.push(sh);S.cur=S.sheets.length-1;n++});return n}

function importWb(wb){
 const archive=readArchive(wb);
 if(!archive)return importLegacyWb(wb);
 const data=archive.state;
 data.yearData=editedExcelYearData(wb,data.yearData);
 if(archive.mode==='all'){
  if(!confirm('Excel містить повний архів Daily Report. Замінити всі поточні аркуші, кошик, KPI й перевірки знань даними з цього файлу?\n\nПеред заміною рекомендуємо зберегти поточну JSON-копію.'))return null;
  S=data;S.cur=Math.min(Math.max(0,+S.cur||0),S.sheets.length-1);
  if(!Array.isArray(S.trash))S.trash=[];
  if(!S.yearData||typeof S.yearData!=='object')S.yearData={};
  view='sheet';yearSource='all';
  return {count:S.sheets.length,restored:true};
 }
 if(archive.mode!=='single')throw Error('Невідомий тип Excel-архіву');
 const sh=deepCopy(data.sheets[0]);
 while(S.sheets.some(x=>x.name===sh.name))sh.name+=' (імпорт)';
 S.sheets.push(sh);S.cur=S.sheets.length-1;
 if(!S.yearData||typeof S.yearData!=='object')S.yearData={};
 for(const [y,m] of Object.entries(data.yearData||{}))if(!S.yearData[y])S.yearData[y]=deepCopy(m);
 view='sheet';yearSource='all';
 return {count:1,restored:false};
}

/* ---------- Річний огляд (читає ті самі аркуші, нічого не дублює в сховищі) ---------- */
let view='sheet',yr=new Date().getFullYear(),yearSource='all',yearMetric='calls',weekdayMetric='avg';
const MN=Array.from({length:12},(_,m)=>new Date(2000,m,1).toLocaleDateString('uk',{month:'long'}));
const dcs=(sh,d)=>d.off?0:(d.calls||[]).slice(0,sh.cfg.ticks).filter(Boolean).length+(+d.adj||0);
const workday=dt=>{const w=pd(dt).getDay();return w!==0&&w!==6};
const YWD=['пн','вт','ср','чт','пт'];

// Приховуємо поточний щоденний екран, коли вибрана вкладка року.
document.querySelectorAll('.wrap>.card,.wrap>.stats').forEach(e=>e.classList.add('sv'));
const yv=document.createElement('div');yv.id='yv';yv.className='h';
document.querySelector('.wrap').appendChild(yv);

/* ---------- Перевірки знань та помісячний KPI ---------- */
function yearMetrics(y=yr){
 if(!S.yearData||typeof S.yearData!=='object')S.yearData={};
 const key=String(y);
 if(!S.yearData[key]||typeof S.yearData[key]!=='object')S.yearData[key]={};
 return normalizeYearRecord(S.yearData[key]);
}
function normalizeYearRecord(entry){
 if(!Array.isArray(entry.knowledge))entry.knowledge=[];
 if(!Array.isArray(entry.kpis))entry.kpis=[]; // старі річні KPI зберігаємо до перенесення в місяць
 if(entry.overallKpi==null)entry.overallKpi='';
 if(!entry.months||typeof entry.months!=='object'||Array.isArray(entry.months))entry.months={};
 for(let i=1;i<=12;i++){
  const m=p2(i),record=entry.months[m]&&typeof entry.months[m]==='object'?entry.months[m]:{};
  if(record.overall==null)record.overall='';
  if(!Array.isArray(record.items))record.items=[];
  entry.months[m]=record;
 }
 return entry;
}
const amount=v=>v===''||v===null||v===undefined?null:(()=>{const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null})();
const pctLabel=n=>n===null?'—':num(n)+'%';
const positiveRate=v=>{const n=amount(v);return n!==null&&n>=0?n:null};
const resultClass=n=>n===null?'':n>=100?'good':'bad';
const monthName=m=>MN[Math.max(0,Number(m)-1)]||'Оберіть місяць';
const monOpts=(selected='',placeholder=false)=>`${placeholder?'<option value="">Оберіть місяць</option>':''}`+MN.map((n,i)=>`<option value="${p2(i+1)}" ${selected===p2(i+1)?'selected':''}>${esc(n)}</option>`).join('');
function knowledgeRollup(knowledge){
 let sum=0,max=0,count=0;
 for(const e of knowledge){const a=amount(e.score),b=amount(e.max);if(a!==null&&b!==null&&a>=0&&b>0){sum+=a;max+=b;count++}}
 return {sum,max,count,rate:max>0?sum/max*100:null};
}
function kpiRollup(items){
 const vals=items.map(x=>positiveRate(x.percent)).filter(v=>v!==null);
 return {count:vals.length,average:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null};
}
function annualEditor(){
 const y=yearMetrics(),kn=knowledgeRollup(y.knowledge),months=Array.from({length:12},(_,i)=>y.months[p2(i+1)]);
 const values=months.map(x=>positiveRate(x.overall)).filter(x=>x!==null);
 const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
 let html='<div class="annual-panels">';
 html+='<section class="card annual-panel" aria-label="Перевірки знань">';
 html+='<div class="annual-panel-top"><div><h3>Перевірки знань</h3><div class="mut">Записуйте результат кожного тесту в місяць проведення</div></div><button type="button" data-a="knowledge-add">+ Додати результат</button></div>';
 html+=`<div class="annual-summary-row"><div class="annual-summary"><strong id="knowledge-weighted" class="annual-result ${resultClass(kn.rate)}">${pctLabel(kn.rate)}</strong><small id="knowledge-count">Сукупний результат · ${kn.count} тестів</small></div><span id="knowledge-points" class="mut">${kn.count?num(kn.sum)+' / '+num(kn.max)+' балів':'Оцінок ще немає'}</span></div>`;
 if(y.knowledge.length){
  html+='<div class="annual-entry-head"><span>Місяць</span><span>Отримано</span><span>Максимум</span><span style="text-align:right">Результат</span><span></span></div>';
  html+=y.knowledge.map((e,i)=>`<div class="annual-entry" data-knowledge-row="${i}">`+
   `<select aria-label="Місяць перевірки ${i+1}" title="${esc(e.name?'Попередній запис: '+e.name:'')}" data-year-kind="knowledge" data-index="${i}" data-field="month">${monOpts(e.month||'',true)}</select>`+
   `<input aria-label="Отриманий бал" type="number" min="0" step="any" placeholder="0" data-year-kind="knowledge" data-index="${i}" data-field="score" value="${esc(e.score??'')}">`+
   `<input aria-label="Максимально можливий бал" type="number" min="0.01" step="any" placeholder="100" data-year-kind="knowledge" data-index="${i}" data-field="max" value="${esc(e.max??'')}">`+
   `<span class="annual-pct annual-result" data-knowledge-result="${i}">—</span><button type="button" data-a="knowledge-del" data-index="${i}" aria-label="Видалити тест" title="Видалити тест">×</button></div>`).join('');
 } else html+='<div class="annual-empty">Коли пройдете наступний тест, натисніть «Додати результат».</div>';
 html+='<div class="annual-total-bar"><span id="knowledge-bar"></span></div>';
 html+='<p class="annual-help">Підсумковий результат розраховується за сумою отриманих та максимальних балів усіх тестів, а не за простим середнім відсотків. Можна додати декілька тестів у той самий місяць.</p></section>';
 html+='<section class="card annual-panel" aria-label="KPI за місяцями">';
 html+='<div class="annual-panel-top"><div><h3>Особисті KPI · по місяцях</h3><div class="mut">12 місяців · загальний результат вводиться вручну, складові — за бажанням</div></div></div>';
 html+=`<div class="annual-summary-row"><div class="annual-summary"><strong id="kpi-annual-avg" class="annual-result ${resultClass(avg)}">${pctLabel(avg)}</strong><small>Середній загальний KPI за заповненими місяцями</small></div><span class="mut" id="kpi-annual-stats">${values.filter(x=>x>=100).length} із ${values.length} заповнених місяців ≥ 100%</span></div>`;
 html+='<div class="annual-month-grid">';
 MN.forEach((label,i)=>{
  const month=p2(i+1),record=y.months[month],overall=positiveRate(record.overall),parts=kpiRollup(record.items);
  html+=`<div class="annual-month${overall!==null?' has-overall':''}" data-month-card="${month}">`;
  html+=`<div class="annual-month-title"><strong>${esc(label)}</strong><label class="annual-month-rate annual-result ${resultClass(overall)}" data-kpi-month-result="${month}" for="kpi-overall-${month}"><input id="kpi-overall-${month}" class="annual-result ${resultClass(overall)}" type="number" min="0" step="any" placeholder="—" aria-label="Загальний KPI за ${esc(label)}, відсотків" title="Введіть відсоток KPI за ${esc(label)}" data-year-kind="kpi-overall" data-month="${month}" value="${esc(record.overall)}"><span class="annual-month-suffix" aria-hidden="true">%</span></label></div>`;
  html+=`<details class="annual-month-details" ${record.items.length?'open':''}><summary title="Натисніть, щоб показати або сховати складові KPI"><span>Складові KPI <span class="annual-detail-meta">(необов’язково) · <span data-kpi-month-count="${month}">${record.items.length}</span></span></span></summary>`;
  record.items.forEach((e,j)=>{
   const rate=positiveRate(e.percent);
   html+=`<div class="annual-component"><input aria-label="Назва KPI, ${esc(label)}" placeholder="Назва показника" data-year-kind="kpi-part" data-month="${month}" data-index="${j}" data-field="name" value="${esc(e.name||'')}">`+
    `<input aria-label="KPI у відсотках" class="annual-result ${resultClass(rate)}" type="number" min="0" step="any" placeholder="%" data-year-kind="kpi-part" data-month="${month}" data-index="${j}" data-field="percent" value="${esc(e.percent??'')}">`+
    `<button type="button" aria-label="Видалити складову" data-a="kpi-item-del" data-month="${month}" data-index="${j}" title="Видалити">×</button></div>`;
  });
  html+=`<div class="annual-detail-foot"><button type="button" data-a="kpi-item-add" data-month="${month}">+ Пункт KPI</button><span class="annual-detail-average">Середнє пунктів: <b class="annual-result ${resultClass(parts.average)}" data-kpi-parts-avg="${month}">${pctLabel(parts.average)}</b></span></div></details></div>`;
 });
 html+='</div>';
 if(y.kpis.length||positiveRate(y.overallKpi)!==null){
  html+='<div class="annual-legacy"><b>Раніше внесені KPI без місяця</b><p class="annual-help">У старій версії ці показники не були прив’язані до місяця. Оберіть, до якого місяця їх перенести, щоб не втратити записи.</p>';
  html+=`<div class="mut">${y.kpis.map(e=>esc(e.name||'KPI')+': '+pctLabel(positiveRate(e.percent))).join(' · ')}${positiveRate(y.overallKpi)!==null?' · Загальний: '+pctLabel(positiveRate(y.overallKpi)):''}</div>`;
  html+=`<div class="annual-legacy-controls"><select id="legacy-kpi-month" aria-label="Місяць для попередніх KPI">${monOpts(p2(new Date().getMonth()+1))}</select><button type="button" data-a="kpi-legacy-assign">Перенести до місяця</button></div></div>`;
 }
 html+='<p class="annual-help">Червоним позначено результат нижче 100%, зеленим — від 100%. Середнє складових лише довідкове: воно не змінює вручну введений загальний KPI місяця.</p></section></div>';
 return html;
}
function annualStatus(el,n){if(!el)return;el.classList.remove('good','bad');if(n!==null)el.classList.add(n>=100?'good':'bad')}
function updateAnnualNumbers(){
 const root=$('#yv');if(!root||view!=='year')return;
 const y=yearMetrics(),kn=knowledgeRollup(y.knowledge);
 const set=(selector,txt)=>{const el=root.querySelector(selector);if(el)el.textContent=txt};
 set('#knowledge-weighted',pctLabel(kn.rate));annualStatus(root.querySelector('#knowledge-weighted'),kn.rate);
 set('#knowledge-count',`Сукупний результат · ${kn.count} тестів`);
 set('#knowledge-points',kn.count?num(kn.sum)+' / '+num(kn.max)+' балів':'Оцінок ще немає');
 const bar=root.querySelector('#knowledge-bar');if(bar){bar.style.width=Math.min(100,Math.max(0,kn.rate||0))+'%';bar.style.background=kn.rate===null?'var(--acc)':kn.rate>=100?'var(--ok)':'var(--bad)'}
 y.knowledge.forEach((e,i)=>{const a=amount(e.score),b=amount(e.max),el=root.querySelector(`[data-knowledge-result="${i}"]`);
  const wrong=(a!==null&&a<0)||(b!==null&&b<=0);
  const val=!wrong&&a!==null&&b!==null&&b>0?a/b*100:null;
  if(el){el.textContent=wrong?'Помилка':pctLabel(val);el.title=wrong?'Бал повинен бути невід’ємним, а максимальний бал — більшим за нуль':'';annualStatus(el,wrong?-1:val)}
 });
 const months=MN.map((_,i)=>y.months[p2(i+1)]);
 const values=months.map(x=>positiveRate(x.overall)).filter(x=>x!==null);
 const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
 set('#kpi-annual-avg',pctLabel(avg));annualStatus(root.querySelector('#kpi-annual-avg'),avg);
 set('#kpi-annual-stats',`${values.filter(x=>x>=100).length} із ${values.length} заповнених місяців ≥ 100%`);
 months.forEach((record,i)=>{
  const month=p2(i+1),val=positiveRate(record.overall),part=kpiRollup(record.items);
  const result=root.querySelector(`[data-kpi-month-result="${month}"]`),input=root.querySelector(`#kpi-overall-${month}`);
  annualStatus(result,val);
  annualStatus(input,val);
  const card=root.querySelector(`[data-month-card="${month}"]`);if(card)card.classList.toggle('has-overall',val!==null);
  const a=root.querySelector(`[data-kpi-parts-avg="${month}"]`);if(a){a.textContent=pctLabel(part.average);annualStatus(a,part.average)}
  record.items.forEach((e,j)=>{const field=root.querySelector(`[data-year-kind="kpi-part"][data-month="${month}"][data-index="${j}"][data-field="percent"]`);annualStatus(field,positiveRate(e.percent))});
 });
}
function refreshAnnualPanel(){const panel=$('#yv .annual-panels');if(panel){panel.outerHTML=annualEditor();updateAnnualNumbers()}}
$('#yv')?.addEventListener('input',e=>{
 const t=e.target;if(view!=='year')return;const y=yearMetrics(),kind=t.dataset.yearKind,month=t.dataset.month;
 if(kind==='kpi-overall'&&y.months[month])y.months[month].overall=t.value;
 else if(kind==='knowledge'){
  const r=y.knowledge[+t.dataset.index];if(!r||!['month','score','max'].includes(t.dataset.field))return;r[t.dataset.field]=t.value;
 }else if(kind==='kpi-part'){
  const r=y.months[month]?.items[+t.dataset.index];if(!r||!['name','percent'].includes(t.dataset.field))return;r[t.dataset.field]=t.value;
 }else return;
 updateAnnualNumbers();save();
});

function applyView(){
 document.querySelectorAll('.sv').forEach(e=>e.classList.toggle('h',view==='year'));
 yv.classList.toggle('h',view!=='year');
 if(view==='year')yearRender();else{refresh();detail()}
}

function collectYear(){
 const entries=new Map(),yearText=String(yr);
 const selection=yearSource==='all'?S.sheets.map((sh,si)=>({sh,si})):
   S.sheets[+yearSource]?[{sh:S.sheets[+yearSource],si:+yearSource}]:[];
 selection.forEach(({sh,si})=>sh.days.forEach((d,i)=>{
  const dt=add(sh.start,i);
  if(dt.slice(0,4)!==yearText)return;
  let item=entries.get(dt);
  if(!item){item={date:dt,calls:0,goal:0,covered:true,off:true,entries:0,source:null};entries.set(dt,item)}
  item.entries++;
  item.calls+=dcs(sh,d);
  item.off=item.off&&!!d.off;
  if(!d.off&&workday(dt))item.goal+=(+sh.cfg.weekly||50)/5;
  if(!item.source||(!d.off&&item.source.off))item.source={si,i,off:!!d.off};
 }));
 const days=[];
 for(let dt=yearText+'-01-01';dt<=yearText+'-12-31';dt=add(dt,1)){
  days.push(entries.get(dt)||{date:dt,calls:0,goal:0,covered:false,off:false,entries:0,source:null});
 }
 return{days,byDate:new Map(days.map(d=>[d.date,d])),overlaps:days.filter(d=>d.entries>1).length};
}
function dayKind(d,today){
 if(!d.covered)return 'empty';
 if(d.off)return 'off';
 const src=d.source,sh=src&&S.sheets[src.si],day=sh&&sh.days[src.i];
 // Точно той самий колір, що у відповідного дня обраного місячного аркуша.
 if(sh&&day){
  const color=sheetDayLevel(sh,day,d.date,today);
  if(color)return color;
  if(d.date>today)return 'future';
  if(d.date===today)return 'pending';
  return 'empty';
 }
 return 'empty';
}
function periodStats(days,start,end,today,fullWeeklyGoal=false){
 const inPeriod=days.filter(d=>d.date>=start&&d.date<=end&&d.covered);
 const covered=inPeriod.filter(d=>d.date<=today),calls=covered.reduce((a,d)=>a+d.calls,0);
 // У тижневому графіку ціль охоплює весь запланований тиждень,
 // включно з майбутніми буднями, але без OFF. Для місяця — лише минулі дні.
 const scheduled=fullWeeklyGoal?inPeriod:covered;
 const goal=scheduled.reduce((a,d)=>a+d.goal,0);
 const lastWork=scheduled.filter(d=>d.goal>0).at(-1)?.date||'';
 return {calls,goal,coverage:covered.length,rate:goal>0?calls/goal:null,
  done:goal>0&&(lastWork<today||calls>=goal),last:lastWork};
}
function yearHeatmap(data,today){
 const first=mon(yr+'-01-01'),last=mon(yr+'-12-31'),weeks=[];
 for(let w=first;w<=last;w=add(w,7))weeks.push(w);
 const cols=`grid-template-columns:34px repeat(${weeks.length},19px)`;
 let mLabels=`<div class="year-month-row" style="${cols}">`;
 MN.forEach((m,mi)=>{
  const w=mon(yr+'-'+p2(mi+1)+'-01'),index=weeks.indexOf(w);
  if(index>=0)mLabels+=`<span style="grid-column:${index+2}/span 4">${esc(m.slice(0,3))}</span>`;
 });
 mLabels+='</div>';
 let cells=`<div class="year-grid" style="${cols}">`;
 YWD.forEach((x,i)=>{cells+=`<span class="day-label" style="grid-row:${i+1}">${x}</span>`});
 weeks.forEach((w,i)=>{for(let wd=0;wd<5;wd++){
  const dt=add(w,wd),d=data.byDate.get(dt);
  if(!d){cells+=`<span class="year-cell outside" style="grid-column:${i+2};grid-row:${wd+1}"></span>`;continue}
  const kind=dayKind(d,today);
  const pct=d.goal>0?Math.round(d.calls/d.goal*100)+'%':'без плану';
  const detail=fmt(dt,{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' | дзвінків: '+d.calls+' | ціль: '+(+d.goal.toFixed(1))+' | '+pct+(d.off?' | OFF':'')+(d.entries>1?' | аркушів: '+d.entries:'');
  const canOpen=!!d.source;
  const text=d.calls?String(d.calls):'';
  cells+=`<button type="button" class="year-cell ${kind}${dt===today?' today':''}${canOpen?' active-year':''}" style="grid-column:${i+2};grid-row:${wd+1}" ${canOpen?`data-ys="${d.source.si}|${d.source.i}"`:'disabled'} title="${esc(detail)}" aria-label="${esc(detail)}">${d.calls?esc(text):''}</button>`;
 }});
 return `<div class="year-map-scroll" tabindex="0" aria-label="Теплова карта за ${yr}">${mLabels+cells+'</div></div>'}`;
}
function yearGraph(id,items,metric,withTrend){
 const el=$(id);if(!el)return;
 const W=Math.max(withTrend?1040:620,el.clientWidth||820),H=235,L=39,R=12,T=16,B=42;
 const h=H-T-B,n=items.length,bw=(W-L-R)/n;
 const value=x=>metric==='calls'?x.calls:(x.rate===null?0:x.rate*100);
 const goal=x=>metric==='calls'?x.goal:100;
 const maxRaw=Math.max(10,...items.map(x=>Math.max(value(x),x.goal>0?goal(x):0)));
 const scale=metric==='calls'?10:25;
 const maxY=Math.max(scale,Math.ceil(maxRaw*1.12/scale)*scale);
 const y=v=>T+h*(1-v/maxY);
 const yAxis=v=>metric==='calls'?String(Math.round(v)):Math.round(v)+'%';
 let html=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${metric==='calls'?'Дзвінки':'Виконання плану'} за ${yr}" font-size="11" fill="currentColor">`;
 for(let k=0;k<=4;k++){
  const val=k*maxY/4;
  html+=`<line x1="${L}" x2="${W-R}" y1="${y(val)}" y2="${y(val)}" stroke="var(--line)"/><text x="${L-5}" y="${y(val)+4}" text-anchor="end" fill="var(--mut)">${yAxis(val)}</text>`;
 }
 if(metric==='rate')html+=`<line x1="${L}" x2="${W-R}" y1="${y(100)}" y2="${y(100)}" stroke="var(--fg)" opacity=".55" stroke-dasharray="5 4"/>`;
 const trend=[];
 items.forEach((x,i)=>{
  const bX=L+i*bw+bw*.17,w=bw*.66,v=value(x);
  const vH=Math.max(0,h*Math.max(0,v)/maxY);
  const color=x.goal>0&&x.done?COL[lv0(x.calls/x.goal)]:'var(--acc)';
  const info=x.label+' | дзвінків: '+x.calls+' | ціль: '+(+x.goal.toFixed(1))+' | '+(x.rate===null?'немає цілі':Math.round(x.rate*100)+'%');
  html+=`<rect x="${bX}" y="${y(v)}" width="${w}" height="${vH}" rx="${Math.min(4,w/4)}" fill="${color}" opacity="${x.coverage?1:.15}"><title>${esc(info)}</title></rect>`;
  if(metric==='calls'&&x.goal>0)html+=`<line x1="${bX-1}" x2="${bX+w+1}" y1="${y(x.goal)}" y2="${y(x.goal)}" stroke="var(--fg)" stroke-dasharray="3 2" opacity=".65"/>`;
  const labelStep=withTrend?Math.max(1,Math.ceil(46/Math.max(1,bw))):1;
  if(i%labelStep===0)html+=`<text x="${bX+w/2}" y="${H-17}" text-anchor="middle" fill="var(--mut)">${esc(x.label)}</text>`;
  if(!withTrend&&x.coverage)html+=`<text x="${bX+w/2}" y="${Math.max(T+9,y(v)-6)}" text-anchor="middle" font-size="10">${metric==='calls'?x.calls:Math.round(v)+'%'}</text>`;
  if(withTrend&&x.coverage&&x.goal>0){
   const set=items.slice(Math.max(0,i-4),i+1).filter(q=>q.coverage&&q.goal>0);
   if(set.length)trend.push([bX+w/2,y(set.reduce((a,q)=>a+value(q),0)/set.length)]);
  }
 });
 if(withTrend&&trend.length>1)html+=`<polyline points="${trend.map(p=>p.join(',')).join(' ')}" stroke="#38bdf8" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
 html+='</svg>';el.innerHTML=html;
}
/* ---------- Спільна аналітика днів тижня: поточний аркуш / рік ---------- */
const WEEKDAY_NAMES=['Понеділок','Вівторок','Середа','Четвер','П’ятниця'];
function weekdayGroups(entries,today=iso(new Date())){
 const groups=WEEKDAY_NAMES.map((name,index)=>({name,index,calls:0,days:0,goal:0,hits:0}));
 let partialToday=false,excludedOff=0;
 for(const d of entries){
  if(!d.covered||d.date>today)continue;
  const wd=(pd(d.date).getDay()+6)%7;
  if(wd>=5)continue; // вихідні не показуються у статистиці днів тижня
  const g=groups[wd];
  if(d.off){excludedOff++;continue}
  // У незавершений сьогоднішній день включаємо тільки записані дзвінки.
  // Незаповнений сьогодні день не знижує середнє до завершення доби.
  if(d.date===today&&d.calls<=0)continue;
  if(!(d.goal>0))continue;
  g.days++;g.calls+=d.calls;g.goal+=d.goal;
  if(d.calls>=d.goal)g.hits++;
  if(d.date===today)partialToday=true;
 }
 for(const g of groups){
  g.avg=g.days?g.calls/g.days:null;
  g.rate=g.goal>0?g.calls/g.goal:null;
 }
 return {groups,partialToday,excludedOff};
}
function weekdayAnalytics(entries,place='month'){
 const {groups,partialToday,excludedOff}=weekdayGroups(entries),workers=groups;
 const metric=weekdayMetric==='rate'?'rate':'avg',isRate=metric==='rate';
 const value=g=>isRate?g.rate:g.avg;
 const eligible=workers.filter(g=>g.days&&value(g)!==null);
 const bestValue=eligible.length?Math.max(...eligible.map(value)):null;
 // Якщо немає жодного дзвінка, нульовий результат не визначає лідера.
 const winners=bestValue!==null&&bestValue>0?eligible.filter(g=>Math.abs(value(g)-bestValue)<1e-9):[];
 const max=Math.max(1,...workers.map(g=>value(g)||0));
 const title='Ефективність за днями тижня';
 let h=`<div class="weekday-top"><div><h3>${title}</h3><div class="mut">${place==='year'?'Обраний рік та аркуші':'Поточний аркуш'} · порівняння понеділка–п’ятниці</div></div><div class="pills" role="group" aria-label="Метрика ефективності за днями тижня"><button type="button" data-a="wdmetric" data-metric="avg" class="${!isRate?'on':''}">Середні дзвінки</button><button type="button" data-a="wdmetric" data-metric="rate" class="${isRate?'on':''}">% плану</button></div></div>`;
 if(winners.length){
  const names=winners.map(g=>g.name).join(', ');
  h+=`<div class="weekday-leader"><small>${winners.length>1?'Найуспішніші дні':'Найуспішніший день'}</small><strong>${esc(names)}</strong><span class="mut">${isRate?Math.round(bestValue*100)+'% плану':num(bestValue)+' дзвінків у середньому'}</span></div>`;
 }else h+=`<div class="weekday-leader"><small>Найуспішніший день</small><strong>Поки немає результатів</strong><span class="mut">Потрібні дзвінки хоча б за один робочий день.</span></div>`;
 if(!eligible.length){
  h+='<div class="weekday-empty">Для цієї вкладки ще немає завершених робочих днів з планом.</div>';
 }else{
  h+='<div class="weekday-grid">';
  workers.forEach(g=>{
   const selected=winners.includes(g),pct=value(g)!==null?Math.max(0,Math.min(100,value(g)/max*100)):0;
   const display=isRate?(g.rate===null?'—':Math.round(g.rate*100)+'%'):(g.avg===null?'—':num(g.avg));
   const desc=`${g.days} ${g.days===1?'роб. день':g.days<5&&g.days>1?'роб. дні':'роб. днів'}`;
   h+=`<div class="weekday-row${selected?' best':''}" title="${esc(g.name)}: ${g.calls} дзвінків, ${g.days} днів, план ${num(g.goal)}, виконання ${g.rate===null?'—':Math.round(g.rate*100)+'%'}">`+
    `<div class="weekday-day">${esc(g.name)}${selected?'<em>№ 1</em>':''}</div>`+
    `<div class="weekday-track"><div class="weekday-fill" style="width:${pct.toFixed(2)}%"></div></div>`+
    `<div class="weekday-num">${display}</div>`+
    `<div class="weekday-detail">${g.calls} всього<br>${desc}</div>`+
    `</div>`;
  });
  h+='</div>';
 }
 h+=`<div class="weekday-foot">Лідер визначається ${isRate?'за відсотком виконання плану':'за середньою кількістю дзвінків на робочий день'}. Будні без дзвінків у минулому враховуються як 0; OFF-дні (${excludedOff}) та майбутні дати виключені. ${partialToday?'Сьогоднішній результат попередній. ':''}Субота та неділя не відображаються.</div>`;
 return h;
}
function monthWeekdays(){
 const box=$('#weekday-monthly');if(!box)return;
 const sh=cur();
 const entries=sh.days.map((d,i)=>{
  const date=add(sh.start,i);
  return {date,covered:true,calls:dcs(sh,d),off:!!d.off,goal:!d.off&&isWorkday(date)?dailyGoal(sh):0};
 });
 box.innerHTML=weekdayAnalytics(entries,'month');
}
function yearRender(){
 if(yearSource!=='all'&&!S.sheets[+yearSource])yearSource='all';
 const today=iso(new Date()),records=collectYear(),days=records.days;
 const elapsed=days.filter(d=>d.covered&&d.date<=today),actual=elapsed.reduce((a,d)=>a+d.calls,0);
 const allCalls=actual; // Підсумок узгоджений із графіками: лише дати до сьогодні.
 const completedDays=elapsed.filter(d=>d.goal>0&&(d.date<today||d.calls>=d.goal));
 const hitDays=completedDays.filter(d=>d.calls>=d.goal);
 const activeWorkdays=elapsed.filter(d=>d.goal>0);
 const dailyCalls=elapsed.filter(d=>d.goal>0).reduce((a,d)=>a+d.calls,0);
 const goal=activeWorkdays.reduce((a,d)=>a+d.goal,0);
 const first=mon(yr+'-01-01'),last=mon(yr+'-12-31');
 const Wk=[];
 for(let w=first;w<=last;w=add(w,7)){
  const e=add(w,6),x=periodStats(days,w,e,today,true);
  Wk.push({...x,label:fmt(w,{day:'numeric',month:'short'}),start:w,end:e});
 }
 const Mo=MN.map((m,mi)=>{
  const a=yr+'-'+p2(mi+1)+'-01',b=iso(new Date(yr,mi+1,0,12));
  return {...periodStats(days,a,b,today),label:m.slice(0,3),name:m,start:a,end:b};
 });
 const evalW=Wk.filter(w=>w.done),hits=evalW.filter(w=>w.calls>=w.goal);
 const wkWithData=Wk.filter(w=>w.goal>0),best=Mo.reduce((a,b)=>b.calls>a.calls?b:a,Mo[0]);
 const kpi=(name,value,note='')=>`<div class="stat"><small>${esc(name)}</small><b>${esc(value)}</b>${note?` <span class="mut">${esc(note)}</span>`:''}</div>`;
 const opts=`<option value="all">Усі аркуші</option>`+S.sheets.map((sh,i)=>`<option value="${i}" ${String(i)===yearSource?'selected':''}>${esc(sh.name)}</option>`).join('');
 let html=`<div class="year-head"><div class="year-controls"><button data-a="yp" aria-label="Попередній рік">←</button><h2>${yr} · Річна статистика</h2><button data-a="yn" aria-label="Наступний рік">→</button></div><div class="year-controls"><label>Дані з <select id="year-source">${opts}</select></label></div></div>`;
 html+=`<div class="stats year-stats">`+
  kpi('Всього дзвінків',allCalls)+
  kpi('Середнє за робочий день',activeWorkdays.length?(dailyCalls/activeWorkdays.length).toFixed(1):'—')+
  kpi('Виконання плану',goal>0?Math.round(actual/goal*100)+'%':'—')+
  kpi('Дні в плані',hitDays.length+'/'+completedDays.length)+
  kpi('Тижні в плані',hits.length+'/'+evalW.length)+
  kpi('Найкращий місяць',best.calls?best.calls:'—',best.calls?best.name:'')+'</div>';
 html+=`<div class="card"><h3 class="year-section-title">Карта активності за ${yr} рік</h3><div class="mut">Кожна клітинка — робочий день (понеділок–п’ятниця). Колір збігається з відповідним днем місячного аркуша; натисніть на день для переходу до записів.</div>`;
 html+=yearHeatmap(records,today);
 html+=`<div class="year-leg"><span><i class="year-key ok"></i>100% і більше</span><span><i class="year-key mid"></i>70–99%</span><span><i class="year-key low"></i>40–69%</span><span><i class="year-key bad"></i>0–39%</span><span><i class="year-key off"></i>OFF</span><span><i class="year-key"></i>Немає аркуша / майбутній день</span></div>`;
 if(records.overlaps)html+=`<p class="year-note warning">Увага: ${records.overlaps} ${records.overlaps%10===1&&records.overlaps%100!==11?'день':records.overlaps%10>=2&&records.overlaps%10<=4&&(records.overlaps%100<12||records.overlaps%100>14)?'дні':'днів'} містять дані з кількох аркушів. Для таких дат їхні дзвінки та цілі підсумовуються в KPI, а колір клітинки відповідає аркушу, що відкривається при натисканні. Фільтр «Дані з» дозволяє переглянути кожен аркуш окремо.</p>`;
 else html+=`<p class="year-note">Сьогоднішній незавершений день не позначається червоним. План кожного тижня зменшується на денну норму за кожен OFF у будній день; майбутні записи не входять до підсумків.</p>`;
 html+='</div>';
 html+=`<div class="card"><div class="year-graph-head"><div><h3 class="year-section-title">Динаміка показників</h3><div class="mut">Порівняння за тижнями та місяцями</div></div><div class="pills"><button data-a="ymetric" data-metric="calls" class="${yearMetric==='calls'?'on':''}">Дзвінки</button><button data-a="ymetric" data-metric="rate" class="${yearMetric==='rate'?'on':''}">% плану</button></div></div><b>За тижнями</b><div class="year-graph-scroll"><div id="yc1"></div></div><div class="year-graph-meta"><span>Стовпчики — показник за тиждень</span><span>Блакитна лінія — середнє за 5 активних тижнів</span><span>${yearMetric==='calls'?'Риски — план тижня':'Пунктир — 100% плану'}</span></div></div>`;
 html+=`<div class="card"><h3 class="year-section-title">За місяцями</h3><div class="year-graph-scroll"><div id="yc2"></div></div></div>`;
 html+=`<div class="card weekday-card" id="weekday-year">${weekdayAnalytics(days,'year')}</div>`;
 html+=annualEditor();
 html+=`<div class="card"><h3 class="year-section-title">Підсумки за місяцями</h3><div class="year-month-summary">`;
 Mo.forEach(m=>{html+=`<div class="year-month-item"><small>${esc(m.name)}</small><b>${m.calls}</b><em>дзвінків</em><div class="mut">${m.goal>0?Math.round(m.rate*100)+'% плану':'Немає плану'}</div><div class="mini-progress"><span style="width:${m.rate===null?0:Math.min(100,Math.max(0,m.rate*100))}%;background:${m.done?COL[lv0(m.rate)]:'var(--acc)'}"></span></div></div>`});
 html+=`</div></div>`;
 if(!elapsed.length)html+=`<div class="year-note">Для обраного року ще немає внесених або минулих днів у жодному аркуші. Дані з'являться автоматично, коли буде додано аркуш із відповідними датами.</div>`;
 yv.innerHTML=html;
 yearGraph('#yc1',Wk,yearMetric,true);
 yearGraph('#yc2',Mo,yearMetric,false);
 updateAnnualNumbers();
}
document.addEventListener('change',e=>{
 if(e.target.id==='year-source'){yearSource=e.target.value;yearRender()}
});
load();pickToday();renderAll();flush();

// Synchronize quick popup and full dashboard without replacing uncommitted edits.
window.dailyReceiveExternal = snapshot => {
 try {
  if (!snapshot || !Array.isArray(snapshot.sheets) || !snapshot.sheets.length) return;
  if (JSON.stringify(snapshot)===JSON.stringify(S)) return;
  clearTimeout(tm);
  S=snapshot;
  if(!Array.isArray(S.trash)) S.trash=[];
  if(!S.yearData||typeof S.yearData!=='object') S.yearData={};
  if(!S.sheets[S.cur]) S.cur=0;
  pickToday();renderAll();st('Оновлено з іншого вікна');
 } catch(err) { console.error('Storage refresh failed',err); }
};
