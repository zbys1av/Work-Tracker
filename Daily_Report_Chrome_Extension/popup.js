"use strict";
const KEY='daily_report_v2';
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const asDate=s=>new Date(s+'T12:00:00');
const advance=(s,d)=>{const x=asDate(s);x.setDate(x.getDate()+d);return iso(x)};
let state=null,busy=false,sectionType='crit',activeIndex=-1;
const today=iso(new Date());
const SECTIONS={crit:'КРІТИ',hard:'СКЛАДНІ ЛЮДИ'};
const getDay=(s,dt)=>{const index=Math.round((asDate(dt)-asDate(s.start))/86400000);return index>=0&&index<s.days.length?{index,day:s.days[index]}:null};
const calls=(s,d)=>d.off?0:(d.calls||[]).slice(0,s.cfg?.ticks||21).filter(Boolean).length+(Number(d.adj)||0);
const workday=dt=>{const w=asDate(dt).getDay();return w>=1&&w<=5};
const weekly=(s,dt)=>{const start=asDate(dt);start.setDate(start.getDate()-((start.getDay()+6)%7));let count=0,goal=0;for(let k=0;k<7;k++){const date=iso(new Date(start.getFullYear(),start.getMonth(),start.getDate()+k));const found=getDay(s,date);if(!found)continue;count+=calls(s,found.day);if(k<5&&!found.day.off)goal+=(Number(s.cfg?.weekly)||50)/5;}return {count,goal}};
const format=n=>Number(n.toFixed(2)).toLocaleString('uk-UA',{maximumFractionDigits:2});
const findSheet=(s)=>{
 if(!s?.sheets?.length)return -1;
 if(Number.isInteger(s.cur)&&s.sheets[s.cur]&&getDay(s.sheets[s.cur],today))return s.cur;
 // Якщо вибраний у повному звіті аркуш не охоплює сьогодні, використовуємо останній відповідний.
 for(let i=s.sheets.length-1;i>=0;i--)if(getDay(s.sheets[i],today))return i;
 return -1;
};
const active=()=>activeIndex<0?null:state?.sheets?.[activeIndex]||null;
const actualSection=(sheet,type)=>{
 const label=SECTIONS[type];
 return (sheet?.cfg?.sections||[]).find(s=>String(s).trim().toUpperCase()===label)||null;
};
const listItems=(day,name)=>Array.isArray(day?.items?.[name])?day.items[name]:[];
function updateCategoryButtons(){
 for(const type of ['crit','hard']){
  const btn=$('#tab-'+type),selected=type===sectionType;
  btn.classList.toggle('active',selected);btn.setAttribute('aria-selected',String(selected));
 }
}
function renderPeople(){
 const sh=active(),d=sh&&getDay(sh,today)?.day;
 const selections={crit:actualSection(sh,'crit'),hard:actualSection(sh,'hard')};
 for(const type of ['crit','hard'])$('#'+type+'-count').textContent=d&&selections[type]?listItems(d,selections[type]).length:0;
 const options=sh?.cfg?.brands||[];
 const select=$('#brand'),previous=select.value;
 select.replaceChildren(new Option('Без бренду',''),...options.map(x=>new Option(x,x)));
 select.value=options.includes(previous)?previous:'';
 updateCategoryButtons();
 const section=selections[sectionType],items=d&&section?listItems(d,section):[];
 const possible=!!d&&!!section;
 $('#add-person').disabled=!possible||busy;
 $('#person-id').disabled=$('#person-link').disabled=$('#person-note').disabled=$('#brand').disabled=!possible||busy;
 $('#people-list-count').textContent=items.length?`${items.length} записів`:'';
 const box=$('#people-list');box.replaceChildren();
 if(!possible){const e=document.createElement('div');e.className='empty';e.textContent=!sh?'Немає аркуша для сьогоднішньої дати.':!d?'Для сьогодні немає дня в аркуші.':'Цей розділ не додано в налаштуваннях аркуша.';box.append(e);return;}
 if(!items.length){const e=document.createElement('div');e.className='empty';e.textContent='Поки записів немає.';box.append(e);return;}
 items.slice(-3).reverse().forEach((item,j)=>{
  const index=items.length-1-j;
  const row=document.createElement('div');row.className='person-entry';
  const info=document.createElement('div');info.className='person-entry-info';
  const title=document.createElement('div');title.className='person-entry-title';title.textContent=[item.b,Cases.fields(item).id,Cases.fields(item).l].filter(Boolean).join(' · ')||'Запис без ID';
  const description=document.createElement('div');description.className='person-entry-description';description.textContent=item.d||'Без опису';
  info.append(title,description);
  const del=document.createElement('button');del.type='button';del.dataset.remove=String(index);del.textContent='×';del.setAttribute('aria-label','Видалити запис');del.title='Видалити цей запис';
  row.append(info,del);box.append(row);
 });
 if(items.length>3){const more=document.createElement('div');more.className='more-records';more.textContent=`Ще ${items.length-3} — у повному звіті`;box.append(more);}
}
function render(){
 $('#date').textContent=new Date().toLocaleDateString('uk-UA',{day:'numeric',month:'long',weekday:'long'});
 const sh=active();
 if(!sh){
  $('#sheet-name').textContent='Немає аркуша на сьогодні';$('#count').textContent='—';$('#goal').innerHTML='/ —<span>ціль на день</span>';
  $('#status').textContent='Створіть аркуш із сьогоднішньою датою в повному звіті.';
  $('#progress').style.width='0%';$('#minus').disabled=$('#plus').disabled=true;
  $('#week-total').textContent=$('#week-goal').textContent=$('#week-rate').textContent='—';renderPeople();return;
 }
 const target=getDay(sh,today),goal=(Number(sh.cfg?.weekly)||50)/5;
 const v=target?calls(sh,target.day):0,off=!!target?.day.off,week=weekly(sh,today),weekday=workday(today);
 $('#sheet-name').textContent=sh.name;
 $('#count').textContent=target?v:'—';$('#goal').innerHTML=`/ ${format(goal)}<span>ціль на день</span>`;
 $('#status').textContent=off?'Сьогодні OFF — дзвінки не враховуються':!weekday?'Вихідний — без денного плану':`Виконано ${Math.round(v/goal*100)}% денної цілі`;
 $('#progress').style.width=`${!off&&weekday?Math.min(100,Math.max(0,v/goal*100)):0}%`;
 $('#progress').style.background=v>=goal?'var(--ok)':v>=goal*.7?'#eab308':v>=goal*.4?'#f97316':'var(--bad)';
 $('#week-total').textContent=week.count;$('#week-goal').textContent=format(week.goal);$('#week-rate').textContent=week.goal?Math.round(100*week.count/week.goal)+'%':'—';
 $('#minus').disabled=off||busy||(!target.day.adj&&!target.day.calls?.some(Boolean));$('#plus').disabled=off||busy;
 renderPeople();
}
function initState(){activeIndex=findSheet(state);render()}
async function updateDay(fn,successMessage){
 if(busy)return;
 busy=true;render();
 try{
  // Завжди беремо свіжі дані, щоб зміни іншої частини розширення не губилися.
  const result=await chrome.storage.local.get(KEY);
  if(!result[KEY]?.sheets?.length)throw Error('Не знайдено аркушів');
  const snapshot=result[KEY],idx=findSheet(snapshot),sh=snapshot.sheets[idx],found=sh&&getDay(sh,today);
  if(!found)throw Error('Для сьогодні не створено аркуш');
  await fn(sh,found.day);
  await chrome.storage.local.set({[KEY]:snapshot});
  state=snapshot;$('#save-status').textContent=successMessage;
 }catch(err){$('#save-status').textContent='Помилка: '+err.message;}
 finally{busy=false;initState()}
}
async function adjust(delta){
 await updateDay((sh,d)=>{
  if(d.off)throw Error('Цей день позначено OFF');
  const ticks=Number(sh.cfg?.ticks)||21;
  if(!Array.isArray(d.calls))d.calls=[];
  if(delta>0){const empty=Array.from({length:ticks},(_,i)=>i).find(i=>!d.calls[i]);if(empty!==undefined)d.calls[empty]=true;else d.adj=(Number(d.adj)||0)+1;}
  else if(Number(d.adj)>0)d.adj--;
  else for(let i=ticks-1;i>=0;i--)if(d.calls[i]){d.calls[i]=false;break;}
 },'Дзвінки збережено');
}
async function submitPerson(){
 const id=$('#person-id').value.trim(),brand=$('#brand').value,l=$('#person-link').value.trim(),d=$('#person-note').value.trim(),type=sectionType;
 if(!id&&!l&&!d){$('#save-status').textContent='Вкажіть ID, посилання або опис.';$('#person-link').focus();return;}
 await updateDay((sh,day)=>{
  const section=actualSection(sh,type);
  if(!section)throw Error('Розділ відсутній в аркуші');
  if(!day.items||typeof day.items!=='object')day.items={};
  if(!Array.isArray(day.items[section]))day.items[section]=[];
  day.items[section].push({b:brand,id,l,d});
 },'Запис додано');
 // Очищаємо поля лише за успішного запису.
 if($('#save-status').textContent==='Запис додано'){$('#person-id').value='';$('#person-link').value='';$('#person-note').value='';$('#person-link').focus();}
}
async function removePerson(index){
 const type=sectionType;
 if(!confirm('Видалити цей запис?'))return;
 await updateDay((sh,day)=>{
  const section=actualSection(sh,type),items=section&&day.items?.[section];
  if(!items||!items[index])throw Error('Запис не знайдено');
  items.splice(index,1);
 },'Запис видалено');
}
function expand(){
 $('#expanded-view').hidden=false;
 document.body.classList.add('is-expanded');
 if(!$('#dashboard-frame').getAttribute('src'))$('#dashboard-frame').src=chrome.runtime.getURL('dashboard.html');
}
function collapse(){
 $('#dashboard-frame').removeAttribute('src'); // Закриваємо повний інтерфейс, щоб його таймери не працювали в фоні popup.
 $('#expanded-view').hidden=true;
 document.body.classList.remove('is-expanded');
 // Повний звіт міг змінити дані. Вони вже потрапляють у спільне сховище.
 chrome.storage.local.get(KEY).then(r=>{state=r[KEY]||null;initState()}).catch(()=>{});
}
function openTab(){chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')}).catch(e=>{$('#save-status').textContent=e.message})}
$('#plus').addEventListener('click',()=>adjust(1));$('#minus').addEventListener('click',()=>adjust(-1));
$('#expand').addEventListener('click',expand);$('#collapse').addEventListener('click',collapse);
$('#dashboard-link').addEventListener('click',openTab);$('#open-tab').addEventListener('click',openTab);
for(const button of document.querySelectorAll('[data-section]'))button.addEventListener('click',()=>{sectionType=button.dataset.section;renderPeople()});
$('#people-form').addEventListener('submit',e=>{e.preventDefault();submitPerson()});
$('#people-list').addEventListener('click',e=>{const btn=e.target.closest('[data-remove]');if(btn)removePerson(Number(btn.dataset.remove))});
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area==='local'&&changes[KEY]?.newValue&&!busy){state=changes[KEY].newValue;initState();}
});
(async()=>{
 try{const result=await chrome.storage.local.get(KEY);state=result[KEY]||null;initState();}
 catch(err){$('#status').textContent='Помилка сховища: '+err.message;$('#minus').disabled=$('#plus').disabled=true;}
})();

$('#copy-crits').addEventListener('click',async()=>{try{const n=await Cases.copy(state,iso(new Date()));$('#save-status').textContent=`Скопійовано крітів: ${n}`}catch(e){$('#save-status').textContent='Не скопійовано: '+e.message}});
