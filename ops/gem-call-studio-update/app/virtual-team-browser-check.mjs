const pages=await fetch("http://127.0.0.1:9223/json").then(r=>r.json());
const page=pages.find(p=>p.type==="page"&&p.url.startsWith("http://127.0.0.1:8765/"));
if(!page) throw new Error("Studio browser tab missing");
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r,j)=>{ws.addEventListener("open",r,{once:true});ws.addEventListener("error",j,{once:true});});
let id=0;const pending=new Map();
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.j(new Error(m.error.message)):p.r(m.result);}});
function send(method,params={}){return new Promise((r,j)=>{const n=++id;pending.set(n,{r,j});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result?.value;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try {
 const active=await evaluate("Boolean(document.querySelector('#localVideo')?.srcObject||document.querySelector('#remoteVideo')?.srcObject)");
 if(active)throw new Error("Active studio session: reload deferred to preserve call");
 await send("Page.reload",{ignoreCache:true});
 for(let n=0;n<30;n++){await wait(300);if(await evaluate("Boolean(document.querySelector('#teamProfile')?.options.length)"))break;}
 const initial=await evaluate("({mode:document.querySelector('#engineMode').value,fallbackDisabled:document.querySelector('#allowLocalFallback').disabled,service:document.querySelector('#serviceBadge').textContent})");
 if(initial.mode!=="fullbody"||!initial.fallbackDisabled)throw new Error("Default gate failed");
 console.log("INITIAL="+JSON.stringify(initial));
 const save=await evaluate(`(async()=>{
  const c=document.createElement("canvas");c.width=20;c.height=40;c.getContext("2d").fillRect(0,0,20,40);
  const b=await new Promise(r=>c.toBlob(r,"image/png"));
  const refs=[new File([b],"test-front.png",{type:"image/png"}),new File([b],"test-body.png",{type:"image/png"})];
  const set=(id,files)=>{const d=new DataTransfer();files.forEach(f=>d.items.add(f));document.getElementById(id).files=d.files;};
  document.getElementById("teamName").value="TEST virtual team validation";
  set("teamImages",refs);set("teamBackground",[refs[0]]);set("teamVoice",[new File([new Uint8Array(44)],"test.wav",{type:"audio/wav"})]);
  document.getElementById("teamAuthorized").checked=true;document.getElementById("teamFullBody").checked=true;
  document.getElementById("saveTeam").click();
  for(let n=0;n<50;n++){await new Promise(r=>setTimeout(r,100));if(document.getElementById("teamProfile").value)return {id:document.getElementById("teamProfile").value,count:document.getElementById("teamPreview").children.length};}
  throw new Error(document.getElementById("teamStatus").textContent);
 })()`);
 if(save.count!==3)throw new Error("Multiple image/background preview failed");
 console.log("PROFILE_SAVED="+JSON.stringify(save));
 await send("Page.reload",{ignoreCache:true});await wait(1800);
 const persisted=await evaluate("Array.from(document.querySelector('#teamProfile').options).some(o=>o.textContent==='TEST virtual team validation')");
 if(!persisted)throw new Error("Profile persistence failed");
 await evaluate("document.querySelector('#teamProfile').value="+JSON.stringify(save.id)+";document.querySelector('#teamProfile').dispatchEvent(new Event('change'));document.querySelector('#consent').checked=true;document.querySelector('#connect').click();true");
 await wait(1500);
 const blocked=await evaluate("({message:document.querySelector('#sessionMessage').textContent,source:!!document.querySelector('#localVideo').srcObject,output:!!document.querySelector('#remoteVideo').srcObject})");
 if(blocked.source||blocked.output||!blocked.message.includes("Full-body call setup incomplete"))throw new Error("Unavailable engine did not fail closed");
 console.log("BLOCKED_OUTPUT="+JSON.stringify(blocked));
 await evaluate("document.querySelector('#deleteTeam').click();true");await wait(700);
 console.log("TEST_PROFILE_REMOVED="+await evaluate("!Array.from(document.querySelector('#teamProfile').options).some(o=>o.textContent==='TEST virtual team validation')"));
}finally{ws.close();}
