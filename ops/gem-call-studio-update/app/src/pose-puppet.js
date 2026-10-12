// GEM Virtual Team: explicit LOCAL 2D motion demo, not photorealistic avatar generation.
// A failed segmentation/tracking check shows no physical camera frame to the caller.
export const poseDistance = (a,b) => Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));
export const within = (x,lo,hi) => Math.min(hi,Math.max(lo,x));
export function visibleBody(pose){
  return !!pose && [11,12,23,24].every(i => pose[i] && (pose[i].visibility??1) > 0.35);
}
const JOINTS=[[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28]];
const POSE_MODEL="/models/pose_landmarker_lite.task";
const WASM="/vendor/mediapipe/wasm";
const pxy=(p,i,w,h)=>({x:p[i].x*w,y:p[i].y*h});
function skinFromMask(bitmap,mask) {
  if (!mask) throw new Error("Person segmentation unavailable; cannot remove source background.");
  const {width,height}=mask;
  const floats=mask.getAsFloat32Array();
  if(!floats?.length||floats.length!==width*height) throw new Error("Person segmentation mask invalid.");
  const cutout=document.createElement("canvas");cutout.width=bitmap.width;cutout.height=bitmap.height;
  const ctx=cutout.getContext("2d");ctx.drawImage(bitmap,0,0);
  const alpha=document.createElement("canvas");alpha.width=width;alpha.height=height;
  const ac=alpha.getContext("2d"),im=ac.createImageData(width,height);
  for(let i=0;i<floats.length;i++){
    im.data[4*i]=im.data[4*i+1]=im.data[4*i+2]=255;
    im.data[4*i+3]=Math.round(255*within((floats[i]-0.3)*3.5,0,1));
  }
  ac.putImageData(im,0,0);
  ctx.globalCompositeOperation="destination-in";ctx.drawImage(alpha,0,0,bitmap.width,bitmap.height);
  ctx.globalCompositeOperation="source-over";
  return cutout;
}
function drawScene(ctx,bg,w,h) {
  const aw=bg?.videoWidth||bg?.naturalWidth||0,ah=bg?.videoHeight||bg?.naturalHeight||0;
  if(aw&&ah){
    const scale=Math.max(w/aw,h/ah),dw=aw*scale,dh=ah*scale;
    ctx.drawImage(bg,(w-dw)/2,(h-dh)/2,dw,dh);return;
  }
  const gradient=ctx.createLinearGradient(0,0,w,h);
  gradient.addColorStop(0,"#0b223a");gradient.addColorStop(1,"#4d6175");
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
}
function drawSegment(ctx,img,a,b,toA,toB,thick) {
  const sl=poseDistance(a,b),tl=poseDistance(toA,toB);
  if(sl<2||tl<2) return;
  const angle=Math.atan2(b.y-a.y,b.x-a.x);
  ctx.save();ctx.translate(toA.x,toA.y);
  ctx.rotate(Math.atan2(toB.y-toA.y,toB.x-toA.x)-angle);
  ctx.scale(within(tl/sl,.70,1.45),1);ctx.translate(-a.x,-a.y);
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(angle);
  ctx.beginPath();ctx.roundRect(-thick/2,-thick/2,sl+thick,thick,thick/2);
  ctx.clip();ctx.rotate(-angle);ctx.translate(-a.x,-a.y);
  ctx.drawImage(img,0,0);ctx.restore();ctx.restore();
}
function drawCharacter(ctx,image,pose,live) {
  const w=image.width,h=image.height;
  const indices=[0,7,8,11,12,23,24,27,28];
  const all=indices.map(i=>pxy(pose,i,w,h));
  const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x));
  const minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));
  const factor=Math.min(460/Math.max(120,maxY-minY),400/Math.max(100,maxX-minX));
  const bx=480-(minX+maxX)*factor/2,by=282-(minY+maxY)*factor/2;
  const r11=pxy(pose,11,w,h),r12=pxy(pose,12,w,h);
  const shoulderWidth=Math.max(15,poseDistance(r11,r12));
  const liveCenter={x:(live[11].x+live[12].x)/2,y:(live[11].y+live[12].y)/2};
  const liveSpan=Math.max(0.025,poseDistance(live[11],live[12]));
  const referenceCenter={x:(r11.x+r12.x)/2,y:(r11.y+r12.y)/2};
  function destination(i) {
    const p=pxy(pose,i,w,h),l=live[i];
    if(!l||(l.visibility??1)<0.35) return p;
    return {
      x:p.x+within(((l.x-liveCenter.x)/liveSpan-(p.x-referenceCenter.x)/shoulderWidth)*shoulderWidth*.8,-shoulderWidth*1.4,shoulderWidth*1.4),
      y:p.y+within(((l.y-liveCenter.y)/liveSpan-(p.y-referenceCenter.y)/shoulderWidth)*shoulderWidth*.8,-shoulderWidth*1.4,shoulderWidth*1.4)
    };
  }
  ctx.save();ctx.translate(bx,by);ctx.scale(factor,factor);
  const p23=pxy(pose,23,w,h),p24=pxy(pose,24,w,h),pad=shoulderWidth*.2;
  ctx.save();ctx.beginPath();ctx.moveTo(r11.x-pad,r11.y-pad);
  ctx.lineTo(r12.x+pad,r12.y-pad);ctx.lineTo(p24.x+pad,p24.y+pad);
  ctx.lineTo(p23.x-pad,p23.y+pad);ctx.closePath();ctx.clip();
  ctx.drawImage(image,0,0);ctx.restore();
  const head=pxy(pose,0,w,h);
  const headDx=(destination(11).x+destination(12).x-r11.x-r12.x)*.3;
  const headDy=(destination(11).y+destination(12).y-r11.y-r12.y)*.3;
  ctx.save();ctx.translate(headDx,headDy);ctx.beginPath();
  ctx.ellipse(head.x,head.y-shoulderWidth*.12,shoulderWidth*.58,shoulderWidth*.85,0,0,Math.PI*2);
  ctx.clip();ctx.drawImage(image,0,0);ctx.restore();
  for(const [a,b] of JOINTS)drawSegment(ctx,image,pxy(pose,a,w,h),pxy(pose,b,w,h),destination(a),destination(b),shoulderWidth*(a>=23?.42:.32));
  ctx.restore();
}
export async function createBodyPuppetProcessor({sourceVideo,referenceFile,backgroundFile,onTrackingChange=()=>{}}) {
  if(!sourceVideo||!referenceFile) throw new Error("Choose a saved full-body reference.");
  const moduleUrl="/vendor/mediapipe/vision_bundle.mjs";
  const {FilesetResolver,PoseLandmarker}=await import(moduleUrl);
  const vision=await FilesetResolver.forVisionTasks(WASM);
  const model={modelAssetPath:POSE_MODEL,delegate:"CPU"};
  let reference=null,tracker=null,bitmap=null,asset=null,assetUrl=null,stream=null;
  try {
    [reference,tracker,bitmap]=await Promise.all([
      PoseLandmarker.createFromOptions(vision,{baseOptions:model,runningMode:"IMAGE",numPoses:1,outputSegmentationMasks:true}),
      PoseLandmarker.createFromOptions(vision,{baseOptions:model,runningMode:"VIDEO",numPoses:1,outputSegmentationMasks:false}),
      createImageBitmap(referenceFile)
    ]);
    const result=reference.detect(bitmap);
    const pose=result.landmarks?.[0];
    if(!visibleBody(pose)||!pose[27]||!pose[28])
      throw new Error("Reference photo needs one person, with the body and feet visible.");
    const image=skinFromMask(bitmap,result.segmentationMasks?.[0]);
    reference.close();reference=null;bitmap.close();bitmap=null;
    if(backgroundFile) {
      assetUrl=URL.createObjectURL(backgroundFile);
      if(backgroundFile.type.startsWith("video/")){
        asset=document.createElement("video");asset.src=assetUrl;asset.loop=true;asset.muted=true;asset.playsInline=true;
        asset.play().catch(()=>{});
      } else {
        asset=new Image();asset.src=assetUrl;await asset.decode();
      }
    }
    const inferenceCanvas=document.createElement("canvas");
    inferenceCanvas.width=320;inferenceCanvas.height=180;
    const inferenceContext=inferenceCanvas.getContext("2d",{alpha:false});
    const canvas=document.createElement("canvas");
    canvas.width=960;canvas.height=540;
    const ctx=canvas.getContext("2d",{alpha:false,desynchronized:true});
    stream=canvas.captureStream(20);
    let raf=0,stopped=false,at=0,lastSeen=0,lastPaint=0,live=null,lastState=false;
    const track=(state)=>{if(state!==lastState){lastState=state;onTrackingChange(state);}};
    function render(t) {
      if(stopped)return;
      raf=requestAnimationFrame(render);
      if(t-lastPaint<45)return;
      lastPaint=t;
      if(sourceVideo.readyState>=2 && t-at>=130) {
        at=t;
        try{
          inferenceContext.drawImage(sourceVideo,0,0,320,180);
          const next=tracker.detectForVideo(inferenceCanvas,t).landmarks?.[0];
          if(visibleBody(next)){live=next;lastSeen=t;}
        }catch {live=null;}
      }
      const tracked=!!(live&&t-lastSeen<900);
      track(tracked);
      if(tracked) {
        drawScene(ctx,asset,960,540);
        drawCharacter(ctx,image,pose,live);
      } else {
        ctx.fillStyle="#071522";ctx.fillRect(0,0,960,540);
        ctx.fillStyle="#ffffff";ctx.font="24px Segoe UI";
        ctx.textAlign="center";ctx.fillText("BODY TRACKING WAIT · CAMERA PRIVATE",480,278);ctx.textAlign="left";
      }
      ctx.fillStyle="#051c31ed";ctx.fillRect(0,0,960,45);
      ctx.font="bold 18px Segoe UI";ctx.fillStyle="#ffbf00";
      ctx.fillText("GEM VIRTUAL PRESENTER · 2D MOTION DEMO",20,29);
    }
    raf=requestAnimationFrame(render);
    return {stream,stop() {
      stopped=true;cancelAnimationFrame(raf);track(false);
      stream.getTracks().forEach(t=>t.stop());tracker.close();
      if(asset?.tagName==="VIDEO"){asset.pause();asset.removeAttribute("src");asset.load();}
      if(assetUrl)URL.revokeObjectURL(assetUrl);
    }};
  }catch(error) {
    reference?.close();tracker?.close();bitmap?.close();
    if(assetUrl)URL.revokeObjectURL(assetUrl);
    stream?.getTracks().forEach(t=>t.stop());
    throw error;
  }
}
