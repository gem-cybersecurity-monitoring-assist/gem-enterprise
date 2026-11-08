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
async function page(){const {targetId}=await browser.send("Target.createTarget",{url:origin+"/styles.css"});targets.push(targetId);let info;
 for(let n=0;n<30;n++){const pages=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());info=pages.find(p=>p.id===targetId);if(info?.webSocketDebuggerUrl)break;await wait(200);}
 if(!info?.webSocketDebuggerUrl)throw new Error("Test tab unavailable");
 const c=await connect(info.webSocketDebuggerUrl);clients.push(c);
 for(let n=0;n<60;n++){if(await evaluate(c,"location.origin === '"+origin+"' && document.readyState === 'complete'"))return c;await wait(250);}throw new Error("Studio page did not load");
}
try{
 await browser.send("Browser.grantPermissions",{origin,permissions:["audioCapture"]});
 const producer=await page(),receiver=await page();
 console.log("TEST_CLIENTS_READY");
 const receiving=await evaluate(receiver,`(async()=>{
  const devices=await navigator.mediaDevices.enumerateDevices();
  const cable=devices.find(d=>d.kind==='audioinput'&&!['default','communications'].includes(d.deviceId)&&/^CABLE Output \\(VB-Audio Virtual Cable\\)$/i.test(d.label));
  if(!cable)throw new Error('Real VB-CABLE recording endpoint missing');
  window.gemReceive={stream:await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:cable.deviceId},echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false})};
  const r=window.gemReceive;r.context=new AudioContext({sampleRate:48000});r.input=r.context.createMediaStreamSource(r.stream);r.analyser=r.context.createAnalyser();r.analyser.fftSize=8192;r.analyser.smoothingTimeConstant=0;r.input.connect(r.analyser);await r.context.resume();
  return {device:cable.label,track:r.stream.getAudioTracks()[0].readyState};
 })()`);
 console.log("RECEIVER="+JSON.stringify(receiving));
 const sending=await evaluate(producer,`(async()=>{
  const {LocalVoiceProcessor}=await import('/voice-select.js?v=voice-routing-2');
  const {VoiceCallRouter}=await import('/voice-call-router.js?v=1');
  const context=new AudioContext({sampleRate:48000});const oscillator=context.createOscillator();oscillator.frequency.value=440;
  const volume=context.createGain();volume.gain.value=0.12;const source=context.createMediaStreamDestination();oscillator.connect(volume).connect(source);oscillator.start();await context.resume();
  const processor=new LocalVoiceProcessor({capture:async()=>source.stream});const router=new VoiceCallRouter();
  window.gemSend={context,oscillator,processor,router};
  const stream=await processor.start('',{pitch:0,bass:0,treble:0,gain:1});processor.analyser.fftSize=8192;processor.analyser.smoothingTimeConstant=0;const route=await router.connect(stream);
  return {route,processor:processor.state};
 })()`);
 console.log("PRODUCER="+JSON.stringify(sending));
 async function measure(client=receiver,source="gemReceive"){await wait(2500);return evaluate(client,`(()=>{const r=${source},d=new Float32Array(r.analyser.frequencyBinCount);r.analyser.getFloatFrequencyData(d);const resolution=r.context.sampleRate/r.analyser.fftSize;let peak=-Infinity,index=0;for(let i=Math.ceil(200/resolution);i<Math.floor(700/resolution);i++){if(d[i]>peak){peak=d[i];index=i;}}return {frequency:index*resolution,db:Number.isFinite(peak)?peak:-999,rate:r.context.sampleRate,state:r.context.state,time:r.context.currentTime};})()`);}
 console.log("PROCESSOR_NATURAL="+JSON.stringify(await measure(producer,"gemSend.processor")));
 const natural=await measure();console.log("NATURAL="+JSON.stringify(natural));
 if(Math.abs(natural.frequency-440)>25||natural.db<-55)throw new Error("Natural tone did not reach the separate receiving client");
 await evaluate(producer,"gemSend.processor.update({pitch:-5,bass:0,treble:0,gain:1});true");
 console.log("PROCESSOR_DEEP="+JSON.stringify(await measure(producer,"gemSend.processor")));
 const deep=await measure();console.log("DEEP="+JSON.stringify(deep));
 if(Math.abs(deep.frequency-440*Math.pow(2,-5/12))>35||deep.db<-55)throw new Error("Changed pitch was not received through the Windows cable");
 await evaluate(producer,"gemSend.router.stop();gemSend.processor.stop().then(()=>true)");
 const stopped=await measure();console.log("STOPPED="+JSON.stringify(stopped));
 if(stopped.db>-65)throw new Error("Call microphone did not become silent on stop");
 console.log("WINDOWS_VOICE_LOOPBACK_PASS: synthetic tone through processor, Windows cable, separate receiving client; pitch change and silence verified. External meeting application untested.");
}finally{
 for(const c of clients){try{await evaluate(c,`(async()=>{if(window.gemSend){gemSend.router.dispose();await gemSend.processor.stop();gemSend.oscillator.stop();await gemSend.context.close();}if(window.gemReceive){gemReceive.stream.getTracks().forEach(t=>t.stop());await gemReceive.context.close();}return true;})()`);}catch{}c.close();}
 for(const targetId of targets){try{await browser.send("Target.closeTarget",{targetId});}catch{}}
 browser.close();
}
