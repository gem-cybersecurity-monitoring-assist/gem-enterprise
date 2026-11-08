import { VoiceCallRouter } from "./voice-call-router.js?v=1";
export const VOICE_PRESETS = {
 natural:{label:"Natural · original pitch",pitch:0,bass:0,treble:0,gain:1},
 warm:{label:"Warm",pitch:-1,bass:4,treble:-2,gain:1},
 deep:{label:"Deep",pitch:-5,bass:5,treble:-3,gain:1},
 bright:{label:"Bright",pitch:3,bass:-2,treble:4,gain:1},
 soft:{label:"Soft",pitch:0,bass:1,treble:-4,gain:0.75},
 clear:{label:"Clear",pitch:0,bass:-2,treble:3,gain:1},
 low:{label:"Low dramatic",pitch:-7,bass:6,treble:-3,gain:1},
 custom:{label:"Custom controls",pitch:0,bass:0,treble:0,gain:1}
};
export function normalizeVoice(value={}) {
 const clamp=(v,low,high,fallback)=>Number.isFinite(Number(v))?Math.max(low,Math.min(high,Number(v))):fallback;
 return {pitch:clamp(value.pitch,-7,7,0),bass:clamp(value.bass,-8,8,0),treble:clamp(value.treble,-8,8,0),gain:clamp(value.gain,0.2,1.5,1)};
}
export class LocalVoiceProcessor {
 constructor({capture=constraints=>navigator.mediaDevices.getUserMedia(constraints)}={}){this.capture=capture;this.generation=0;this.state="idle";this.source=null;this.context=null;}
 async start(deviceId,controls) {
  if(this.state!=="idle")throw new Error("Stop the active voice test first.");
  this.state="starting";const generation=++this.generation;
  let source,context;
  try {
   source=await this.capture({audio:{deviceId:deviceId?{exact:deviceId}:undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});
   if(generation!==this.generation){source.getTracks().forEach(t=>t.stop());return;}
   if(source.getAudioTracks().some(t=>/CABLE Output|Voicemeeter|Voicemod/i.test(t.label))) {
    source.getTracks().forEach(t=>t.stop());
    if(deviceId)throw new Error("Choose your physical microphone to avoid an audio feedback loop.");
    const devices=await navigator.mediaDevices.enumerateDevices();
    const physical=devices.find(d=>d.kind==="audioinput"&&!["default","communications"].includes(d.deviceId)&&d.label&&!/CABLE|Voicemeeter|Voicemod|Virtual/i.test(d.label));
    if(!physical)throw new Error("Select your physical microphone in Microphone settings.");
    source=await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:physical.deviceId},echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});
    if(generation!==this.generation){source.getTracks().forEach(t=>t.stop());return;}
   }
   this.source=source;context=new AudioContext({latencyHint:"interactive"});this.context=context;
   await context.audioWorklet.addModule("/voice-pitch-worklet.js?v=1");
   if(generation!==this.generation){source.getTracks().forEach(t=>t.stop());await context.close();return;}
   this.input=context.createMediaStreamSource(source);
   this.pitch=new AudioWorkletNode(context,"gem-pitch",{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:"explicit"});
   this.bass=context.createBiquadFilter();this.bass.type="lowshelf";this.bass.frequency.value=220;
   this.treble=context.createBiquadFilter();this.treble.type="highshelf";this.treble.frequency.value=2200;
   this.gain=context.createGain();this.limit=context.createDynamicsCompressor();
   this.limit.threshold.value=-10;this.limit.knee.value=8;this.limit.ratio.value=8;this.limit.attack.value=0.003;this.limit.release.value=0.15;
   this.analyser=context.createAnalyser();this.analyser.fftSize=256;
   this.output=context.createMediaStreamDestination();this.monitor=context.createGain();this.monitor.gain.value=0;
   this.input.connect(this.pitch).connect(this.bass).connect(this.treble).connect(this.gain).connect(this.limit).connect(this.analyser);
   this.analyser.connect(this.output);this.analyser.connect(this.monitor).connect(context.destination);
   this.update(controls);await context.resume();
   if(generation!==this.generation)return;
   this.state="live";source.getAudioTracks().forEach(track=>track.addEventListener("ended",()=>this.onSourceEnded?.(),{once:true}));return this.output.stream;
  }catch(error){if(generation===this.generation)await this.stop();else{source?.getTracks().forEach(t=>t.stop());if(context?.state!=="closed")await context?.close();}throw error;}
 }
 update(value){const v=normalizeVoice(value);if(!this.context||!this.pitch)return;const t=this.context.currentTime;
  this.pitch.port.postMessage({ratio:2**(v.pitch/12)});
  this.bass.gain.setTargetAtTime(v.bass,t,0.02);this.treble.gain.setTargetAtTime(v.treble,t,0.02);this.gain.gain.setTargetAtTime(v.gain,t,0.02);
 }
 listen(on){if(this.monitor)this.monitor.gain.setTargetAtTime(on?0.3:0,this.context.currentTime,0.02);}
 async stop(){++this.generation;this.state="stopping";this.source?.getTracks().forEach(t=>t.stop());this.output?.stream.getTracks().forEach(t=>t.stop());
  this.monitor?.disconnect();try{if(this.context?.state!=="closed")await this.context?.close();}finally{this.source=null;this.context=null;this.pitch=null;this.state="idle";}}
}
export function initVoiceSelector() {
 const $=id=>document.getElementById(id);if(!$("localVoicePreset"))return;
 const processor=new LocalVoiceProcessor();
 const routeStatus=$("voiceRouteStatus");
 const router=new VoiceCallRouter({onStatus:value=>{
  routeStatus.textContent=value.state==="connected"?"Voice output connected. Select CABLE Output (VB-Audio Virtual Cable) as the microphone in your calling app.":value.message||"Voice output stopped.";
  routeStatus.dataset.state=value.state;
 }});
 async function routeVoice(){
  if(!$("routeVoiceToCalls").checked){router.stop();routeStatus.textContent="Preview only. Call output is off.";routeStatus.dataset.state="idle";return;}
  if(processor.state!=="live")return;
  routeStatus.textContent="Connecting voice output…";routeStatus.dataset.state="connecting";
  try{await router.connect(processor.output.stream);}catch(e){routeStatus.textContent=e.message;routeStatus.dataset.state="idle";}
 }
 $("routeVoiceToCalls").onchange=()=>{void routeVoice();};
 let settings={preset:"natural",...normalizeVoice()},meterTimer=null;
 try{settings={...settings,...JSON.parse(localStorage.getItem("gem-local-voice-v1")||"{}"),...normalizeVoice(JSON.parse(localStorage.getItem("gem-local-voice-v1")||"{}"))};}catch{}
 const select=$("localVoicePreset");Object.entries(VOICE_PRESETS).forEach(([id,p])=>select.add(new Option(p.label,id)));
 select.value=VOICE_PRESETS[settings.preset]?settings.preset:"custom";
 const controls=()=>normalizeVoice(Object.fromEntries(["pitch","bass","treble","gain"].map(k=>[k,$("voice-"+k).value])));
 function sync(v){for(const k of ["pitch","bass","treble","gain"]){$("voice-"+k).value=v[k];$("voice-"+k+"-value").textContent=String(v[k]);}}
 function update(){const v=controls();sync(v);settings={...settings,...v,preset:select.value};processor.update(v);}
 sync(settings);
 select.onchange=()=>{sync(VOICE_PRESETS[select.value]);update();};
 for(const k of ["pitch","bass","treble","gain"])$("voice-"+k).oninput=()=>{select.value="custom";update();};
 $("saveLocalVoice").onclick=()=>{try{localStorage.setItem("gem-local-voice-v1",JSON.stringify({...settings,...controls()}));$("localVoiceStatus").textContent="Voice settings saved on this browser.";}catch{$("localVoiceStatus").textContent="Voice settings could not be saved.";}};
 $("scanLocalMics").onclick=async()=>{let mic;try{mic=await navigator.mediaDevices.getUserMedia({audio:true,video:false});const devices=await navigator.mediaDevices.enumerateDevices();
  const choice=$("localVoiceMic");choice.replaceChildren(new Option("System microphone",""));devices.filter(d=>d.kind==="audioinput"&&!["default","communications"].includes(d.deviceId)).forEach(d=>choice.add(new Option(d.label||"Microphone",d.deviceId)));
 }catch(e){$("localVoiceStatus").textContent="Microphone detection failed: "+e.message;}finally{mic?.getTracks().forEach(t=>t.stop());}};
 $("startLocalVoice").onclick=async()=>{const button=$("startLocalVoice");button.disabled=true;$("localVoiceStatus").textContent="Starting local voice processing…";
  try{const stream=await processor.start($("localVoiceMic").value,controls());if(!stream)return;
   processor.listen($("listenLocalVoice").checked);
   document.dispatchEvent(new CustomEvent("gem-processed-voice-ready",{detail:{stream,source:"local-dsp",callRoutingVerified:false}}));
   $("localVoiceStatus").textContent="LIVE · selected pitch and tone are active.";
   await routeVoice();
   if(processor.state!=="live")return;
   meterTimer=setInterval(()=>{if(!processor.analyser)return;const data=new Uint8Array(128);processor.analyser.getByteTimeDomainData(data);let energy=0;for(const x of data)energy+=(x-128)**2;$("localVoiceMeter").value=Math.min(100,Math.sqrt(energy/data.length)*4);},100);
  }catch(e){$("localVoiceStatus").textContent="Voice preview failed: "+e.message;button.disabled=false;}
 };
 $("stopLocalVoice").onclick=async()=>{clearInterval(meterTimer);router.stop();routeStatus.textContent="Voice output stopped.";routeStatus.dataset.state="idle";await processor.stop();$("localVoiceMeter").value=0;$("startLocalVoice").disabled=false;$("localVoiceStatus").textContent="Voice preview stopped; microphone released.";
  document.dispatchEvent(new CustomEvent("gem-processed-voice-stopped"));};
 $("listenLocalVoice").onchange=()=>processor.listen($("listenLocalVoice").checked);
 processor.onSourceEnded=()=>{void $("stopLocalVoice").onclick();};
 window.addEventListener("beforeunload",()=>{clearInterval(meterTimer);router.dispose();void processor.stop();});
}
if(typeof document!=="undefined")initVoiceSelector();

