importScripts('backup.js');
// A download continues when the popup closes. All operation metadata is durable.
let queue=Promise.resolve();
const run=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result};
const read=async()=> (await chrome.storage.local.get(DailyBackup.KEY))[DailyBackup.KEY]||{};
const write=async value=>chrome.storage.local.set({[DailyBackup.KEY]:value});
async function reconcile(){
 const settings=await read();if(!settings.pending)return settings;
 const [download]=await chrome.downloads.search({id:settings.pending.id});
 if(!download||download.state==='interrupted'){
  settings.error='Локальне завантаження скасовано або перервано. Дані Daily Report збережені; повторіть резервування.';delete settings.pending;await write(settings);return settings;
 }
 if(download.state!=='complete')return settings;
 const op=settings.pending;delete settings.pending;delete settings.error;
 settings.lastLocal={filename:download.filename||op.filename,completedAt:new Date().toISOString(),downloadId:op.id};
 settings.driveStatus='Не підтверджено. Завантажте цей JSON у папку Drive вручну: «Створити → Завантажити файл» або перетягніть файл.';
 await write(settings); // Claim completion before opening a tab, avoiding duplicate opens.
 try{await chrome.tabs.create({url:op.folder})}catch{settings.error='Копію збережено локально. Не вдалося відкрити Drive; натисніть «Відкрити папку».';await write(settings)}
 return settings;
}
async function handle(message){
 if(message.type==='backup-status')return reconcile();
 if(message.type==='backup-save-folder'){
  const url=DailyBackup.folder(message.url),s=await read();s.folder=url;await write(s);return s;
 }
 if(message.type==='backup-open-folder'){const s=await read();await chrome.tabs.create({url:DailyBackup.folder(s.folder)});return s}
 if(message.type!=='backup-start')throw Error('Невідома дія');
 const s=await reconcile();if(s.pending)throw Error('Попередня копія ще завантажується');
 const url=DailyBackup.folder(s.folder);
 // Dashboard sends its live state; compact popup reads the current shared storage.
 const state=message.state||(await chrome.storage.local.get('daily_report_v2')).daily_report_v2;
 const json=DailyBackup.serialize(state),filename=DailyBackup.filename();
 const id=await chrome.downloads.download({url:'data:application/json;charset=utf-8,'+encodeURIComponent(json),filename,conflictAction:'uniquify',saveAs:false});
 s.pending={id,filename,folder:url};delete s.error;s.driveStatus='Не підтверджено: очікування локальної копії.';await write(s);
 return reconcile();
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(!message?.type?.startsWith('backup-'))return;
 run(()=>handle(message)).then(data=>respond({ok:true,data}),error=>respond({ok:false,error:error.message}));return true;
});
chrome.downloads.onChanged.addListener(delta=>{if(delta.state)run(reconcile).catch(console.error)});
chrome.runtime.onStartup.addListener(()=>run(reconcile).catch(console.error));
chrome.runtime.onInstalled.addListener(()=>run(reconcile).catch(console.error));
