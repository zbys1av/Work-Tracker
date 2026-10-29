(function(){
 const panel=document.querySelector('#drive-backup');if(!panel)return;
 const input=panel.querySelector('input'),status=panel.querySelector('[data-backup-status]');
 let pending=false;
 const send=async message=>{const result=await chrome.runtime.sendMessage(message);if(!result?.ok)throw Error(result?.error||'Служба резервування недоступна');return result.data};
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
   if(b.hasAttribute('data-backup-save')){render(await send({type:'backup-save-folder',url:input.value}));status.textContent='Папку збережено.'}
   if(b.hasAttribute('data-backup-open'))render(await send({type:'backup-open-folder'}));
   if(b.hasAttribute('data-backup-start')){
    const state=window.dailyBackupSnapshot?.();
    render(await send({type:'backup-start',...(state?{state}:{})}));
   }
  }catch(error){status.textContent=error.message}finally{b.disabled=b.hasAttribute('data-backup-start')&&pending}
 });
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[DailyBackup.KEY])render(changes[DailyBackup.KEY].newValue||{})});
 send({type:'backup-status'}).then(render).catch(e=>status.textContent=e.message);
 document.querySelector('[data-backup-settings]')?.addEventListener('click',()=>{panel.open=true;input.focus();panel.scrollIntoView({block:'nearest'})});
})();
