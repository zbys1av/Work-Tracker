/*
 * Daily Report lightweight Excel workbook compatibility layer.
 * Offline OOXML (.xlsx) writer/reader with the subset of ExcelJS used in Daily Report.
 * ZIP files are generated without compression and imported with native DecompressionStream.
 * No external code and no network are required.
 */
(function(global){
 'use strict';
 const te=new TextEncoder(),td=new TextDecoder();
 const xmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const idxToCol=n=>{let s='';while(n){s=String.fromCharCode(65+(n-1)%26)+s;n=Math.floor((n-1)/26);}return s;};
 const colToIdx=s=>{let n=0;for(const c of s.toUpperCase())n=n*26+c.charCodeAt(0)-64;return n;};
 const parseAddress=a=>{const m=String(a).match(/^\$?([A-Za-z]+)\$?(\d+)$/);if(!m)throw Error('Invalid Excel cell: '+a);return {r:Number(m[2]),c:colToIdx(m[1])};};
 const dateSerial=d=>(d.getTime()-Date.UTC(1899,11,30))/86400000;
 const byTag=(node,tag)=>Array.from(node?.children||[]).filter(x=>x.localName===tag);
 const child=(node,tag)=>byTag(node,tag)[0];
 function attr(node,name,fallback=''){return node?.getAttribute(name)??fallback;}
 function zipFiles(files){
  const parts=[],central=[];let offset=0;
  const crcTable=zipFiles.crcTable||(zipFiles.crcTable=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0}));
  const crc32=b=>{let x=-1;for(const v of b)x=crcTable[(x^v)&255]^(x>>>8);return(x^-1)>>>0;};
  const u16=(dv,off,v)=>dv.setUint16(off,v,true),u32=(dv,off,v)=>dv.setUint32(off,v,true);
  for(const [path,text] of Object.entries(files)){
   const name=te.encode(path),data=text instanceof Uint8Array?text:te.encode(text),crc=crc32(data);
   const local=new Uint8Array(30+name.length),l=new DataView(local.buffer);
   u32(l,0,0x04034b50);u16(l,4,20);u16(l,6,0x800);u16(l,8,0);u32(l,14,crc);u32(l,18,data.length);u32(l,22,data.length);u16(l,26,name.length);local.set(name,30);
   parts.push(local,data);
   const cent=new Uint8Array(46+name.length),c=new DataView(cent.buffer);
   u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u16(c,8,0x800);u16(c,10,0);u32(c,16,crc);u32(c,20,data.length);u32(c,24,data.length);u16(c,28,name.length);u32(c,42,offset);cent.set(name,46);central.push(cent);
   offset+=local.length+data.length;
  }
  const centSize=central.reduce((n,a)=>n+a.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  u32(e,0,0x06054b50);u16(e,8,central.length);u16(e,10,central.length);u32(e,12,centSize);u32(e,16,offset);
  const size=offset+centSize+end.length,out=new Uint8Array(size);let at=0;
  for(const part of [...parts,...central,end]){out.set(part,at);at+=part.length;}return out;
 }
 async function unzipFiles(input){
  const data=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(data.buffer,data.byteOffset,data.byteLength);
  let pos=data.length-22;while(pos>=Math.max(0,data.length-65557)&&v.getUint32(pos,true)!==0x06054b50)pos--;
  if(pos<0)throw Error('Invalid ZIP/XLSX archive');
  const count=v.getUint16(pos+10,true),head=v.getUint32(pos+16,true),files={};let at=head;
  for(let i=0;i<count;i++){
   if(v.getUint32(at,true)!==0x02014b50)throw Error('Broken ZIP directory');
   const method=v.getUint16(at+10,true),size=v.getUint32(at+20,true),nl=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true),localAt=v.getUint32(at+42,true),name=td.decode(data.subarray(at+46,at+46+nl));
   const loName=v.getUint16(localAt+26,true),loExtra=v.getUint16(localAt+28,true),start=localAt+30+loName+loExtra,blob=data.subarray(start,start+size);
   if(!name.endsWith('/')){
    if(method===0)files[name]=td.decode(blob);
    else if(method===8){
     const stream=new Blob([blob]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
     files[name]=td.decode(new Uint8Array(await new Response(stream).arrayBuffer()));
    }else throw Error('Unsupported ZIP compression method '+method);
   }
   at+=46+nl+extra+comment;
  }
  return files;
 }
 class Cell {constructor(sheet,r,c){this.sheet=sheet;this.row=r;this.col=c;this.value=null;this.font=null;this.fill=null;this.alignment=null;this.numFmt=null;this.dataValidation=null;}}
 class Worksheet {
  constructor(name){this.name=name;this.state='visible';this.views=[];this._cells=new Map();this._columns=new Map();this._rows=new Map();this._merges=[];this._cfs=[];this._maxRow=0;}
  getCell(a,b){let r,c;if(typeof a==='string')({r,c}=parseAddress(a));else{r=Number(a);c=Number(b);}this._maxRow=Math.max(this._maxRow,r);
   const key=r+':'+c;if(!this._cells.has(key))this._cells.set(key,new Cell(this,r,c));return this._cells.get(key);}
  getRow(r){r=Number(r);if(!this._rows.has(r))this._rows.set(r,{r,height:null,getCell:(c)=>this.getCell(r,c)});this._maxRow=Math.max(this._maxRow,r);return this._rows.get(r);}
  getColumn(c){if(!this._columns.has(c))this._columns.set(c,{width:null,hidden:false});return this._columns.get(c);}
  mergeCells(...args){let span;if(args.length===1)span=args[0];else span=idxToCol(args[1])+args[0]+':'+idxToCol(args[3])+args[2];this._merges.push(span);}
  addConditionalFormatting(spec){this._cfs.push(spec);}
  get rowCount(){return this._maxRow;}
 }
 class Workbook {
  constructor(){this.worksheets=[];this.xlsx={writeBuffer:()=>this._write(),load:a=>this._load(a)};}
  addWorksheet(name){const s=new Worksheet(name);this.worksheets.push(s);return s;}
  getWorksheet(name){return typeof name==='number'?this.worksheets[name-1]:this.worksheets.find(x=>x.name===name);}
  eachSheet(fn){this.worksheets.forEach((sh,i)=>fn(sh,i+1));}
  async _write(){
   const files={},ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
   const fonts=['<font><sz val="11"/><name val="Calibri"/></font>'],fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>'],borders=['<border><left/><right/><top/><bottom/><diagonal/></border>'];
   const fontMap=new Map(),fillMap=new Map(),fmtMap=new Map(),styleMap=new Map();const fmts=[],dxfs=[],dxfMap=new Map(),styles=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
   const fontId=f=>{if(!f)return 0;const key=JSON.stringify(f);if(fontMap.has(key))return fontMap.get(key);
    const n=fonts.length;let color=f.color?.argb;
    fonts.push(`<font>${f.bold?'<b/>':''}${f.italic?'<i/>':''}<sz val="${f.size||11}"/><name val="${xmlEscape(f.name||'Calibri')}"/>${color?`<color rgb="${xmlEscape(color)}"/>`:''}</font>`);fontMap.set(key,n);return n;};
   const fillId=f=>{if(!f)return 0;const key=JSON.stringify(f);if(fillMap.has(key))return fillMap.get(key);
    const n=fills.length;let fg=f.fgColor?.argb||f.bgColor?.argb||'FFFFFFFF';fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${xmlEscape(fg)}"/><bgColor indexed="64"/></patternFill></fill>`);fillMap.set(key,n);return n;};
   const fmtId=f=>{if(!f)return 0;const builtin={'0.0%':10,'0%':9}[f];if(builtin)return builtin;
    if(!fmtMap.has(f)){fmtMap.set(f,164+fmtMap.size);fmts.push(`<numFmt numFmtId="${fmtMap.get(f)}" formatCode="${xmlEscape(f)}"/>`);}return fmtMap.get(f);};
   const styleFor=c=>{const f=fontId(c.font),fill=fillId(c.fill),num=fmtId(c.numFmt),alignment=c.alignment||{};
    if(alignment.vertical==='middle')alignment.vertical='center';
    const key=[f,fill,num,alignment.horizontal||'',alignment.vertical||''].join(':');if(!styleMap.has(key)){
     const n=styles.length;styles.push(`<xf numFmtId="${num}" fontId="${f}" fillId="${fill}" borderId="0" xfId="0"${num?' applyNumberFormat="1"':''}${(alignment.horizontal||alignment.vertical)?' applyAlignment="1"':''}>${(alignment.horizontal||alignment.vertical)?`<alignment${alignment.horizontal?` horizontal="${alignment.horizontal}"`:''}${alignment.vertical?` vertical="${alignment.vertical}"`:''}/>`:''}</xf>`);styleMap.set(key,n);
    }return styleMap.get(key);};
   const dxfId=style=>{const key=JSON.stringify(style||{});if(dxfMap.has(key))return dxfMap.get(key);
    const f=style?.font,col=f?.color?.argb,fill=style?.fill,fg=fill?.fgColor?.argb||fill?.bgColor?.argb;
    const fragment=`<dxf>${col?`<font><color rgb="${xmlEscape(col)}"/></font>`:''}${fg?`<fill><patternFill patternType="solid"><fgColor rgb="${xmlEscape(fg)}"/><bgColor indexed="64"/></patternFill></fill>`:''}</dxf>`;
    const id=dxfs.length;dxfs.push(fragment);dxfMap.set(key,id);return id;
   };
   const cellXml=c=>{
    const v=c.value,s=styleFor(c),ref=idxToCol(c.col)+c.row,head=`<c r="${ref}" s="${s}"`;
    if(v===null||v===undefined)return head+'/>';
    if(v instanceof Date)return head+`><v>${dateSerial(v)}</v></c>`;
    if(typeof v==='boolean')return head+` t="b"><v>${v?1:0}</v></c>`;
    if(typeof v==='number')return head+`><v>${Number.isFinite(v)?v:0}</v></c>`;
    if(typeof v==='object'&&('formula' in v||'sharedFormula' in v)){
     const formula=v.formula||v.sharedFormula,hasResult=v.result!==null&&v.result!==undefined,r=v.result;
     return head+(hasResult&&typeof r==='string'?' t="str"':'')+`><f>${xmlEscape(formula)}</f>${hasResult?`<v>${xmlEscape(r)}</v>`:''}</c>`;
    }
    const content=xmlEscape(v?.text??v);return head+` t="inlineStr"><is><t xml:space="preserve">${content}</t></is></c>`;
   };
   const rels=[];let sheetsXml='';
   for(let i=0;i<this.worksheets.length;i++){
    const sh=this.worksheets[i],sorted=[...sh._cells.values()].sort((a,b)=>a.row-b.row||a.col-b.col);
    const rowMap=new Map();for(const c of sorted){if(!rowMap.has(c.row))rowMap.set(c.row,[]);rowMap.get(c.row).push(c);}
    const rows=[...new Set([...rowMap.keys(),...sh._rows.keys()])].sort((a,b)=>a-b).map(r=>{
      const ht=sh._rows.get(r)?.height;
      return `<row r="${r}"${ht?` ht="${ht}" customHeight="1"`:''}>${(rowMap.get(r)||[]).map(cellXml).join('')}</row>`;
    }).join('');
    const cols=[...sh._columns.entries()].map(([n,c])=>`<col min="${n}" max="${n}" width="${c.width||8.43}" customWidth="1"${c.hidden?' hidden="1"':''}/>`).join('');
    const merges=sh._merges.length?`<mergeCells count="${sh._merges.length}">${sh._merges.map(m=>`<mergeCell ref="${xmlEscape(m)}"/>`).join('')}</mergeCells>`:'';
    const frozen=sh.views.find(v=>v.state==='frozen');
    const viewXml=frozen?`<sheetViews><sheetView workbookViewId="0"><pane ySplit="${frozen.ySplit||0}" state="frozen" topLeftCell="A${(frozen.ySplit||0)+1}"/></sheetView></sheetViews>`:'';
    const conditions=sh._cfs.map(c=>`<conditionalFormatting sqref="${xmlEscape(c.ref)}">`+
      (c.rules||[]).map((rule,i)=>`<cfRule type="${xmlEscape(rule.type)}"${rule.operator?` operator="${xmlEscape(rule.operator)}"`:''} dxfId="${dxfId(rule.style)}" priority="${i+1}">${(rule.formulae||[]).map(formula=>`<formula>${xmlEscape(formula)}</formula>`).join('')}</cfRule>`).join('')+
     `</conditionalFormatting>`).join('');
    const path=`xl/worksheets/sheet${i+1}.xml`;
    files[path]=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}">${viewXml}<sheetFormatPr defaultRowHeight="15"/>${cols?`<cols>${cols}</cols>`:''}<sheetData>${rows}</sheetData>${merges}${conditions}</worksheet>`;
    sheetsXml+=`<sheet name="${xmlEscape(sh.name)}" sheetId="${i+1}" r:id="rId${i+1}"${sh.state!=='visible'?` state="${xmlEscape(sh.state)}"`:''}/>`;
    rels.push(`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`);
   }
   const styleId=this.worksheets.length+1;
   rels.push(`<Relationship Id="rId${styleId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
   files['xl/workbook.xml']=`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetsXml}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
   files['xl/_rels/workbook.xml.rels']=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`;
   files['_rels/.rels']='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
   files['xl/styles.xml']=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${ns}">${fmts.length?`<numFmts count="${fmts.length}">${fmts.join('')}</numFmts>`:''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="1">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="${dxfs.length}">${dxfs.join('')}</dxfs></styleSheet>`;
   files['[Content_Types].xml']=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${this.worksheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
   return zipFiles(files);
  }
  async _load(data){
   const files=await unzipFiles(data),parse=x=>new DOMParser().parseFromString(x,'application/xml');
   if(!files['xl/workbook.xml'])throw Error('Excel workbook XML missing');
   const workbook=parse(files['xl/workbook.xml']),rels=parse(files['xl/_rels/workbook.xml.rels']||''),relMap=new Map();
   for(const r of rels.getElementsByTagName('*'))if(r.localName==='Relationship')relMap.set(attr(r,'Id'),attr(r,'Target'));
   const strings=[];
   if(files['xl/sharedStrings.xml']){
    const sst=parse(files['xl/sharedStrings.xml']);for(const si of sst.getElementsByTagName('*'))if(si.localName==='si')strings.push(Array.from(si.getElementsByTagName('*')).filter(t=>t.localName==='t').map(t=>t.textContent).join(''));
   }
   this.worksheets=[];
   const sheetNodes=Array.from(workbook.getElementsByTagName('*')).filter(n=>n.localName==='sheet');
   for(let i=0;i<sheetNodes.length;i++){
    const node=sheetNodes[i],sh=this.addWorksheet(attr(node,'name',`Sheet${i+1}`));sh.state=attr(node,'state','visible');
    const rid=node.getAttribute('r:id')||node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||'rId'+(i+1);
    let target=relMap.get(rid)||`worksheets/sheet${i+1}.xml`;
    target=target.startsWith('/')?target.slice(1):target.startsWith('xl/')?target:'xl/'+target;
    const content=files[target];if(!content)continue;
    const document=parse(content),cs=Array.from(document.getElementsByTagName('*')).filter(n=>n.localName==='c');
    for(const n of cs){
     const a=attr(n,'r');if(!a)continue;
     const c=sh.getCell(a),t=attr(n,'t'),val=child(n,'v'),formula=child(n,'f');
     if(formula){c.value={formula:formula.textContent||'',result:val?(t==='str'?val.textContent:Number(val.textContent)):null};continue;}
     if(t==='inlineStr'){const is=child(n,'is');c.value=is?Array.from(is.getElementsByTagName('*')).filter(x=>x.localName==='t').map(x=>x.textContent).join(''):'';}
     else if(t==='s')c.value=strings[Number(val?.textContent)||0]||'';
     else if(t==='b')c.value=val?.textContent==='1';
     else if(t==='str'||t==='e')c.value=val?.textContent||'';
     else if(val){const n=Number(val.textContent);c.value=Number.isFinite(n)?n:val.textContent;}
    }
   }
   return this;
  }
 }
 global.ExcelJS={Workbook};
})(window);
