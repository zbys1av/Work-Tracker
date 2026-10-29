(function(){
 const panel=document.querySelector('#drive-backup');if(!panel)return;
 const input=panel.querySelector('input'),status=panel.querySelector('[data-backup-status]');
 let pending=false;
 const serviceHint='Фонова служба недоступна. На сторінці розширень перезавантажте Daily Report, підтвердьте дозвіл на завантаження та заново відкрийте звіт.';
 const read=async()=> (await chrome.storage.local.get(DailyBackup.KEY))[DailyBackup.KEY]||{};
 const send=async message=>{
  let result;
  try{result=await chrome.runtime.sendMessage(message)}catch{
   const error=Error(serviceHint);error.serviceUnavailable=true;throw error;
  }
  if(!result?.ok)throw Error(result?.error||serviceHint);return result.data;
 };
 async function saveFolder(){
  const url=DailyBackup.folder(input.value);
  try{return await send({type:'backup-save-folder',url})}
  catch(error){
   if(!error.serviceUnavailable)throw error;
   // Settings remain usable even if a manifest update has not activated the worker.
   const settings=await read();settings.folder=url;
   await chrome.storage.local.set({[DailyBackup.KEY]:settings});return settings;
  }
 }
 function render(s){
  pending=!!s.pending;
  if(document.activeElement!==input)input.value=s.folder||'';
  panel.querySelector('[data-backup-local]').textContent=s.lastLocal?`Локальна копія: ${s.lastLocal.filename} · ${new Date(s.lastLocal.completedAt).toLocaleString('uk-UA')}`:'Локальну копію ще не створено.';
  panel.querySelector('[data-backup-drive]').textContent='Google Drive: '+(s.driveStatus||'Завантаження не підтверджено.');
  status.textContent=s.error||(s.pending?'Завантаження JSON на комп’ютер…':'');
  panel.querySelector('[data-backup-start]').disabled=!!s.pending;
 }
 panel.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  b.disabled=true;
  try{
   if(b.hasAttribute('data-backup-save')){render(await saveFolder());status.textContent='Папку збережено.'}
   if(b.hasAttribute('data-backup-open')){const settings=await read();await chrome.tabs.create({url:DailyBackup.folder(settings.folder)});render(settings)}
   if(b.hasAttribute('data-backup-start')){
    const state=window.dailyBackupSnapshot?.();
    render(await send({type:'backup-start',...(state?{state}:{})}));
   }
  }catch(error){status.textContent=error.message}finally{b.disabled=b.hasAttribute('data-backup-start')&&pending}
 });
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[DailyBackup.KEY])render(changes[DailyBackup.KEY].newValue||{})});
 (async()=>{try{render(await read());render(await send({type:'backup-status'}))}catch(e){status.textContent=e.message}})();
 document.querySelector('[data-backup-settings]')?.addEventListener('click',()=>{panel.open=true;input.focus();panel.scrollIntoView({block:'nearest'})});
})();
