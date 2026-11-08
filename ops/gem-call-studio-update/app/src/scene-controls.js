const KEY="gem-studio-scene-settings-v1";
export function validateNotionUrl(value) {
  if (!value) return "";
  const u=new URL(value);
  if(u.protocol!=="https:" || u.username || u.password || !(
    u.hostname==="notion.so"||u.hostname.endsWith(".notion.so")||
    u.hostname==="app.notion.com"||u.hostname==="notion.site"||u.hostname.endsWith(".notion.site")
  ))throw new Error("Use an HTTPS Notion page link.");
  return u.href;
}
export function validateBackground(file) {
  if(!file||!["image/png","image/jpeg","image/webp","video/mp4","video/webm"].includes(file.type)||file.size<=0||
     file.size>(file.type.startsWith("video/")?20:5)*1024*1024)throw new Error("Use PNG/JPEG/WebP under 5 MB, or MP4/WebM under 20 MB.");
}
function database() {return new Promise((resolve,reject)=>{
 const r=indexedDB.open("gem-studio-backgrounds-v1",1);
 r.onupgradeneeded=()=>r.result.createObjectStore("assets",{keyPath:"id"});
 r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error("Background storage unavailable."));
});}
async function assets(mode,action){const db=await database();try{return await new Promise((resolve,reject)=>{
 const tx=db.transaction("assets",mode),r=action(tx.objectStore("assets"));let out;
 r.onsuccess=()=>{out=r.result;};tx.oncomplete=()=>resolve(out);tx.onerror=tx.onabort=()=>reject(new Error("Background storage failed."));
});}finally{db.close();}}
export const backgroundStore={list:()=>assets("readonly",s=>s.getAll()),save:p=>{validateBackground(p.file);return assets("readwrite",s=>s.put(p));},remove:id=>assets("readwrite",s=>s.delete(id))};
export function initSceneControls({isBusy=()=>false}={}) {
 const $=id=>document.getElementById(id);
 let settings={notionUrl:"https://app.notion.com/p/393b5b56eac281b29c2eedd3307902c8",category:"office",backgroundId:"",voiceProvider:"voicemod",voiceDeviceId:"",voiceDeviceLabel:""};
 try{settings={...settings,...JSON.parse(localStorage.getItem(KEY)||"{}")};}catch{}
 let library=[],previewUrl=null;
 const message=text=>{$("sceneStatus").textContent=text;};
 const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{message("Settings could not be saved.");}};
 $("notionSource").value=settings.notionUrl;
 $("backgroundCategory").value=settings.category;
 $("voiceProvider").value=settings.voiceProvider;
 function notion(){try{settings.notionUrl=validateNotionUrl($("notionSource").value.trim());persist();
   $("notionPageLink").href=settings.notionUrl||"#";$("notionPageLink").hidden=!settings.notionUrl;
   $("notionStatus").textContent="Page link only. Download authorized reference images from Notion and upload them to your team profile; automatic image sync is not connected.";
 }catch(e){$("notionPageLink").hidden=true;$("notionStatus").textContent=e.message;}}
 $("notionSource").onchange=notion;notion();
 function preview(item){
  const box=$("backgroundPreview");const oldVideo=box.querySelector("video");oldVideo?.pause();box.replaceChildren();
  if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;
  if(!item){box.textContent="Upload a scene for this category. Background preview is separate from caller output.";return;}
  previewUrl=URL.createObjectURL(item.file);
  const node=document.createElement(item.file.type.startsWith("video/")?"video":"img");node.src=previewUrl;
  node.style.cssText="width:100%;max-height:260px;object-fit:contain";
  if(node.tagName==="VIDEO"){node.controls=true;node.muted=true;node.loop=true;node.playsInline=true;node.play().catch(()=>{});}
  else node.alt="Selected background reference";
  box.append(node);message("Background selected for preview. Applying it to the live character requires the full-body renderer.");
 }
 async function refresh(){library=await backgroundStore.list();const select=$("backgroundChoice");select.replaceChildren(new Option("Choose an uploaded background",""));
  library.filter(x=>x.category===settings.category).forEach(x=>select.add(new Option(x.name,x.id)));
  select.value=settings.backgroundId;
  const active=library.find(x=>x.id===select.value);preview(active);
 }
 $("backgroundCategory").onchange=()=>{if(isBusy()){message("Stop the session before changing scene settings.");$("backgroundCategory").value=settings.category;return;}
  settings.category=$("backgroundCategory").value;settings.backgroundId="";persist();refresh().catch(e=>message(e.message));};
 $("backgroundChoice").onchange=()=>{if(isBusy()){message("Stop the session before changing background.");$("backgroundChoice").value=settings.backgroundId;return;}
  settings.backgroundId=$("backgroundChoice").value;persist();preview(library.find(x=>x.id===settings.backgroundId));};
 $("uploadBackgrounds").onchange=async e=>{if(isBusy()){message("Stop the session before changing assets.");return;}
  try{const files=[...e.target.files];if(library.length+files.length>12)throw new Error("Keep up to 12 backgrounds. Delete unused scenes first.");
   files.forEach(validateBackground);
   for(const file of files){const id=crypto.randomUUID();await backgroundStore.save({id,name:file.name,category:settings.category,file});settings.backgroundId=id;}
   persist();await refresh();e.target.value="";
  }catch(error){message(error.message);}};
 $("deleteBackground").onclick=async()=>{if(isBusy()||!settings.backgroundId)return;try{await backgroundStore.remove(settings.backgroundId);settings.backgroundId="";persist();await refresh();}catch(e){message(e.message);}};
 $("voiceProvider").onchange=()=>{if(isBusy()){$("voiceProvider").value=settings.voiceProvider;return;}settings.voiceProvider=$("voiceProvider").value;persist();};
 $("voiceDevice").onchange=()=>{if(isBusy()){$("voiceDevice").value=settings.voiceDeviceId;return;}
  settings.voiceDeviceId=$("voiceDevice").value;settings.voiceDeviceLabel=$("voiceDevice").selectedOptions[0]?.textContent||"";persist();
  $("voiceStatus").textContent=settings.voiceDeviceId?"Device preference saved. Choose the voice inside its app and select this same virtual microphone in the calling app. Conversion is not yet verified.":"No virtual microphone selected.";
 };
 $("scanVoiceDevices").onclick=async()=>{
  let probe;
  try{probe=await navigator.mediaDevices.getUserMedia({audio:true});const devices=await navigator.mediaDevices.enumerateDevices();
   const select=$("voiceDevice");select.replaceChildren(new Option("Choose the voice app virtual microphone",""));
   const inputs=devices.filter(d=>d.kind==="audioinput"&&d.deviceId!=="default"&&d.deviceId!=="communications");
   for(const d of inputs){const o=new Option(d.label||"Unnamed input",d.deviceId);o.disabled=/Microphone Array|Realtek/i.test(d.label);select.add(o);}
   select.value=settings.voiceDeviceId;
   $("voiceStatus").textContent=inputs.some(d=>/voicemod|voicemeeter|virtual|vb-audio|cable output/i.test(d.label))?"Virtual audio device detected. Select it and verify the converted voice in the app.":"No recognized virtual voice microphone detected. Original microphone is not a custom voice.";
  }catch(e){$("voiceStatus").textContent="Voice device scan failed: "+e.message;}finally{probe?.getTracks().forEach(t=>t.stop());}
 };
 refresh().catch(e=>message(e.message));
 window.addEventListener("beforeunload",()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);});
 return {settings:()=>({...settings}),background:()=>library.find(x=>x.id===settings.backgroundId)};
}
