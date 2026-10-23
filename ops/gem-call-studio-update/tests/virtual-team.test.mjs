import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProfile, assessFullBodyReadiness } from "../app/src/virtual-team.js";
const img = { type: "image/png", size: 10 };
const p = () => ({ name:"Support", images:[img,img], background:img, voiceSample:{type:"audio/wav",size:10}, authorized:true,fullBodyConfirmed:true });
test("accepts multiple full-body references and independent background/voice",()=> assert.equal(validateProfile(p()).images.length,2));
test("rejects missing authorization or full-body references",()=> {
  for(const change of [{authorized:false},{fullBodyConfirmed:false},{images:[]}]) assert.throws(()=>validateProfile({...p(),...change}));
});
test("rejects excessive files and unsupported image types",()=> {
  assert.throws(()=>validateProfile({...p(),images:Array(9).fill(img)}));
  assert.throws(()=>validateProfile({...p(),images:[{type:"image/svg+xml",size:10}]}));
  assert.throws(()=>validateProfile({...p(),voiceSample:{type:"audio/wav",size:16000000}}));
});
test("face-only or decorated-camera capability cannot pass full-body gate",()=> {
  const r=assessFullBodyReadiness(p(),{faceTracking:true});
  assert.equal(r.ready,false); assert.equal(r.missing.length,6);
});
test("all independently verified capabilities are required",()=> {
 const caps={fullBodyMotion:true,facialExpression:true,backgroundReplacement:true,customVoice:true,virtualMicrophone:true,actualCallVerified:true};
 assert.equal(assessFullBodyReadiness(p(),caps).ready,true);
 for(const key of Object.keys(caps)) assert.equal(assessFullBodyReadiness(p(),{...caps,[key]:false}).ready,false);
});

test("live voice app and independent scene can be chosen without profile audio/background uploads",()=>assert.equal(validateProfile({...p(),voiceSample:null,background:null}).name,"Support"));
