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
 await send("Page.reload",{ignoreCache:true});
 let status;
 for(let n=0;n<100;n++){await wait(300);status=await evaluate("({gate:document.querySelector('#gateList')?.textContent?.includes('Running · verified automatically'),camera:document.querySelector('#obsCameraState')?.textContent})");if(status?.gate)break;}
 console.log("OBS_GATE="+JSON.stringify(status));
 if(!status?.gate)throw new Error("OBS gate not verified in browser");
}finally{ws.close();}
