const {test}=require('node:test');
const assert=require('node:assert/strict');
const Cases=require('../Daily_Report_Chrome_Extension/cases.js');
const sheet=(start,days)=>({start,days:days.map(items=>({items:{'КРІТИ':items,'СКЛАДНІ ЛЮДИ':[{id:'excluded'}]},off:'OFF'}))});
test('legacy values remain editable without losing URL or ID',()=>{
 assert.deepEqual(Cases.fields({l:'https://example.com/42'}),{id:'',l:'https://example.com/42'});
 assert.deepEqual(Cases.fields({l:'00123'}),{id:'00123',l:''});
 assert.deepEqual(Cases.fields({id:'00123',l:'https://example.com/42'}),{id:'00123',l:'https://example.com/42'});
});
test('Monday to Sunday spans sheets and month/year boundaries, including OFF',()=>{
 const state={sheets:[sheet('2026-12-27',[[{id:'before'}],[{id:'monday'}]]),sheet('2027-01-03',[[{id:'sunday',l:'https://example.com/42',d:'<script>&'}],[{id:'after'}]])]};
 for(const selected of ['2026-12-28','2027-01-01','2027-01-03']){
  const r=Cases.report(state,selected);assert.equal(r.count,2);
  assert.match(r.html,/<a href="https:\/\/example.com\/42">sunday<\/a>/);
  assert.match(r.html,/&lt;script&gt;&amp;/);assert.doesNotMatch(r.text,/before|after|excluded/);
 }
});
test('unsafe links never become HTML anchors and missing fields still copy',()=>{
 const r=Cases.report({sheets:[sheet('2026-10-26',[[{id:'<42>',l:'javascript:alert(1)'},{l:'legacy-ID'},{d:'note'},{id:'',l:''}]])]},'2026-10-28');
 assert.equal(r.count,3);assert.doesNotMatch(r.html,/<a|<42>/);assert.match(r.html,/&lt;42&gt;/);assert.match(r.text,/legacy-ID|note/);
});
test('clipboard receives both rich HTML and plain text; empty report preserves clipboard',async()=>{
 let writes=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{write:async x=>writes.push(x)}}});
 globalThis.ClipboardItem=class{constructor(data){this.data=data}};
 const state={sheets:[sheet('2026-10-26',[[{id:'007',l:'https://example.com/7'}]])]};
 assert.equal(await Cases.copy(state,'2026-10-28'),1);
 assert.match(await writes[0][0].data['text/html'].text(),/>007<\/a>/);
 assert.match(await writes[0][0].data['text/plain'].text(),/007 \(https:/);
 await assert.rejects(Cases.copy({sheets:[]},'2026-10-28'),/крітів немає/);assert.equal(writes.length,1);
 navigator.clipboard.write=async()=>{throw Error('Denied')};await assert.rejects(Cases.copy(state,'2026-10-28'),/Denied/);
});
