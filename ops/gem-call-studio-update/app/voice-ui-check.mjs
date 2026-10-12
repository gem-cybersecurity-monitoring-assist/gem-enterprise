// Run only in the dedicated local test browser, with real audio devices.
// Produces a synthetic tone; it does not capture the physical microphone.
const port=Number(process.env.GEM_TEST_CDP_PORT||9226);
const origin="http://127.0.0.1:8765";
async function connect(url){
 const ws=new WebSocket(url);let sequence=0;const pending=new Map();
 await new Promise((r,j)=>{ws.addEventListener("open",r,{once:true});ws.addEventListener("error",j,{once:true});});
 ws.addEventListener("message",e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);});
 return {send:(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error("Timed out: "+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));}),close:()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error("Closed"));}pending.clear();ws.close();}};
}
async function evaluate(client,expression){const r=await client.send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true,timeout:25000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const version=await fetch(`http://127.0.0.1:${port}/json/version`).then(r=>r.json());
const browser=await connect(version.webSocketDebuggerUrl),targets=[],clients=[];
async function page(){const {targetId}=await browser.send("Target.createTarget",{url:origin+"/"});targets.push(targetId);let info;
 for(let n=0;n<30;n++){const pages=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());info=pages.find(p=>p.id===targetId);if(info?.webSocketDebuggerUrl)break;await wait(200);}
 if(!info?.webSocketDebuggerUrl)throw new Error("Test tab unavailable");
 const c=await connect(info.webSocketDebuggerUrl);clients.push(c);
 for(let n=0;n<60;n++){if(await evaluate(c,"location.origin === '"+origin+"' && document.readyState === 'complete'"))return c;await wait(250);}throw new Error("Studio page did not load");
}
try {
 await browser.send("Browser.grantPermissions",{origin,permissions:["audioCapture"]});
 const client=await page();
 const result=await evaluate(client,`(async()=>{
 const q=id=>document.getElementById(id);
 for(let n=0;n<60&&!q("localVoicePreset")?.options.length;n++)await new Promise(r=>setTimeout(r,250));
 let output;
 document.addEventListener("gem-processed-voice-ready",e=>{output=e.detail.stream;},{once:true});
 q("localVoicePreset").value="deep";q("localVoicePreset").dispatchEvent(new Event("change"));
 q("startLocalVoice").click();
 for(let n=0;n<80;n++){
  await new Promise(r=>setTimeout(r,250));
  if(q("voiceRouteStatus").dataset.state==="connected")break;
  if(!q("startLocalVoice").disabled)throw new Error(q("localVoiceStatus").textContent);
 }
 if(q("voiceRouteStatus").dataset.state!=="connected")throw new Error(q("voiceRouteStatus").textContent);
 const started={preset:q("localVoicePreset").value,route:q("voiceRouteStatus").dataset.state,output:output?.getAudioTracks()[0].readyState,status:q("voiceRouteStatus").textContent};
 q("stopLocalVoice").click();
 for(let n=0;n<40&&q("startLocalVoice").disabled;n++)await new Promise(r=>setTimeout(r,100));
 if(output?.getAudioTracks()[0].readyState!=="ended"||q("startLocalVoice").disabled)throw new Error("Stop did not release processed audio");
 return {started,stopped:true};
})()`);
 console.log("VOICE_UI_PASS="+JSON.stringify(result));
} finally {
 for(const c of clients){try{await evaluate(c,"document.getElementById('stopLocalVoice')?.click();true");}catch{}c.close();}
 for(const targetId of targets){try{await browser.send("Target.closeTarget",{targetId});}catch{}}
 browser.close();
}

