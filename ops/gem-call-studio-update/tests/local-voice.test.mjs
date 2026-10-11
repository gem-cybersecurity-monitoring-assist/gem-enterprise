import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {VOICE_PRESETS,normalizeVoice} from "../app/public/voice-select.js";
test("voice presets are bounded and customizable",()=>{
 assert.equal(Object.keys(VOICE_PRESETS).length,8);
 for(const p of Object.values(VOICE_PRESETS)){const n=normalizeVoice(p);assert.ok(n.pitch>=-7&&n.pitch<=7);}
 const n=normalizeVoice({pitch:200,gain:-5,bass:"bad",treble:Infinity});assert.deepEqual(n,{pitch:7,bass:0,treble:0,gain:0.2});
});
test("worklet processes audio continuously without NaN or unbounded samples",()=>{
 let Processor;
 const context={AudioWorkletProcessor:class{constructor(){this.port={};}},Float32Array,sampleRate:48000,registerProcessor:(_name,p)=>{Processor=p;}};
 vm.runInNewContext(fs.readFileSync(new URL("../app/public/voice-pitch-worklet.js",import.meta.url),"utf8"),context);
 const node=new Processor();node.port.onmessage({data:{ratio:0.75}});
 let energy=0;
 for(let b=0;b<100;b++){const input=Float32Array.from({length:128},(_,i)=>Math.sin((b*128+i)*2*Math.PI*440/48000)*0.4),out=new Float32Array(128);
  assert.equal(node.process([[input]],[[out]]),true);
  for(const x of out){assert.ok(Number.isFinite(x)&&Math.abs(x)<=1);energy+=x*x;}}
 assert.ok(energy>1);
 node.port.onmessage({data:{ratio:1}});const bad=Float32Array.from([Infinity,NaN,0.3]),out=new Float32Array(3);node.process([[bad]],[[out]]);assert.equal(out[0],0);assert.equal(out[1],0);assert.ok(Math.abs(out[2]-0.3)<0.0001);
});
