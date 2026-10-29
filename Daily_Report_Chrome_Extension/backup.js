/* Standard backup format: the complete, unmodified Daily Report state. */
(function(root){
 const KEY='daily_report_drive_backup';
 function serialize(state){if(!state||!Array.isArray(state.sheets)||!state.sheets.length)throw Error('Немає даних для резервування');return JSON.stringify(state)}
 function folder(value){
  let u;try{u=new URL(String(value).trim())}catch{throw Error('Вкажіть посилання на папку Google Drive')}
  if(u.protocol!=='https:'||u.hostname!=='drive.google.com'||u.port||u.username||u.password||!/^\/drive\/(?:u\/\d+\/)?folders\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))throw Error('Потрібна адреса https://drive.google.com/drive/folders/…');
  u.hash='';return u.href;
 }
 function filename(d=new Date()){const p=n=>String(n).padStart(2,'0');return `Daily_Report_Backup_${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.json`}
 root.DailyBackup={KEY,serialize,folder,filename};
 if(typeof module!=='undefined')module.exports=root.DailyBackup;
})(globalThis);
