const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Backup=require('../Daily_Report_Chrome_Extension/backup.js');
const state={cur:1,sheets:[{name:'first',days:[{calls:[true],adj:2,off:'OFF',items:{'КРІТИ':[{id:'42',l:'https://example.com'}]}}]},{name:'second',cfg:{weekly:50}}],trash:[{name:'deleted'}],yearData:{knowledge:[{score:7}],months:{'01':{overall:90,items:[{name:'KPI',percent:90}]}}},custom:'preserve'};
test('folder accepts standard and account URLs, rejects third-party and non-folder URLs',()=>{
 for(const u of ['https://drive.google.com/drive/folders/Ab_1-2','https://drive.google.com/drive/u/0/folders/Ab_1-2?usp=sharing','https://drive.google.com/drive/u/12/folders/abc?resourcekey=key'])assert.equal(Backup.folder(u),u);
 for(const u of ['', 'http://drive.google.com/drive/folders/abc','https://drive.google.com.evil.test/drive/folders/abc','https://drive.google.com/file/d/abc','https://user@drive.google.com/drive/folders/abc','https://drive.google.com/drive/folders/abc/other'])assert.throws(()=>Backup.folder(u));
});
test('standard full-state JSON preserves every field and filename uses local time',()=>{
 assert.deepEqual(JSON.parse(Backup.serialize(state)),state);assert.throws(()=>Backup.serialize({sheets:[]}));
 assert.equal(Backup.filename(new Date(2026,9,29,8,3)),'Daily_Report_Backup_2026-10-29_08-03.json');
});
function worker(store={},downloads=new Map()){
 let listener,change,downloadCount=0,tabs=[],failDownload=false,failTab=false;
 const event=()=>({addListener(){}});
 const chrome={storage:{local:{get:async k=>({[k]:structuredClone(store[k])}),set:async obj=>Object.assign(store,structuredClone(obj))}},downloads:{search:async({id})=>downloads.has(id)?[downloads.get(id)]:[],download:async opts=>{if(failDownload)throw Error('download blocked');downloadCount++;downloads.set(downloadCount,{id:downloadCount,state:'in_progress',filename:opts.filename,url:opts.url});return downloadCount},onChanged:{addListener:f=>change=f}},tabs:{create:async o=>{if(failTab)throw Error('tab blocked');tabs.push(o)}},runtime:{onMessage:{addListener:f=>listener=f},onStartup:event(),onInstalled:event()}};
 const ctx=vm.createContext({chrome,console,Date,URL,encodeURIComponent,importScripts(){}});
 vm.runInContext(fs.readFileSync(require.resolve('../Daily_Report_Chrome_Extension/backup.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(require.resolve('../Daily_Report_Chrome_Extension/backup-worker.js'),'utf8'),ctx);
 return {send:msg=>new Promise(resolve=>listener(msg,{},resolve)),store,downloads,tabs,setFailDownload:()=>failDownload=true,setFailTab:()=>failTab=true};
}
test('download completion, restart recovery, specific file and no Drive success claim',async()=>{
 const store={[Backup.KEY]:{folder:'https://drive.google.com/drive/u/0/folders/abc'},daily_report_v2:structuredClone(state)};
 const w=worker(store);const before=JSON.stringify(store.daily_report_v2);
 assert.equal((await w.send({type:'backup-start'})).ok,true);assert.equal(w.tabs.length,0);assert.equal(store[Backup.KEY].lastLocal,undefined);
 const download=w.downloads.get(1);assert.deepEqual(JSON.parse(decodeURIComponent(download.url.split(',')[1])),state);
 assert.equal((await w.send({type:'backup-start'})).ok,false);
 download.state='complete';const restarted=worker(store,w.downloads);await restarted.send({type:'backup-status'});
 assert.equal(restarted.tabs.length,1);assert.equal(store[Backup.KEY].lastLocal.downloadId,1);assert.match(store[Backup.KEY].driveStatus,/Не підтверджено/);
 await restarted.send({type:'backup-status'});assert.equal(restarted.tabs.length,1);assert.equal(JSON.stringify(store.daily_report_v2),before);
});
test('missing folder, cancelled download, failed creation and tab failure never change working data',async()=>{
 const store={daily_report_v2:structuredClone(state)},w=worker(store);assert.equal((await w.send({type:'backup-start'})).ok,false);
 await w.send({type:'backup-save-folder',url:'https://drive.google.com/drive/folders/abc'});await w.send({type:'backup-start'});
 w.downloads.get(1).state='interrupted';await w.send({type:'backup-status'});assert.equal(store[Backup.KEY].lastLocal,undefined);assert.match(store[Backup.KEY].error,/перервано/);
 await w.send({type:'backup-start'});w.downloads.get(2).state='complete';w.setFailTab();await w.send({type:'backup-status'});assert.equal(store[Backup.KEY].lastLocal.downloadId,2);assert.match(store[Backup.KEY].error,/Копію збережено/);
 w.setFailDownload();assert.equal((await w.send({type:'backup-start'})).ok,false);assert.equal(store[Backup.KEY].lastLocal.downloadId,2);assert.deepEqual(store.daily_report_v2,state);
});
test('dashboard snapshot includes latest edits instead of older stored data',async()=>{
 const w=worker({[Backup.KEY]:{folder:'https://drive.google.com/drive/folders/abc'},daily_report_v2:state});
 const live=structuredClone(state);live.latest='unflushed edit';await w.send({type:'backup-start',state:live});
 assert.equal(JSON.parse(decodeURIComponent(w.downloads.get(1).url.split(',')[1])).latest,'unflushed edit');
});
