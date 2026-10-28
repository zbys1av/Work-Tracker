"use strict";
(async()=>{
 const KEY='daily_report_v2';
 try {
   const result=await chrome.storage.local.get(KEY);
   if(result[KEY]?.sheets?.length) localStorage.setItem(KEY,JSON.stringify(result[KEY]));
   else {
     const old=localStorage.getItem(KEY);
     if(old) await chrome.storage.local.set({[KEY]:JSON.parse(old)});
   }
 }catch(error){console.error('Cannot initialize storage',error)}
 const js=document.createElement('script');js.src='dashboard.js';js.addEventListener('load',()=>{
   chrome.storage.onChanged.addListener((changes,area)=>{
      if(area==='local'&&changes[KEY]?.newValue) window.dailyReceiveExternal?.(changes[KEY].newValue);
   });
 });document.body.appendChild(js);
})();
