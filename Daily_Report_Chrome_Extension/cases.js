/* Shared case fields and Monday–Sunday clipboard report. */
(function(root){
 'use strict';
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeURL=value=>{try{const u=new URL(String(value||'').trim());return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
 function fields(item){
  if(Object.hasOwn(item,'id'))return {id:item.id||'',l:item.l||''};
  const old=String(item.l||'');return safeURL(old)?{id:'',l:old}:{id:old,l:''};
 }
 function normalize(item){Object.assign(item,fields(item));return item}
 const date=s=>new Date(s+'T12:00:00');
 const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const add=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return iso(d)};
 function report(state,selected){
  const start=add(selected,-((date(selected).getDay()+6)%7)),end=add(start,6),entries=[];
  for(const sh of state?.sheets||[]) (sh.days||[]).forEach((day,i)=>{
   const dt=add(sh.start,i);if(dt<start||dt>end)return;
   for(const [name,items] of Object.entries(day.items||{})){
    if(name.trim().toUpperCase()!=='КРІТИ'||!Array.isArray(items))continue;
    for(const item of items){const f=fields(item);if(f.id||f.l||item.d||item.b)entries.push({dt,item,...f})}
   }
  });
  entries.sort((a,b)=>a.dt.localeCompare(b.dt));
  const title=`Кріти · ${start} — ${end}`;
  const plain=entries.map(e=>{const label=e.id||e.l||'Без ID';return `${e.dt} · ${e.item.b?e.item.b+' · ':''}${label}${e.id&&e.l?' ('+e.l+')':''}${e.item.d?' — '+e.item.d:''}`});
  const html=entries.map(e=>{const url=safeURL(e.l),label=escape(e.id||e.l||'Без ID');return `<li>${escape(e.dt)} · ${e.item.b?escape(e.item.b)+' · ':''}${url?`<a href="${escape(url)}">${label}</a>`:label}${e.item.d?' — '+escape(e.item.d):''}</li>`});
  return {count:entries.length,text:title+'\n'+plain.join('\n'),html:`<h3>${escape(title)}</h3><ul>${html.join('')}</ul>`};
 }
 async function copy(state,selected){
  const r=report(state,selected);
  if(!r.count)throw Error('За цей тиждень крітів немає');
  if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('Браузер не підтримує копіювання з гіперпосиланнями');
  await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([r.text],{type:'text/plain'}),'text/html':new Blob([r.html],{type:'text/html'})})]);
  return r.count;
 }
 const api={fields,normalize,safeURL,report,copy};root.Cases=api;
 if(typeof module!=='undefined')module.exports=api;
})(globalThis);
