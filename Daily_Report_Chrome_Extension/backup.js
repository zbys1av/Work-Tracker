/* Standard backup format: the complete, unmodified Daily Report state. */
(function(root){
 const KEY='daily_report_drive_backup';
 function serialize(state,settings){if(!state||!Array.isArray(state.sheets)||!state.sheets.length)throw Error('Немає даних для резервування');return JSON.stringify(settings?.folder?{...state,backupSettings:{...state.backupSettings,googleDriveFolder:folder(settings.folder)}}:state)}
 function folder(value){
  let u;try{u=new URL(String(value).trim())}catch{throw Error('Вкажіть посилання на папку Google Drive')}
  if(u.protocol!=='https:'||u.hostname!=='drive.google.com'||u.port||u.username||u.password||!/^\/drive\/(?:u\/\d+\/)?folders\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))throw Error('Потрібна адреса https://drive.google.com/drive/folders/…');
  u.hash='';return u.href;
 }
 function filename(d=new Date()){const p=n=>String(n).padStart(2,'0');return `Daily_Report_Backup_${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.json`}
 async function exportJSON(state){const settings=(await chrome.storage.local.get(KEY))[KEY]||{};return serialize(state,settings)}
 async function restoreSettings(state){
  if(!Object.hasOwn(state.backupSettings||{},'googleDriveFolder'))return;
  const url=folder(state.backupSettings.googleDriveFolder);
  const settings=(await chrome.storage.local.get(KEY))[KEY]||{};
  await chrome.storage.local.set({[KEY]:{...settings,folder:url}});
 }
 root.DailyBackup={KEY,serialize,folder,filename,exportJSON,restoreSettings};
 if(typeof module!=='undefined')module.exports=root.DailyBackup;
})(globalThis);
