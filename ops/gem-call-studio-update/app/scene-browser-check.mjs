const pages=await fetch("http://127.0.0.1:9223/json").then(r=>r.json());
const page=pages.find(p=>p.type==="page"&&p.url.startsWith("http://127.0.0.1:8765/"));
if(!page) throw new Error("Studio browser tab missing");
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r,j)=>{ws.addEventListener("open",r,{once:true});ws.addEventListener("error",j,{once:true});});
let id=0;const pending=new Map();
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.j(new Error(m.error.message)):p.r(m.result);}});
function send(method,params={}){return new Promise((r,j)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);j(new Error("Browser command timed out: "+method));},30000);pending.set(n,{r:value=>{clearTimeout(timer);r(value);},j:error=>{clearTimeout(timer);j(error);}});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true,timeout:30000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result?.value;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression, label) { for(let n=0;n<120;n++){if(await evaluate(expression))return;await wait(250);} throw new Error(label); }
const fixtureName="TEST virtual team "+Date.now();
try {
 const active=await evaluate("Boolean(document.querySelector('#localVideo')?.srcObject||document.querySelector('#remoteVideo')?.srcObject)");
 if(active)throw new Error("Active studio session: reload deferred to preserve call");
 await send("Page.reload",{ignoreCache:true});
 for(let n=0;n<30;n++){await wait(300);if(await evaluate("Boolean(document.querySelector('#teamProfile')?.options.length)"))break;}
 const initial=await evaluate("({mode:document.querySelector('#engineMode').value,fallbackDisabled:document.querySelector('#allowLocalFallback').disabled,service:document.querySelector('#serviceBadge').textContent})");
 if(initial.mode!=="fullbody"||!initial.fallbackDisabled)throw new Error("Default gate failed");
 console.log("INITIAL="+JSON.stringify(initial));
 const save=await evaluate(`(async()=>{
  const b=new Blob([Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAABQAAAAoCAIAAABxU02MAAAAJElEQVR4nO3LMQEAAAgDoGn/ztrBV/ipZHLV5ynLsizLsvw+LwLoAU+mxwuvAAAAAElFTkSuQmCC"),c=>c.charCodeAt(0))],{type:"image/png"});
  const refs=[new File([b],"test-front.png",{type:"image/png"}),new File([b],"test-body.png",{type:"image/png"})];
  const set=(id,files)=>{const d=new DataTransfer();files.forEach(f=>d.items.add(f));document.getElementById(id).files=d.files;};
  document.getElementById("teamName").value=${JSON.stringify(fixtureName)};
  set("teamImages",refs);set("teamBackground",[refs[0]]);set("teamVoice",[new File([new Uint8Array(44)],"test.wav",{type:"audio/wav"})]);
  document.getElementById("teamAuthorized").checked=true;document.getElementById("teamFullBody").checked=true;
  document.getElementById("saveTeam").click();
  for(let n=0;n<50;n++){await new Promise(r=>setTimeout(r,100));if(document.getElementById("teamProfile").value)return {id:document.getElementById("teamProfile").value,count:document.getElementById("teamPreview").children.length};}
  throw new Error(document.getElementById("teamStatus").textContent);
 })()`);
 if(save.count!==3)throw new Error("Multiple image/background preview failed");
 console.log("PROFILE_SAVED="+JSON.stringify(save));
 await send("Page.reload",{ignoreCache:true});
 await until("document.querySelector('#teamProfile')?.value==="+JSON.stringify(save.id), "Selected profile restoration failed");
 console.log("PROFILE_RESTORED="+save.id);
 await evaluate("document.querySelector('#teamProfile').value="+JSON.stringify(save.id)+";document.querySelector('#teamProfile').dispatchEvent(new Event('change'));document.querySelector('#consent').checked=true;document.querySelector('#connect').click();true");
 await wait(1500);
 const blocked=await evaluate("({message:document.querySelector('#sessionMessage').textContent,source:!!document.querySelector('#localVideo').srcObject,output:!!document.querySelector('#remoteVideo').srcObject})");
 if(blocked.source||blocked.output||!blocked.message.includes("Live body animation"))throw new Error("Unavailable engine did not fail closed");
 console.log("BLOCKED_OUTPUT="+JSON.stringify(blocked));
 await evaluate("document.querySelector('#deleteTeam').click();true");
 await until("!Array.from(document.querySelector('#teamProfile')?.options||[]).some(o=>o.value==="+JSON.stringify(save.id)+")","Test profile deletion timed out");
 console.log("TEST_PROFILE_REMOVED="+await evaluate("!Array.from(document.querySelector('#teamProfile').options).some(o=>o.value==="+JSON.stringify(save.id)+")"));

 const scene=await evaluate(`(async()=>{
 const q=id=>document.getElementById(id);
 if(q("backgroundCategory").options.length!==5)throw new Error("Scene categories missing");
 if(!q("notionPageLink").href.includes("app.notion.com/p/"))throw new Error("Notion page link missing");
 q("backgroundCategory").value="pool";q("backgroundCategory").dispatchEvent(new Event("change"));await new Promise(r=>setTimeout(r,300));
 const blob=new Blob([Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAABQAAAAoCAIAAABxU02MAAAAJElEQVR4nO3LMQEAAAgDoGn/ztrBV/ipZHLV5ynLsizLsvw+LwLoAU+mxwuvAAAAAElFTkSuQmCC"),c=>c.charCodeAt(0))],{type:"image/png"});const transfer=new DataTransfer();
 transfer.items.add(new File([blob],"TEST-pool-scene.png",{type:"image/png"}));
 q("uploadBackgrounds").files=transfer.files;q("uploadBackgrounds").dispatchEvent(new Event("change"));
 for(let n=0;n<30;n++){await new Promise(r=>setTimeout(r,100));if(q("backgroundChoice").value)return {id:q("backgroundChoice").value,preview:!!q("backgroundPreview").querySelector("img")};}
 throw new Error(q("sceneStatus").textContent);
 })()`);
 if(!scene.preview)throw new Error("Background preview failed");
 await send("Page.reload",{ignoreCache:true});
 await until("document.querySelector('#backgroundChoice')?.value==="+JSON.stringify(scene.id),"Background restoration timed out");
 const restored=await evaluate("({category:document.querySelector('#backgroundCategory').value,id:document.querySelector('#backgroundChoice').value,voiceOptions:document.querySelector('#voiceProvider').options.length})");
 if(restored.category!=="pool"||restored.id!==scene.id||restored.voiceOptions!==3)throw new Error("Scene/voice preferences failed");
 console.log("SCENE_PERSISTENCE="+JSON.stringify(restored));
 await evaluate("document.querySelector('#deleteBackground').click();true");
 await until("!Array.from(document.querySelector('#backgroundChoice')?.options||[]).some(o=>o.value==="+JSON.stringify(scene.id)+")","Test scene deletion timed out");
 console.log("TEST_SCENE_REMOVED="+await evaluate("!document.querySelector('#backgroundChoice').value"));

 const layout=await evaluate("({cards:Array.from(document.querySelectorAll('.simple-choices > article')).map(e=>e.querySelector('h2').textContent),openAdvanced:document.querySelector('.advanced-settings').open,duplicates:Array.from(document.querySelectorAll('[id]')).map(e=>e.id).filter((x,i,a)=>a.indexOf(x)!==i)})");
 if(layout.cards.length!==3||layout.openAdvanced||layout.duplicates.length)throw new Error("Simple layout failed");
 console.log("SIMPLE_LAYOUT="+JSON.stringify(layout));

 let ready=false;
 for(let n=0;n<40;n++){await wait(500);if(await evaluate("document.querySelector('#gateList').textContent.includes('Running · verified automatically')")){ready=true;break;}}
 if(!ready)throw new Error("Automatic OBS Virtual Camera gate did not turn green");
 console.log("AUTO_OBS_GATE_PASS");
}finally{ws.close();}
