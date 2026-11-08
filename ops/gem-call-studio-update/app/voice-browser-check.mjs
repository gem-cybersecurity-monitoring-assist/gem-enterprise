const pages=await fetch("http://127.0.0.1:9224/json").then(r=>r.json());
const page=pages.find(p=>p.type==="page"&&p.url.startsWith("http://127.0.0.1:8765/"));
if(!page)throw new Error("Voice test page missing");const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r,j)=>{ws.addEventListener("open",r,{once:true});ws.addEventListener("error",j,{once:true});});
let id=0;const pending=new Map();
ws.addEventListener("message",e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.j(new Error(m.error.message)):p.r(m.result);}});
function send(method,params={}){return new Promise((r,j)=>{const n=++id;pending.set(n,{r,j});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try {
 for(let n=0;n<40;n++){await wait(250);if(await evaluate("document.querySelector('#localVoicePreset')?.options.length===8"))break;}
 await evaluate("document.addEventListener('gem-processed-voice-ready',e=>{window.voiceTestOutput=e.detail;});document.querySelector('#localVoicePreset').value='deep';document.querySelector('#localVoicePreset').dispatchEvent(new Event('change'));document.querySelector('#saveLocalVoice').click();document.querySelector('#startLocalVoice').click();true");
 for(let n=0;n<60;n++){await wait(200);const status=await evaluate("document.querySelector('#localVoiceStatus').textContent");if(status.startsWith("Voice preview failed"))throw new Error(status);if(status.startsWith("LIVE"))break;}
 const live=await evaluate("({status:document.querySelector('#localVoiceStatus').textContent,track:window.voiceTestOutput?.stream?.getAudioTracks()[0]?.readyState,callRouting:window.voiceTestOutput?.callRoutingVerified,listen:document.querySelector('#listenLocalVoice').checked,pitch:document.querySelector('#voice-pitch').value})");
 if(live.track!=="live"||live.listen!==false||live.callRouting!==false||live.pitch!=="-5")throw new Error("Voice audio pipeline failed");
 console.log("VOICE_LIVE="+JSON.stringify(live));
 await evaluate("document.querySelector('#voice-pitch').value='3';document.querySelector('#voice-pitch').dispatchEvent(new Event('input'));document.querySelector('#stopLocalVoice').click();true");await wait(500);
 const stopped=await evaluate("({status:document.querySelector('#localVoiceStatus').textContent,track:window.voiceTestOutput.stream.getAudioTracks()[0].readyState})");
 if(stopped.track!=="ended")throw new Error("Audio track not released");console.log("VOICE_STOP="+JSON.stringify(stopped));
 await send("Page.reload",{ignoreCache:true});await wait(1200);
 const restored=await evaluate("({preset:document.querySelector('#localVoicePreset').value,pitch:document.querySelector('#voice-pitch').value})");
 if(restored.preset!=="deep"||restored.pitch!=="-5")throw new Error("Saved preset not restored");
 console.log("VOICE_PRESET_RESTORED="+JSON.stringify(restored));
}finally{ws.close();}
