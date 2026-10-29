(function(){
 const panel=document.querySelector('#drive-backup'),input=panel?.querySelector('input');
 const status=document.querySelector('[data-backup-status]');if(!status)return;
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
   const settings=await read();settings.folder=url;
   await chrome.storage.local.set({[DailyBackup.KEY]:settings});return settings;
  }
 }
 function render(s){
  pending=!!s.pending;
  if(input&&document.activeElement!==input)input.value=s.folder||'';
  const local=panel?.querySelector('[data-backup-local]'),drive=panel?.querySelector('[data-backup-drive]');
  if(local)local.textContent=s.lastLocal?`Локальна копія: ${s.lastLocal.filename} · ${new Date(s.lastLocal.completedAt).toLocaleString('uk-UA')}`:'Локальну копію ще не створено.';
  if(drive)drive.textContent='Google Drive: '+(s.driveStatus||'Завантаження не підтверджено.');
  status.textContent=s.error||(pending?'Завантаження JSON на комп’ютер…':!panel&&s.lastLocal?'Локальну копію збережено. Завантажте її на Drive вручну.':'');
  document.querySelectorAll('[data-backup-start]').forEach(b=>b.disabled=pending);
 }
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||!['data-backup-save','data-backup-open','data-backup-start'].some(a=>b.hasAttribute(a)))return;
  b.disabled=true;
  try{
   if(b.hasAttribute('data-backup-save')){render(await saveFolder());status.textContent='Папку збережено.'}
   if(b.hasAttribute('data-backup-open')){const settings=await read();await chrome.tabs.create({url:DailyBackup.folder(settings.folder)});render(settings)}
   if(b.hasAttribute('data-backup-start')){
    if(!(await read()).folder)throw Error('Спочатку вкажіть папку в повному звіті: Файл → Google Drive Backup.');
    const state=window.dailyBackupSnapshot?.();
    render(await send({type:'backup-start',...(state?{state}:{})}));
   }
  }catch(error){status.textContent=error.message;if(panel){panel.open=true;status.scrollIntoView({block:'nearest'})}}
  finally{b.disabled=b.hasAttribute('data-backup-start')&&pending}
 });
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[DailyBackup.KEY])render(changes[DailyBackup.KEY].newValue||{})});
 (async()=>{try{const settings=await read();render(settings);if(settings.pending)render(await send({type:'backup-status'}))}catch(e){status.textContent=e.message}})();
 document.querySelector('[data-backup-settings]')?.addEventListener('click',()=>{panel.open=true;input.focus();panel.scrollIntoView({block:'nearest'})});
})();
